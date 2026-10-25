"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { declareConflict, finalizeScore, saveScore } from "@/server/judge-actions";
import { FormMessage } from "@/components/messages";
import { Button, Field, TextArea, TextInput } from "@/components/ui";

export function ScorePanel({
  locale,
  submissionId,
  criteria,
  initial,
  finalized,
  canScore,
  conflict,
}: {
  locale: string;
  submissionId: string;
  criteria: { id: string; title: string; description: string; maxPoints: number }[];
  initial: { scores: Record<string, number>; strengths: string[]; improvements: string[]; nextSteps: string; publicComment: string; internalNote: string };
  finalized: boolean;
  canScore: boolean;
  conflict: boolean;
}) {
  const t = useTranslations("judge");
  const common = useTranslations("common");
  const [scores, setScores] = useState(initial.scores);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [auto, setAuto] = useState<string | null>(null);
  const [saveState, saveAction, savePending] = useActionState(saveScore, null);
  const [finalState, finalAction, finalPending] = useActionState(finalizeScore, null);
  const [conflictState, conflictAction, conflictPending] = useActionState(declareConflict, null);
  const total = criteria.reduce((sum, criterion) => sum + (scores[criterion.id] ?? 0), 0);
  const dirty = useRef(false);

  useEffect(() => {
    if (!canScore || finalized || conflict || !dirty.current) return;
    const timer = window.setTimeout(() => {
      if (!formRef.current) return;
      void saveScore(null, new FormData(formRef.current)).then((next) => setAuto(next?.error ?? "saved"));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [scores, canScore, finalized, conflict]);

  return (
    <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:border-border max-lg:bg-card max-lg:px-4 max-lg:pt-2 lg:sticky lg:top-24">
      <button type="button" className="flex min-h-11 w-full items-center justify-between py-2 text-sm font-semibold lg:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{t("sheet")}</span>
        <span className="tabular-nums">{total} / 100</span>
      </button>
      <div className={open ? "max-h-[70vh] overflow-y-auto pb-4" : "max-lg:hidden"}>
        {conflict ? <p className="mb-3 text-sm">{t("conflictSaved")}</p> : null}
        <form ref={formRef} action={saveAction} className="grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="submissionId" value={submissionId} />
          <p className="text-sm font-semibold">{t("total")} <span className="tabular-nums">{total} / 100</span></p>
          <FormMessage state={saveState ?? finalState ?? conflictState} />
          {auto === "saved" ? <p className="text-sm text-muted">{common("saved")}. {t("autosave")}</p> : null}
          {criteria.map((criterion) => (
            <Field key={criterion.id} id={`points_${criterion.id}`} label={criterion.title} hint={criterion.description}>
              <TextInput
                id={`points_${criterion.id}`}
                name={`points_${criterion.id}`}
                type="number"
                min={0}
                max={criterion.maxPoints}
                step={1}
                inputMode="numeric"
                required
                disabled={!canScore || finalized || conflict}
                value={scores[criterion.id] ?? 0}
                aria-describedby={`points_${criterion.id}-hint`}
                onChange={(event) => {
                  dirty.current = true;
                  setScores((current) => ({ ...current, [criterion.id]: Number(event.target.value) }));
                }}
              />
            </Field>
          ))}
          {[0, 1, 2].map((index) => (
            <Field key={`s${index}`} id={`strength_${index}`} label={`${t("strengthsHint")} ${index + 1}`}>
              <TextInput id={`strength_${index}`} name={`strength_${index}`} maxLength={400} defaultValue={initial.strengths[index] ?? ""} disabled={!canScore || finalized || conflict} />
            </Field>
          ))}
          {[0, 1, 2].map((index) => (
            <Field key={`i${index}`} id={`improvement_${index}`} label={`${t("improvementsHint")} ${index + 1}`}>
              <TextInput id={`improvement_${index}`} name={`improvement_${index}`} maxLength={400} defaultValue={initial.improvements[index] ?? ""} disabled={!canScore || finalized || conflict} />
            </Field>
          ))}
          <Field id="nextSteps" label={t("nextSteps")}>
            <TextArea id="nextSteps" name="nextSteps" defaultValue={initial.nextSteps} disabled={!canScore || finalized || conflict} />
          </Field>
          <Field id="publicComment" label={t("publicComment")}>
            <TextArea id="publicComment" name="publicComment" defaultValue={initial.publicComment} disabled={!canScore || finalized || conflict} />
          </Field>
          <Field id="internalNote" label={t("internal")}>
            <TextArea id="internalNote" name="internalNote" defaultValue={initial.internalNote} disabled={!canScore || finalized || conflict} />
          </Field>
          {canScore && !finalized && !conflict ? (
            <div className="grid gap-2">
              <Button type="submit" variant="secondary" disabled={savePending}>{savePending ? common("saving") : common("save")}</Button>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" className="mt-1 h-5 w-5" />
                <span>{t("finalizeHint")}</span>
              </label>
              <Button type="submit" formAction={finalAction} disabled={finalPending}>{finalPending ? common("loading") : t("finalize")}</Button>
            </div>
          ) : null}
          {!canScore ? <p className="text-sm text-muted">{finalized ? t("finalizeHint") : t("notEvaluating")}</p> : null}
        </form>
        {!conflict && !finalized ? (
          <form action={conflictAction} className="mt-4 grid gap-2 border-t border-border pt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="submissionId" value={submissionId} />
            <Field id="conflictNote" label={t("conflict")}>
              <TextArea id="conflictNote" name="conflictNote" required minLength={3} placeholder={t("conflictNote")} />
            </Field>
            <Button type="submit" variant="secondary" disabled={conflictPending}>{t("declare")}</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
