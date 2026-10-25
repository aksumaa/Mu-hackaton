"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useShown<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setShown(true);
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, shown };
}

export function AnchorNav({ items, menu, close }: { items: { id: string; label: string }[]; menu: string; close: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-border bg-background/90 backdrop-blur sm:-mx-6">
      <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
        <p className="text-sm font-semibold md:hidden">{menu}</p>
        <nav className="hidden min-w-0 flex-1 flex-wrap gap-1 md:flex" aria-label={menu}>
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="ml-auto grid h-11 w-11 place-items-center rounded-full border border-border md:hidden"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden size={18} /> : <Menu aria-hidden size={18} />}
          <span className="sr-only">{open ? close : menu}</span>
        </button>
      </div>
      {open ? (
        <nav className="grid gap-1 px-4 pb-3 md:hidden" aria-label={menu}>
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="rounded-xl px-3 py-3 font-semibold" onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, shown } = useShown<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("reveal", shown && "is-in", className)}>
      {children}
    </div>
  );
}

export function CountUp({ value }: { value: number }) {
  const { ref, shown } = useShown<HTMLSpanElement>();
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 800);
      setCurrent(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, value]);
  return <span ref={ref} className="tabular-nums">{current}</span>;
}

export function FillBar({ label, value, max }: { label: string; value: number; max: number }) {
  const { ref, shown } = useShown<HTMLDivElement>();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 tabular-nums">{value} / {max}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft">
        <div className={cn("meter-fill h-2 rounded-full bg-meter", shown && "is-in")} style={{ ["--fill" as string]: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Timeline({
  items,
  currentLabel,
}: {
  items: { id: string; title: string; current: boolean; rows: { label: string; value: string }[] }[];
  currentLabel: string;
}) {
  const { ref, shown } = useShown<HTMLOListElement>();
  return (
    <ol ref={ref} className="relative grid gap-8 pl-8">
      <span aria-hidden className={cn("time-line absolute bottom-0 left-[7px] top-2 w-px bg-meter", shown && "is-in")} />
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-8 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-meter bg-background",
              item.current && "pulse bg-meter",
            )}
          />
          <h3 className="text-lg font-semibold">
            {item.title}
            {item.current ? <span className="ml-2 text-xs font-semibold uppercase tracking-wide">{currentLabel}</span> : null}
          </h3>
          <dl className="mt-2 grid gap-1 text-sm">
            {item.rows.map((row) => (
              <div key={row.label} className="flex flex-wrap gap-x-2">
                <dt className="text-muted">{row.label}</dt>
                <dd className="font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function RubricTabs({
  tabs,
}: {
  tabs: { id: string; label: string; rows: { key: string; label: string; max: number }[] }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const tab = tabs.find((item) => item.id === active) ?? tabs[0];
  if (!tab) return null;
  const top = Math.max(...tab.rows.map((row) => row.max), 1);
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === tab.id}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold",
              item.id === tab.id ? "bg-accent text-accent-foreground" : "border border-border bg-card",
            )}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul key={tab.id} role="tabpanel" className="mt-5 grid gap-3">
        {tab.rows.map((row) => (
          <li key={row.key}>
            <FillBar label={row.label} value={row.max} max={top} />
          </li>
        ))}
      </ul>
    </div>
  );
}
