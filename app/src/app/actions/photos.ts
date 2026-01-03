"use server";

import { auth } from "@/lib/auth/config";
import type { CreateSessionResponse, MediaItem } from "@/types/google-photos";

const GOOGLE_PHOTOS_PICKER_API = "https://photospicker.googleapis.com/v1";

/**
 * Server Action to create a new Google Photos Picker session
 * Returns the picker URI for the user to select photos
 */
export async function createPickerSession(): Promise<CreateSessionResponse> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated. Please sign in first.");
  }

  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Session expired. Please sign in again.");
  }

  try {
    const response = await fetch(`${GOOGLE_PHOTOS_PICKER_API}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to create picker session");
    }

    const data = await response.json();

    // Parse polling config (e.g., "5s" -> 5000ms)
    const pollIntervalStr = data.pollingConfig?.pollInterval || "5s";
    const timeoutStr = data.pollingConfig?.timeoutIn || "1800s";

    return {
      sessionId: data.id,
      pickerUri: data.pickerUri,
      pollInterval: parseInt(pollIntervalStr) * 1000,
      timeout: parseInt(timeoutStr) * 1000,
    };
  } catch (error) {
    console.error("Error creating picker session:", error);
    throw error instanceof Error ? error : new Error("Failed to create picker session");
  }
}

/**
 * Server Action to fetch selected photos from a completed picker session
 */
export async function getSelectedPhotos(
  sessionId: string,
  pageToken?: string
): Promise<{ mediaItems: MediaItem[]; nextPageToken?: string }> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated. Please sign in first.");
  }

  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Session expired. Please sign in again.");
  }

  try {
    const url = new URL(`${GOOGLE_PHOTOS_PICKER_API}/mediaItems`);
    url.searchParams.set("sessionId", sessionId);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to fetch photos");
    }

    const data = await response.json();

    return {
      mediaItems: data.mediaItems || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error("Error fetching selected photos:", error);
    throw error instanceof Error ? error : new Error("Failed to fetch photos");
  }
}
