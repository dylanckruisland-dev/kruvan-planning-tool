import { Mic, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNoteSpeechRecognition } from "@/hooks/useNoteSpeechRecognition";
import { cn } from "@/lib/cn";
import type { VoiceParseResult } from "@/lib/quick-add-voice";

type VoicePhase = "idle" | "listening" | "processing" | "ready";

type Props = {
  /** When false, panel is hidden. */
  expanded: boolean;
  onParsed: (result: VoiceParseResult) => void;
  /** First step from top-bar mic: transcript first, then controls. */
  variant?: "inline" | "gate";
  /** Label for the primary action (default: Fill form). */
  primaryActionLabel?: string;
};

/** Speech-to-text + Gemini parse for Quick Add. */
export function QuickAddVoicePanel({
  expanded,
  onParsed,
  variant = "inline",
  primaryActionLabel = "Fill form",
}: Props) {
  const { workspaceId } = useWorkspace();
  const speech = useNoteSpeechRecognition({ langMode: "auto" });
  const parseVoice = useAction(api.voiceCommand.parseVoiceCommand);

  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (speech.finalText) setTranscript(speech.finalText);
  }, [speech.finalText]);

  const listening = speech.phase === "listening";
  const sttProcessing = speech.phase === "processing";
  const transcriptDisplay =
    listening || sttProcessing ? speech.liveText : transcript;

  let voicePhase: VoicePhase = "idle";
  if (listening) voicePhase = "listening";
  else if (sttProcessing || parsing) voicePhase = "processing";
  else if (transcript.trim().length > 0) voicePhase = "ready";

  async function onProcess() {
    if (!workspaceId || !transcript.trim()) return;
    setParseError(null);
    setParsing(true);
    try {
      const result = await parseVoice({
        workspaceId,
        transcript: transcript.trim(),
      });
      onParsed(result);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not parse your command.";
      setParseError(msg);
    } finally {
      setParsing(false);
    }
  }

  const statusLine = (
    <p className="text-[11px] text-slate-500" aria-live="polite">
      {voicePhase === "idle" &&
        (variant === "gate"
          ? "Tap Speak, talk, then Stop — edit below if needed."
          : "Speak, then process with AI to fill the form.")}
      {voicePhase === "listening" && "Listening…"}
      {voicePhase === "processing" &&
        (parsing ? "Parsing…" : "Finishing…")}
      {voicePhase === "ready" &&
        !parsing &&
        (variant === "gate"
          ? "Check the text, then continue to the form."
          : "Review transcript, then process.")}
    </p>
  );

  const buttonRow = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setParseError(null);
          if (listening) speech.finishListening();
          else {
            setTranscript("");
            speech.start();
          }
        }}
        disabled={sttProcessing || !workspaceId}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          listening
            ? "bg-rose-600 text-white hover:bg-rose-700"
            : "bg-slate-800 text-white hover:bg-slate-900",
          (!workspaceId || sttProcessing) && "pointer-events-none opacity-50",
        )}
      >
        {listening ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            {sttProcessing ? "Stopping…" : "Speak"}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => void onProcess()}
        disabled={
          parsing ||
          !transcript.trim() ||
          listening ||
          sttProcessing ||
          !workspaceId
        }
        className="rounded-lg bg-accent-solid px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
      >
        {parsing ? "Processing…" : primaryActionLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          speech.reset();
          setTranscript("");
          setParseError(null);
        }}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        disabled={listening || sttProcessing}
      >
        Clear
      </button>
    </div>
  );

  const transcriptField = (
    <label className="block text-[11px] font-medium text-slate-600">
      Transcript
      <textarea
        className={cn(
          "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none input-focus-accent",
          variant === "gate" && "min-h-[160px]",
        )}
        rows={variant === "gate" ? 6 : 3}
        value={transcriptDisplay}
        onChange={(e) => setTranscript(e.target.value)}
        disabled={listening || sttProcessing}
        placeholder="Your words appear here — edit before continuing."
      />
    </label>
  );

  const errorBlock = (
    <>
      {speech.error ? (
        <p className="mt-2 text-xs text-rose-600" role="alert">
          {speech.error}
        </p>
      ) : null}
      {parseError ? (
        <p className="mt-2 text-xs text-rose-600" role="alert">
          {parseError}
        </p>
      ) : null}
    </>
  );

  if (!expanded) return null;

  const gate = variant === "gate";

  if (gate) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-4 sm:px-4">
        {statusLine}
        <div className="mt-4">{transcriptField}</div>
        <div className="mt-4">{buttonRow}</div>
        {errorBlock}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">Voice fill</p>
        {statusLine}
      </div>
      <div className="mt-3">{buttonRow}</div>
      {errorBlock}
      <div className="mt-3">{transcriptField}</div>
    </div>
  );
}
