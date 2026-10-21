"use server";

import { z } from "zod";
import { runAction } from "@/server/action";
import { completeStage, downstreamWork, markStagesForRevalidation, setTaskStatus } from "@/server/services/stages";

const id = z.string().min(1).max(64);

export async function toggleTaskAction(taskId: string, done: boolean) {
  return runAction(async () => {
    const task = await setTaskStatus(id.parse(taskId), z.boolean().parse(done));
    return { status: task.status };
  });
}

export async function completeStageAction(stageId: string) {
  return runAction(async () => {
    const stage = await completeStage(id.parse(stageId));
    return { status: stage.status };
  });
}

export async function downstreamWorkAction(stageId: string) {
  return runAction(async () => downstreamWork(id.parse(stageId)));
}

export async function markRevalidationAction(projectId: string, stageIds: string[], reason: string) {
  return runAction(async () => {
    await markStagesForRevalidation(id.parse(projectId), z.array(id).max(8).parse(stageIds), z.string().max(300).parse(reason));
    return null;
  });
}
