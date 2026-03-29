import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";

export const KRUVAN_LOGO_URL = "/kruvan-logo.png";

const sizeClass = {
  xs: "h-5 w-auto max-h-5",
  sm: "h-7 w-auto max-h-7",
  md: "h-9 w-auto max-h-9",
  lg: "h-11 w-auto max-h-11",
} as const;

type Props = {
  className?: string;
  size?: keyof typeof sizeClass;
  /**
   * default — minimal (app chrome)
   * onDark — frosted tile on photo / dark hero
   * card — subtle frame on white login card
   */
  variant?: "default" | "onDark" | "card";
  /** Wrap in link to home (/) */
  asHomeLink?: boolean;
};

export function KruvanLogo({
  className,
  size = "md",
  variant = "default",
  asHomeLink = false,
}: Props) {
  const img = (
    <img
      src={KRUVAN_LOGO_URL}
      alt=""
      width={120}
      height={120}
      className={cn(
        sizeClass[size],
        "object-contain",
        variant === "default" && "opacity-[0.94]",
      )}
      decoding="async"
    />
  );

  const shell = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        variant === "default" && "rounded-md",
        variant === "card" &&
          "rounded-xl bg-slate-50/90 p-2 ring-1 ring-slate-200/60",
        variant === "onDark" &&
          "rounded-2xl bg-white/12 p-1.5 ring-1 ring-white/25 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {img}
    </span>
  );

  if (asHomeLink) {
    return (
      <Link
        to="/"
        title="Kruvan"
        aria-label="Kruvan — home"
        className={cn(
          "shrink-0 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-focus focus-visible:ring-offset-2",
        )}
      >
        {shell}
      </Link>
    );
  }

  return shell;
}
