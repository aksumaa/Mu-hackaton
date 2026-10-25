"use client";

import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/time";

export function Countdown({ target, labels, passed }: { target: string; labels: [string, string, string, string]; passed: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return <p className="text-3xl font-semibold tabular-nums">--:--:--</p>;
  const parts = countdownParts(new Date(target), new Date(now));
  if (parts.done) return <p className="text-lg">{passed}</p>;
  const values = [parts.days, parts.hours, parts.minutes, parts.seconds];
  return (
    <div className="grid grid-cols-4 gap-2">
      {values.map((value, index) => (
        <div key={labels[index]} className="rounded-2xl bg-accent-soft px-2 py-3 text-center">
          <div className="text-2xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</div>
          <div className="text-xs uppercase tracking-wide text-muted">{labels[index]}</div>
        </div>
      ))}
    </div>
  );
}
