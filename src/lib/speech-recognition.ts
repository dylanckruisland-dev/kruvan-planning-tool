/**
 * Browser Web Speech API helpers. Can be swapped later for a server-side STT provider.
 */

export type SpeechLangMode = "nl" | "en" | "auto";

export function resolveRecognitionLang(mode: SpeechLangMode): string {
  if (mode === "nl") return "nl-NL";
  if (mode === "en") return "en-US";
  const n = typeof navigator !== "undefined" ? navigator.language : "en-US";
  return n.toLowerCase().startsWith("nl") ? "nl-NL" : "en-US";
}

export function getSpeechRecognitionConstructor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}
