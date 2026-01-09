"use client";

import type { PickerState } from "@/types/google-photos";

interface PickerStatusProps {
  /** Current picker state */
  state: PickerState;
  /** Error message if in error state */
  errorMessage?: string;
  /** Callback to retry */
  onRetry?: () => void;
}

export function PickerStatus({ state, errorMessage, onRetry }: PickerStatusProps) {
  if (state === "idle") {
    return null;
  }

  const statusConfig: Record<
    Exclude<PickerState, "idle">,
    { message: string; icon: React.ReactNode; bgColor: string }
  > = {
    picking: {
      message: "Waiting for photo selection...",
      icon: (
        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      bgColor: "bg-blue-50 border-blue-200",
    },
    polling: {
      message: "Processing your selection...",
      icon: (
        <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
      bgColor: "bg-blue-50 border-blue-200",
    },
    complete: {
      message: "Photos selected successfully!",
      icon: (
        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      bgColor: "bg-green-50 border-green-200",
    },
    error: {
      message: errorMessage || "Something went wrong",
      icon: (
        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: "bg-red-50 border-red-200",
    },
  };

  const config = statusConfig[state];

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${config.bgColor}`}>
      {config.icon}
      <span className="text-sm font-medium text-gray-700">{config.message}</span>
      {state === "error" && onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
