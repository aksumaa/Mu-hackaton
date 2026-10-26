"use client";

import { animate, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

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

export function AnchorNav({ items, menu }: { items: { id: string; label: string }[]; menu: string }) {
  const ids = items.map((item) => item.id).join("|");
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const nodes = ids.split("|").map((id) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0.15, 0.4] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);
  return (
    <div className="sticky top-16 z-30 -mx-4 min-w-0 overflow-x-auto border-b border-border/80 bg-background/85 backdrop-blur-md [scrollbar-width:none] sm:-mx-6 [&::-webkit-scrollbar]:hidden">
      <nav className="flex w-max gap-1 px-4 py-2 sm:px-6" aria-label={menu}>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={item.id === active ? "true" : undefined}
            className={cn(
              "shrink-0 px-3 py-2 text-sm font-semibold transition-colors hover:text-foreground",
              item.id === active ? "text-foreground underline decoration-brand-700 decoration-2 underline-offset-8" : "text-muted",
            )}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </Comp>
  );
}

export function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function HeroField({ steps }: { steps: { n: string; title: string }[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const shiftX = useTransform(px, [-0.5, 0.5], [-18, 18]);
  const shiftY = useTransform(py, [-0.5, 0.5], [-12, 12]);
  const backX = useTransform(px, [-0.5, 0.5], [14, -14]);
  const backY = useTransform(py, [-0.5, 0.5], [10, -10]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduce || window.matchMedia("(pointer: coarse)").matches) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  }

  return (
    <div
      ref={ref}
      className="relative min-h-[280px] overflow-hidden sm:min-h-[420px]"
      onPointerMove={move}
      onPointerLeave={() => { px.set(0); py.set(0); }}
      aria-hidden="true"
    >
      <motion.p
        className="pointer-events-none absolute -left-2 top-0 font-display text-[7.5rem] leading-none text-brand-200/80 sm:text-[10rem] dark:text-brand-800"
        style={reduce ? undefined : { x: backX, y: backY }}
      >
        01
      </motion.p>
      <motion.div
        className="absolute right-0 top-16 w-[78%] border border-foreground/80 bg-brand-900 p-4 text-brand-50 sm:top-24 sm:p-6"
        style={reduce ? undefined : { x: shiftX, y: shiftY }}
      >
        <Logo className="h-12" />
        <p className="mt-6 font-display text-4xl leading-none sm:text-5xl">MVP</p>
        <ol className="mt-6 grid gap-2">
          {steps.map((step) => (
            <li key={step.n} className="flex items-baseline justify-between gap-3 border-t border-brand-300/30 pt-2">
              <span className="font-display text-lg">{step.n}</span>
              <span className="text-right text-xs font-bold uppercase tracking-[0.16em] text-brand-200">{step.title}</span>
            </li>
          ))}
        </ol>
      </motion.div>
      <motion.span
        className="absolute bottom-2 left-0 h-16 w-16 border border-foreground bg-accent sm:h-24 sm:w-24"
        style={reduce ? undefined : { x: shiftX }}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function ProcessFlow({ steps }: { steps: { n: string; title: string; body: string }[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="mt-10 grid gap-0 md:grid-cols-4 md:gap-6">
      {steps.map((step, index) => (
        <motion.li
          key={step.n}
          className="relative min-w-0 border-t border-foreground py-5 md:py-6"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55, delay: reduce ? 0 : index * 0.08, ease }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">{step.n}</p>
          <h3 className="mt-3 font-display text-4xl font-semibold leading-none">{step.title}</h3>
          <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
          {index < steps.length - 1 ? (
            <span aria-hidden className="absolute right-0 top-6 hidden font-display text-2xl text-brand-700 md:block">→</span>
          ) : null}
        </motion.li>
      ))}
    </ol>
  );
}

export function CountUp({ value }: { value: number }) {
  const { ref, shown } = useShown<HTMLSpanElement>();
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (next) => setCurrent(Math.round(next)),
    });
    return () => controls.stop();
  }, [shown, value, reduce]);
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

export function Journey({ items }: { items: { n: string; mark: string; title: string; body: string }[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 50%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 70, damping: 24, restDelta: 0.001 });
  return (
    <div ref={ref} className="relative">
      <span aria-hidden className="absolute bottom-0 left-0 top-0 w-px bg-border md:left-[8.5rem]" />
      <motion.span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-px origin-top bg-foreground md:left-[8.5rem]"
        style={reduce ? { scaleY: 1 } : { scaleY }}
      />
      <ol>
        {items.map((item, index) => (
          <motion.li
            key={item.n}
            className={cn(
              "relative grid gap-3 border-b border-border py-8 pl-6 md:grid-cols-[9rem_1fr] md:gap-10 md:py-12 md:pl-0",
              index % 2 === 1 && "md:ml-16",
            )}
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px -15% 0px" }}
            transition={{ duration: 0.65, ease }}
          >
            <div>
              <p className="font-display text-6xl leading-none sm:text-8xl">{item.n}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-700">{item.mark}</p>
            </div>
            <div className="max-w-xl md:pt-4">
              <h3 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h3>
              <p className="mt-3 max-w-prose text-base leading-7 text-muted">{item.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
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
  return (
    <ol className="border-t border-foreground">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "grid gap-4 border-b border-foreground/20 py-8 md:grid-cols-[5rem_1fr_1.1fr] md:items-start",
            item.current && "-mx-4 bg-brand-900 px-4 text-brand-50 sm:-mx-6 sm:px-6",
          )}
        >
          <p className={cn("font-display text-5xl leading-none", item.current ? "text-brand-300" : "text-brand-700")}>
            {String(index + 1).padStart(2, "0")}
          </p>
          <div>
            <h3 className="font-display text-2xl font-semibold sm:text-3xl">{item.title}</h3>
            {item.current ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-200">{currentLabel}</p> : null}
          </div>
          <dl className="grid gap-2 text-sm">
            {item.rows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-current/15 pt-2">
                <dt className={item.current ? "text-brand-200" : "text-muted"}>{row.label}</dt>
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
  const reduce = useReducedMotion();
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
              "min-h-11 border-b-2 px-1 text-sm font-semibold uppercase tracking-[0.16em] transition-colors",
              item.id === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <motion.ul
        key={tab.id}
        role="tabpanel"
        className="mt-5 grid gap-3"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
      >
        {tab.rows.map((row) => (
          <li key={row.key}>
            <FillBar label={row.label} value={row.max} max={top} />
          </li>
        ))}
      </motion.ul>
    </div>
  );
}
