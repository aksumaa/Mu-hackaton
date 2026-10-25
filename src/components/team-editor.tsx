"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addMemberAction, removeMemberAction, saveTeamNameAction, updateMemberAction } from "@/app/actions";
import { ErrorNote, Field, controlClass } from "@/components/field";

type Member = { id: string; fullName: string; studentId: string; facultyId: string; course: number; groupName: string; isLeader: boolean; verificationStatus: string; rejectionNote: string | null };
type Faculty = { id: string; name: string };

export function TeamEditor({ teamName, members, faculties, locked }: { teamName: string; members: Member[]; faculties: Faculty[]; locked: boolean }) {
  const t = useTranslations("team");
  const auth = useTranslations("auth");
  const [name, setName] = useState(teamName);
  const [error, setError] = useState<string | null>(null);
  const blank = { fullName: "", studentId: "", facultyId: faculties[0]?.id ?? "", course: 1, groupName: "" };
  const [draft, setDraft] = useState(blank);

  return (
    <div className="grid gap-6">
      <ErrorNote code={error} />
      {locked ? <p className="rounded-2xl bg-accent-soft p-4">{t("locked")}</p> : null}
      <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); const result = await saveTeamNameAction(name); if (!result.ok) setError(result.code); }}>
        <Field label={t("name")}><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} disabled={locked} /></Field>
        <button className="self-end rounded-full bg-accent px-4 py-2 text-accent-foreground" disabled={locked} type="submit">{t("saveName")}</button>
      </form>
      <ul className="grid gap-4">
        {members.map((member) => <MemberRow key={member.id} member={member} faculties={faculties} locked={locked} onError={setError} />)}
      </ul>
      {locked || members.length >= 4 ? null : (
        <form className="grid gap-3 rounded-3xl border border-border p-4" onSubmit={async (event) => {
          event.preventDefault();
          const result = await addMemberAction(draft);
          if (!result.ok) setError(result.code);
          else setDraft(blank);
        }}>
          <h2 className="font-semibold">{t("add")}</h2>
          <Field label={auth("fullName")}><input className={controlClass} required value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></Field>
          <Field label={auth("studentId")}><input className={controlClass} required value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value })} /></Field>
          <Field label={auth("faculty")}><select className={controlClass} value={draft.facultyId} onChange={(event) => setDraft({ ...draft, facultyId: event.target.value })}>{faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></Field>
          <Field label={auth("course")}><select className={controlClass} value={draft.course} onChange={(event) => setDraft({ ...draft, course: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map((course) => <option key={course}>{course}</option>)}</select></Field>
          <Field label={auth("group")}><input className={controlClass} required value={draft.groupName} onChange={(event) => setDraft({ ...draft, groupName: event.target.value })} /></Field>
          <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{t("add")}</button>
        </form>
      )}
      </div>
  );
}

function MemberRow({ member, faculties, locked, onError }: { member: Member; faculties: Faculty[]; locked: boolean; onError: (code: string) => void }) {
  const t = useTranslations("team");
  const common = useTranslations("common");
  const status = useTranslations("status");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(member);
  return (
    <li className="rounded-3xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{member.fullName}</strong>
        <span>{status(member.verificationStatus)}{member.isLeader ? ` · ${t("leader")}` : ""}</span>
      </div>
      {member.rejectionNote ? <p className="mt-2 text-sm text-danger">{member.rejectionNote}</p> : null}
      {editing ? (
        <form className="mt-3 grid gap-2" onSubmit={async (event) => {
          event.preventDefault();
          const result = await updateMemberAction(member.id, form);
          if (!result.ok) onError(result.code);
          else setEditing(false);
        }}>
          <input className={controlClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          <input className={controlClass} value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} />
          <select className={controlClass} value={form.facultyId} onChange={(event) => setForm({ ...form, facultyId: event.target.value })}>{faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select>
          <select className={controlClass} value={form.course} onChange={(event) => setForm({ ...form, course: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map((course) => <option key={course}>{course}</option>)}</select>
          <input className={controlClass} value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} />
          <button className="rounded-full bg-accent px-4 py-2 text-accent-foreground" type="submit">{common("save")}</button>
        </form>
      ) : <p className="mt-2 text-sm text-muted">{member.studentId} · {member.groupName}</p>}
      {locked ? null : (
        <div className="mt-3 flex gap-3 text-sm">
          <button type="button" className="underline" onClick={() => setEditing((value) => !value)}>{common("edit")}</button>
          {member.isLeader ? null : <button type="button" className="underline" onClick={async () => { const result = await removeMemberAction(member.id); if (!result.ok) onError(result.code); }}>{common("remove")}</button>}
        </div>
      )}
    </li>
  );
}
