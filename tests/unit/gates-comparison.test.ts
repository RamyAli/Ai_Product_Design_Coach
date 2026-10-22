import { describe, expect, it } from "vitest";
import { computeBriefImpact } from "@/domain/briefImpact";
import { compareReviews } from "@/domain/comparison";
import { canWorkOnStage, evaluateStageGate, stageStatusAfterReview } from "@/domain/gates";
import type { StoredReview } from "@/domain/review";
import { downstreamStages } from "@/domain/stages/definitions";
import { buildMockBrief } from "@/server/ai/mock/generate";
import { GeneratorInputSchema } from "@/domain/brief";

const passReview = { submissionId: "s2", decision: "pass" as const, missingDeliverables: [], criticalIssueCount: 0 };

describe("stage gates", () => {
  it("allows completion only with a passing review of the latest version and done mandatory tasks", () => {
    const base = { status: "ready_to_complete" as const, practiceMode: false, latestSubmissionId: "s2", openRevisionTasks: [], mandatoryTasks: [{ status: "done" }] };
    expect(evaluateStageGate({ ...base, latestReview: passReview }).eligible).toBe(true);
    expect(evaluateStageGate({ ...base, latestReview: null }).blockers.map((b) => b.code)).toEqual(["no_review"]);
    expect(evaluateStageGate({ ...base, latestReview: { ...passReview, decision: "revise" } }).blockers.map((b) => b.code)).toContain("review_not_passed");
    expect(evaluateStageGate({ ...base, latestReview: { ...passReview, submissionId: "s1" } }).blockers.map((b) => b.code)).toContain("review_outdated");
    expect(evaluateStageGate({ ...base, latestReview: passReview, openRevisionTasks: [{ severity: "critical" }] }).blockers.map((b) => b.code)).toContain("open_critical_tasks");
    expect(evaluateStageGate({ ...base, latestReview: passReview, mandatoryTasks: [{ status: "todo" }] }).blockers).toEqual([{ code: "mandatory_tasks_incomplete", count: 1 }]);
  });

  it("practice mode never bypasses review gates", () => {
    const g = evaluateStageGate({ status: "locked", practiceMode: true, latestSubmissionId: null, latestReview: null, openRevisionTasks: [], mandatoryTasks: [] });
    expect(g.eligible).toBe(false);
    expect(g.blockers.map((b) => b.code)).toEqual(["no_review"]);
    expect(canWorkOnStage("locked", true)).toBe(true);
    expect(canWorkOnStage("locked", false)).toBe(false);
  });

  it("maps decisions to stage statuses", () => {
    expect(stageStatusAfterReview("pass")).toBe("ready_to_complete");
    expect(stageStatusAfterReview("revise")).toBe("needs_revision");
    expect(stageStatusAfterReview("needs_more_evidence")).toBe("needs_revision");
  });

  it("computes downstream dependencies for invalidation", () => {
    expect(downstreamStages("discovery")).toEqual(["research", "architecture", "wireframes", "visual_design", "prototype", "usability_testing", "handoff"]);
    expect(downstreamStages("usability_testing")).toEqual(["handoff"]);
    expect(downstreamStages("handoff")).toEqual([]);
  });
});

describe("review comparison", () => {
  it("classifies previous tasks by the reviewer's assessment and computes deltas", () => {
    const prev = { overallScore: 60, decision: "revise" as const, criteria: [{ id: "a", name: "A", score: 50 }, { id: "b", name: "B", score: 70 }] } as unknown as StoredReview;
    const curr = {
      overallScore: 85,
      decision: "pass",
      criteria: [{ id: "a", name: "A", score: 90 }, { id: "b", name: "B", score: null }],
      issues: [{ id: "n1", title: "New", severity: "minor" }],
      previousTaskAssessments: [
        { previousTaskId: "P1", status: "resolved", note: "fixed" },
        { previousTaskId: "P2", status: "partially_resolved", note: "some" },
        { previousTaskId: "P3", status: "unresolved", note: "no" },
      ],
    } as unknown as StoredReview;
    const c = compareReviews({
      previousReviewId: "r1",
      previous: prev,
      current: curr,
      previousTasks: [
        { id: "t1", promptId: "P1", title: "one" },
        { id: "t2", promptId: "P2", title: "two" },
        { id: "t3", promptId: "P3", title: "three" },
        { id: "t4", promptId: "P4", title: "four" },
      ],
    });
    expect(c.scoreDelta).toBe(25);
    expect(c.criteria).toEqual([
      { id: "a", name: "A", previous: 50, current: 90, delta: 40 },
      { id: "b", name: "B", previous: 70, current: null, delta: null },
    ]);
    expect(c.resolved.map((t) => t.taskId)).toEqual(["t1"]);
    expect(c.partiallyResolved.map((t) => t.taskId)).toEqual(["t2"]);
    expect(c.unresolved.map((t) => t.taskId)).toEqual(["t3"]);
    expect(c.notAssessed.map((t) => t.taskId)).toEqual(["t4"]);
    expect(c.newIssues).toEqual([{ id: "n1", title: "New", severity: "minor" }]);
  });
});

describe("brief impact", () => {
  it("only reports stages that have work and rely on the changed fields", () => {
    const brief = { ...buildMockBrief(GeneratorInputSchema.parse({ mode: "random" }), null), workflow: [] };
    const next = { ...brief, platform: brief.platform === "web" ? ("mobile" as const) : ("web" as const) };
    const stages = [
      { stageId: "1", stageKey: "discovery" as const, status: "completed", submissionCount: 2, reviewCount: 2 },
      { stageId: "4", stageKey: "wireframes" as const, status: "in_progress", submissionCount: 1, reviewCount: 0 },
      { stageId: "5", stageKey: "visual_design" as const, status: "locked", submissionCount: 0, reviewCount: 0 },
    ];
    const impact = computeBriefImpact(brief, next, stages);
    expect(impact.changedFields).toEqual(["platform"]);
    expect(impact.affectedStages.map((s) => s.stageKey)).toEqual(["wireframes"]);
    expect(impact.untouchedStageKeys).toContain("visual_design");
    expect(computeBriefImpact(brief, brief, stages).changedFields).toEqual([]);
  });
});
