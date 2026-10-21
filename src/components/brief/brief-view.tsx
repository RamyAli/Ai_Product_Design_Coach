import { useTranslations } from "next-intl";
import type { BriefCore, StagePlan } from "@/domain/brief";
import { detectTextDirection } from "@/domain/localized";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function dirOf(s: string) {
  const d = detectTextDirection(s);
  return d === "auto" ? undefined : d;
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-subtle">—</p>;
  return (
    <ul className="list-disc space-y-1 ps-5 text-sm" dir={dirOf(items.join(" "))}>
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** Read-only brief. User/AI content keeps its own language and direction. */
export function BriefView({ brief, workflow, stageTitles }: { brief: BriefCore; workflow?: StagePlan[]; stageTitles?: Record<string, string> }) {
  const t = useTranslations("brief");
  const te = useTranslations("enums");
  const dir = dirOf(`${brief.summary} ${brief.problemStatement}`);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{brief.industry}</Badge>
            <Badge variant="outline">{te(`platform.${brief.platform}`)}</Badge>
            <Badge variant="outline">{te(`experience.${brief.experienceLevel}`)}</Badge>
            <Badge variant="outline">{te(`difficulty.${brief.difficulty}`)}</Badge>
            {brief.market ? <Badge variant="outline">{brief.market}</Badge> : null}
          </div>
          <CardTitle className="text-xl" dir={dirOf(brief.title)}>
            {brief.title}
          </CardTitle>
          <p className="text-sm text-muted" dir={dir}>
            {brief.summary}
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2" dir={dir}>
          <Section title={t("problemStatement")}>
            <p className="text-sm">{brief.problemStatement}</p>
          </Section>
          <Section title={t("problemContext")}>
            <p className="text-sm">{brief.problemContext}</p>
          </Section>
          <Section title={t("businessOpportunity")}>
            <p className="text-sm">{brief.businessOpportunity}</p>
          </Section>
          <Section title={t("estimatedEffort")}>
            <p className="text-sm">{brief.estimatedEffort}</p>
          </Section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("focusFeatures")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2" dir={dir}>
          {brief.focusFeatures.map((f) => (
            <div key={f.id} className="rounded-md border border-border p-3">
              <p className="font-medium">{f.name}</p>
              <p className="mt-1 text-sm text-muted">{f.description}</p>
              {f.userValue ? <p className="mt-2 text-xs text-subtle">{t("userValue")}: {f.userValue}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("targetUsers")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3" dir={dir}>
            {brief.targetUsers.map((u, i) => (
              <div key={i}>
                <p className="text-sm font-medium">{u.segment}</p>
                <p className="text-sm text-muted">{u.description}</p>
                <List items={u.needs} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("successMetrics")}</CardTitle>
          </CardHeader>
          <CardContent dir={dir}>
            <ul className="flex flex-col gap-2 text-sm">
              {brief.successMetrics.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.metric}</span>
                  {m.target ? <span className="text-muted"> — {m.target}</span> : null}
                  {m.rationale ? <p className="text-xs text-subtle">{m.rationale}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("goalsAndObjectives")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Section title={t("primaryUserGoals")}>
              <List items={brief.primaryUserGoals} />
            </Section>
            <Section title={t("businessObjectives")}>
              <List items={brief.businessObjectives} />
            </Section>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("scope")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Section title={t("inScope")}>
              <List items={brief.inScope} />
            </Section>
            <Section title={t("outOfScope")}>
              <List items={brief.outOfScope} />
            </Section>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("constraints")}</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={brief.constraints} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("assumptions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-subtle">{t("assumptionsNote")}</p>
            <List items={brief.assumptions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("risks")}</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={brief.risks} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("edgeCases")}</CardTitle>
          </CardHeader>
          <CardContent>
            <List items={brief.edgeCases} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t("whyThisChallenge")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm" dir={dir}>
            {brief.challengeRationale}
          </p>
          <p className="mt-2 text-xs text-subtle">{t("fictionNotice")}</p>
        </CardContent>
      </Card>

      {workflow && workflow.length ? (
        <Card>
          <CardHeader>
            <CardTitle as="h3">{t("workflowTailoring")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm" dir={dir}>
              {workflow.map((w, i) => (
                <li key={w.stageKey} className="flex gap-2">
                  <span className="ltr-isolate w-5 shrink-0 text-subtle tabular-nums">{i + 1}.</span>
                  <span>
                    <span className="font-medium">{stageTitles?.[w.stageKey] ?? w.stageKey}</span>
                    <span className="text-muted"> — {w.focus}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
