import type { DeliverableStatus, Severity } from "@/domain/enums";
import { lt } from "@/domain/localized";
import type { ModelReviewOutput, PreviousTaskStatus } from "@/domain/review";
import type { EvaluationTaskContext } from "../types";

/**
 * Offline demo reviewer. It only checks whether each required deliverable is present and
 * how much was written about it. It cannot judge design quality or look at images, and its
 * output is always labelled as a demo review in the UI. Deterministic for tests.
 */

interface Located {
  ref: string;
  heading: string;
  words: number;
}

const HEADING = /^\s{0,3}(#{1,6}\s+.+|[^\n]{2,80}:\s*$)/;

function countWords(s: string): number {
  return (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

function locate(keywords: string[], texts: EvaluationTaskContext["texts"]): Located | null {
  let best: Located | null = null;
  for (const t of texts) {
    const lines = t.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lower = line.toLowerCase();
      if (!keywords.some((k) => lower.includes(k))) continue;
      const isHeading = HEADING.test(line);
      let body = "";
      if (isHeading) {
        for (let j = i + 1; j < lines.length && !/^\s{0,3}#{1,6}\s+/.test(lines[j]!); j++) body += `${lines[j]}\n`;
      } else {
        body = lines.slice(i, i + 4).join("\n");
      }
      const found: Located = { ref: t.ref, heading: line.trim().slice(0, 120), words: countWords(body) };
      if (!best || (isHeading && found.words > best.words) || found.words > best.words) best = found;
    }
  }
  return best;
}

const SCORE: Record<DeliverableStatus, number> = { provided: 90, partial: 65, missing: 10, not_evaluable: 0 };

export function mockEvaluate(ctx: EvaluationTaskContext): ModelReviewOutput {
  const L = ctx.language;
  const hasVisual = ctx.visualRefs.length > 0;
  const hasUnavailable = ctx.unavailableVisualRefs.length > 0;

  const deliverables = ctx.rubric.deliverables.map((d) => {
    const found = locate(d.mockKeywords, ctx.texts);
    let status: DeliverableStatus;
    let note: string;
    if (d.evidence === "visual" || d.evidence === "link_or_visual") {
      if (hasVisual && (found || d.evidence === "visual")) {
        status = "provided";
        note = L === "ar" ? "توجد أدلة مرئية مرفقة (لم يتم فحص محتواها في الوضع التجريبي)." : "Visual evidence is attached (contents not inspected in demo mode).";
      } else if (hasUnavailable) {
        status = "not_evaluable";
        note = L === "ar" ? "الأدلة المرئية المرفقة غير متاحة للمراجعة." : "Attached visual evidence could not be accessed.";
      } else {
        status = "missing";
        note = L === "ar" ? "لم تُرفق صور أو ملفات PDF أو روابط تصميم متاحة." : "No images, PDFs or accessible design links were attached.";
      }
    } else if (!found) {
      status = "missing";
      note = L === "ar" ? "لم يُعثر على قسم لهذا المخرج." : "No section for this deliverable was found.";
    } else if (found.words >= 25) {
      status = "provided";
      note = L === "ar" ? `قسم بعنوان «${found.heading}» (${found.words} كلمة).` : `Section "${found.heading}" (${found.words} words).`;
    } else {
      status = "partial";
      note = L === "ar" ? `القسم «${found.heading}» قصير (${found.words} كلمة).` : `Section "${found.heading}" is brief (${found.words} words).`;
    }
    return { def: d, found, status, note };
  });

  const byId = new Map(deliverables.map((d) => [d.def.id, d]));

  const criteria = ctx.rubric.criteria.map((c) => {
    const linked = c.deliverableIds.map((id) => byId.get(id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
    const relevant = linked.filter((d) => d.def.mandatory || d.status !== "missing");
    const pool = relevant.length ? relevant : linked;
    if (pool.some((d) => d.status === "not_evaluable") && c.evidence === "visual") {
      return { criterionId: c.id, score: 0, status: "not_evaluable" as const, evidence: [], feedback: L === "ar" ? "تعذر تقييمه دون أدلة مرئية متاحة." : "Cannot be assessed without accessible visual evidence." };
    }
    const score = Math.round(pool.reduce((s, d) => s + SCORE[d.status === "not_evaluable" ? "missing" : d.status], 0) / Math.max(1, pool.length));
    const status = pool.every((d) => d.status === "missing") ? ("missing" as const) : score >= 80 ? ("met" as const) : score >= 60 ? ("partial" as const) : ("not_met" as const);
    const evidence = pool
      .filter((d) => d.found)
      .map((d) => ({ ref: d.found!.ref, locator: d.found!.heading.slice(0, 80), quote: "" }));
    const feedback =
      status === "met"
        ? L === "ar" ? "المخرجات المرتبطة موجودة ومفصلة بما يكفي لهذا الفحص التجريبي." : "Linked deliverables are present and reasonably detailed for this demo check."
        : L === "ar" ? "بعض المخرجات المرتبطة مفقودة أو مختصرة جداً." : "Some linked deliverables are missing or too brief.";
    return { criterionId: c.id, score, status, evidence, feedback };
  });

  const issues: ModelReviewOutput["issues"] = [];
  const revisionTasks: ModelReviewOutput["revisionTasks"] = [];
  for (const d of deliverables) {
    if (d.status === "provided" || d.status === "not_evaluable") continue;
    if (!d.def.mandatory && d.status === "missing") continue;
    const criterion = ctx.rubric.criteria.find((c) => c.deliverableIds.includes(d.def.id)) ?? ctx.rubric.criteria[0]!;
    const kind = d.status === "missing" ? "missing" : "thin";
    const severity: Severity = kind === "missing" ? "critical" : "major";
    const title = lt(d.def.title, L);
    const id = `mock-${d.def.id}-${kind}`;
    issues.push({
      id,
      title: kind === "missing" ? (L === "ar" ? `مفقود: ${title}` : `Missing: ${title}`) : L === "ar" ? `يحتاج توسعاً: ${title}` : `Needs more depth: ${title}`,
      severity,
      criterionId: criterion.id,
      observation: d.note,
      impact: L === "ar" ? "هذا مخرج مطلوب لهذه المرحلة، ويعتمد عليه تقييم المعيار المرتبط." : "This deliverable is required for the stage and the linked criterion depends on it.",
      recommendation: lt(d.def.description, L),
      evidence: d.found ? [{ ref: d.found.ref, locator: d.found.heading.slice(0, 80), quote: "" }] : [],
    });
    revisionTasks.push({
      id,
      issueId: id,
      title: kind === "missing" ? (L === "ar" ? `أضف ${title}` : `Add the ${title.toLowerCase()}`) : L === "ar" ? `وسّع ${title}` : `Expand the ${title.toLowerCase()}`,
      description: lt(d.def.description, L),
      reason: d.note,
      severity,
      criterionId: criterion.id,
      theme: d.def.theme,
      suggestedAction:
        L === "ar" ? `أضف قسماً بعنوان «${title}» يغطي: ${lt(d.def.description, "ar")}` : `Add a section headed "${title}" that covers: ${lt(d.def.description, "en")}`,
    });
  }

  const previousTaskAssessments = ctx.previousTasks.map((p) => {
    const match = /^mock-(.+)-(missing|thin)$/.exec(p.reviewTaskKey);
    let status: PreviousTaskStatus = "not_assessable";
    let note = "";
    if (match) {
      const d = byId.get(match[1]!);
      if (d) {
        status = d.status === "provided" ? "resolved" : d.status === "partial" ? (match[2] === "missing" ? "partially_resolved" : "unresolved") : d.status === "missing" ? "unresolved" : "not_assessable";
        note = d.note;
      }
    }
    return { previousTaskId: p.promptId, status, note };
  });

  const provided = deliverables.filter((d) => d.status === "provided");
  return {
    summary:
      L === "ar"
        ? `مراجعة تجريبية من المراجع غير المتصل: وُجد ${provided.length} من ${deliverables.length} مخرجات بتفاصيل كافية. يتحقق هذا المراجع من وجود المخرجات وطولها فقط ولا يقيّم جودة التصميم.`
        : `Demo review from the offline reviewer: ${provided.length} of ${deliverables.length} deliverables were found with enough detail. This reviewer only checks presence and length of deliverables; it does not judge design quality.`,
    criteria,
    deliverables: deliverables.map((d) => ({
      deliverableId: d.def.id,
      status: d.status,
      evidence: d.found ? [{ ref: d.found.ref, locator: d.found.heading.slice(0, 80), quote: "" }] : [],
      note: d.note,
    })),
    strengths: provided
      .filter((d) => d.found)
      .slice(0, 4)
      .map((d) => ({
        text: L === "ar" ? `يتضمن العمل قسماً واضحاً لـ ${lt(d.def.title, L)}.` : `Includes a clear section for the ${lt(d.def.title, L).toLowerCase()}.`,
        evidence: [{ ref: d.found!.ref, locator: d.found!.heading.slice(0, 80), quote: "" }],
      })),
    issues,
    assumptionsToValidate: [],
    revisionTasks,
    questionsForDesigner:
      L === "ar"
        ? ["ما الدليل الذي يدعم أهم قرار اتخذته في هذه المرحلة؟", "ما الذي ستفعله بشكل مختلف لو كان لديك أسبوع إضافي؟"]
        : ["What evidence supports the most important decision you made in this stage?", "What would you do differently with one more week?"],
    nextSteps:
      revisionTasks.length > 0
        ? [L === "ar" ? "عالج المهام الحرجة أولاً ثم أعد الإرسال." : "Address the critical tasks first, then resubmit."]
        : [L === "ar" ? "أكمل قائمة المهام ثم أكمل المرحلة." : "Finish the task checklist, then complete the stage."],
    limitations: [
      L === "ar"
        ? "مراجع تجريبي غير متصل: يتحقق من وجود المخرجات وطولها فقط، ولا يقرأ الصور ولا يقيّم الجودة."
        : "Offline demo reviewer: checks presence and length of deliverables only; it does not read images or assess quality.",
    ],
    confidence: hasUnavailable ? 60 : 90,
    previousTaskAssessments,
  };
}
