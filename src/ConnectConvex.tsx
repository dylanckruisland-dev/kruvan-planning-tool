export function ConnectConvex() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Connect Convex</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Add{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            VITE_CONVEX_URL
          </code>{" "}
          to{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            .env.local
          </code>
          . Run{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            npx convex dev
          </code>{" "}
          to create a deployment and sync schema. Regenerated{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            convex/_generated
          </code>{" "}
          files will replace the bundled stubs.
        </p>
      </div>
    </div>
  );
}
