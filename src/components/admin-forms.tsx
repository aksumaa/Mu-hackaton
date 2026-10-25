"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  computeRankingAction, createStaffAction, importRosterAction,
  publishStageAction, resetPasswordAction, resolveTieAction,
  revealScoresAction, saveAnnouncementAction, saveContentAction, saveFacultyAction, saveSettingsAction, saveTrackAction,
  selectTopAction, transitionStageAction, updateStageDatesAction,
} from "@/app/actions";
import type { PlatformSettings } from "@/lib/settings";
import type { StageKey, StageStatus } from "@prisma/client";
import { ErrorNote, Field, controlClass } from "@/components/field";

export function BusyButton({ label, action }: { label: string; action: () => Promise<{ ok: boolean; code?: string }> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form onSubmit={async (event) => { event.preventDefault(); setPending(true); const result = await action(); setPending(false); setError(result.ok ? null : result.code ?? "invalid_input"); }}>
      <button className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground" disabled={pending} type="submit">{label}</button>
      <ErrorNote code={error} />
    </form>
  );
}

export function StageEditor({ stageKey, status, opens, updateAt, deadline }: { stageKey: StageKey; status: StageStatus; opens: string; updateAt: string; deadline: string }) {
  const t = useTranslations("admin");
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<StageStatus>(status);
  return (
    <div className="grid gap-3 rounded-3xl border border-border p-4">
      <ErrorNote code={error} />
      <form className="grid gap-2 md:grid-cols-3" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await updateStageDatesAction(stageKey, String(form.get("opens")), String(form.get("update")), String(form.get("deadline")));
        setError(result.ok ? null : result.code);
      }}>
        <Field label="opens"><input className={controlClass} type="datetime-local" name="opens" defaultValue={opens} /></Field>
        <Field label="update"><input className={controlClass} type="datetime-local" name="update" defaultValue={updateAt} /></Field>
        <Field label="deadline"><input className={controlClass} type="datetime-local" name="deadline" defaultValue={deadline} /></Field>
        <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{t("dates")}</button>
      </form>
      <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); const result = await transitionStageAction(stageKey, next); setError(result.ok ? null : result.code); }}>
        <select className={controlClass} value={next} onChange={(event) => setNext(event.target.value as StageStatus)}>
          {["DRAFT", "OPEN", "CLOSED", "EVALUATING", "PUBLISHED"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="rounded-full border border-border px-4" type="submit">{t("transition")}</button>
      </form>
    </div>
  );
}

export function RosterImporter() {
  const t = useTranslations("admin");
  const [text, setText] = useState("studentId,fullName,faculty,group\n");
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  async function run(commit: boolean) {
    const result = await importRosterAction(text, commit);
    if (!result.ok) setError(result.code);
    else setReport(`${result.data?.imported ?? 0} / ${result.data?.errors.map((item) => `${item.line}:${item.code}`).join(", ")}`);
  }
  return (
    <div className="grid gap-3">
      <ErrorNote code={error} />
      <textarea className={`${controlClass} min-h-40 font-mono`} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="rounded-full border border-border px-4 py-2" onClick={() => void run(false)}>{t("preview")}</button>
        <button type="button" className="rounded-full bg-accent px-4 py-2 text-accent-foreground" onClick={() => void run(true)}>{t("import")}</button>
      </div>
      {report ? <p>{report}</p> : null}
    </div>
  );
}

export function PasswordReset({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const [password, setPassword] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="underline" onClick={async () => { const result = await resetPasswordAction(userId); if (result.ok) setPassword(result.data?.password ?? null); }}>{t("resetPassword")}</button>
      {password ? <p className="font-mono">{t("tempPassword")}: {password}</p> : null}
    </div>
  );
}

export function StaffCreator() {
  const t = useTranslations("admin");
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await createStaffAction({ fullName: String(form.get("name")), studentId: String(form.get("id")), role: String(form.get("role")) as "JUDGE" | "ADMIN", email: String(form.get("email") || "") });
      if (!result.ok) setError(result.code);
      else setPassword(result.data?.password ?? null);
    }}>
      <h2 className="font-semibold">{t("createStaff")}</h2>
      <ErrorNote code={error} />
      <input className={controlClass} name="name" required placeholder="name" />
      <input className={controlClass} name="id" required placeholder="login" />
      <input className={controlClass} name="email" placeholder="email" />
      <select className={controlClass} name="role"><option>JUDGE</option><option>ADMIN</option></select>
      <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{t("createStaff")}</button>
      {password ? <p className="font-mono">{t("tempPassword")}: {password}</p> : null}
    </form>
  );
}

export function RankingControls({ stageKey }: { stageKey: StageKey }) {
  const t = useTranslations("admin");
  const [ack, setAck] = useState(false);
  const [none, setNone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <ErrorNote code={error} />
      <BusyButton label={t("compute")} action={async () => computeRankingAction(stageKey)} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />{t("acknowledge")}</label>
      <button type="button" className="rounded-full border border-border px-4 py-2" onClick={async () => { const result = await selectTopAction(stageKey, ack); setError(result.ok ? null : result.code); }}>{t("select")}</button>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={none} onChange={(event) => setNone(event.target.checked)} />{t("confirmNone")}</label>
      <button type="button" className="rounded-full bg-accent px-4 py-2 text-accent-foreground" onClick={async () => { const result = await publishStageAction(stageKey, none); setError(result.ok ? null : result.code); }}>{t("publish")}</button>
      <button type="button" className="text-sm underline" onClick={async () => { const result = await revealScoresAction(stageKey, true); setError(result.ok ? null : result.code); }}>{t("reveal")}</button>
      <button type="button" className="text-sm underline" onClick={async () => { const result = await revealScoresAction(stageKey, false); setError(result.ok ? null : result.code); }}>{t("hideScores")}</button>
    </div>
  );
}

export function TieForm({ resultId }: { resultId: string }) {
  const t = useTranslations("admin");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const result = await resolveTieAction(resultId, form.get("advanced") === "yes", note); setError(result.ok ? null : result.code); }}>
      <ErrorNote code={error} />
      <select name="advanced" className={controlClass}><option value="yes">yes</option><option value="no">no</option></select>
      <input className={controlClass} value={note} onChange={(event) => setNote(event.target.value)} required />
      <button className="rounded-full border border-border px-3" type="submit">{t("select")}</button>
    </form>
  );
}

export function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const t = useTranslations("admin");
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); const result = await saveSettingsAction(value); setError(result.ok ? null : result.code); }}>
      <ErrorNote code={error} />
      <label className="flex gap-2"><input type="checkbox" checked={value.judgesCanScoreAny} onChange={(event) => setValue({ ...value, judgesCanScoreAny: event.target.checked })} />judgesCanScoreAny</label>
      <label className="flex gap-2"><input type="checkbox" checked={value.blindReview} onChange={(event) => setValue({ ...value, blindReview: event.target.checked })} />blindReview</label>
      <label className="flex gap-2"><input type="checkbox" checked={value.emailPasswordReset} onChange={(event) => setValue({ ...value, emailPasswordReset: event.target.checked })} />emailPasswordReset</label>
      <label className="flex gap-2"><input type="checkbox" checked={value.videoUploadEnabled} onChange={(event) => setValue({ ...value, videoUploadEnabled: event.target.checked })} />videoUploadEnabled</label>
      <Field label="threshold"><input className={controlClass} type="number" value={value.discrepancyThreshold} onChange={(event) => setValue({ ...value, discrepancyThreshold: Number(event.target.value) })} /></Field>
      <Field label="judges"><input className={controlClass} type="number" value={value.judgesPerSubmission} onChange={(event) => setValue({ ...value, judgesPerSubmission: Number(event.target.value) })} /></Field>
      <Field label="contact"><input className={controlClass} value={value.contactEmail} onChange={(event) => setValue({ ...value, contactEmail: event.target.value })} /></Field>
      <select className={controlClass} value={value.scoreAggregate} onChange={(event) => setValue({ ...value, scoreAggregate: event.target.value as "average" | "median" })}><option>average</option><option>median</option></select>
      <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{t("settings")}</button>
    </form>
  );
}

export function JsonContentEditor({ settingKey, initial, label }: { settingKey: string; initial: string; label: string }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      try {
        const parsed = JSON.parse(text) as unknown;
        if (!Array.isArray(parsed)) throw new Error("array");
        const result = await saveContentAction(settingKey, parsed as never);
        setError(result.ok ? null : result.code);
      } catch {
        setError("invalid_input");
      }
    }}>
      <h2 className="font-semibold">{label}</h2>
      <ErrorNote code={error} />
      <textarea className={`${controlClass} min-h-40 font-mono text-xs`} value={text} onChange={(event) => setText(event.target.value)} />
      <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{label}</button>
    </form>
  );
}

export function TrackEditor({ track }: { track: { id: string; slug: string; nameUz: string; nameRu: string; nameEn: string; descUz: string; descRu: string; descEn: string; isActive: boolean } }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-2 rounded-2xl border border-border p-3" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await saveTrackAction({
        id: track.id,
        slug: String(form.get("slug")),
        nameUz: String(form.get("nameUz")),
        nameRu: String(form.get("nameRu")),
        nameEn: String(form.get("nameEn")),
        descUz: String(form.get("descUz")),
        descRu: String(form.get("descRu")),
        descEn: String(form.get("descEn")),
        isActive: form.get("active") === "on",
      });
      setError(result.ok ? null : result.code);
    }}>
      <ErrorNote code={error} />
      <input className={controlClass} name="slug" defaultValue={track.slug} />
      <input className={controlClass} name="nameUz" defaultValue={track.nameUz} />
      <input className={controlClass} name="nameRu" defaultValue={track.nameRu} />
      <input className={controlClass} name="nameEn" defaultValue={track.nameEn} />
      <textarea className={controlClass} name="descUz" defaultValue={track.descUz} />
      <textarea className={controlClass} name="descRu" defaultValue={track.descRu} />
      <textarea className={controlClass} name="descEn" defaultValue={track.descEn} />
      <label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={track.isActive} />active</label>
      <button className="rounded-full border border-border px-3 py-1" type="submit">save</button>
    </form>
  );
}

export function FacultyEditor({ faculty }: { faculty: { id: string; nameUz: string; nameRu: string; nameEn: string; isActive: boolean } }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await saveFacultyAction({ id: faculty.id, nameUz: String(form.get("uz")), nameRu: String(form.get("ru")), nameEn: String(form.get("en")), isActive: form.get("active") === "on" });
      setError(result.ok ? null : result.code);
    }}>
      <ErrorNote code={error} />
      <input className={controlClass} name="uz" defaultValue={faculty.nameUz} />
      <input className={controlClass} name="ru" defaultValue={faculty.nameRu} />
      <input className={controlClass} name="en" defaultValue={faculty.nameEn} />
      <label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={faculty.isActive} />active</label>
      <button className="rounded-full border border-border px-3 py-1" type="submit">save</button>
    </form>
  );
}

export function AnnouncementEditor() {
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await saveAnnouncementAction({
        titleUz: String(form.get("titleUz")), titleRu: String(form.get("titleRu")), titleEn: String(form.get("titleEn")),
        bodyUz: String(form.get("bodyUz")), bodyRu: String(form.get("bodyRu")), bodyEn: String(form.get("bodyEn")),
        publish: form.get("publish") === "on",
      });
      setError(result.ok ? null : result.code);
      if (result.ok) event.currentTarget.reset();
    }}>
      <ErrorNote code={error} />
      <input className={controlClass} name="titleUz" required placeholder="title uz" />
      <input className={controlClass} name="titleRu" required placeholder="title ru" />
      <input className={controlClass} name="titleEn" required placeholder="title en" />
      <textarea className={controlClass} name="bodyUz" required placeholder="body uz" />
      <textarea className={controlClass} name="bodyRu" required placeholder="body ru" />
      <textarea className={controlClass} name="bodyEn" required placeholder="body en" />
      <label className="flex gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked />publish</label>
      <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">publish</button>
    </form>
  );
}
