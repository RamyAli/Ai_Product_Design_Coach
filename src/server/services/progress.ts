import type { FeedbackTheme, Skill } from "@/domain/enums";
import type { StoredReview } from "@/domain/review";
import type { CriterionDef } from "@/domain/stages/types";
import { db, parseJson } from "../db";

export interface SkillScore {
  skill: Skill;
  average: number;
  samples: number;
}

export interface ThemeCount {
  theme: FeedbackTheme;
  count: number;
}

function skillAverages(reviews: { reviewJson: string; acceptanceCriteriaJson: string }[]): SkillScore[] {
  const sums = new Map<Skill, { total: number; n: number }>();
  for (const r of reviews) {
    const stored = parseJson<StoredReview | null>(r.reviewJson, null);
    const defs = parseJson<CriterionDef[]>(r.acceptanceCriteriaJson, []);
    if (!stored) continue;
    for (const c of stored.criteria) {
      if (c.score === null) continue;
      const skill = defs.find((d) => d.id === c.id)?.skill;
      if (!skill) continue;
      const s = sums.get(skill) ?? { total: 0, n: 0 };
      s.total += c.score;
      s.n += 1;
      sums.set(skill, s);
    }
  }
  return [...sums.entries()]
    .map(([skill, s]) => ({ skill, average: Math.round(s.total / s.n), samples: s.n }))
    .sort((a, b) => b.average - a.average);
}

function themeCounts(tasks: { theme: string | null }[]): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const t of tasks) if (t.theme) counts.set(t.theme, (counts.get(t.theme) ?? 0) + 1);
  return [...counts.entries()]
    .map(([theme, count]) => ({ theme: theme as FeedbackTheme, count }))
    .sort((a, b) => b.count - a.count);
}

/** Progress (how far) and quality (how well) for one project, computed only from saved data. */
export async function computeProjectProgress(projectId: string) {
  const stages = await db.stage.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: {
      submissions: { where: { status: "submitted" }, select: { id: true } },
      reviews: { orderBy: { createdAt: "desc" }, select: { id: true, overallScore: true, decision: true, reviewJson: true, isMock: true, createdAt: true } },
    },
  });
  const completed = stages.filter((s) => s.status === "completed");
  const current = stages.find((s) => s.status !== "completed") ?? null;
  const latestReviews = stages.flatMap((s) => (s.reviews[0] ? [{ ...s.reviews[0], acceptanceCriteriaJson: s.acceptanceCriteriaJson }] : []));
  const tasks = await db.revisionTask.findMany({ where: { review: { projectId } }, select: { theme: true, status: true, severity: true } });
  const submissionCount = stages.reduce((n, s) => n + s.submissions.length, 0);
  const avg = latestReviews.length ? Math.round(latestReviews.reduce((n, r) => n + r.overallScore, 0) / latestReviews.length) : null;
  const skills = skillAverages(latestReviews);
  const themes = themeCounts(tasks);
  return {
    stages: stages.map((s) => ({
      id: s.id,
      stageKey: s.stageKey,
      title: s.title,
      orderIndex: s.orderIndex,
      status: s.status,
      submissionCount: s.submissions.length,
      reviewCount: s.reviews.length,
      latestScore: s.reviews[0]?.overallScore ?? null,
      latestDecision: s.reviews[0]?.decision ?? null,
      latestIsMock: s.reviews[0]?.isMock ?? false,
    })),
    completedCount: completed.length,
    totalStages: stages.length,
    completionPercent: stages.length ? Math.round((completed.length / stages.length) * 100) : 0,
    currentStage: current ? { id: current.id, title: current.title, status: current.status, orderIndex: current.orderIndex } : null,
    submissionCount,
    revisionCount: stages.reduce((n, s) => n + Math.max(0, s.submissions.length - 1), 0),
    reviewCount: stages.reduce((n, s) => n + s.reviews.length, 0),
    averageLatestScore: avg,
    includesMockReviews: latestReviews.some((r) => r.isMock),
    skills,
    themes,
    repeatedThemes: themes.filter((t) => t.count >= 2),
    openRevisionTasks: tasks.filter((t) => t.status === "open").length,
    improvementAreas: skills.filter((s) => s.average < 75).slice(-3).reverse(),
  };
}

/** Learning analytics across all projects. Demo (mock) reviews are excluded unless requested. */
export async function computeLearningProgress(opts: { includeDemo: boolean }) {
  const reviewWhere = opts.includeDemo ? {} : { isMock: false };
  const [projects, reviews, demoCount, tasks] = await Promise.all([
    db.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, status: true, title: true, isSample: true } }),
    db.review.findMany({
      where: reviewWhere,
      orderBy: { createdAt: "asc" },
      include: { stage: { select: { stageKey: true, title: true, acceptanceCriteriaJson: true, id: true } }, project: { select: { title: true } } },
    }),
    db.review.count({ where: { isMock: true } }),
    db.revisionTask.findMany({
      where: { review: reviewWhere },
      select: { theme: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const stagesCompleted = await db.stage.count({ where: { status: "completed", project: { status: { not: "archived" } } } });
  // Latest review per stage is the official evaluation used for skill averages.
  const latestByStage = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) latestByStage.set(r.stageId, r);
  const latest = [...latestByStage.values()].map((r) => ({ reviewJson: r.reviewJson, acceptanceCriteriaJson: r.stage.acceptanceCriteriaJson }));
  const skills = skillAverages(latest);
  const themes = themeCounts(tasks);
  const recentThemes = themeCounts(tasks.slice(0, 25));
  const passed = reviews.filter((r) => r.decision === "pass").length;
  return {
    projectCount: projects.length,
    activeProjects: projects.filter((p) => p.status === "active").length,
    completedProjects: projects.filter((p) => p.status === "completed").length,
    stagesCompleted,
    reviewCount: reviews.length,
    demoReviewCount: demoCount,
    passRate: reviews.length ? Math.round((passed / reviews.length) * 100) : null,
    averageScore: reviews.length ? Math.round(reviews.reduce((n, r) => n + r.overallScore, 0) / reviews.length) : null,
    timeline: reviews.slice(-30).map((r) => ({
      id: r.id,
      projectId: r.projectId,
      date: r.createdAt.toISOString(),
      score: r.overallScore,
      decision: r.decision,
      stageKey: r.stage.stageKey,
      projectTitle: r.project.title,
      isMock: r.isMock,
    })),
    skills,
    strongest: skills.slice(0, 2),
    weakest: skills.length > 2 ? skills.slice(-2).reverse() : [],
    themes,
    recentThemes: recentThemes.slice(0, 5),
    completedTasks: tasks.filter((t) => t.status === "completed").length,
    openTasks: tasks.filter((t) => t.status === "open").length,
  };
}

export async function getDashboardData() {
  const [projects, activeJobs, failedJobs, recentSubmissions, revisionStages] = await Promise.all([
    db.project.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ lastOpenedAt: "desc" }, { updatedAt: "desc" }],
      include: { stages: { select: { id: true, status: true, orderIndex: true, title: true, stageKey: true } } },
    }),
    db.aiJob.findMany({ where: { type: "review", status: { in: ["queued", "running"] } }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.aiJob.findMany({
      where: { type: "review", status: "failed", createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.submission.findMany({
      where: { status: "submitted" },
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: { stage: { select: { title: true, id: true, stageKey: true } }, project: { select: { title: true, id: true } }, reviews: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, overallScore: true, decision: true, isMock: true } } },
    }),
    db.stage.findMany({
      where: { status: { in: ["needs_revision", "needs_revalidation"] }, project: { status: { not: "archived" } } },
      include: {
        project: { select: { title: true, id: true } },
        reviews: { orderBy: { createdAt: "desc" }, take: 1, include: { revisionTasks: { where: { status: "open" }, select: { id: true, severity: true } } } },
      },
      take: 10,
    }),
  ]);
  const jobStages = await db.stage.findMany({
    where: { id: { in: [...activeJobs, ...failedJobs].map((j) => j.stageId).filter((x): x is string => Boolean(x)) } },
    include: { project: { select: { title: true, id: true } } },
  });
  // Only show failures that have not been superseded by a later review.
  const failed = [];
  for (const j of failedJobs) {
    const later = await db.review.count({ where: { submissionId: j.submissionId ?? "", createdAt: { gt: j.createdAt } } });
    if (later === 0) failed.push(j);
  }
  const summarize = (p: (typeof projects)[number]) => {
    const sorted = [...p.stages].sort((a, b) => a.orderIndex - b.orderIndex);
    const done = sorted.filter((s) => s.status === "completed").length;
    const current = sorted.find((s) => s.status !== "completed") ?? null;
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      isSample: p.isSample,
      platform: p.platform,
      industry: p.industry,
      lastOpenedAt: p.lastOpenedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      completedStages: done,
      totalStages: sorted.length,
      currentStage: current ? { id: current.id, title: current.title, stageKey: current.stageKey, status: current.status, orderIndex: current.orderIndex } : null,
    };
  };
  const all = projects.map(summarize);
  const active = all.filter((p) => p.status === "active" || p.status === "draft");
  return {
    active,
    completed: all.filter((p) => p.status === "completed"),
    lastActive: active.find((p) => p.status === "active") ?? null,
    pendingReviews: activeJobs.map((j) => {
      const s = jobStages.find((st) => st.id === j.stageId);
      return { jobId: j.id, status: j.status, stageId: j.stageId, stageKey: s?.stageKey ?? "", stageTitle: s?.title ?? "", projectId: s?.project.id ?? "", projectTitle: s?.project.title ?? "", createdAt: j.createdAt.toISOString() };
    }),
    failedReviews: failed.map((j) => {
      const s = jobStages.find((st) => st.id === j.stageId);
      return { jobId: j.id, submissionId: j.submissionId, stageId: j.stageId, stageKey: s?.stageKey ?? "", stageTitle: s?.title ?? "", projectId: s?.project.id ?? "", projectTitle: s?.project.title ?? "", message: j.errorMessage ?? "" };
    }),
    revisionRequests: revisionStages.map((s) => ({
      stageId: s.id,
      stageKey: s.stageKey,
      stageTitle: s.title,
      status: s.status,
      projectId: s.project.id,
      projectTitle: s.project.title,
      reviewId: s.reviews[0]?.id ?? null,
      openTasks: s.reviews[0]?.revisionTasks.length ?? 0,
      criticalTasks: s.reviews[0]?.revisionTasks.filter((t) => t.severity === "critical").length ?? 0,
    })),
    recentSubmissions: recentSubmissions.map((s) => ({
      id: s.id,
      versionNumber: s.versionNumber,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      stageId: s.stage.id,
      stageKey: s.stage.stageKey,
      stageTitle: s.stage.title,
      projectId: s.project.id,
      projectTitle: s.project.title,
      review: s.reviews[0] ?? null,
    })),
  };
}
