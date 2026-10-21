"use client";

import { MessageSquare, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { askMentorAction } from "@/app/actions/reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Markdown, UserText } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useJob } from "@/hooks/use-job";

export interface MentorMessage {
  id: string;
  role: string;
  content: string;
  isMock: boolean;
}

export function MentorChat({
  projectId,
  stageId,
  reviewId,
  initialMessages,
  pendingJobId,
  title,
}: {
  projectId: string;
  stageId?: string;
  reviewId?: string;
  initialMessages: MentorMessage[];
  pendingJobId: string | null;
  title?: string;
}) {
  const t = useTranslations("mentor");
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [jobId, setJobId] = useState<string | null>(pendingJobId);
  const [sending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  const { active } = useJob(jobId, {
    onDone: (j) => {
      setJobId(null);
      if (j.status !== "succeeded") toast.push(j.errorMessage ?? t("failed"), "error");
      router.refresh();
    },
  });

  const send = () => {
    const q = question.trim();
    if (q.length < 2) return;
    start(async () => {
      const res = await askMentorAction({ projectId, stageId, reviewId, question: q });
      if (res.ok) {
        setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: q, isMock: false }]);
        setQuestion("");
        setJobId(res.data.jobId);
      } else toast.push(res.error.message, "error");
    });
  };

  const busy = sending || active;
  return (
    <section aria-labelledby={`mentor-${reviewId ?? stageId ?? projectId}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`mentor-${reviewId ?? stageId ?? projectId}`} className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-primary" aria-hidden />
          {title ?? t("title")}
        </h2>
        <p className="mt-0.5 text-xs text-subtle">{t("note")}</p>
      </div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? <p className="text-sm text-muted">{t("empty")}</p> : null}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ms-6 rounded-lg bg-primary-soft px-3 py-2 text-sm">
              <span className="sr-only">{t("you")}: </span>
              <UserText text={m.content} />
            </div>
          ) : (
            <div key={m.id} className="me-2 rounded-lg border border-border bg-surface px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-subtle">
                {t("mentor")}
                {m.isMock ? <Badge variant="warning">{t("demo")}</Badge> : null}
              </div>
              <Markdown>{m.content}</Markdown>
            </div>
          ),
        )}
        {active ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t("thinking")}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={`mentor-input-${reviewId ?? stageId ?? projectId}`} className="sr-only">
          {t("placeholder")}
        </label>
        <Textarea
          id={`mentor-input-${reviewId ?? stageId ?? projectId}`}
          rows={3}
          value={question}
          maxLength={2000}
          placeholder={t("placeholder")}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" size="sm" className="self-end" disabled={busy || question.trim().length < 2}>
          <Send className="rtl:-scale-x-100" aria-hidden />
          {t("send")}
        </Button>
      </form>
    </section>
  );
}
