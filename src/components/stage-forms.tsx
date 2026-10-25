"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CHECKLIST_KEYS } from "@/lib/catalog";
import { saveStage1, saveStage2, submitStage1, submitStage2, updateStage1, updateStage2, uploadStage2File } from "@/server/participant-actions";
import { FormMessage } from "@/components/messages";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import type { ActionState } from "@/server/action-state";

type Stage1Values = {
  title: string;
  trackId: string;
  shortDescription: string;
  problem: string;
  audience: string;
  solution: string;
  differentiation: string;
  validation: string;
  teamRoles: string;
  consent: boolean;
};

const limits: Record<keyof Omit<Stage1Values, "trackId" | "consent">, number> = {
  title: 120,
  shortDescription: 500,
  problem: 3000,
  audience: 2000,
  solution: 4000,
  differentiation: 2000,
  validation: 2000,
  teamRoles: 1500,
};

export function Stage1Form({
  locale,
  tracks,
  initial,
  mode,
}: {
  locale: string;
  tracks: { id: string; name: string }[];
  initial: Stage1Values;
  mode: "draft" | "update" | "locked";
}) {
  const t = useTranslations("cabinet");
  const common = useTranslations("common");
  const save = useActionState(saveStage1, null);
  const submit = useActionState(submitStage1, null);
  const update = useActionState(updateStage1, null);
  const [state, setState] = useState<ActionState>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (mode !== "draft") return;
    const timer = window.setTimeout(() => {
      if (!formRef.current) return;
      setPending(true);
      void saveStage1(null, new FormData(formRef.current)).then((next) => {
        setState(next);
        setPending(false);
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [values, mode]);

  const action = mode === "draft" ? save[1] : mode === "update" ? update[1] : undefined;
  const active = mode === "draft" ? save[0] : mode === "update" ? update[0] : submit[0];
  const busy = mode === "draft" ? save[2] : mode === "update" ? update[2] : submit[2];

  function bind(key: keyof Stage1Values) {
    return {
      value: String(values[key] ?? ""),
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const next = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value;
        setValues((current) => ({ ...current, [key]: next }));
      },
    };
  }

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state ?? active} />
      {pending ? <p className="text-sm text-muted">{common("saving")}</p> : null}
      <Field id="title" label={t("titleField")} hint={`${values.title.length}/${limits.title}`}>
        <TextInput id="title" name="title" required={mode !== "draft"} maxLength={limits.title} disabled={mode === "locked"} {...bind("title")} />
      </Field>
      <Field id="trackId" label={t("track")}>
        <SelectInput id="trackId" name="trackId" disabled={mode === "locked"} value={values.trackId} onChange={bind("trackId").onChange}>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>{track.name}</option>
          ))}
        </SelectInput>
      </Field>
      {(["shortDescription", "problem", "audience", "solution", "differentiation", "validation", "teamRoles"] as const).map((key) => (
        <Field key={key} id={key} label={t(key === "shortDescription" ? "short" : key === "differentiation" ? "difference" : key === "teamRoles" ? "roles" : key)} hint={`${values[key].length}/${limits[key]}`}>
          <TextArea id={key} name={key} maxLength={limits[key]} disabled={mode === "locked"} {...bind(key)} />
        </Field>
      ))}
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          name="consent"
          className="mt-1 h-5 w-5"
          checked={values.consent}
          disabled={mode === "locked"}
          onChange={(event) => setValues((current) => ({ ...current, consent: event.target.checked }))}
        />
        <span>{t("consent")}</span>
      </label>
      {mode === "draft" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" formAction={save[1]} disabled={busy || pending}>{busy ? common("saving") : t("saveDraft")}</Button>
          <Button type="submit" formAction={submit[1]} disabled={busy}>{busy ? common("submitting") : t("submitApplication")}</Button>
        </div>
      ) : null}
      {mode === "update" ? (
        <Button type="submit" formAction={update[1]} disabled={busy}>{busy ? common("updating") : t("updateApplication")}</Button>
      ) : null}
      {mode === "locked" ? <p className="text-sm text-muted">{t("lockedMessage")}</p> : null}
      <p className="text-sm text-muted">{t("draftHint")}</p>
    </form>
  );
}

export function Stage2Form({
  locale,
  mode,
  initial,
  files,
}: {
  locale: string;
  mode: "draft" | "update" | "locked";
  initial: Record<string, string | boolean | Record<string, unknown>>;
  files: { kind: string; name: string }[];
}) {
  const t = useTranslations("cabinet");
  const checklist = useTranslations("checklist");
  const common = useTranslations("common");
  const save = useActionState(saveStage2, null);
  const submit = useActionState(submitStage2, null);
  const update = useActionState(updateStage2, null);
  const state = mode === "update" ? update[0] : save[0];
  const action = mode === "update" ? update[1] : save[1];
  const pending = mode === "update" ? update[2] : save[2] || submit[2];
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadStage2File, null);
  const checks = (typeof initial.checklist === "object" && initial.checklist ? initial.checklist : {}) as Record<string, boolean>;
  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <FormMessage state={state} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="softwareProject" defaultChecked={Boolean(initial.softwareProject)} disabled={mode === "locked"} className="mt-1 h-5 w-5" />
          <span>{t("software")}</span>
        </label>
        <Field id="productUrl" label={t("product")}>
          <TextInput id="productUrl" name="productUrl" type="url" defaultValue={String(initial.productUrl ?? "")} disabled={mode === "locked"} />
        </Field>
        <Field id="accessInstructions" label={t("access")}>
          <TextArea id="accessInstructions" name="accessInstructions" defaultValue={String(initial.accessInstructions ?? "")} disabled={mode === "locked"} />
        </Field>
        <Field id="videoUrl" label={t("video")} hint={t("videoHint")}>
          <TextInput id="videoUrl" name="videoUrl" type="url" defaultValue={String(initial.videoUrl ?? "")} disabled={mode === "locked"} />
        </Field>
        <Field id="githubUrl" label={t("github")}>
          <TextInput id="githubUrl" name="githubUrl" type="url" defaultValue={String(initial.githubUrl ?? "")} disabled={mode === "locked"} />
        </Field>
        <Field id="equivalentProof" label={t("equivalent")}>
          <TextArea id="equivalentProof" name="equivalentProof" defaultValue={String(initial.equivalentProof ?? "")} disabled={mode === "locked"} />
        </Field>
        {(["priorWork", "aiTools", "openSource", "limitations"] as const).map((key) => (
          <Field key={key} id={key} label={t(key === "limitations" ? "knownLimitations" : key)}>
            <TextArea id={key} name={key} defaultValue={String(initial[key] ?? "")} disabled={mode === "locked"} />
          </Field>
        ))}
        {mode !== "locked" ? (
          <div className="grid gap-3">
            {(["PRD_PDF", "PITCH_DECK", "VIDEO_FILE", "EQUIVALENT_PROOF"] as const).map((kind) => (
              <Field key={kind} id={`file_${kind}`} label={kind} hint={files.find((file) => file.kind === kind)?.name}>
                <input id={`file_${kind}`} name={`file_${kind}`} type="file" className="block w-full text-sm" />
              </Field>
            ))}
          </div>
        ) : null}
        <fieldset className="grid gap-2" disabled={mode === "locked"}>
          <legend className="text-sm font-semibold">{t("checklistTitle")}</legend>
          {CHECKLIST_KEYS.map((key) => (
            <label key={key} className="flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" name={`check_${key}`} defaultChecked={Boolean(checks[key])} className="mt-1 h-5 w-5" />
              <span>{checklist(key)}</span>
            </label>
          ))}
        </fieldset>
        {mode === "draft" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" formAction={save[1]} disabled={pending}>{pending ? common("saving") : t("saveDraft")}</Button>
            <Button type="submit" formAction={submit[1]} disabled={pending}>{pending ? common("submitting") : t("submitApplication")}</Button>
          </div>
        ) : null}
        {mode === "update" ? <Button type="submit" disabled={pending}>{pending ? common("updating") : t("updateApplication")}</Button> : null}
        {mode === "locked" ? <p className="text-sm text-muted">{t("lockedMessage")}</p> : null}
      </form>
      {mode === "draft" ? (
        <form action={uploadAction} className="grid gap-3 rounded-2xl border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <FormMessage state={uploadState} />
          <Field id="kind" label={t("upload")}>
            <SelectInput id="kind" name="kind" defaultValue="PRD_PDF">
              <option value="PRD_PDF">PRD PDF</option>
              <option value="PITCH_DECK">PPTX</option>
              <option value="VIDEO_FILE">MP4</option>
              <option value="EQUIVALENT_PROOF">ZIP / PDF</option>
            </SelectInput>
          </Field>
          <input name="file" type="file" required className="block w-full text-sm" />
          <Button type="submit" variant="secondary" disabled={uploadPending}>{uploadPending ? common("loading") : t("upload")}</Button>
        </form>
      ) : null}
    </div>
  );
}
