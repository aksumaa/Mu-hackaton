"use client";

import { useActionState, type ReactNode } from "react";
import { FormMessage } from "@/components/messages";
import type { ActionState } from "@/server/action-state";

export function ActionForm({
  action,
  locale,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  locale?: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? "grid gap-3"}>
      {locale ? <input type="hidden" name="locale" value={locale} /> : null}
      <FormMessage state={state} />
      <fieldset disabled={pending} className="grid min-w-0 gap-3 disabled:opacity-70">
        {children}
      </fieldset>
    </form>
  );
}
