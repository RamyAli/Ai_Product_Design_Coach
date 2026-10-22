import { z } from "zod";
import {
  CriterionStatusSchema,
  DeliverableStatusSchema,
  FeedbackThemeSchema,
  SeveritySchema,
  type CriterionStatus,
  type Decision,
  type DeliverableStatus,
  type FeedbackTheme,
  type Severity,
} from "./enums";
import type { LocalizedText } from "./localized";

/** A pointer into the evidence manifest given to the reviewer (e.g. ref "A2", locator "p.3"). */
export const EvidenceRefSchema = z.object({
  ref: z.string(),
  locator: z.string(),
  quote: z.string(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const PREVIOUS_TASK_STATUSES = ["resolved", "partially_resolved", "unresolved", "not_assessable"] as const;
export type PreviousTaskStatus = (typeof PREVIOUS_TASK_STATUSES)[number];

/** Builds the schema the evaluator must return. Criterion and deliverable ids are constrained to the stage rubric. */
export function buildModelReviewSchema(criterionIds: [string, ...string[]], deliverableIds: [string, ...string[]]) {
  const criterionId = z.enum(criterionIds);
  return z.object({
    summary: z.string(),
    criteria: z.array(
      z.object({
        criterionId,
        score: z.number(),
        status: CriterionStatusSchema,
        evidence: z.array(EvidenceRefSchema),
        feedback: z.string(),
      }),
    ),
    deliverables: z.array(
      z.object({
        deliverableId: z.enum(deliverableIds),
        status: DeliverableStatusSchema,
        evidence: z.array(EvidenceRefSchema),
        note: z.string(),
      }),
    ),
    strengths: z.array(z.object({ text: z.string(), evidence: z.array(EvidenceRefSchema) })),
    issues: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        severity: SeveritySchema,
        criterionId,
        observation: z.string(),
        impact: z.string(),
        recommendation: z.string(),
        evidence: z.array(EvidenceRefSchema),
      }),
    ),
    assumptionsToValidate: z.array(z.string()),
    revisionTasks: z.array(
      z.object({
        id: z.string(),
        issueId: z.string(),
        title: z.string(),
        description: z.string(),
        reason: z.string(),
        severity: SeveritySchema,
        criterionId,
        theme: FeedbackThemeSchema,
        suggestedAction: z.string(),
      }),
    ),
    questionsForDesigner: z.array(z.string()),
    nextSteps: z.array(z.string()),
    limitations: z.array(z.string()),
    confidence: z.number(),
    previousTaskAssessments: z.array(
      z.object({
        previousTaskId: z.string(),
        status: z.enum(PREVIOUS_TASK_STATUSES),
        note: z.string(),
      }),
    ),
  });
}
export type ModelReviewOutput = z.infer<ReturnType<typeof buildModelReviewSchema>>;

// ---------- Stored review (reviewJson) ----------

export interface ReviewCriterionResult {
  id: string;
  name: LocalizedText;
  weight: number;
  mandatory: boolean;
  minScore: number;
  /** Score after deterministic adjustments; null when not evaluable */
  score: number | null;
  rawScore: number;
  maxScore: 100;
  status: CriterionStatus;
  severity: Severity | null;
  evidence: EvidenceRef[];
  feedback: string;
  adjustments: string[];
}

export interface ReviewDeliverableResult {
  id: string;
  title: LocalizedText;
  mandatory: boolean;
  status: DeliverableStatus;
  evidence: EvidenceRef[];
  note: string;
}

export interface ReviewIssue {
  id: string;
  title: string;
  severity: Severity;
  criterionId: string;
  observation: string;
  impact: string;
  recommendation: string;
  evidence: EvidenceRef[];
}

export interface ReviewRevisionTask {
  id: string;
  issueId: string;
  title: string;
  description: string;
  reason: string;
  severity: Severity;
  criterionId: string;
  theme: FeedbackTheme;
  suggestedAction: string;
  /** true when synthesized by deterministic code rather than the reviewer */
  synthesized: boolean;
}

export type DecisionReasonCode =
  | "score_below_threshold"
  | "mandatory_deliverable_missing"
  | "mandatory_deliverable_not_evaluable"
  | "mandatory_criterion_below_minimum"
  | "mandatory_criterion_not_evaluable"
  | "critical_issue_open"
  | "low_confidence"
  | "insufficient_evaluable_weight"
  | "all_requirements_met";

export interface DecisionReason {
  code: DecisionReasonCode;
  criterionId?: string;
  deliverableId?: string;
  detail?: string;
}

export interface EvidenceManifestEntry {
  ref: string;
  kind: "text" | "notes" | "image" | "pdf" | "figma";
  label: string;
  available: boolean;
  detail?: string;
}

export interface StoredReview {
  schemaVersion: 1;
  summary: string;
  overallScore: number;
  decision: Decision;
  decisionReasons: DecisionReason[];
  threshold: number;
  confidence: number;
  modelConfidence: number;
  evaluatedWeight: number;
  criteria: ReviewCriterionResult[];
  deliverables: ReviewDeliverableResult[];
  missingDeliverables: string[];
  strengths: { text: string; evidence: EvidenceRef[] }[];
  issues: ReviewIssue[];
  assumptionsToValidate: string[];
  revisionTasks: ReviewRevisionTask[];
  questionsForDesigner: string[];
  nextSteps: string[];
  limitations: string[];
  evidenceManifest: EvidenceManifestEntry[];
  previousTaskAssessments: { previousTaskId: string; status: PreviousTaskStatus; note: string }[];
  strictness: string;
}

export interface ReviewComparison {
  previousReviewId: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  previousDecision: Decision;
  currentDecision: Decision;
  criteria: { id: string; name: LocalizedText; previous: number | null; current: number | null; delta: number | null }[];
  resolved: { taskId: string; title: string; note: string }[];
  partiallyResolved: { taskId: string; title: string; note: string }[];
  unresolved: { taskId: string; title: string; note: string }[];
  notAssessed: { taskId: string; title: string }[];
  newIssues: { id: string; title: string; severity: Severity }[];
}
