import type { AiJob } from "@prisma/client";
import { z } from "zod";
import type { Locale } from "@/domain/enums";
import { lt } from "@/domain/localized";
import type { StoredReview } from "@/domain/review";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getProvider } from "../ai";
import { followUpPrompt } from "../ai/prompts/followUp";
import type { TextMessage } from "../ai/types";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { createJob, type JobOutcome } from "../jobs/queue";

export const MentorQuestionSchema = z.object({
  projectId: z.string().min(1),
  stageId: z.string().min(1).optional(),
  reviewId: z.string().min(1).optional(),
  question: z.string().trim().min(2).max(2000),
});

/** Saves the question and queues the mentor's answer. Never touches official scores. */
export async function askMentor(raw: z.infer<typeof MentorQuestionSchema>) {
  const input = MentorQuestionSchema.parse(raw);
  const project = await db.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw notFound("Project");
  let stageId = input.stageId ?? null;
  if (input.reviewId) {
    const review = await db.review.findUnique({ where: { id: input.reviewId } });
    if (!review || review.projectId !== project.id) throw notFound("Review");
    stageId = review.stageId;
  }
  if (stageId) {
    const stage = await db.stage.findUnique({ where: { id: stageId } });
    if (!stage || stage.projectId !== project.id) throw notFound("Stage");
  }
  const busy = await db.aiJob.findFirst({ where: { projectId: project.id, type: "follow_up", status: { in: ["queued", "running"] } } });
  if (busy) throw new AppError("conflict", "The mentor is still answering your previous question.");
  const message = await db.coachMessage.create({
    data: { projectId: project.id, stageId, reviewId: input.reviewId ?? null, role: "user", content: input.question },
  });
  return createJob({ type: "follow_up", input: { messageId: message.id }, projectId: project.id, stageId });
}

export async function listMentorMessages(scope: { projectId: string; stageId?: string; reviewId?: string }) {
  return db.coachMessage.findMany({
    where: scope.reviewId ? { reviewId: scope.reviewId } : { projectId: scope.projectId, stageId: scope.stageId ?? null, reviewId: null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function runFollowUpJob(job: AiJob, signal: AbortSignal): Promise<JobOutcome> {
  const { messageId } = parseJson<{ messageId: string }>(job.inputJson, { messageId: "" });
  const message = await db.coachMessage.findUnique({ where: { id: messageId }, include: { project: true, stage: true } });
  if (!message) throw notFound("Message");
  const language = message.project.preferredLanguage as Locale;

  const contextLines: string[] = [`Project: ${message.project.title}`, `Project description: ${message.project.description}`];
  let review = message.reviewId ? await db.review.findUnique({ where: { id: message.reviewId } }) : null;
  if (message.stage) {
    const def = getStageDefinition(message.stage.stageKey);
    contextLines.push(
      `Current stage: ${lt(def.title, "en")} — ${lt(def.objective, "en")}`,
      `Required deliverables: ${def.deliverables.map((d) => lt(d.title, "en") + (d.mandatory ? "" : " (optional)")).join("; ")}`,
      `Acceptance criteria: ${def.criteria.map((c) => lt(c.name, "en")).join("; ")}`,
    );
    if (!review) review = await db.review.findFirst({ where: { stageId: message.stage.id }, orderBy: { createdAt: "desc" } });
  }
  if (review) {
    const stored = parseJson<StoredReview | null>(review.reviewJson, null);
    contextLines.push(
      `Latest formal review: score ${review.overallScore}/100, decision ${review.decision}${review.isMock ? " (offline demo review)" : ""}.`,
      `Review summary: ${review.summary}`,
      ...(stored?.issues ?? []).slice(0, 8).map((i) => `Issue [${i.severity}] ${i.title}: ${i.observation}`),
    );
  }

  const history = await db.coachMessage.findMany({
    where: message.reviewId ? { reviewId: message.reviewId } : { projectId: message.projectId, stageId: message.stageId, reviewId: null },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const messages: TextMessage[] = history
    .reverse()
    .filter((m) => m.createdAt <= message.createdAt)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.role === "user" ? `<untrusted_user_message>\n${m.content}\n</untrusted_user_message>` : m.content }));
  while (messages.length && messages[0]!.role !== "user") messages.shift();

  const provider = await getProvider();
  const prompt = followUpPrompt.build({ language, context: contextLines.join("\n") });
  const result = await provider.generateText({
    task: { kind: "follow_up", language, question: message.content, stageTitle: message.stage?.title ?? "", hasReview: Boolean(review) },
    system: prompt.system,
    messages,
    maxTokens: 4_000,
    signal,
  });
  const answer = await db.coachMessage.create({
    data: {
      projectId: message.projectId,
      stageId: message.stageId,
      reviewId: message.reviewId,
      role: "assistant",
      content: result.data || (language === "ar" ? "لم يتمكن المرشد من الإجابة." : "The mentor could not produce an answer."),
      provider: result.provider,
      model: result.model,
      isMock: provider.isMock,
    },
  });
  return { result: { messageId: answer.id }, usage: result.usage, provider: result.provider, model: result.model };
}
