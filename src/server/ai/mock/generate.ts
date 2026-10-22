import type { BriefCore, GeneratorInput, StageCustomizationOutput } from "@/domain/brief";
import { featureLabel, industryLabel } from "@/domain/catalog";
import { STAGE_DEFINITIONS } from "@/domain/stages/definitions";
import type { Locale } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { SAMPLE_IDEAS, type SampleIdea } from "./ideas";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickSampleIdea(input: GeneratorInput, avoidTitles: string[]): SampleIdea {
  const avoid = new Set(avoidTitles.map((t) => t.toLowerCase()));
  let candidates = SAMPLE_IDEAS.filter(
    (i) => !avoid.has(lt(i.title, "en").toLowerCase()) && !avoid.has(lt(i.title, "ar").toLowerCase()),
  );
  if (input.industry) {
    const byIndustry = candidates.filter((i) => i.industry === input.industry);
    if (byIndustry.length) candidates = byIndustry;
  }
  if (input.platform) {
    const byPlatform = candidates.filter((i) => i.platform === input.platform);
    if (byPlatform.length) candidates = byPlatform;
  }
  if (candidates.length === 0) candidates = SAMPLE_IDEAS;
  const seed = hash(`${input.industry ?? ""}|${input.platform ?? ""}|${input.difficulty}|${avoidTitles.length}`);
  return candidates[seed % candidates.length]!;
}

const T = {
  effort: {
    easy: { en: "About 15–25 hours across all stages", ar: "نحو 15–25 ساعة لجميع المراحل" },
    medium: { en: "About 30–45 hours across all stages", ar: "نحو 30–45 ساعة لجميع المراحل" },
    hard: { en: "About 50–70 hours across all stages", ar: "نحو 50–70 ساعة لجميع المراحل" },
  },
  rationale: {
    en: "This brief combines a real-feeling constraint set with features that interact, so you must make trade-offs instead of designing screens in isolation. It is a fictional practice brief, not a validated market opportunity.",
    ar: "يجمع هذا الموجز قيوداً واقعية مع ميزات متداخلة، لذا ستضطر للموازنة بين الخيارات بدلاً من تصميم شاشات معزولة. إنه موجز تدريبي خيالي وليس فرصة سوقية مُتحقق منها.",
  },
  outOfScope: [
    { en: "Native platform-specific features beyond the core flows", ar: "ميزات المنصة الأصلية خارج التدفقات الأساسية" },
    { en: "Marketing website and pricing pages", ar: "موقع تسويقي وصفحات الأسعار" },
    { en: "Back-office administration tools", ar: "أدوات الإدارة الداخلية" },
  ],
  assumptions: [
    { en: "Target users already own a smartphone and use similar apps (assumption — validate in research).", ar: "يمتلك المستخدمون المستهدفون هواتف ذكية ويستخدمون تطبيقات مشابهة (افتراض — يُتحقق منه في البحث)." },
    { en: "The core problem happens often enough to justify a dedicated tool (assumption).", ar: "تتكرر المشكلة الأساسية بما يكفي لتبرير أداة مخصصة (افتراض)." },
  ],
  risks: [
    { en: "Low adoption if the first-use experience asks for too much information.", ar: "ضعف التبني إذا طلبت تجربة الاستخدام الأولى معلومات كثيرة." },
    { en: "Trust issues if system status is unclear.", ar: "مشكلات ثقة إذا كانت حالة النظام غير واضحة." },
  ],
  goals: [
    { en: "Complete the core task without outside help", ar: "إنجاز المهمة الأساسية دون مساعدة خارجية" },
    { en: "Understand status and next steps at any time", ar: "فهم الحالة والخطوات التالية في أي وقت" },
  ],
  objectives: [
    { en: "Prove the core workflow is valuable enough for repeat use", ar: "إثبات أن سير العمل الأساسي ذو قيمة كافية لتكرار الاستخدام" },
    { en: "Reduce support effort caused by the current manual process", ar: "تقليل جهد الدعم الناتج عن العملية اليدوية الحالية" },
  ],
};

function customFeature(name: string, language: Locale) {
  const label = lt(featureLabel(name), language);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || `feature_${hash(name) % 1000}`,
    name: label,
    description:
      language === "ar"
        ? `ميزة ${label} مصممة حول المهمة الأساسية للمستخدم.`
        : `${label} designed around the user's core task.`,
    userValue: language === "ar" ? "تقلل الجهد وتزيد الوضوح." : "Reduces effort and increases clarity.",
  };
}

export function buildMockBrief(input: GeneratorInput, idea: SampleIdea | null): BriefCore {
  const L = input.language;
  const base = idea ?? pickSampleIdea(input, []);
  let features = base.features.map((f, i) => ({
    id: `feature_${i + 1}`,
    name: lt(f.name, L),
    description: lt(f.description, L),
    userValue: lt(f.userValue, L),
  }));
  if (input.mode === "custom" && input.focusFeatures.length >= 2) {
    features = input.focusFeatures.slice(0, 4).map((f) => customFeature(f, L));
  } else if (input.mode === "custom" && input.focusFeatures.length === 1) {
    features = [customFeature(input.focusFeatures[0]!, L), ...features].slice(0, 3);
  }
  features = features.slice(0, 4);

  const industry = input.industry ? lt(industryLabel(input.industry), L) : lt(industryLabel(base.industry), L);
  const title =
    input.mode === "custom" && input.concept
      ? input.concept.slice(0, 120)
      : lt(base.title, L);
  const problemContext =
    input.mode === "custom" && input.problemArea
      ? input.problemArea
      : lt(base.problem, L);
  const users =
    input.mode === "custom" && input.targetAudience
      ? [
          {
            segment: input.targetAudience.slice(0, 80),
            description: input.targetAudience,
            needs: base.users[0]!.needs.map((n) => lt(n, L)),
          },
        ]
      : base.users.map((u) => ({ segment: lt(u.segment, L), description: lt(u.description, L), needs: u.needs.map((n) => lt(n, L)) }));
  const constraints = base.constraints.map((c) => lt(c, L));
  if (input.constraints) constraints.unshift(input.constraints);
  if (input.duration) constraints.push(L === "ar" ? `المدة المتاحة: ${input.duration}` : `Time available: ${input.duration}`);

  return {
    title,
    summary: lt(base.concept, L),
    problemContext,
    problemStatement:
      L === "ar"
        ? `${users[0]!.segment} يحتاجون إلى طريقة أوضح للتعامل مع: ${problemContext}`
        : `${users[0]!.segment} need a clearer way to deal with this: ${problemContext}`,
    businessOpportunity: lt(base.opportunity, L),
    targetUsers: users,
    industry,
    market: input.market || (L === "ar" ? "سوق تجريبي (خيالي)" : "Practice market (fictional)"),
    platform: input.platform ?? base.platform,
    experienceLevel: input.experienceLevel,
    difficulty: input.difficulty,
    language: L,
    focusFeatures: features,
    primaryUserGoals: T.goals.map((g) => lt(g, L)),
    businessObjectives: T.objectives.map((o) => lt(o, L)),
    successMetrics: base.metrics.map((m) => ({ metric: lt(m.metric, L), target: lt(m.target, L), rationale: lt(m.rationale, L) })),
    constraints,
    inScope: features.map((f) => f.name),
    outOfScope: T.outOfScope.map((o) => lt(o, L)),
    assumptions: T.assumptions.map((a) => lt(a, L)),
    risks: T.risks.map((r) => lt(r, L)),
    edgeCases: base.edgeCases.map((e) => lt(e, L)),
    estimatedEffort: input.duration || lt(T.effort[input.difficulty], L),
    challengeRationale:
      lt(T.rationale, L) + (input.portfolioOrientation ? (L === "ar" ? ` تركيز الملف: ${input.portfolioOrientation}` : ` Portfolio focus: ${input.portfolioOrientation}`) : ""),
  };
}

export function buildMockCustomization(brief: BriefCore): StageCustomizationOutput {
  const L = brief.language;
  const featureNames = brief.focusFeatures.map((f) => f.name).join(L === "ar" ? "، " : ", ");
  return {
    stages: STAGE_DEFINITIONS.map((def) => ({
      stageKey: def.key,
      focus:
        L === "ar"
          ? `ركّز في هذه المرحلة على ${lt(def.title, "ar")} لمشروع «${brief.title}» مع الانتباه إلى: ${featureNames}.`
          : `Apply ${lt(def.title, "en").toLowerCase()} to "${brief.title}", paying attention to: ${featureNames}.`,
      tailoredTasks:
        def.key === "architecture" || def.key === "wireframes"
          ? brief.focusFeatures.slice(0, 2).map((f) => ({
              title: L === "ar" ? `غطِّ ميزة «${f.name}» بالكامل` : `Cover the "${f.name}" feature end to end`,
              description: L === "ar" ? `بما في ذلك الحالات الطرفية: ${brief.edgeCases[0] ?? ""}` : `Including edge cases such as: ${brief.edgeCases[0] ?? "error recovery"}`,
            }))
          : [],
      deliverableNotes: [],
      criteriaGuidance: [],
    })),
  };
}
