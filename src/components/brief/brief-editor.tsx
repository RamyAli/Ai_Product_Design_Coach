"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { DIFFICULTIES, EXPERIENCE_LEVELS, LOCALES, PLATFORMS } from "@/domain/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { BriefFormSchema, type BriefFormValues } from "./brief-form";

function errorText(errors: FieldErrors<BriefFormValues>, path: string, fallback: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = errors;
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  return node ? fallback : undefined;
}

/** Structured editor for every brief field. List fields take one item per line. */
export function BriefEditor({
  defaultValues,
  onSubmit,
  submitLabel,
  busy,
  secondaryAction,
}: {
  defaultValues: BriefFormValues;
  onSubmit: (values: BriefFormValues) => void;
  submitLabel: string;
  busy?: boolean;
  secondaryAction?: React.ReactNode;
}) {
  const t = useTranslations("brief");
  const te = useTranslations("enums");
  const tv = useTranslations("validation");
  const form = useForm<BriefFormValues>({ resolver: zodResolver(BriefFormSchema), defaultValues, mode: "onBlur" });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;
  const users = useFieldArray({ control, name: "targetUsers" });
  const features = useFieldArray({ control, name: "focusFeatures" });
  const metrics = useFieldArray({ control, name: "successMetrics" });
  const err = (path: string) => errorText(errors, path, tv("invalid"));

  const listField = (name: keyof BriefFormValues, label: string) => (
    <Field id={`brief-${name}`} label={label} hint={t("onePerLine")} error={err(name)}>
      {(p) => <Textarea {...p} rows={4} {...register(name)} />}
    </Field>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {tv("fixErrors")}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("basics")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field id="brief-title" label={t("titleField")} error={err("title") && tv("minLength", { n: 3 })} className="md:col-span-2">
            {(p) => <Input {...p} {...register("title")} />}
          </Field>
          <Field id="brief-summary" label={t("summary")} error={err("summary") && tv("minLength", { n: 10 })} className="md:col-span-2">
            {(p) => <Textarea {...p} rows={3} {...register("summary")} />}
          </Field>
          <Field id="brief-industry" label={t("industry")} error={err("industry")}>
            {(p) => <Input {...p} {...register("industry")} />}
          </Field>
          <Field id="brief-market" label={t("market")}>
            {(p) => <Input {...p} {...register("market")} />}
          </Field>
          <Field id="brief-platform" label={t("platform")}>
            {(p) => (
              <Select {...p} {...register("platform")}>
                {PLATFORMS.map((v) => (
                  <option key={v} value={v}>
                    {te(`platform.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="brief-language" label={t("language")} hint={t("languageHint")}>
            {(p) => (
              <Select {...p} {...register("language")}>
                {LOCALES.map((v) => (
                  <option key={v} value={v}>
                    {te(`language.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="brief-experience" label={t("experienceLevel")}>
            {(p) => (
              <Select {...p} {...register("experienceLevel")}>
                {EXPERIENCE_LEVELS.map((v) => (
                  <option key={v} value={v}>
                    {te(`experience.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="brief-difficulty" label={t("difficulty")}>
            {(p) => (
              <Select {...p} {...register("difficulty")}>
                {DIFFICULTIES.map((v) => (
                  <option key={v} value={v}>
                    {te(`difficulty.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("problem")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field id="brief-problemStatement" label={t("problemStatement")} error={err("problemStatement") && tv("minLength", { n: 10 })}>
            {(p) => <Textarea {...p} rows={3} {...register("problemStatement")} />}
          </Field>
          <Field id="brief-problemContext" label={t("problemContext")}>
            {(p) => <Textarea {...p} rows={3} {...register("problemContext")} />}
          </Field>
          <Field id="brief-businessOpportunity" label={t("businessOpportunity")}>
            {(p) => <Textarea {...p} rows={3} {...register("businessOpportunity")} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("focusFeatures")}</CardTitle>
          <p className="text-sm text-muted">{t("focusFeaturesHint")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {features.fields.map((f, i) => (
            <fieldset key={f.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_2fr_auto]">
              <legend className="sr-only">{t("featureN", { n: i + 1 })}</legend>
              <Field id={`ff-name-${i}`} label={t("featureName")} error={err(`focusFeatures.${i}.name`)}>
                {(p) => <Input {...p} {...register(`focusFeatures.${i}.name`)} />}
              </Field>
              <Field id={`ff-desc-${i}`} label={t("featureDescription")}>
                {(p) => <Input {...p} {...register(`focusFeatures.${i}.description`)} />}
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" size="icon" aria-label={t("removeFeature", { n: i + 1 })} disabled={features.fields.length <= 2} onClick={() => features.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </fieldset>
          ))}
          {errors.focusFeatures?.root || errors.focusFeatures?.message ? <p className="text-xs text-danger">{tv("features")}</p> : null}
          <Button variant="outline" size="sm" className="self-start" disabled={features.fields.length >= 4} onClick={() => features.append({ id: "", name: "", description: "", userValue: "" })}>
            <Plus aria-hidden />
            {t("addFeature")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("targetUsers")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {users.fields.map((u, i) => (
            <fieldset key={u.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2">
              <legend className="sr-only">{t("segmentN", { n: i + 1 })}</legend>
              <Field id={`tu-seg-${i}`} label={t("segment")} error={err(`targetUsers.${i}.segment`)}>
                {(p) => <Input {...p} {...register(`targetUsers.${i}.segment`)} />}
              </Field>
              <Field id={`tu-desc-${i}`} label={t("segmentDescription")}>
                {(p) => <Input {...p} {...register(`targetUsers.${i}.description`)} />}
              </Field>
              <Field id={`tu-needs-${i}`} label={t("needs")} hint={t("onePerLine")} className="md:col-span-2">
                {(p) => <Textarea {...p} rows={2} {...register(`targetUsers.${i}.needs`)} />}
              </Field>
              <Button variant="ghost" size="sm" className="justify-self-start text-danger" disabled={users.fields.length <= 1} onClick={() => users.remove(i)}>
                <Trash2 aria-hidden />
                {t("removeSegment")}
              </Button>
            </fieldset>
          ))}
          <Button variant="outline" size="sm" className="self-start" disabled={users.fields.length >= 5} onClick={() => users.append({ segment: "", description: "", needs: "" })}>
            <Plus aria-hidden />
            {t("addSegment")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("successMetrics")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {metrics.fields.map((m, i) => (
            <fieldset key={m.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[2fr_1fr_2fr_auto]">
              <legend className="sr-only">{t("metricN", { n: i + 1 })}</legend>
              <Field id={`sm-metric-${i}`} label={t("metric")} error={err(`successMetrics.${i}.metric`)}>
                {(p) => <Input {...p} {...register(`successMetrics.${i}.metric`)} />}
              </Field>
              <Field id={`sm-target-${i}`} label={t("target")}>
                {(p) => <Input {...p} {...register(`successMetrics.${i}.target`)} />}
              </Field>
              <Field id={`sm-rat-${i}`} label={t("rationale")}>
                {(p) => <Input {...p} {...register(`successMetrics.${i}.rationale`)} />}
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" size="icon" aria-label={t("removeMetric", { n: i + 1 })} disabled={metrics.fields.length <= 1} onClick={() => metrics.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </fieldset>
          ))}
          <Button variant="outline" size="sm" className="self-start" disabled={metrics.fields.length >= 8} onClick={() => metrics.append({ metric: "", target: "", rationale: "" })}>
            <Plus aria-hidden />
            {t("addMetric")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {listField("primaryUserGoals", t("primaryUserGoals"))}
          {listField("businessObjectives", t("businessObjectives"))}
          {listField("inScope", t("inScope"))}
          {listField("outOfScope", t("outOfScope"))}
          {listField("constraints", t("constraints"))}
          {listField("assumptions", t("assumptions"))}
          {listField("risks", t("risks"))}
          {listField("edgeCases", t("edgeCases"))}
          <Field id="brief-effort" label={t("estimatedEffort")}>
            {(p) => <Input {...p} {...register("estimatedEffort")} />}
          </Field>
          <Field id="brief-rationale" label={t("whyThisChallenge")}>
            {(p) => <Textarea {...p} rows={3} {...register("challengeRationale")} />}
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        {secondaryAction}
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
