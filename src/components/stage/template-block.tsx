"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TemplateBlock({ title, body }: { title: string; body: string }) {
  const t = useTranslations("workspace");
  const [copied, setCopied] = useState(false);
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{title}</summary>
      <div className="border-t border-border p-3">
        <p className="mb-2 text-xs text-subtle">{t("templateNote")}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-muted p-3 text-xs" dir="auto">
          {body}
        </pre>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(body);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // clipboard unavailable
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copyTemplate")}
        </Button>
      </div>
    </details>
  );
}
