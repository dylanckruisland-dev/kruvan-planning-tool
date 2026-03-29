import { useAuthActions } from "@convex-dev/auth/react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { KruvanLogo } from "@/components/brand/KruvanLogo";
import { cn } from "@/lib/cn";

/** Static hero background — file lives in `public/login-bg.png`. */
const LOGIN_BG_URL = "/login-bg.png";

const HERO_BULLETS = [
  "Everything organized in one clear place",
  "Find what you need instantly",
  "A clean overview without clutter",
] as const;

export function LoginPage() {
  const { signIn } = useAuthActions();
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  const errorId = `${baseId}-error`;

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgReady(true);
    img.onerror = () => setBgReady(true);
    img.src = LOGIN_BG_URL;
  }, []);

  const setFlowTab = (next: "signIn" | "signUp") => {
    setFlow(next);
    setError(null);
    setShowPassword(false);
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950" />
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out"
          style={{
            backgroundImage: `url(${LOGIN_BG_URL})`,
            opacity: bgReady ? 1 : 0,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/45 via-slate-900/40 to-slate-900/60" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:gap-16 lg:py-16 xl:gap-24">
        {/* Desktop: marketing column (logo lives on the card) */}
        <aside className="hidden min-w-0 flex-1 flex-col gap-8 lg:flex">
          <div className="space-y-4">
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-tight text-white [font-optical-sizing:auto]">
              Find everything with ease.
              <br />
              <span className="text-white/88">Work without distractions.</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/72 sm:text-lg">
              All your projects, tasks and calendar in one simple place, organized
              so you always know where to look.
            </p>
          </div>
          <ul className="max-w-md space-y-3 text-sm text-white/85">
            {HERO_BULLETS.map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/78 text-[color:var(--kruvan-brand)] shadow-[0_1px_2px_rgba(15,23,42,0.22)] ring-1 ring-white/55 backdrop-blur-[1.5px]">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Auth card */}
        <div className="w-full shrink-0 lg:max-w-[420px]">
          <div className="login-card-enter rounded-3xl border border-white/25 bg-white/95 p-7 shadow-[0_25px_50px_-12px_rgb(15_23_42/0.35)] ring-1 ring-white/40 backdrop-blur-md sm:p-8">
            <div className="mb-6 flex flex-col items-center">
              <KruvanLogo
                size="md"
                variant="card"
                className="mb-4"
              />
              <p className="text-center font-display text-xl font-semibold tracking-tight text-slate-900 [font-optical-sizing:auto]">
                {flow === "signIn" ? "Welcome back" : "Welcome to Kruvan"}
              </p>
              <p className="mt-1 text-center text-sm text-slate-500">
                {flow === "signIn"
                  ? "Sign in to continue to your workspace."
                  : "Create an account to get started."}
              </p>
            </div>

            <div
              className="mb-6 flex rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80"
              role="tablist"
              aria-label="Choose sign in or sign up"
            >
              <button
                type="button"
                role="tab"
                aria-selected={flow === "signIn"}
                className={cn(
                  "relative flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.45)] focus-visible:ring-offset-2",
                  flow === "signIn"
                    ? "bg-white text-slate-900 shadow-sm shadow-slate-900/8 ring-1 ring-slate-200/90"
                    : "text-slate-500 hover:text-slate-800",
                )}
                onClick={() => setFlowTab("signIn")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={flow === "signUp"}
                className={cn(
                  "relative flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.45)] focus-visible:ring-offset-2",
                  flow === "signUp"
                    ? "bg-white text-slate-900 shadow-sm shadow-slate-900/8 ring-1 ring-slate-200/90"
                    : "text-slate-500 hover:text-slate-800",
                )}
                onClick={() => setFlowTab("signUp")}
              >
                Sign up
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setSubmitting(true);
                const fd = new FormData(e.currentTarget);
                void signIn("password", fd)
                  .catch((err: unknown) => {
                    const msg =
                      err instanceof Error ? err.message : "Sign-in failed.";
                    setError(msg);
                  })
                  .finally(() => setSubmitting(false));
              }}
            >
              <div>
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  Email
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus-visible:border-[rgba(var(--kruvan-brand-rgb),0.42)] focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.14)]"
                  placeholder="you@example.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              <div>
                <label
                  htmlFor={passwordId}
                  className="mb-1.5 block text-xs font-medium text-slate-600"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id={passwordId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={
                      flow === "signIn" ? "current-password" : "new-password"
                    }
                    minLength={8}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus-visible:border-[rgba(var(--kruvan-brand-rgb),0.42)] focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.14)]"
                    placeholder="At least 8 characters"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.35)]"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              <input name="flow" type="hidden" value={flow} />

              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800 ring-1 ring-red-100"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--kruvan-brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_-3px_rgba(var(--kruvan-brand-rgb),0.38)] transition hover:bg-[color:var(--kruvan-brand-hover)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {submitting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                    {flow === "signIn" ? "Signing in…" : "Creating account…"}
                  </>
                ) : flow === "signIn" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
              By continuing you agree to our{" "}
              <a
                href="#"
                className="text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-[color:var(--kruvan-brand)]"
                onClick={(e) => e.preventDefault()}
              >
                terms
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-[color:var(--kruvan-brand)]"
                onClick={(e) => e.preventDefault()}
              >
                privacy policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <p className="pointer-events-none relative z-10 px-4 pb-4 text-center text-[10px] text-white/55">
        <span className="pointer-events-auto">
          Photo:{" "}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-white/85"
          >
            Unsplash
          </a>
        </span>
      </p>
    </div>
  );
}
