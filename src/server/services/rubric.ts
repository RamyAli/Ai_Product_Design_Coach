import type { Stage } from "@prisma/client";
import type { StagePlan } from "@/domain/brief";
import type { StageRubric } from "@/domain/scoring";
import { getStageDefinition } from "@/domain/stages/definitions";
import type { CriterionDef, DeliverableDef, StageDefinition } from "@/domain/stages/types";
import { parseJson } from "../db";

/** The rubric snapshot stored on the stage row (falls back to the canonical definition). */
export function rubricForStage(stage: Pick<Stage, "stageKey" | "passThreshold" | "acceptanceCriteriaJson" | "deliverablesJson">): StageRubric {
  const def = getStageDefinition(stage.stageKey);
  return {
    passThreshold: stage.passThreshold,
    criteria: parseJson<CriterionDef[]>(stage.acceptanceCriteriaJson, def.criteria),
    deliverables: parseJson<DeliverableDef[]>(stage.deliverablesJson, def.deliverables),
  };
}

export function customizationForStage(stage: Pick<Stage, "customizationJson">): StagePlan | null {
  return parseJson<StagePlan | null>(stage.customizationJson, null);
}

export function snapshotFromDefinition(def: StageDefinition) {
  return {
    passThreshold: def.passThreshold,
    weightConfigJson: JSON.stringify(def.criteria.map((c) => ({ id: c.id, weight: c.weight, mandatory: c.mandatory, minScore: c.minScore }))),
    acceptanceCriteriaJson: JSON.stringify(def.criteria),
    deliverablesJson: JSON.stringify(def.deliverables),
  };
}
