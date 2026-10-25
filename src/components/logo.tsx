import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    // next/image does not optimize SVG unless dangerouslyAllowSVG is enabled.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo.svg" alt="" width={385} height={441} className={cn("w-auto shrink-0", className)} />
  );
}

export function BrandLink({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <Link href="/" className={cn("inline-flex w-fit items-center gap-3", className)}>
      <Logo className={cn("h-14", markClassName)} />
      <span className="leading-tight">
        <span className="block text-lg font-semibold tracking-tight">MU Hackathon</span>
        <span className="block text-sm text-muted">Millat Umidi</span>
      </span>
    </Link>
  );
}
