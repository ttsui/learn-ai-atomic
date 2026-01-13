"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PickerButton } from "./PickerButton";
import { PickerStatus } from "./PickerStatus";
import { useSessionPolling } from "@/hooks/useSessionPolling";
import type { PickerState, CreateSessionResponse } from "@/types/google-photos";

export function PhotoPickerFlow() {
  const router = useRouter();
  const [state, setState] = useState<PickerState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const pickerWindowRef = useRef<Window | null>(null);
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleComplete = useCallback(
    (completedSessionId: string) => {
      setState("complete");

      // Clear window check interval
      if (windowCheckIntervalRef.current) {
        clearInterval(windowCheckIntervalRef.current);
        windowCheckIntervalRef.current = null;
      }

      // Navigate to gallery with session ID
      setTimeout(() => {
        router.push(`/gallery?sessionId=${completedSessionId}`);
      }, 1000);
    },
    [router]
  );

  const handleError = useCallback((error: Error) => {
    setState("error");
    setErrorMessage(error.message);

    // Clear window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
      windowCheckIntervalRef.current = null;
    }
  }, []);

  const { startPolling, stopPolling } = useSessionPolling({
    onComplete: handleComplete,
    onError: handleError,
  });

  const handleSessionCreated = useCallback(
    (session: CreateSessionResponse) => {
      setSessionId(session.sessionId);
      setState("picking");

      // Append /autoclose for auto-close behavior after selection
      const pickerUrl = `${session.pickerUri}/autoclose`;

      // Open picker in a new window
      const width = 800;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      pickerWindowRef.current = window.open(
        pickerUrl,
        "GooglePhotosPicker",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Start polling when picker opens
      setState("polling");
      startPolling(session.sessionId);

      // Monitor picker window close
      windowCheckIntervalRef.current = setInterval(() => {
        if (pickerWindowRef.current?.closed) {
          clearInterval(windowCheckIntervalRef.current!);
          windowCheckIntervalRef.current = null;
          pickerWindowRef.current = null;
        }
      }, 500);
    },
    [startPolling]
  );

  const handleRetry = useCallback(() => {
    setState("idle");
    setSessionId(null);
    setErrorMessage(undefined);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (windowCheckIntervalRef.current) {
        clearInterval(windowCheckIntervalRef.current);
      }
      if (pickerWindowRef.current && !pickerWindowRef.current.closed) {
        pickerWindowRef.current.close();
      }
    };
  }, [stopPolling]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <PickerButton
          onSessionCreated={handleSessionCreated}
          onError={handleError}
          disabled={state !== "idle" && state !== "error"}
        />
        <PickerStatus state={state} errorMessage={errorMessage} onRetry={handleRetry} />
      </div>

      {sessionId && state === "complete" && (
        <p className="text-center text-sm text-gray-500">
          Redirecting to your photos...
        </p>
      )}
    </div>
  );
}
