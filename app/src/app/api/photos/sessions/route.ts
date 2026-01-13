import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const GOOGLE_PHOTOS_PICKER_API = "https://photospicker.googleapis.com/v1/sessions";

/**
 * POST /api/photos/sessions
 * Creates a new Google Photos Picker session
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to access photos" },
        { status: 401 }
      );
    }

    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "TokenExpired", message: "Session expired. Please sign in again" },
        { status: 401 }
      );
    }

    const response = await fetch(GOOGLE_PHOTOS_PICKER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Photos API error:", error);
      return NextResponse.json(
        { error: "GoogleAPIError", message: error.error?.message || "Failed to create session" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Parse polling config (e.g., "5s" -> 5000ms)
    const pollIntervalStr = data.pollingConfig?.pollInterval || "5s";
    const timeoutStr = data.pollingConfig?.timeoutIn || "1800s";
    const pollInterval = parseInt(pollIntervalStr) * 1000;
    const timeout = parseInt(timeoutStr) * 1000;

    return NextResponse.json({
      sessionId: data.id,
      pickerUri: data.pickerUri,
      pollInterval,
      timeout,
    });
  } catch (error) {
    console.error("Error creating picker session:", error);
    return NextResponse.json(
      { error: "InternalError", message: "Failed to create picker session" },
      { status: 500 }
    );
  }
}
