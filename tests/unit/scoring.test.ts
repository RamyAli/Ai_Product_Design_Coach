import { describe, expect, it } from "vitest";
import type { ModelReviewOutput } from "@/domain/review";
import { computeWeightedScore, finalizeReview, sanitizeEvidenceRefs, validateWeights, checkModelOutputCompleteness, type EvidenceContext, type StageRubric } from "@/domain/scoring";
import { getStageDefinition, STAGE_DEFINITIONS } from "@/domain/stages/definitions";

const discovery = getStageDefinition("discovery");
const wireframes = getStageDefinition("wireframes");
const rubricOf = (key: string): StageRubric => {
  const d = getStageDefinition(key);
  return { passThreshold: d.passThreshold, criteria: d.criteria, deliverables: d.deliverables };
};

const textEvidence: EvidenceContext = {
  manifest: [{ ref: "T1", kind: "text", label: "Written submission", available: true }],
  textByRef: { T1: "# Problem statement\nOwners cannot find the permits they need." },
  pageCountByRef: {},
  visualEvidenceAvailable: false,
  visualSourcesUnavailable: false,
  confidenceCap: 100,
  codeLimitations: [],
};

function output(rubric: StageRubric, score: number, overrides: Partial<ModelReviewOutput> = {}): ModelReviewOutput {
  return {
    summary: "s",
    criteria: rubric.criteria.map((c) => ({ criterionId: c.id, score, status: score >= 80 ? "met" : score >= 60 ? "partial" : "not_met", evidence: [], feedback: "f" })),
    deliverables: rubric.deliverables.map((d) => ({ deliverableId: d.id, status: "provided", evidence: [], note: "" })),
    strengths: [],
    issues: [],
    assumptionsToValidate: [],
    revisionTasks: [],
    questionsForDesigner: [],
    nextSteps: [],
    limitations: [],
    confidence: 90,
    previousTaskAssessments: [],
    ...overrides,
  };
}

const run = (rubric: StageRubric, out: ModelReviewOutput, evidence = textEvidence, strictness: "supportive" | "standard" | "demanding" = "standard") =>
  finalizeReview({ rubric, output: out, evidence, strictness, language: "en" });

describe("stage configuration", () => {
  it("every stage has weights that sum to 100 and valid deliverable links", () => {
    expect(STAGE_DEFINITIONS).toHaveLength(8);
    for (const s of STAGE_DEFINITIONS) {
      expect(validateWeights(s.criteria)).toEqual([]);
      const ids = new Set(s.deliverables.map((d) => d.id));
      for (const c of s.criteria) for (const d of c.deliverableIds) expect(ids.has(d)).toBe(true);
      expect(s.deliverables.some((d) => d.mandatory)).toBe(true);
    }
  });
  it("detects invalid weights", () => {
    expect(validateWeights([{ ...discovery.criteria[0]!, weight: 50 }])).toContain("weights sum to 50, expected 100");
  });
});

describe("weighted scoring", () => {
  it("uses rubric weights, not model weights, and excludes non-evaluable criteria", () => {
    expect(computeWeightedScore([{ weight: 75, score: 100 }, { weight: 25, score: 0 }]).overall).toBe(75);
    expect(computeWeightedScore([{ weight: 50, score: 80 }, { weight: 50, score: null }])).toEqual({ overall: 80, evaluatedWeight: 50 });
  });

  it("passes a strong, complete submission", () => {
    const r = run(rubricOf("discovery"), output(rubricOf("discovery"), 88));
    expect(r.overallScore).toBe(88);
    expect(r.decision).toBe("pass");
    expect(r.decisionReasons[0]!.code).toBe("all_requirements_met");
  });

  it("revises when the score is below the threshold", () => {
    const r = run(rubricOf("discovery"), output(rubricOf("discovery"), 75));
    expect(r.decision).toBe("revise");
    expect(r.decisionReasons.map((x) => x.code)).toContain("score_below_threshold");
  });

  it("never lets a high score compensate for a missing mandatory deliverable", () => {
    const rubric = rubricOf("discovery");
    const out = output(rubric, 95);
    out.deliverables[0]!.status = "missing";
    const r = run(rubric, out);
    expect(r.overallScore).toBeGreaterThanOrEqual(80);
    expect(r.decision).toBe("revise");
    expect(r.missingDeliverables).toEqual(["problem_statement"]);
    expect(r.revisionTasks.some((t) => t.synthesized && t.severity === "critical")).toBe(true);
  });

  it("blocks a pass when a critical issue is open", () => {
    const rubric = rubricOf("discovery");
    const r = run(rubric, output(rubric, 92, { issues: [{ id: "i1", title: "x", severity: "critical", criterionId: "problem_clarity", observation: "o", impact: "i", recommendation: "r", evidence: [] }] }));
    expect(r.decision).toBe("revise");
    expect(r.decisionReasons.map((x) => x.code)).toContain("critical_issue_open");
    // Every critical/major issue has a revision task even if the model forgot one.
    expect(r.revisionTasks.find((t) => t.issueId === "i1")?.synthesized).toBe(true);
  });

  it("blocks a pass when a mandatory criterion is below its minimum", () => {
    const rubric = rubricOf("discovery");
    const out = output(rubric, 95);
    out.criteria[0]!.score = 50;
    out.criteria[0]!.status = "not_met";
    const r = run(rubric, out);
    expect(r.decision).toBe("revise");
    expect(r.decisionReasons).toContainEqual({ code: "mandatory_criterion_below_minimum", criterionId: "problem_clarity" });
  });

  it("caps scores for missing artifacts so a mention cannot earn full credit", () => {
    const rubric = rubricOf("discovery");
    const out = output(rubric, 90);
    out.criteria[1]!.status = "missing";
    const r = run(rubric, out);
    expect(r.criteria[1]!.score).toBe(20);
    expect(r.criteria[1]!.adjustments).toContain("capped_for_missing");
  });

  it("returns needs_more_evidence when a mandatory criterion cannot be evaluated", () => {
    const rubric = rubricOf("discovery");
    const out = output(rubric, 90);
    out.criteria[0]!.status = "not_evaluable";
    const r = run(rubric, out);
    expect(r.decision).toBe("needs_more_evidence");
    expect(r.criteria[0]!.score).toBeNull();
    expect(r.confidence).toBeLessThanOrEqual(75);
  });

  it("does not let a reviewer mark visual criteria as met without visual evidence", () => {
    const rubric = rubricOf("wireframes");
    const out = output(rubric, 90);
    const noVisual = run(rubric, out);
    const task = noVisual.criteria.find((c) => c.id === "task_support")!;
    expect(task.status).toBe("missing");
    expect(task.adjustments).toContain("visual_evidence_not_supplied");
    expect(noVisual.decision).toBe("revise");

    const unavailable = run(rubric, out, { ...textEvidence, visualSourcesUnavailable: true });
    expect(unavailable.criteria.find((c) => c.id === "task_support")!.status).toBe("not_evaluable");
    expect(unavailable.decision).toBe("needs_more_evidence");

    const withVisual = run(rubric, out, { ...textEvidence, visualEvidenceAvailable: true });
    expect(withVisual.decision).toBe("pass");
    expect(wireframes.criteria.some((c) => c.evidence === "visual")).toBe(true);
  });

  it("raises the threshold in demanding mode but never lowers it", () => {
    const rubric = rubricOf("discovery");
    expect(run(rubric, output(rubric, 82), textEvidence, "demanding").decision).toBe("revise");
    expect(run(rubric, output(rubric, 79), textEvidence, "supportive").decision).toBe("revise");
    expect(run(rubric, output(rubric, 82), textEvidence, "supportive").threshold).toBe(80);
  });

  it("caps confidence by processing failures and low confidence yields needs_more_evidence", () => {
    const rubric = rubricOf("discovery");
    const r = run(rubric, output(rubric, 90, { confidence: 95 }), { ...textEvidence, confidenceCap: 30 });
    expect(r.confidence).toBe(30);
    expect(r.decision).toBe("needs_more_evidence");
  });
});

describe("evidence verification", () => {
  it("drops unknown refs, out-of-range pages and quotes not present in the source", () => {
    const ctx: EvidenceContext = {
      ...textEvidence,
      manifest: [...textEvidence.manifest, { ref: "A1", kind: "pdf", label: "doc.pdf", available: true }],
      textByRef: { ...textEvidence.textByRef, A1: "[Page 1]\nhello" },
      pageCountByRef: { A1: 2 },
    };
    const { refs, removed } = sanitizeEvidenceRefs(
      [
        { ref: "T1", locator: "Problem statement", quote: "owners cannot find   the permits" },
        { ref: "T9", locator: "", quote: "" },
        { ref: "A1", locator: "p.7", quote: "" },
        { ref: "T1", locator: "", quote: "invented participant quote" },
      ],
      ctx,
    );
    expect(refs).toHaveLength(3);
    expect(refs[0]!.quote).toBe("owners cannot find   the permits");
    expect(refs[1]).toEqual({ ref: "A1", locator: "", quote: "" });
    expect(refs[2]!.quote).toBe("");
    expect(removed).toBe(3);
  });

  it("flags incomplete model output for a corrective retry", () => {
    const rubric = rubricOf("discovery");
    const out = output(rubric, 80);
    out.criteria.pop();
    out.criteria.push({ ...out.criteria[0]! });
    out.confidence = 140;
    const problems = checkModelOutputCompleteness(rubric, out);
    expect(problems.join("\n")).toMatch(/missing result for criterion "realistic_scope"/);
    expect(problems.join("\n")).toMatch(/returned 2 times/);
    expect(problems.join("\n")).toMatch(/confidence/);
  });
});
