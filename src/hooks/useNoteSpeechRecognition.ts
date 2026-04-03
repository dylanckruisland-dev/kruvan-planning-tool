import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  type SpeechLangMode,
  resolveRecognitionLang,
} from "@/lib/speech-recognition";

export type VoicePhase = "idle" | "listening" | "processing" | "ready";

type UseNoteSpeechRecognitionOptions = {
  langMode: SpeechLangMode;
};

/**
 * Keeps speech recognition alive across natural pauses: `continuous` mode plus
 * restart on `onend` while the user has not pressed Stop (Chrome/Chromium pattern).
 */
export function useNoteSpeechRecognition({
  langMode,
}: UseNoteSpeechRecognitionOptions) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [liveText, setLiveText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef("");
  const hadErrorRef = useRef(false);
  /** True from mic click until Stop — used to restart after `onend` during pauses. */
  const listeningActiveRef = useRef(false);
  const langModeRef = useRef(langMode);
  langModeRef.current = langMode;

  const stopRecognition = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const reset = useCallback(() => {
    listeningActiveRef.current = false;
    stopRecognition();
    recRef.current = null;
    accumulatedRef.current = "";
    hadErrorRef.current = false;
    setPhase("idle");
    setLiveText("");
    setFinalText("");
    setError(null);
  }, [stopRecognition]);

  const discard = useCallback(() => {
    reset();
  }, [reset]);

  const start = useCallback(() => {
    setError(null);
    setFinalText("");
    accumulatedRef.current = "";
    hadErrorRef.current = false;
    setLiveText("");
    listeningActiveRef.current = true;
    setPhase("listening");

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      listeningActiveRef.current = false;
      setPhase("idle");
      setError(
        "Voice input isn’t available in this browser. Try Chrome or Edge on desktop, or type your note instead.",
      );
      return;
    }

    const recognition = new Ctor();
    recRef.current = recognition;
    recognition.lang = resolveRecognitionLang(langModeRef.current);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setPhase("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const seg = event.results[i]![0]!.transcript;
        if (event.results[i]!.isFinal) {
          accumulatedRef.current += seg;
        } else {
          interim += seg;
        }
      }
      setLiveText(accumulatedRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") {
        listeningActiveRef.current = false;
        recRef.current = null;
        setPhase("idle");
        setLiveText("");
        accumulatedRef.current = "";
        return;
      }
      if (
        event.error === "no-speech" &&
        listeningActiveRef.current &&
        recRef.current &&
        accumulatedRef.current.length > 0
      ) {
        try {
          recRef.current.start();
        } catch {
          window.setTimeout(() => {
            try {
              if (listeningActiveRef.current && recRef.current) {
                recRef.current.start();
              }
            } catch {
              /* ignore */
            }
          }, 80);
        }
        return;
      }
      listeningActiveRef.current = false;
      hadErrorRef.current = true;
      const friendly =
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow the microphone in your browser settings, or type your note instead."
          : event.error === "no-speech"
            ? "No speech was detected. Try again and speak a bit longer."
            : event.error === "audio-capture"
              ? "No microphone was found. Check your device settings."
              : `Could not capture speech (${event.error}). Try again or type your note.`;
      setError(friendly);
      setPhase("idle");
      setLiveText("");
      accumulatedRef.current = "";
      recRef.current = null;
    };

    recognition.onend = () => {
      if (listeningActiveRef.current) {
        const r = recRef.current;
        if (!r) return;
        try {
          r.start();
        } catch {
          window.setTimeout(() => {
            try {
              if (listeningActiveRef.current && recRef.current) {
                recRef.current.start();
              }
            } catch {
              /* ignore */
            }
          }, 80);
        }
        return;
      }

      recRef.current = null;
      const text = accumulatedRef.current.trim();
      accumulatedRef.current = "";
      setLiveText("");
      if (hadErrorRef.current) {
        hadErrorRef.current = false;
        return;
      }
      if (text.length > 0) {
        setFinalText(text);
        setPhase("ready");
      } else {
        setPhase("idle");
      }
    };

    try {
      recognition.start();
    } catch {
      listeningActiveRef.current = false;
      setError("Could not start the microphone. Try again.");
      setPhase("idle");
      recRef.current = null;
    }
  }, []);

  const finishListening = useCallback(() => {
    listeningActiveRef.current = false;
    if (!recRef.current) return;
    setPhase("processing");
    stopRecognition();
  }, [stopRecognition]);

  useEffect(() => () => {
    listeningActiveRef.current = false;
    const r = recRef.current;
    if (r) {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return {
    phase,
    liveText,
    finalText,
    error,
    start,
    stopRecognition,
    finishListening,
    reset,
    discard,
  };
}
