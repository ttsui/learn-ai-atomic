import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import type { MediaItem } from "@/types/google-photos";

const GOOGLE_PHOTOS_PICKER_API = "https://photospicker.googleapis.com/v1";

/**
 * GET /api/photos
 * Fetches selected photos from a completed picker session
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const pageToken = searchParams.get("pageToken");

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

    if (!sessionId) {
      return NextResponse.json(
        { error: "BadRequest", message: "Session ID is required" },
        { status: 400 }
      );
    }

    // Build URL with optional page token
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
      console.error("Google Photos API error:", error);

      // Map error codes to user-friendly messages
      const statusMessages: Record<number, string> = {
        401: "Please sign in again",
        403: "Permission denied. Please grant photo access",
        429: "Too many requests. Please try again in a minute",
      };

      return NextResponse.json(
        {
          error: "GoogleAPIError",
          message: statusMessages[response.status] || error.error?.message || "Failed to fetch photos",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Map media items to our type
    const mediaItems: MediaItem[] = (data.mediaItems || []).map((item: MediaItem) => ({
      id: item.id,
      baseUrl: item.baseUrl,
      mimeType: item.mimeType,
      filename: item.filename,
      mediaMetadata: item.mediaMetadata,
    }));

    return NextResponse.json({
      mediaItems,
      nextPageToken: data.nextPageToken,
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "InternalError", message: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
