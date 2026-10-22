"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Dices, FileEdit, Loader2, PenLine, RefreshCcw, Save, Sparkles, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cancelJobAction, generateBriefAction, saveGeneratedProjectAction } from "@/app/actions/projects";
import { BriefEditor } from "@/components/brief/brief-editor";
import { briefToForm, formToBrief } from "@/components/brief/brief-form";
import { BriefView } from "@/components/brief/brief-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { BriefCore, ProjectBrief, StagePlan } from "@/domain/brief";
import { featureLabel, industryLabel } from "@/domain/catalog";
import { DIFFICULTIES, EXPERIENCE_LEVELS, FEATURE_SUGGESTIONS, INDUSTRIES, LOCALES, PLATFORMS, type Locale } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { useJob } from "@/hooks/use-job";
import { cn } from "@/lib/utils";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const FormSchema = z.object({
  concept: optionalText(300),
  industry: optionalText(80),
  problemArea: optionalText(300),
  targetAudience: optionalText(300),
  market: optionalText(120),
  platform: z.union([z.enum(PLATFORMS), z.literal("")]).transform((v) => (v ? v : undefined)),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  difficulty: z.enum(DIFFICULTIES),
  duration: optionalText(80),
  language: z.enum(LOCALES),
  constraints: optionalText(1000),
  portfolioOrientation: optionalText(300),
});
type FormInput = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

interface GeneratedResult {
  brief: ProjectBrief;
  source: "ai" | "mock";
  model: string;
  workflowTailored: boolean;
}

type Step = "mode" | "details" | "generating" | "review" | "edit";

export function GeneratorWizard({ locale, stageTitles, aiReady }: { locale: Locale; stageTitles: Record<string, string>; aiReady: boolean }) {
  const t = useTranslations("generator");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [features, setFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [lastInput, setLastInput] = useState<Record<string, unknown> | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [brief, setBrief] = useState<BriefCore | null>(null);
  const [workflow, setWorkflow] = useState<StagePlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, start] = useTransition();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(FormSchema),
    defaultValues: { experienceLevel: "intermediate", difficulty: "medium", language: locale, platform: "" },
  });

  const { job } = useJob(step === "generating" ? jobId : null, {
    onDone: (j) => {
      if (j.status === "succeeded") {
        const r = j.result as GeneratedResult;
        setResult(r);
        const { workflow: wf, ...core } = r.brief;
        setBrief(core);
        setWorkflow(wf);
        setStep("review");
      } else {
        setError(j.status === "cancelled" ? t("cancelled") : (j.errorMessage ?? t("failed")));
        setStep("details");
      }
    },
  });

  useEffect(() => {
    if (step !== "generating") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [step]);

  const launch = (input: Record<string, unknown>, avoid: string[] = []) => {
    setError(null);
    start(async () => {
      const res = await generateBriefAction(input, avoid);
      if (res.ok) {
        setLastInput(input);
        setJobId(res.data.jobId);
        setStep("generating");
      } else setError(res.error.message);
    });
  };

  const submitDetails = form.handleSubmit((values) => {
    if (mode === "custom" && features.length === 1) {
      setError(t("featureCountError"));
      return;
    }
    launch({ mode, ...values, focusFeatures: mode === "custom" ? features : [] });
  });

  const toggleFeature = (key: string) => {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : prev.length >= 4 ? prev : [...prev, key]));
  };

  const save = (asDraft: boolean) => {
    if (!brief || !jobId) return;
    start(async () => {
      const res = await saveGeneratedProjectAction({ jobId, brief, asDraft });
      if (res.ok) {
        toast.push(asDraft ? t("savedDraft") : t("created"), "success");
        router.push(`/projects/${res.data.projectId}`);
      } else toast.push(res.error.message, "error");
    });
  };

  if (step === "generating") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <div role="status" aria-live="polite">
            <p className="font-semibold">{job?.status === "queued" ? t("queued") : t("generating")}</p>
            <p className="mt-1 text-sm text-muted">{t("generatingHint")}</p>
            <p className="ltr-isolate mt-2 text-xs tabular-nums text-subtle">{t("elapsed", { s: elapsed })}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (jobId) void cancelJobAction(jobId);
            }}
          >
            <X aria-hidden />
            {tc("cancel")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if ((step === "review" || step === "edit") && brief && result) {
    return (
      <div className="flex flex-col gap-4">
        {result.source === "mock" ? (
          <Alert tone="warning" title={t("mockTitle")}>
            {t("mockBody")}
          </Alert>
        ) : (
          <Alert tone="info" title={t("aiTitle", { model: result.model })}>
            {t("aiBody")}
          </Alert>
        )}
        {!result.workflowTailored ? <Alert tone="info">{t("notTailored")}</Alert> : null}
        {step === "edit" ? (
          <BriefEditor
            defaultValues={briefToForm(brief)}
            submitLabel={t("applyEdits")}
            onSubmit={(v) => {
              setBrief({ ...formToBrief(v) });
              setStep("review");
            }}
            secondaryAction={
              <Button variant="outline" onClick={() => setStep("review")}>
                {tc("cancel")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="sticky top-14 z-10 flex flex-wrap gap-2 rounded-lg border border-border bg-surface/95 p-3 backdrop-blur lg:top-0">
              <Button onClick={() => save(false)} disabled={pending}>
                <Check aria-hidden />
                {t("accept")}
              </Button>
              <Button variant="outline" onClick={() => setStep("edit")} disabled={pending}>
                <PenLine aria-hidden />
                {t("edit")}
              </Button>
              <Button variant="outline" onClick={() => lastInput && launch(lastInput, [brief.title])} disabled={pending}>
                <RefreshCcw aria-hidden />
                {t("regenerate")}
              </Button>
              <Button variant="ghost" onClick={() => save(true)} disabled={pending}>
                <Save aria-hidden />
                {t("saveDraft")}
              </Button>
              <Button variant="ghost" className="ms-auto" onClick={() => setStep("details")} disabled={pending}>
                <ArrowLeft className="rtl:rotate-180" aria-hidden />
                {t("changeInputs")}
              </Button>
            </div>
            <BriefView brief={brief} workflow={workflow} stageTitles={stageTitles} />
          </>
        )}
      </div>
    );
  }

  if (step === "mode") {
    return (
      <div className="flex flex-col gap-4">
        {!aiReady ? <Alert tone="warning" title={t("demoTitle")}>{t("demoBody")}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={t("chooseMode")}>
          {(["random", "custom"] as const).map((m) => {
            const Icon = m === "random" ? Dices : FileEdit;
            const selected = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border bg-surface p-5 text-start transition-colors hover:border-primary",
                  selected ? "border-primary ring-2 ring-primary/20" : "border-border",
                )}
              >
                <span className="rounded-md bg-primary-soft p-2 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-semibold">{t(`${m}Title`)}</span>
                <span className="text-sm text-muted">{t(`${m}Body`)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setStep("details")}>{t("next")}</Button>
        </div>
      </div>
    );
  }

  // details
  const reg = form.register;
  const errs = form.formState.errors;
  return (
    <form onSubmit={submitDetails} className="flex flex-col gap-4" noValidate>
      {error ? <Alert tone="danger" role="alert" title={t("errorTitle")}>{error}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>{mode === "random" ? t("randomTitle") : t("customTitle")}</CardTitle>
          <p className="text-sm text-muted">{mode === "random" ? t("randomHint") : t("customHint")}</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {mode === "custom" ? (
            <>
              <Field id="gen-concept" label={t("concept")} optional={tc("optional")} className="md:col-span-2" hint={t("conceptHint")}>
                {(p) => <Input {...p} {...reg("concept")} />}
              </Field>
              <Field id="gen-industry" label={t("industry")} optional={tc("optional")} hint={t("industryHint")}>
                {(p) => (
                  <>
                    <Input {...p} list="industry-suggestions" {...reg("industry")} />
                    <datalist id="industry-suggestions">
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={lt(industryLabel(i), locale)} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field id="gen-market" label={t("market")} optional={tc("optional")}>
                {(p) => <Input {...p} placeholder={t("marketPlaceholder")} {...reg("market")} />}
              </Field>
              <Field id="gen-problem" label={t("problemArea")} optional={tc("optional")} className="md:col-span-2">
                {(p) => <Textarea {...p} rows={2} {...reg("problemArea")} />}
              </Field>
              <Field id="gen-audience" label={t("targetAudience")} optional={tc("optional")} className="md:col-span-2">
                {(p) => <Input {...p} {...reg("targetAudience")} />}
              </Field>
            </>
          ) : (
            <Field id="gen-industry" label={t("industry")} optional={tc("optional")}>
              {(p) => (
                <Select {...p} {...reg("industry")}>
                  <option value="">{t("anyIndustry")}</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {lt(industryLabel(i), locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field id="gen-platform" label={t("platform")} optional={tc("optional")}>
            {(p) => (
              <Select {...p} {...reg("platform")}>
                <option value="">{t("anyPlatform")}</option>
                {PLATFORMS.map((v) => (
                  <option key={v} value={v}>
                    {te(`platform.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="gen-level" label={t("experienceLevel")}>
            {(p) => (
              <Select {...p} {...reg("experienceLevel")}>
                {EXPERIENCE_LEVELS.map((v) => (
                  <option key={v} value={v}>
                    {te(`experience.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="gen-difficulty" label={t("difficulty")}>
            {(p) => (
              <Select {...p} {...reg("difficulty")}>
                {DIFFICULTIES.map((v) => (
                  <option key={v} value={v}>
                    {te(`difficulty.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="gen-language" label={t("language")} hint={t("languageHint")}>
            {(p) => (
              <Select {...p} {...reg("language")}>
                {LOCALES.map((v) => (
                  <option key={v} value={v}>
                    {te(`language.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {mode === "custom" ? (
            <>
              <Field id="gen-duration" label={t("duration")} optional={tc("optional")}>
                {(p) => <Input {...p} placeholder={t("durationPlaceholder")} {...reg("duration")} />}
              </Field>
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-medium">{t("focusFeatures")}</legend>
                <p className="mb-2 text-xs text-subtle">{t("focusFeaturesHint", { count: features.length })}</p>
                <div className="flex flex-wrap gap-2">
                  {[...FEATURE_SUGGESTIONS, ...features.filter((f) => !(FEATURE_SUGGESTIONS as readonly string[]).includes(f))].map((key) => {
                    const on = features.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFeature(key)}
                        disabled={!on && features.length >= 4}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-40",
                          on ? "border-primary bg-primary-soft text-primary" : "border-border-strong hover:bg-surface-muted",
                        )}
                      >
                        {lt(featureLabel(key), locale)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex max-w-md gap-2">
                  <Input
                    aria-label={t("customFeature")}
                    placeholder={t("customFeature")}
                    value={customFeature}
                    maxLength={80}
                    onChange={(e) => setCustomFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customFeature.trim() && features.length < 4) {
                          toggleFeature(customFeature.trim());
                          setCustomFeature("");
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={!customFeature.trim() || features.length >= 4}
                    onClick={() => {
                      toggleFeature(customFeature.trim());
                      setCustomFeature("");
                    }}
                  >
                    {t("add")}
                  </Button>
                </div>
              </fieldset>
              <Field id="gen-constraints" label={t("constraints")} optional={tc("optional")} className="md:col-span-2">
                {(p) => <Textarea {...p} rows={2} {...reg("constraints")} />}
              </Field>
              <Field id="gen-portfolio" label={t("portfolio")} optional={tc("optional")} className="md:col-span-2" hint={t("portfolioHint")}>
                {(p) => <Input {...p} {...reg("portfolioOrientation")} />}
              </Field>
            </>
          ) : null}
          {Object.keys(errs).length ? <p className="text-sm text-danger md:col-span-2">{t("invalidInputs")}</p> : null}
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep("mode")}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("back")}
        </Button>
        <Button type="submit" disabled={pending}>
          <Sparkles aria-hidden />
          {mode === "random" ? t("generateIdea") : t("generateBrief")}
        </Button>
      </div>
    </form>
  );
}
