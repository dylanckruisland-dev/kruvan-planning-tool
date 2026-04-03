import { Loader2, Mic, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { useNoteSpeechRecognition } from "@/hooks/useNoteSpeechRecognition";
import {
  isSpeechRecognitionSupported,
  type SpeechLangMode,
} from "@/lib/speech-recognition";

type Props = {
  /** Plain text to merge into the note body (never auto-saves the note). */
  onInsertPlainText: (text: string) => void;
  disabled?: boolean;
};

const LANG_OPTIONS: { value: SpeechLangMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "nl", label: "NL" },
  { value: "en", label: "EN" },
];

export function NoteVoiceInput({ onInsertPlainText, disabled }: Props) {
  const [langMode, setLangMode] = useState<SpeechLangMode>("auto");
  const voice = useNoteSpeechRecognition({ langMode });

  const supported = useMemo(() => isSpeechRecognitionSupported(), []);

  const statusLabel = useMemo(() => {
    switch (voice.phase) {
      case "listening":
        return "Listening… short pauses are OK — tap Stop when finished";
      case "processing":
        return "Processing…";
      case "ready":
        return "Review transcript below";
      default:
        return null;
    }
  }, [voice.phase]);

  if (!supported) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-[11px] text-slate-500">
        Voice notes need a browser with speech recognition (e.g. Chrome or
        Edge). You can still type your note as usual.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Voice
        </span>
        <label className="sr-only" htmlFor="note-voice-lang">
          Speech language
        </label>
        <select
          id="note-voice-lang"
          value={langMode}
          onChange={(e) =>
            setLangMode(e.target.value as SpeechLangMode)
          }
          disabled={disabled || voice.phase === "listening" || voice.phase === "processing"}
          className="rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none input-focus-accent disabled:opacity-50"
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {voice.phase === "listening" ? (
            <button
              type="button"
              onClick={() => voice.finishListening()}
              disabled={disabled}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-40"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => voice.start()}
              disabled={
                disabled ||
                voice.phase === "processing" ||
                voice.phase === "ready"
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
              title="Speak to add text (Dutch or English)"
              aria-label="Start voice input"
            >
              <Mic className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {voice.phase === "idle" && !voice.error ? (
        <p className="text-[10px] leading-snug text-slate-400">
          Allow the mic if prompted. Recording keeps going through short pauses —
          tap Stop when you&apos;re done.
        </p>
      ) : null}

      {statusLabel ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {voice.phase === "processing" ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
          ) : null}
          {statusLabel}
        </p>
      ) : null}

      {voice.phase === "listening" && voice.liveText ? (
        <p className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-xs leading-relaxed text-slate-700">
          {voice.liveText}
        </p>
      ) : null}

      {voice.phase === "ready" && voice.finalText ? (
        <div className="space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">
            Transcript — not saved yet
          </p>
          <p className="max-h-32 overflow-y-auto text-xs leading-relaxed text-slate-800">
            {voice.finalText}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onInsertPlainText(voice.finalText);
                voice.discard();
              }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Add to note
            </button>
            <button
              type="button"
              onClick={() => voice.discard()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {voice.error ? (
        <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          {voice.error}
        </p>
      ) : null}
    </div>
  );
}
