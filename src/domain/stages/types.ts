import type { Difficulty, FeedbackTheme, Skill, StageKey } from "../enums";
import type { LocalizedText } from "../localized";

/**
 * What kind of evidence can demonstrate a deliverable or criterion.
 * - text: written work is sufficient
 * - visual: needs something the reviewer can see (image, readable PDF, accessible design file)
 * - link_or_visual: an interactive link plus visual evidence that it works
 * - any: text or visual
 */
export type EvidenceKind = "text" | "visual" | "link_or_visual" | "any";

export interface DeliverableDef {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  mandatory: boolean;
  evidence: EvidenceKind;
  theme: FeedbackTheme;
  /** Lower-case phrases the offline mock reviewer looks for. Never used by the AI reviewer. */
  mockKeywords: string[];
}

export interface CriterionDef {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Integer weight; all weights in a stage sum to 100 */
  weight: number;
  mandatory: boolean;
  /** Mandatory criteria must reach this score for the stage to pass */
  minScore: number;
  skill: Skill;
  evidence: EvidenceKind;
  deliverableIds: string[];
  theme: FeedbackTheme;
}

export interface TaskDef {
  key: string;
  title: LocalizedText;
  mandatory: boolean;
}

export interface TemplateDef {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
}

export interface StageDefinition {
  key: StageKey;
  order: number;
  title: LocalizedText;
  objective: LocalizedText;
  whyItMatters: LocalizedText;
  tasks: TaskDef[];
  deliverables: DeliverableDef[];
  criteria: CriterionDef[];
  methods: LocalizedText[];
  templates: TemplateDef[];
  passThreshold: number;
  depthGuidance: Record<Difficulty, LocalizedText>;
  /** Upstream stages whose changes can invalidate this stage */
  dependsOn: StageKey[];
}
