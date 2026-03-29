/** Default matches previous app purple when workspace has no accent. */
export const DEFAULT_WORKSPACE_ACCENT = "#4f46e5";

export function normalizeWorkspaceAccent(hex: string | undefined | null): string {
  const t = (hex ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  return DEFAULT_WORKSPACE_ACCENT;
}

/** Comma-separated values for `rgba(var(--workspace-accent-rgb), a)`. */
export function accentHexToRgbComma(hex: string): string {
  const h = normalizeWorkspaceAccent(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
