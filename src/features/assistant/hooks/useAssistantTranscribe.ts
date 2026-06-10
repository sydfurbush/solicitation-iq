import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readEdgeError } from "@/lib/supabase/edgeError";

export type RecordingState = "idle" | "recording" | "transcribing";

export type MicErrorKind = "denied" | "no_device" | "in_use" | "unsupported" | "unknown";

export class MicrophoneError extends Error {
  kind: MicErrorKind;
  constructor(kind: MicErrorKind, message: string) {
    super(message);
    this.name = "MicrophoneError";
    this.kind = kind;
  }
}

export function useAssistantTranscribe() {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolveRef = useRef<((text: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  const start = useCallback(async (): Promise<string> => {
    if (state !== "idle") throw new Error("Recorder busy");
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new MicrophoneError(
        "unsupported",
        "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari on a secure (https) page.",
      );
    }

    // Pre-check the permission state when available so we can give a clearer message
    // before invoking the native prompt.
    try {
      const status = await (navigator.permissions as any)?.query?.({ name: "microphone" as PermissionName });
      if (status?.state === "denied") {
        throw new MicrophoneError(
          "denied",
          "Microphone access is blocked for this site. Click the lock icon in the address bar, allow the microphone, then try again.",
        );
      }
    } catch (e) {
      if (e instanceof MicrophoneError) throw e;
      // permissions API not supported — fall through to getUserMedia which will prompt
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new MicrophoneError(
          "denied",
          "Microphone access was denied. Click the lock icon in the address bar, allow the microphone for this site, then click the mic again.",
        );
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new MicrophoneError(
          "no_device",
          "No microphone was found. Plug in or enable a microphone and try again.",
        );
      }
      if (name === "NotReadableError") {
        throw new MicrophoneError(
          "in_use",
          "Your microphone is being used by another app. Close other apps using it and try again.",
        );
      }
      throw new MicrophoneError("unknown", err?.message || "Could not start the microphone.");
    }
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mediaRecorderRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    const done = new Promise<string>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
    });

    rec.onstop = async () => {
      try {
        setState("transcribing");
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const ext = (rec.mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: blob.type });
        const form = new FormData();
        form.append("file", file);

        const { data, error: invokeError } = await supabase.functions.invoke("assistant-transcribe", {
          body: form,
        });
        if (invokeError) {
          const msg = await readEdgeError(invokeError);
          throw new Error(msg);
        }
        const text = (data as { text?: string })?.text ?? "";
        resolveRef.current?.(text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        rejectRef.current?.(e instanceof Error ? e : new Error(msg));
      } finally {
        cleanup();
        setState("idle");
      }
    };

    rec.start();
    setState("recording");
    return done;
  }, [state]);

  const stop = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const cancel = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    cleanup();
    setState("idle");
  }, []);

  return { state, error, start, stop, cancel };
}
