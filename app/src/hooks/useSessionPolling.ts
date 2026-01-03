"use client";

import { useCallback, useRef, useState } from "react";
import type { SessionStatusResponse } from "@/types/google-photos";

interface UseSessionPollingOptions {
  /** Callback when photos are selected */
  onComplete: (sessionId: string) => void;
  /** Callback on error */
  onError: (error: Error) => void;
  /** Poll interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Timeout in milliseconds (default: 1800000 = 30 minutes) */
  timeout?: number;
}

interface UseSessionPollingReturn {
  /** Start polling for a session */
  startPolling: (sessionId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Whether currently polling */
  isPolling: boolean;
}

export function useSessionPolling({
  onComplete,
  onError,
  pollInterval = 5000,
  timeout = 1800000,
}: UseSessionPollingOptions): UseSessionPollingReturn {
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(
    (sessionId: string) => {
      // Clear any existing polling
      stopPolling();
      setIsPolling(true);

      const poll = async () => {
        try {
          const response = await fetch(`/api/photos/sessions/${sessionId}`);
          const data: SessionStatusResponse = await response.json();

          if (!response.ok) {
            throw new Error(data.sessionId || "Failed to get session status");
          }

          if (data.mediaItemsSet) {
            stopPolling();
            onComplete(sessionId);
          }
        } catch (error) {
          stopPolling();
          onError(error instanceof Error ? error : new Error("Polling failed"));
        }
      };

      // Start polling
      poll(); // Initial poll
      intervalRef.current = setInterval(poll, pollInterval);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        onError(new Error("Session timed out. Please try again."));
      }, timeout);
    },
    [pollInterval, timeout, onComplete, onError, stopPolling]
  );

  return {
    startPolling,
    stopPolling,
    isPolling,
  };
}
