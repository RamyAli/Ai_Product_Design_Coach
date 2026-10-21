import type { CriterionStatus, Decision, DeliverableStatus, Locale, Severity, Strictness } from "./enums";
import { lt } from "./localized";
import type {
  DecisionReason,
  EvidenceManifestEntry,
  EvidenceRef,
  ModelReviewOutput,
  ReviewCriterionResult,
  ReviewDeliverableResult,
  ReviewRevisionTask,
  StoredReview,
} from "./review";
import type { CriterionDef, DeliverableDef } from "./stages/types";

/** Stage rubric as snapshotted on the project's stage row. */
export interface StageRubric {
  passThreshold: number;
  criteria: CriterionDef[];
  deliverables: DeliverableDef[];
}

/** What the reviewer was actually able to see. Built by the evaluation service, not the model. */
export interface EvidenceContext {
  manifest: EvidenceManifestEntry[];
  /** Searchable text per manifest ref, used to verify quoted excerpts */
  textByRef: Record<string, string>;
  /** Page count per PDF ref, used to validate page locators */
  pageCountByRef: Record<string, number>;
  /** At least one image, readable PDF or accessible design file reached the reviewer */
  visualEvidenceAvailable: boolean;
  /** The user supplied visual sources that could not be read (failed upload, inaccessible Figma, scanned PDF without vision) */
  visualSourcesUnavailable: boolean;
  /** Upper bound on confidence derived from processing failures */
  confidenceCap: number;
  /** Limitations detected by code (failed files, truncation, capability gaps) */
  codeLimitations: string[];
}

export const STRICTNESS_THRESHOLD_ADJUSTMENT: Record<Strictness, number> = {
  supportive: 0,
  standard: 0,
  demanding: 5,
};

export const LOW_CONFIDENCE_THRESHOLD = 35;
export const MIN_EVALUABLE_WEIGHT = 50;

/** Score ceilings by status so that, e.g., a merely mentioned artifact cannot earn full credit. */
const STATUS_CAP: Record<CriterionStatus, number> = {
  met: 100,
  partial: 84,
  not_met: 59,
  missing: 20,
  not_evaluable: 0,
};

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function validateWeights(criteria: CriterionDef[]): string[] {
  const errors: string[] = [];
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (total !== 100) errors.push(`weights sum to ${total}, expected 100`);
  for (const c of criteria) {
    if (!Number.isInteger(c.weight) || c.weight <= 0) errors.push(`criterion ${c.id} has invalid weight ${c.weight}`);
  }
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length) errors.push("duplicate criterion ids");
  return errors;
}

export function criterionSeverity(c: { status: CriterionStatus; mandatory: boolean; score: number | null }): Severity | null {
  if (c.status === "not_evaluable") return null;
  if (c.status === "missing") return c.mandatory ? "critical" : "major";
  if (c.status === "not_met") return c.mandatory ? "critical" : "major";
  if (c.status === "partial") return (c.score ?? 0) < 60 ? "major" : "minor";
  return (c.score ?? 100) < 80 ? "suggestion" : null;
}

/** Weighted mean over evaluable criteria using rubric weights only. */
export function computeWeightedScore(results: Pick<ReviewCriterionResult, "weight" | "score">[]): {
  overall: number;
  evaluatedWeight: number;
} {
  let weighted = 0;
  let weight = 0;
  for (const r of results) {
    if (r.score === null) continue;
    weighted += r.score * r.weight;
    weight += r.weight;
  }
  return { overall: weight === 0 ? 0 : Math.round(weighted / weight), evaluatedWeight: weight };
}

function normalizeQuote(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Drops references to evidence that does not exist, invalid page numbers and quotes
 * that do not appear in the referenced text. Returns the cleaned refs and a count of removals.
 */
export function sanitizeEvidenceRefs(refs: EvidenceRef[], ctx: EvidenceContext): { refs: EvidenceRef[]; removed: number } {
  const known = new Map(ctx.manifest.map((m) => [m.ref, m]));
  const out: EvidenceRef[] = [];
  let removed = 0;
  for (const r of refs) {
    const entry = known.get(r.ref.trim());
    if (!entry || !entry.available) {
      removed++;
      continue;
    }
    let locator = r.locator.trim();
    const pageCount = ctx.pageCountByRef[entry.ref];
    if (pageCount && locator) {
      const pages = [...locator.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (/p(age)?\.?\s*\d|صفحة/i.test(locator) && pages.some((p) => p < 1 || p > pageCount)) {
        locator = "";
        removed++;
      }
    }
    let quote = r.quote.trim();
    if (quote) {
      const source = ctx.textByRef[entry.ref];
      if (!source || !normalizeQuote(source).includes(normalizeQuote(quote))) {
        // The reviewer may only quote text that actually exists in the submission.
        quote = "";
        removed++;
      }
    }
    out.push({ ref: entry.ref, locator, quote });
  }
  return { refs: out, removed };
}

export interface FinalizeInput {
  rubric: StageRubric;
  output: ModelReviewOutput;
  evidence: EvidenceContext;
  strictness: Strictness;
  /** Language for code-synthesized text (the project's language) */
  language: Locale;
}

/**
 * Turns raw model output into the official review: applies status caps, evidence guards,
 * weighted scoring with rubric weights, mandatory gates and the final decision.
 * Pure and deterministic — the model never decides the score or the outcome.
 */
export function finalizeReview({ rubric, output, evidence, strictness, language }: FinalizeInput): StoredReview {
  const limitations = [...evidence.codeLimitations];
  let removedRefs = 0;
  const clean = (refs: EvidenceRef[]) => {
    const r = sanitizeEvidenceRefs(refs, evidence);
    removedRefs += r.removed;
    return r.refs;
  };

  // ----- Criteria -----
  const modelCriteria = new Map(output.criteria.map((c) => [c.criterionId, c]));
  const criteria: ReviewCriterionResult[] = rubric.criteria.map((def) => {
    const m = modelCriteria.get(def.id);
    const adjustments: string[] = [];
    if (!m) {
      return {
        id: def.id,
        name: def.name,
        weight: def.weight,
        mandatory: def.mandatory,
        minScore: def.minScore,
        score: null,
        rawScore: 0,
        maxScore: 100,
        status: "not_evaluable",
        severity: null,
        evidence: [],
        feedback: "",
        adjustments: ["reviewer_returned_no_result"],
      };
    }
    let status: CriterionStatus = m.status;
    const rawScore = clampScore(m.score);
    const refs = clean(m.evidence);

    // Visual criteria can only be met with visual evidence the reviewer could actually see.
    if (def.evidence === "visual" && !evidence.visualEvidenceAvailable && (status === "met" || status === "partial")) {
      if (evidence.visualSourcesUnavailable) {
        status = "not_evaluable";
        adjustments.push("visual_evidence_unavailable");
      } else {
        status = "missing";
        adjustments.push("visual_evidence_not_supplied");
      }
    }
    if (status === "met" && refs.length === 0 && m.evidence.length > 0) {
      // Every cited reference was invalid: treat the claim as unsupported.
      status = "partial";
      adjustments.push("evidence_references_invalid");
    }

    let score: number | null = rawScore;
    if (status === "not_evaluable") {
      score = null;
    } else if (score > STATUS_CAP[status]) {
      score = STATUS_CAP[status];
      adjustments.push(`capped_for_${status}`);
    }
    return {
      id: def.id,
      name: def.name,
      weight: def.weight,
      mandatory: def.mandatory,
      minScore: def.minScore,
      score,
      rawScore,
      maxScore: 100,
      status,
      severity: criterionSeverity({ status, mandatory: def.mandatory, score }),
      evidence: refs,
      feedback: m.feedback,
      adjustments,
    };
  });

  // ----- Deliverables -----
  const modelDeliverables = new Map(output.deliverables.map((d) => [d.deliverableId, d]));
  const deliverables: ReviewDeliverableResult[] = rubric.deliverables.map((def) => {
    const m = modelDeliverables.get(def.id);
    let status: DeliverableStatus = m?.status ?? "not_evaluable";
    if (
      def.evidence === "visual" &&
      !evidence.visualEvidenceAvailable &&
      (status === "provided" || status === "partial")
    ) {
      status = evidence.visualSourcesUnavailable ? "not_evaluable" : "missing";
    }
    return {
      id: def.id,
      title: def.title,
      mandatory: def.mandatory,
      status,
      evidence: m ? clean(m.evidence) : [],
      note: m?.note ?? "",
    };
  });

  const issues = output.issues.map((i) => ({ ...i, evidence: clean(i.evidence) }));
  const strengths = output.strengths.map((s) => ({ text: s.text, evidence: clean(s.evidence) }));
  if (removedRefs > 0) limitations.push(`removed_invalid_references:${removedRefs}`);

  // ----- Score -----
  const { overall, evaluatedWeight } = computeWeightedScore(criteria);

  // ----- Confidence -----
  const modelConfidence = clampScore(output.confidence);
  const notEvaluableWeight = criteria.filter((c) => c.score === null).reduce((s, c) => s + c.weight, 0);
  const confidence = Math.min(modelConfidence, evidence.confidenceCap, 100 - notEvaluableWeight);

  // ----- Decision -----
  const threshold = Math.min(100, rubric.passThreshold + STRICTNESS_THRESHOLD_ADJUSTMENT[strictness]);
  const evidenceBlockers: DecisionReason[] = [];
  const qualityBlockers: DecisionReason[] = [];

  for (const c of criteria) {
    if (!c.mandatory) continue;
    if (c.status === "not_evaluable") evidenceBlockers.push({ code: "mandatory_criterion_not_evaluable", criterionId: c.id });
    else if (c.status === "missing" || c.status === "not_met" || (c.score ?? 0) < c.minScore)
      qualityBlockers.push({ code: "mandatory_criterion_below_minimum", criterionId: c.id });
  }
  for (const d of deliverables) {
    if (!d.mandatory) continue;
    if (d.status === "not_evaluable") evidenceBlockers.push({ code: "mandatory_deliverable_not_evaluable", deliverableId: d.id });
    else if (d.status === "missing") qualityBlockers.push({ code: "mandatory_deliverable_missing", deliverableId: d.id });
  }
  if (evaluatedWeight < MIN_EVALUABLE_WEIGHT) evidenceBlockers.push({ code: "insufficient_evaluable_weight", detail: String(evaluatedWeight) });
  if (confidence < LOW_CONFIDENCE_THRESHOLD) evidenceBlockers.push({ code: "low_confidence", detail: String(confidence) });
  if (issues.some((i) => i.severity === "critical")) qualityBlockers.push({ code: "critical_issue_open" });
  if (overall < threshold) qualityBlockers.push({ code: "score_below_threshold", detail: `${overall}/${threshold}` });

  let decision: Decision;
  let decisionReasons: DecisionReason[];
  if (evidenceBlockers.length > 0) {
    decision = "needs_more_evidence";
    decisionReasons = [...evidenceBlockers, ...qualityBlockers];
  } else if (qualityBlockers.length > 0) {
    decision = "revise";
    decisionReasons = qualityBlockers;
  } else {
    decision = "pass";
    decisionReasons = [{ code: "all_requirements_met" }];
  }

  // ----- Revision tasks -----
  const revisionTasks: ReviewRevisionTask[] = output.revisionTasks.map((t) => ({ ...t, synthesized: false }));
  const coveredIssueIds = new Set(revisionTasks.map((t) => t.issueId));
  for (const issue of issues) {
    if ((issue.severity === "critical" || issue.severity === "major") && !coveredIssueIds.has(issue.id)) {
      const def = rubric.criteria.find((c) => c.id === issue.criterionId);
      revisionTasks.push({
        id: `auto-issue-${issue.id}`,
        issueId: issue.id,
        title: issue.title,
        description: issue.recommendation,
        reason: issue.impact,
        severity: issue.severity,
        criterionId: issue.criterionId,
        theme: def?.theme ?? "communication",
        suggestedAction: issue.recommendation,
        synthesized: true,
      });
    }
  }
  const missingDeliverables = deliverables.filter((d) => d.mandatory && d.status === "missing").map((d) => d.id);
  for (const id of missingDeliverables) {
    const def = rubric.deliverables.find((d) => d.id === id)!;
    const criterion = rubric.criteria.find((c) => c.deliverableIds.includes(id)) ?? rubric.criteria[0]!;
    const alreadyCovered = revisionTasks.some(
      (t) =>
        t.id.includes(id) ||
        ((t.severity === "critical" || t.severity === "major") &&
          rubric.criteria.find((c) => c.id === t.criterionId)?.deliverableIds.includes(id)),
    );
    if (!alreadyCovered) {
      revisionTasks.push({
        id: `auto-deliverable-${id}`,
        issueId: "",
        title: lt(def.title, language),
        description: lt(def.description, language),
        reason: "mandatory_deliverable_missing",
        severity: "critical",
        criterionId: criterion.id,
        theme: def.theme,
        suggestedAction: lt(def.description, language),
        synthesized: true,
      });
    }
  }

  return {
    schemaVersion: 1,
    summary: output.summary,
    overallScore: overall,
    decision,
    decisionReasons,
    threshold,
    confidence,
    modelConfidence,
    evaluatedWeight,
    criteria,
    deliverables,
    missingDeliverables,
    strengths,
    issues,
    assumptionsToValidate: output.assumptionsToValidate,
    revisionTasks,
    questionsForDesigner: output.questionsForDesigner,
    nextSteps: output.nextSteps,
    limitations: [...limitations, ...output.limitations],
    evidenceManifest: evidence.manifest,
    previousTaskAssessments: output.previousTaskAssessments,
    strictness,
  };
}

/** Structural checks the schema cannot express; failures trigger a controlled retry. */
export function checkModelOutputCompleteness(rubric: StageRubric, output: ModelReviewOutput): string[] {
  const problems: string[] = [];
  const ids = output.criteria.map((c) => c.criterionId);
  for (const c of rubric.criteria) {
    const count = ids.filter((id) => id === c.id).length;
    if (count === 0) problems.push(`missing result for criterion "${c.id}"`);
    if (count > 1) problems.push(`criterion "${c.id}" returned ${count} times`);
  }
  const dIds = output.deliverables.map((d) => d.deliverableId);
  for (const d of rubric.deliverables) {
    if (!dIds.includes(d.id)) problems.push(`missing status for deliverable "${d.id}"`);
  }
  for (const c of output.criteria) {
    if (!Number.isFinite(c.score) || c.score < 0 || c.score > 100) problems.push(`score for "${c.criterionId}" must be 0–100`);
  }
  if (!Number.isFinite(output.confidence) || output.confidence < 0 || output.confidence > 100) problems.push("confidence must be 0–100");
  return problems;
}
