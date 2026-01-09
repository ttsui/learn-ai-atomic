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
 *
 * @param sessionId - The picker session ID from Google Photos Picker API
 * @param pageToken - Optional pagination token for fetching additional pages
 * @returns Object containing mediaItems array and optional nextPageToken
 *
 * ## Cache Revalidation Strategy
 *
 * **IMPORTANT: This Server Action does NOT use revalidatePath()**
 *
 * Reasoning:
 * 1. **Data-Fetching vs Mutation**: This is a read-only data-fetching Server Action,
 *    not a mutation. It doesn't modify any server-side state or database records.
 *
 * 2. **Fresh Data Guarantee**: Every call fetches fresh data directly from Google's API.
 *    There's no cached data to revalidate - the API is the source of truth.
 *
 * 3. **Server Component Restriction**: Server Actions called during the render phase
 *    (from Server Components) CANNOT call revalidatePath or revalidateTag. Doing so
 *    causes a Next.js error: "revalidatePath cannot be called during render".
 *
 * 4. **No Cache Invalidation Needed**: Since we're fetching from an external API,
 *    Next.js page caching doesn't apply. Each request gets live data.
 *
 * ## Best Practice: Separation of Concerns
 *
 * **Data-Fetching Actions** (like this one):
 * - Pure read operations
 * - Can be called from Server Components during render
 * - Should NOT use revalidatePath/revalidateTag
 * - Return data directly without side effects
 *
 * **Mutation Actions** (for future use if needed):
 * - Modify server state (database, files, etc.)
 * - Must be called from Client Components only
 * - Should use revalidatePath/revalidateTag to update caches
 * - Typically triggered by user interactions (form submissions, button clicks)
 *
 * If cache revalidation becomes necessary in the future, create a separate
 * mutation action (e.g., completePhotoSelection) that handles the revalidation.
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
    // Fetch fresh data directly from Google Photos Picker API
    // No caching layer - API is the single source of truth
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

    // Return data directly without any cache revalidation
    // This is a pure data-fetching operation with no side effects
    return {
      mediaItems: data.mediaItems || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error("Error fetching selected photos:", error);
    throw error instanceof Error ? error : new Error("Failed to fetch photos");
  }
}
