"use server";

import { z } from "zod";
import { runAction } from "@/server/action";
import { askMentor } from "@/server/services/coach";
import { updateRevisionTask } from "@/server/services/reviews";

const id = z.string().min(1).max(64);

export async function updateRevisionTaskAction(taskId: string, status: "open" | "completed" | "dismissed", note?: string) {
  return runAction(async () => {
    const t = await updateRevisionTask(id.parse(taskId), z.enum(["open", "completed", "dismissed"]).parse(status), z.string().max(500).optional().parse(note));
    return { status: t.status, resolutionNote: t.resolutionNote };
  });
}

export async function askMentorAction(input: { projectId: string; stageId?: string; reviewId?: string; question: string }) {
  return runAction(async () => ({ jobId: (await askMentor(input)).id }));
}
