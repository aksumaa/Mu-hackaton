import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-accent text-accent-foreground hover:opacity-90",
    secondary: "border border-border bg-card hover:bg-accent-soft",
    ghost: "hover:bg-accent-soft",
    danger: "bg-[var(--danger-solid)] text-white hover:opacity-90",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-semibold leading-tight disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-base text-foreground aria-invalid:border-danger",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-base text-foreground",
        props.className,
      )}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn("min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-base aria-invalid:border-danger", props.className)}
    />
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6", className)}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-accent-soft text-foreground",
    good: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
    warn: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
    bad: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100",
  };
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export function PageIntro({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {lede ? <p className="mt-4 text-base leading-7 text-muted sm:text-lg">{lede}</p> : null}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted">{children}</p>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="max-h-[70vh] min-w-0 max-w-full overflow-auto">{children}</div>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-foreground underline decoration-2 decoration-meter underline-offset-4">
      {children}
    </Link>
  );
}
