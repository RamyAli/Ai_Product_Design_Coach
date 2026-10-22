"use client";

import { AlertTriangle, Bold, Eye, FileText, Heading2, Image as ImageIcon, Link2, List, Loader2, PenLine, RotateCcw, Send, Table, Trash2, Upload, X, Frame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  addFigmaLinkAction,
  discardDraftAction,
  ensureDraftAction,
  estimateReviewAction,
  removeAssetAction,
  retryAssetAction,
  saveDraftAction,
  submitDraftAction,
} from "@/app/actions/submissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { Alert, Progress, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/domain/enums";
import { formatBytes, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssetDto } from "@/server/dto";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";
const ALLOWED_EXT = /\.(png|jpe?g|webp|pdf)$/i;
const MAX_TEXT = 60_000;
const MAX_NOTES = 8_000;

interface DraftProps {
  id: string;
  textContent: string;
  notes: string;
  updatedAt: string;
  assets: AssetDto[];
}

interface UploadRow {
  key: string;
  name: string;
  size: number;
  progress: number;
  phase: "uploading" | "processing";
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "error"; message: string };

interface Estimate {
  provider: string;
  model: string;
  isMock: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  imagesSent: number;
  pdfPagesSent: number;
  limitations: string[];
}

export function SubmissionEditor({
  stageId,
  stageHref,
  stageCompleted,
  draft,
  deliverables,
  templates,
  maxUploadMb,
  maxFiles,
  uiLocale,
}: {
  stageId: string;
  stageHref: string;
  stageCompleted: boolean;
  draft: DraftProps | null;
  deliverables: { id: string; title: string; mandatory: boolean; evidence: string }[];
  templates: { id: string; title: string; body: string }[];
  maxUploadMb: number;
  maxFiles: number;
  uiLocale: Locale;
}) {
  const t = useTranslations("submission");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const backupKey = `pdc.draft.${stageId}`;

  const [submissionId, setSubmissionId] = useState<string | null>(draft?.id ?? null);
  const [text, setText] = useState(draft?.textContent ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [assets, setAssets] = useState<AssetDto[]>(draft?.assets ?? []);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [save, setSave] = useState<SaveState>(draft ? { kind: "saved", at: new Date(draft.updatedAt) } : { kind: "idle" });
  const [dirty, setDirty] = useState(false);
  const [restore, setRestore] = useState<{ text: string; notes: string } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, start] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ensuring = useRef<Promise<string | null> | null>(null);
  const latest = useRef({ text, notes });
  latest.current = { text, notes };

  // Offer to restore text kept locally after a failed save or closed tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const b = JSON.parse(raw) as { text: string; notes: string };
      if (b.text !== (draft?.textContent ?? "") || b.notes !== (draft?.notes ?? "")) setRestore(b);
      else localStorage.removeItem(backupKey);
    } catch {
      // ignore
    }
  }, [backupKey, draft?.textContent, draft?.notes]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || save.kind === "saving" || uploads.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, save.kind, uploads.length]);

  const ensureId = useCallback(async (): Promise<string | null> => {
    if (submissionId) return submissionId;
    if (!ensuring.current) {
      ensuring.current = ensureDraftAction(stageId).then((res) => {
        if (res.ok) {
          setSubmissionId(res.data.submissionId);
          return res.data.submissionId;
        }
        toast.push(res.error.message, "error");
        ensuring.current = null;
        return null;
      });
    }
    return ensuring.current;
  }, [submissionId, stageId, toast]);

  const flush = useCallback(async (): Promise<boolean> => {
    const id = await ensureId();
    if (!id) return false;
    const snapshot = { ...latest.current };
    setSave({ kind: "saving" });
    const res = await saveDraftAction(id, { textContent: snapshot.text, notes: snapshot.notes });
    if (res.ok) {
      setSave({ kind: "saved", at: new Date(res.data.updatedAt) });
      if (latest.current.text === snapshot.text && latest.current.notes === snapshot.notes) {
        setDirty(false);
        try {
          localStorage.removeItem(backupKey);
        } catch {
          // ignore
        }
      }
      return true;
    }
    setSave({ kind: "error", message: res.error.message });
    return false;
  }, [ensureId, backupKey]);

  // Debounced autosave; local backup is written on every change.
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(backupKey, JSON.stringify({ text, notes }));
    } catch {
      // ignore
    }
    const id = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(id);
  }, [text, notes, dirty, flush, backupKey]);

  const insert = (before: string, after = "", placeholder = "") => {
    const el = textRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const selected = text.slice(s, e) || placeholder;
    const next = text.slice(0, s) + before + selected + after + text.slice(e);
    setText(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const uploadOne = (file: File): Promise<void> =>
    new Promise((resolve) => {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setUploads((u) => [...u, { key, name: file.name, size: file.size, progress: 0, phase: "uploading" }]);
      const form = new FormData();
      form.append("stageId", stageId);
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploads((u) => u.map((r) => (r.key === key ? { ...r, progress: pct, phase: pct >= 100 ? "processing" : "uploading" } : r)));
        }
      };
      const finish = () => {
        setUploads((u) => u.filter((r) => r.key !== key));
        resolve();
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText) as { ok: boolean; data?: { submissionId: string; asset: AssetDto }; error?: { message: string } };
          if (body.ok && body.data) {
            setSubmissionId(body.data.submissionId);
            setAssets((a) => [...a, body.data!.asset]);
            if (body.data.asset.extractionStatus === "failed") toast.push(t("processingFailed", { name: file.name }), "error");
          } else setUploadErrors((e) => [...e, body.error?.message ?? t("uploadFailed", { name: file.name })]);
        } catch {
          setUploadErrors((e) => [...e, t("uploadFailed", { name: file.name })]);
        }
        finish();
      };
      xhr.onerror = () => {
        setUploadErrors((e) => [...e, t("uploadFailed", { name: file.name })]);
        finish();
      };
      xhr.send(form);
    });

  const handleFiles = async (list: FileList | File[]) => {
    setUploadErrors([]);
    const files = Array.from(list);
    const room = maxFiles - assets.filter((a) => a.kind !== "figma").length;
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const f of files) {
      if (!ALLOWED_EXT.test(f.name)) errors.push(t("typeRejected", { name: f.name }));
      else if (f.size > maxUploadMb * 1024 * 1024) errors.push(t("sizeRejected", { name: f.name, max: maxUploadMb }));
      else if (accepted.length >= room) errors.push(t("tooMany", { max: maxFiles }));
      else accepted.push(f);
    }
    setUploadErrors(errors);
    if (accepted.length && !submissionId) await ensureId();
    for (const f of accepted) await uploadOne(f);
  };

  const addFigma = () => {
    setFigmaError(null);
    start(async () => {
      const id = await ensureId();
      if (!id) return;
      const res = await addFigmaLinkAction(id, figmaUrl);
      if (res.ok) {
        setAssets((a) => [...a, res.data]);
        setFigmaUrl("");
      } else setFigmaError(res.error.message);
    });
  };

  const openSubmit = () => {
    setEstimate(null);
    setEstimateError(null);
    setConfirmReopen(false);
    setSubmitOpen(true);
    start(async () => {
      const ok = await flush();
      if (!ok || !submissionId) {
        const id = await ensureId();
        if (!id) return;
      }
      const id = submissionId ?? (await ensureId());
      if (!id) return;
      const res = await estimateReviewAction(id);
      if (res.ok) setEstimate(res.data);
      else setEstimateError(res.error.message);
    });
  };

  const doSubmit = () => {
    start(async () => {
      const saved = await flush();
      if (!saved) return;
      const id = submissionId ?? (await ensureId());
      if (!id) return;
      const res = await submitDraftAction(id, { confirmReopen });
      if (res.ok) {
        try {
          localStorage.removeItem(backupKey);
        } catch {
          // ignore
        }
        setDirty(false);
        toast.push(t("submitted", { n: res.data.versionNumber }), "success");
        router.push(stageHref);
        router.refresh();
      } else {
        toast.push(res.error.message, "error");
      }
    });
  };

  const processing = uploads.length > 0 || assets.some((a) => ["uploaded", "validating", "extracting"].includes(a.extractionStatus));
  const failed = assets.filter((a) => a.extractionStatus === "failed");
  const empty = !text.trim() && assets.length === 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {restore ? (
          <Alert
            tone="warning"
            title={t("restoreTitle")}
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setText(restore.text);
                    setNotes(restore.notes);
                    setDirty(true);
                    setRestore(null);
                  }}
                >
                  {t("restore")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    try {
                      localStorage.removeItem(backupKey);
                    } catch {
                      // ignore
                    }
                    setRestore(null);
                  }}
                >
                  {t("discardLocal")}
                </Button>
              </div>
            }
          >
            {t("restoreBody")}
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle as="h2">{t("writtenWork")}</CardTitle>
            <SaveIndicator state={save} dirty={dirty} locale={uiLocale} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
              <div role="group" aria-label={t("viewMode")} className="me-2 inline-flex rounded-md bg-surface-muted p-0.5">
                <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "write" ? "bg-surface shadow-sm" : "text-muted")}>
                  <PenLine className="size-3.5" aria-hidden />
                  {t("write")}
                </button>
                <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")} className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "preview" ? "bg-surface shadow-sm" : "text-muted")}>
                  <Eye className="size-3.5" aria-hidden />
                  {t("preview")}
                </button>
              </div>
              {mode === "write" ? (
                <>
                  <Button size="icon-sm" variant="ghost" aria-label={t("heading")} onClick={() => insert("\n## ", "\n", t("heading"))}>
                    <Heading2 aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("bold")} onClick={() => insert("**", "**", t("bold"))}>
                    <Bold aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("list")} onClick={() => insert("\n- ", "", t("listItem"))}>
                    <List aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={t("table")} onClick={() => insert("\n| A | B |\n|---|---|\n| ", " |  |\n")}>
                    <Table aria-hidden />
                  </Button>
                  {templates.length ? (
                    <select
                      aria-label={t("insertTemplate")}
                      className="ms-auto h-8 rounded-md border border-border-strong bg-surface px-2 text-xs"
                      value=""
                      onChange={(e) => {
                        const tpl = templates.find((x) => x.id === e.target.value);
                        if (tpl) {
                          setText((prev) => (prev.trim() ? `${prev}\n\n${tpl.body}` : tpl.body));
                          setDirty(true);
                        }
                      }}
                    >
                      <option value="">{t("insertTemplate")}</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </>
              ) : null}
            </div>
            {mode === "write" ? (
              <>
                <label htmlFor="submission-text" className="sr-only">
                  {t("writtenWork")}
                </label>
                <Textarea
                  id="submission-text"
                  ref={textRef}
                  dir="auto"
                  value={text}
                  maxLength={MAX_TEXT}
                  rows={20}
                  className="min-h-[24rem] font-mono text-[13px]"
                  placeholder={t("textPlaceholder")}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDirty(true);
                  }}
                  aria-describedby="text-help"
                />
                <p id="text-help" className="flex justify-between text-xs text-subtle">
                  <span>{t("markdownHelp")}</span>
                  <span className="ltr-isolate tabular-nums">
                    {text.length.toLocaleString("en")}/{MAX_TEXT.toLocaleString("en")}
                  </span>
                </p>
              </>
            ) : (
              <div className="min-h-[24rem] rounded-md border border-border p-4">{text.trim() ? <Markdown>{text}</Markdown> : <p className="text-sm text-subtle">{t("nothingToPreview")}</p>}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("attachments")}</CardTitle>
            <p className="text-sm text-muted">{t("attachmentsHint", { max: maxUploadMb })}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
              }}
              className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm", dragOver ? "border-primary bg-primary-soft" : "border-border-strong")}
            >
              <Upload className="size-5 text-subtle" aria-hidden />
              <p className="text-muted">{t("dropHere")}</p>
              <label className="cursor-pointer">
                <span className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-xs font-medium hover:bg-surface-muted">{t("chooseFiles")}</span>
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  accept={ACCEPT}
                  data-testid="file-input"
                  onChange={(e) => {
                    if (e.target.files?.length) void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadErrors.length ? (
              <Alert tone="danger" role="alert" title={t("someRejected")}>
                <ul className="list-disc ps-4">
                  {uploadErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            {uploads.map((u) => (
              <div key={u.key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                <Loader2 className="size-4 animate-spin text-info" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="text-xs text-subtle">{u.phase === "uploading" ? t("uploading", { pct: u.progress }) : t("processing")}</p>
                  <Progress value={u.progress} label={t("uploadProgress", { name: u.name })} className="mt-1 h-1" />
                </div>
              </div>
            ))}
            <ul className="flex flex-col gap-2" aria-label={t("attachedFiles")}>
              {assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  locale={uiLocale}
                  onRemove={() =>
                    start(async () => {
                      const res = await removeAssetAction(a.id);
                      if (res.ok) setAssets((list) => list.filter((x) => x.id !== a.id));
                      else toast.push(res.error.message, "error");
                    })
                  }
                  onRetry={() =>
                    start(async () => {
                      const res = await retryAssetAction(a.id);
                      if (res.ok) setAssets((list) => list.map((x) => (x.id === a.id ? res.data : x)));
                      else toast.push(res.error.message, "error");
                    })
                  }
                />
              ))}
            </ul>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="figma-url" className="text-sm font-medium">
                {t("figmaLink")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="figma-url"
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://www.figma.com/design/…"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  aria-invalid={figmaError ? true : undefined}
                  aria-describedby="figma-help"
                />
                <Button variant="outline" onClick={addFigma} disabled={!figmaUrl.trim() || busy}>
                  <Link2 aria-hidden />
                  {t("addLink")}
                </Button>
              </div>
              <p id="figma-help" className={cn("text-xs", figmaError ? "text-danger" : "text-subtle")} role={figmaError ? "alert" : undefined}>
                {figmaError ?? t("figmaHelp")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("notes")}</CardTitle>
            <p className="text-sm text-muted">{t("notesHint")}</p>
          </CardHeader>
          <CardContent>
            <label htmlFor="submission-notes" className="sr-only">
              {t("notes")}
            </label>
            <Textarea
              id="submission-notes"
              dir="auto"
              rows={4}
              maxLength={MAX_NOTES}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("readyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {processing ? <p className="text-sm text-info">{t("waitProcessing")}</p> : null}
            {failed.length ? <p className="text-sm text-danger">{t("fixFailed", { count: failed.length })}</p> : null}
            {empty ? <p className="text-sm text-muted">{t("addSomething")}</p> : null}
            <Button onClick={openSubmit} disabled={busy || processing || failed.length > 0 || empty}>
              <Send className="rtl:-scale-x-100" aria-hidden />
              {t("submitForReview")}
            </Button>
            <p className="text-xs text-subtle">{t("submitNote")}</p>
            {submissionId ? (
              <Button variant="ghost" size="sm" className="self-start text-danger" onClick={() => setDiscardOpen(true)}>
                <Trash2 aria-hidden />
                {t("discardDraft")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("deliverablesChecklist")}</CardTitle>
            <p className="text-xs text-muted">{t("deliverablesChecklistHint")}</p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {deliverables.map((d) => (
                <li key={d.id} className="flex items-start gap-2">
                  {d.evidence === "visual" || d.evidence === "link_or_visual" ? <ImageIcon className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> : <FileText className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />}
                  <span>
                    {d.title}
                    {!d.mandatory ? <span className="ms-1 text-xs text-subtle">({t("optional")})</span> : null}
                    <span className="block text-xs text-subtle">{te(`evidence.${d.evidence}`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </aside>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogTitle>{t("confirmTitle")}</DialogTitle>
          <DialogDescription>{t("confirmBody")}</DialogDescription>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {!estimate && !estimateError ? <Spinner label={t("estimating")} /> : null}
            {estimateError ? <Alert tone="danger">{estimateError}</Alert> : null}
            {estimate ? (
              estimate.isMock ? (
                <Alert tone="warning" title={t("mockReviewTitle")}>
                  {t("mockReviewBody")}
                </Alert>
              ) : (
                <div className="rounded-md border border-border p-3">
                  <p className="font-medium">{t("estimateTitle")}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-subtle">{t("model")}</dt>
                    <dd className="ltr-isolate">{estimate.model}</dd>
                    <dt className="text-subtle">{t("tokens")}</dt>
                    <dd className="ltr-isolate">~{estimate.inputTokens.toLocaleString("en")} / ~{estimate.outputTokens.toLocaleString("en")}</dd>
                    <dt className="text-subtle">{t("imagesSent")}</dt>
                    <dd className="ltr-isolate">{estimate.imagesSent}</dd>
                    <dt className="text-subtle">{t("pdfPages")}</dt>
                    <dd className="ltr-isolate">{estimate.pdfPagesSent}</dd>
                    <dt className="text-subtle">{t("cost")}</dt>
                    <dd>{estimate.estimatedCostUsd === null ? t("costUnknown") : `≈ ${formatUsd(estimate.estimatedCostUsd, uiLocale)}`}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-subtle">{t("estimateNote")}</p>
                </div>
              )
            ) : null}
            {estimate && estimate.limitations.length ? (
              <Alert tone="warning" title={t("limitationsTitle")}>
                <ul className="list-disc ps-4">
                  {estimate.limitations.map((l, i) => (
                    <li key={i}>{describeLimitation(l, t)}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            {stageCompleted ? (
              <label className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3">
                <Checkbox checked={confirmReopen} onChange={(e) => setConfirmReopen(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="size-4 text-warning" aria-hidden />
                    {t("reopenTitle")}
                  </span>
                  <span className="text-xs text-muted">{t("reopenBody")}</span>
                </span>
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={doSubmit} disabled={busy || (stageCompleted && !confirmReopen)}>
              {busy ? <Spinner /> : <Send className="rtl:-scale-x-100" aria-hidden />}
              {t("confirmSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogTitle>{t("discardTitle")}</DialogTitle>
          <DialogDescription>{t("discardBody")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  if (!submissionId) return;
                  const res = await discardDraftAction(submissionId);
                  if (res.ok) {
                    try {
                      localStorage.removeItem(backupKey);
                    } catch {
                      // ignore
                    }
                    setDirty(false);
                    router.push(stageHref);
                    router.refresh();
                  } else toast.push(res.error.message, "error");
                })
              }
            >
              {t("discardConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function describeLimitation(code: string, t: ReturnType<typeof useTranslations>): string {
  const [kind, ref, reason] = code.split(":");
  if (kind === "unavailable") return t("lim.unavailable", { ref: ref ?? "", reason: t(`lim.reason.${reason ?? "unknown"}`) });
  if (kind === "truncated") return t("lim.truncated", { ref: ref ?? "" });
  if (kind === "text_only") return t("lim.textOnly", { ref: ref ?? "" });
  return code;
}

function SaveIndicator({ state, dirty, locale }: { state: SaveState; dirty: boolean; locale: Locale }) {
  const t = useTranslations("submission");
  let label: string;
  let cls = "text-subtle";
  if (state.kind === "saving") label = t("saving");
  else if (state.kind === "error") {
    label = t("saveFailed");
    cls = "text-danger";
  } else if (dirty) label = t("unsaved");
  else if (state.kind === "saved") label = t("savedAt", { time: new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { timeStyle: "short" }).format(state.at) });
  else label = t("notSavedYet");
  return (
    <span role="status" aria-live="polite" className={cn("text-xs", cls)}>
      {label}
    </span>
  );
}

function AssetRow({ asset, locale, onRemove, onRetry }: { asset: AssetDto; locale: Locale; onRemove: () => void; onRetry: () => void }) {
  const t = useTranslations("submission");
  const te = useTranslations("enums");
  const status = asset.extractionStatus;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        {asset.kind === "image" && asset.hasThumbnail ? (
          <a href={`/api/assets/${asset.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/assets/${asset.id}?variant=thumbnail`} alt={asset.originalFilename} className="size-16 rounded border border-border object-cover" />
          </a>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded border border-border bg-surface-muted text-subtle">
            {asset.kind === "pdf" ? <FileText className="size-6" aria-hidden /> : asset.kind === "figma" ? <Frame className="size-6" aria-hidden /> : <ImageIcon className="size-6" aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="break-all font-medium" dir="auto">
            {asset.kind === "figma" && asset.sourceUrl ? (
              <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {asset.originalFilename}
              </a>
            ) : asset.kind !== "figma" ? (
              <a href={`/api/assets/${asset.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {asset.originalFilename}
              </a>
            ) : (
              asset.originalFilename
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
            <span>{te(`assetKind.${asset.kind}`)}</span>
            {asset.fileSize ? <span className="ltr-isolate">{formatBytes(asset.fileSize, locale)}</span> : null}
            {asset.meta.width ? <span className="ltr-isolate">{asset.meta.width}×{asset.meta.height}px</span> : null}
            {asset.meta.pageCount ? <span>{t("pages", { count: asset.meta.pageCount })}</span> : null}
            <Badge variant={status === "ready" ? "success" : status === "failed" ? "danger" : "info"}>{te(`extraction.${status}`)}</Badge>
          </p>
          {asset.kind === "pdf" && asset.meta.textLayer === "none" ? <p className="mt-1 text-xs text-warning">{t("pdfNoText")}</p> : null}
          {asset.kind === "pdf" && asset.meta.textLayer === "partial" ? <p className="mt-1 text-xs text-warning">{t("pdfPartialText")}</p> : null}
          {asset.kind === "figma" ? <p className="mt-1 text-xs text-muted">{t(`figmaAccess.${asset.meta.access ?? "not_configured"}`)}</p> : null}
          {status === "failed" && asset.extractionError ? (
            <p className="mt-1 text-xs text-danger" role="alert">
              {asset.extractionError}
            </p>
          ) : null}
          {asset.textPreview && asset.kind === "pdf" ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-primary">{t("extractedPreview")}</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface-muted p-2 text-xs" dir="auto">
                {asset.textPreview}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1 self-end sm:self-start">
        {status === "failed" ? (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            <RotateCcw aria-hidden />
            {t("retry")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t("removeNamed", { name: asset.originalFilename })}>
          <X aria-hidden />
          {t("remove")}
        </Button>
      </div>
    </li>
  );
}
