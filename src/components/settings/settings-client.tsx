"use client";

import { Database, Download, FlaskConical, KeyRound, Languages, Monitor, Moon, PlugZap, Sun, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { clearAllDataAction, createBackupAction, loadSampleProjectAction, removeSampleProjectsAction } from "@/app/actions/data";
import { saveApiKeyAction, setLocaleAction, setThemeAction, testProviderAction, updateSettingsAction } from "@/app/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/domain/enums";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SecretInfo {
  configured: boolean;
  source: "env" | "file" | null;
  masked: string | null;
}

export interface SettingsData {
  displayName: string;
  locale: Locale;
  theme: "light" | "dark" | "system";
  aiProvider: "auto" | "anthropic" | "mock";
  aiModel: string;
  aiEffort: "low" | "medium" | "high" | "xhigh";
  maxUploadMb: number;
  strictness: "supportive" | "standard" | "demanding";
  defaultPracticeMode: boolean;
}

export function SettingsClient({
  settings,
  provider,
  anthropicKey,
  figmaToken,
  dataPaths,
  backups,
  sampleCount,
  hardMaxUploadMb,
  envProviderForced,
  projects,
}: {
  settings: SettingsData;
  provider: { active: string; reason: string; model: string; realProviderReady: boolean };
  anthropicKey: SecretInfo;
  figmaToken: SecretInfo;
  dataPaths: { root: string; database: string; uploads: string; backups: string };
  backups: { filename: string; sizeBytes: number; kind: string; createdAt: string }[];
  sampleCount: number;
  hardMaxUploadMb: number;
  envProviderForced: boolean;
  projects: { id: string; title: string }[];
}) {
  const t = useTranslations("settings");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(settings);
  const [keyInput, setKeyInput] = useState("");
  const [figmaInput, setFigmaInput] = useState("");
  const [keyError, setKeyError] = useState<string | undefined>();
  const [figmaError, setFigmaError] = useState<string | undefined>();
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [clearText, setClearText] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreText, setRestoreText] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const saveSettings = (patch: Partial<SettingsData>) =>
    start(async () => {
      const res = await updateSettingsAction(patch);
      if (res.ok) {
        toast.push(t("saved"), "success");
        router.refresh();
      } else toast.push(res.error.message, "error");
    });

  const section = "scroll-mt-20";
  return (
    <div className="flex flex-col gap-6">
      <Card id="general" className={section}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-4" aria-hidden />
            {t("general")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field id="set-language" label={t("language")} hint={t("languageHint")}>
            {(p) => (
              <Select
                {...p}
                value={settings.locale}
                onChange={(e) =>
                  start(async () => {
                    await setLocaleAction(e.target.value);
                    router.refresh();
                  })
                }
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </Select>
            )}
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">{t("theme")}</legend>
            <div className="inline-flex gap-1 rounded-md bg-surface-muted p-1">
              {(
                [
                  ["light", Sun],
                  ["dark", Moon],
                  ["system", Monitor],
                ] as const
              ).map(([value, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.theme === value}
                  onClick={() =>
                    start(async () => {
                      await setThemeAction(value);
                      const dark = value === "dark" || (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                      document.documentElement.classList.toggle("dark", dark);
                      router.refresh();
                    })
                  }
                  className={cn("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm", settings.theme === value ? "bg-surface font-medium shadow-sm" : "text-muted")}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`theme_${value}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card id="ai" className={section}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="size-4" aria-hidden />
            {t("ai")}
          </CardTitle>
          <p className="text-sm text-muted">{t("aiHint")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {provider.active === "mock" ? (
            <Alert tone="warning" title={t("mockActiveTitle")}>
              {t(`mockReason.${provider.reason}`)}
            </Alert>
          ) : (
            <Alert tone="success" title={t("realActiveTitle", { model: provider.model })}>
              {t("realActiveBody")}
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="set-provider" label={t("provider")} hint={envProviderForced ? t("providerForced") : undefined}>
              {(p) => (
                <Select {...p} value={form.aiProvider} disabled={envProviderForced} onChange={(e) => { const v = e.target.value as SettingsData["aiProvider"]; setForm({ ...form, aiProvider: v }); saveSettings({ aiProvider: v }); }}>
                  <option value="auto">{t("providerAuto")}</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="mock">{t("providerMock")}</option>
                </Select>
              )}
            </Field>
            <Field id="set-model" label={t("model")} hint={t("modelHint")}>
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} dir="ltr" list="model-suggestions" value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })} />
                  <datalist id="model-suggestions">
                    <option value="claude-opus-5-5" />
                    <option value="claude-sonnet-5-5" />
                    <option value="claude-haiku-5-5" />
                    <option value="claude-fable-5-1" />
                  </datalist>
                  <Button variant="outline" disabled={pending || !form.aiModel.trim() || form.aiModel === settings.aiModel} onClick={() => saveSettings({ aiModel: form.aiModel.trim() })}>
                    {tc("save")}
                  </Button>
                </div>
              )}
            </Field>
            <Field id="set-effort" label={t("effort")} hint={t("effortHint")}>
              {(p) => (
                <Select {...p} value={form.aiEffort} onChange={(e) => { const v = e.target.value as SettingsData["aiEffort"]; setForm({ ...form, aiEffort: v }); saveSettings({ aiEffort: v }); }}>
                  {(["low", "medium", "high", "xhigh"] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`effort_${v}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <SecretField
            id="anthropic-key"
            icon={<KeyRound className="size-4" aria-hidden />}
            label={t("anthropicKey")}
            hint={t("anthropicKeyHint")}
            info={anthropicKey}
            value={keyInput}
            setValue={setKeyInput}
            error={keyError}
            pending={pending}
            onSave={() =>
              start(async () => {
                setKeyError(undefined);
                const res = await saveApiKeyAction("anthropicApiKey", keyInput);
                if (res.ok) {
                  setKeyInput("");
                  toast.push(t("keySaved"), "success");
                  router.refresh();
                } else setKeyError(res.error.message);
              })
            }
            onRemove={() =>
              start(async () => {
                const res = await saveApiKeyAction("anthropicApiKey", null);
                if (res.ok) router.refresh();
                else toast.push(res.error.message, "error");
              })
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setTestResult(null);
                  const res = await testProviderAction();
                  setTestResult(res.ok ? { ok: true, text: t("testOk", { provider: res.data.provider, detail: res.data.detail }) } : { ok: false, text: res.error.message });
                })
              }
            >
              <PlugZap aria-hidden />
              {t("testConnection")}
            </Button>
            {testResult ? (
              <p role="status" className={cn("text-sm", testResult.ok ? "text-success" : "text-danger")}>
                {testResult.text}
              </p>
            ) : null}
          </div>
          <SecretField
            id="figma-token"
            icon={<KeyRound className="size-4" aria-hidden />}
            label={t("figmaToken")}
            hint={t("figmaTokenHint")}
            info={figmaToken}
            value={figmaInput}
            setValue={setFigmaInput}
            error={figmaError}
            pending={pending}
            onSave={() =>
              start(async () => {
                setFigmaError(undefined);
                const res = await saveApiKeyAction("figmaAccessToken", figmaInput);
                if (res.ok) {
                  setFigmaInput("");
                  toast.push(t("keySaved"), "success");
                  router.refresh();
                } else setFigmaError(res.error.message);
              })
            }
            onRemove={() =>
              start(async () => {
                const res = await saveApiKeyAction("figmaAccessToken", null);
                if (res.ok) router.refresh();
                else toast.push(res.error.message, "error");
              })
            }
          />
          <p className="text-xs text-subtle">{t("secretStorage")}</p>
        </CardContent>
      </Card>

      <Card id="reviews" className={section}>
        <CardHeader>
          <CardTitle>{t("reviewsSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field id="set-strictness" label={t("strictness")} hint={t("strictnessHint")}>
            {(p) => (
              <Select {...p} value={form.strictness} onChange={(e) => { const v = e.target.value as SettingsData["strictness"]; setForm({ ...form, strictness: v }); saveSettings({ strictness: v }); }}>
                {(["supportive", "standard", "demanding"] as const).map((v) => (
                  <option key={v} value={v}>
                    {te(`strictness.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="set-upload" label={t("maxUpload")} hint={t("maxUploadHint", { max: hardMaxUploadMb })}>
            {(p) => (
              <div className="flex gap-2">
                <Input {...p} type="number" min={1} max={hardMaxUploadMb} value={form.maxUploadMb} onChange={(e) => setForm({ ...form, maxUploadMb: Number(e.target.value) })} className="w-28" />
                <Button variant="outline" disabled={pending || form.maxUploadMb === settings.maxUploadMb || form.maxUploadMb < 1 || form.maxUploadMb > hardMaxUploadMb} onClick={() => saveSettings({ maxUploadMb: Math.round(form.maxUploadMb) })}>
                  {tc("save")}
                </Button>
              </div>
            )}
          </Field>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <Checkbox className="mt-0.5" checked={form.defaultPracticeMode} onChange={(e) => { setForm({ ...form, defaultPracticeMode: e.target.checked }); saveSettings({ defaultPracticeMode: e.target.checked }); }} />
            <span>
              <span className="font-medium">{t("defaultPractice")}</span>
              <span className="block text-xs text-muted">{t("defaultPracticeHint")}</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card id="data" className={section}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" aria-hidden />
            {t("data")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Alert tone="info" title={t("localTitle")}>
            {t("localBody")}
          </Alert>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-subtle">{t("dataDir")}</dt>
            <dd className="ltr-isolate break-all font-mono text-xs">{dataPaths.root}</dd>
            <dt className="text-subtle">{t("database")}</dt>
            <dd className="ltr-isolate break-all font-mono text-xs">{dataPaths.database}</dd>
            <dt className="text-subtle">{t("uploads")}</dt>
            <dd className="ltr-isolate break-all font-mono text-xs">{dataPaths.uploads}</dd>
            <dt className="text-subtle">{t("backups")}</dt>
            <dd className="ltr-isolate break-all font-mono text-xs">{dataPaths.backups}</dd>
          </dl>
          <p className="text-xs text-subtle">{t("dataDirHint")}</p>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("backupTitle")}</h3>
            <p className="mb-2 text-sm text-muted">{t("backupBody")}</p>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await createBackupAction();
                  if (res.ok) {
                    toast.push(t("backupCreated"), "success");
                    router.refresh();
                  } else toast.push(res.error.message, "error");
                })
              }
            >
              <Download aria-hidden />
              {t("createBackup")}
            </Button>
            {backups.length ? (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {backups.map((b) => (
                  <li key={b.filename} className="flex flex-wrap items-center gap-2">
                    <a className="ltr-isolate break-all text-primary hover:underline" href={`/api/backups/${b.filename}`} download>
                      {b.filename}
                    </a>
                    <span className="text-xs text-subtle">
                      {formatBytes(b.sizeBytes, settings.locale)} · {formatDateTime(b.createdAt, settings.locale)}
                    </span>
                    {b.kind === "pre_restore" ? <Badge>{t("safetyBackup")}</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("exportTitle")}</h3>
            <p className="mb-2 text-sm text-muted">{t("exportBody")}</p>
            {projects.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {projects.map((p) => (
                  <li key={p.id}>
                    <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`/api/projects/${p.id}/export`} download dir="auto">
                      <Download className="size-3.5" aria-hidden />
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle">{t("noProjects")}</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("restoreTitle")}</h3>
            <p className="mb-2 text-sm text-muted">{t("restoreBody")}</p>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!restoreFile) return;
                setRestoreError(null);
                start(async () => {
                  const fd = new FormData();
                  fd.append("file", restoreFile);
                  fd.append("confirm", restoreText);
                  const res = await fetch("/api/restore", { method: "POST", body: fd });
                  const body = (await res.json()) as { ok: boolean; error?: { message: string } };
                  if (body.ok) {
                    toast.push(t("restored"), "success");
                    setRestoreText("");
                    setRestoreFile(null);
                    router.refresh();
                  } else setRestoreError(body.error?.message ?? t("restoreFailed"));
                });
              }}
            >
              <Field id="restore-file" label={t("backupFile")}>
                {(p) => <input {...p} type="file" accept=".zip,application/zip" className="text-sm" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />}
              </Field>
              <Field id="restore-confirm" label={t("typeRestore")}>
                {(p) => <Input {...p} dir="ltr" value={restoreText} onChange={(e) => setRestoreText(e.target.value)} className="w-40" autoComplete="off" />}
              </Field>
              <Button type="submit" variant="outline" disabled={pending || !restoreFile || restoreText !== "RESTORE"}>
                <Upload aria-hidden />
                {t("restore")}
              </Button>
            </form>
            {restoreError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {restoreError}
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("sampleTitle")}</h3>
            <p className="mb-2 text-sm text-muted">{t("sampleBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await loadSampleProjectAction();
                    if (res.ok) router.push("/projects");
                    else toast.push(res.error.message, "error");
                  })
                }
              >
                <FlaskConical aria-hidden />
                {t("loadSample")}
              </Button>
              <Button
                variant="ghost"
                disabled={pending || sampleCount === 0}
                onClick={() =>
                  start(async () => {
                    const res = await removeSampleProjectsAction();
                    if (res.ok) {
                      toast.push(t("samplesRemoved", { count: res.data.removed }), "success");
                      router.refresh();
                    } else toast.push(res.error.message, "error");
                  })
                }
              >
                {t("removeSamples", { count: sampleCount })}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-danger/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-danger">{t("dangerTitle")}</h3>
            <p className="mb-3 text-sm text-muted">{t("dangerBody")}</p>
            <Dialog onOpenChange={() => setClearText("")}>
              <DialogTrigger asChild>
                <Button variant="danger">
                  <Trash2 aria-hidden />
                  {t("clearAll")}
                </Button>
              </DialogTrigger>
              <DialogContent closeLabel={tc("close")}>
                <DialogTitle>{t("clearTitle")}</DialogTitle>
                <DialogDescription>{t("clearBody")}</DialogDescription>
                <div className="mt-4">
                  <Field id="clear-confirm" label={t("typeDelete")}>
                    {(p) => <Input {...p} dir="ltr" value={clearText} onChange={(e) => setClearText(e.target.value)} autoComplete="off" />}
                  </Field>
                </div>
                <DialogFooter>
                  <Button
                    variant="danger"
                    disabled={pending || clearText !== "DELETE"}
                    onClick={() =>
                      start(async () => {
                        const res = await clearAllDataAction(clearText);
                        if (res.ok) {
                          toast.push(t("cleared"), "success");
                          router.push("/");
                          router.refresh();
                        } else toast.push(res.error.message, "error");
                      })
                    }
                  >
                    {t("clearConfirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecretField({
  id,
  icon,
  label,
  hint,
  info,
  value,
  setValue,
  error,
  pending,
  onSave,
  onRemove,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  info: SecretInfo;
  value: string;
  setValue: (v: string) => void;
  error?: string;
  pending: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {icon}
        {label}
        {info.configured ? (
          <Badge variant="success">
            {t(info.source === "env" ? "fromEnv" : "fromFile")} · <span className="ltr-isolate">{info.masked}</span>
          </Badge>
        ) : (
          <Badge>{t("notSet")}</Badge>
        )}
      </div>
      {info.source !== "env" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <Field id={id} label={<span className="sr-only">{label}</span>} hint={hint} error={error} className="flex-1">
            {(p) => <Input {...p} type="password" dir="ltr" autoComplete="off" spellCheck={false} placeholder={info.configured ? t("replaceKey") : t("enterKey")} value={value} onChange={(e) => setValue(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={pending || value.trim().length < 20}>
            {tc("save")}
          </Button>
          {info.configured ? (
            <Button variant="ghost" className="text-danger" disabled={pending} onClick={onRemove}>
              {t("removeKey")}
            </Button>
          ) : null}
        </form>
      ) : (
        <p className="text-xs text-subtle">{t("envManaged")}</p>
      )}
    </div>
  );
}
