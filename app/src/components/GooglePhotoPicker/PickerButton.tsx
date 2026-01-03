"use client";

import { useTransition } from "react";
import { createPickerSession } from "@/app/actions/photos";
import type { CreateSessionResponse } from "@/types/google-photos";

interface PickerButtonProps {
  /** Callback when session is created */
  onSessionCreated: (session: CreateSessionResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether button is disabled */
  disabled?: boolean;
}

export function PickerButton({
  onSessionCreated,
  onError,
  className = "",
  disabled = false,
}: PickerButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const session = await createPickerSession();
        onSessionCreated(session);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("Failed to start picker"));
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isPending}
      aria-label="Select photos from Google Photos"
      className={`
        inline-flex items-center justify-center gap-2 px-6 py-3
        bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
        text-white font-medium rounded-lg
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isPending ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Starting...</span>
        </>
      ) : (
        <>
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>Select Photos</span>
        </>
      )}
    </button>
  );
}
