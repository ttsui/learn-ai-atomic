import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const GOOGLE_PHOTOS_PICKER_API = "https://photospicker.googleapis.com/v1/sessions";

/**
 * GET /api/photos/sessions/[sessionId]
 * Polls the status of a picker session
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();
    const { sessionId } = await params;

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

    const response = await fetch(`${GOOGLE_PHOTOS_PICKER_API}/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();

      // Handle specific error cases
      if (response.status === 404) {
        return NextResponse.json(
          { error: "NotFound", message: "Session not found or expired" },
          { status: 404 }
        );
      }

      // FAILED_PRECONDITION means user hasn't finished selecting yet
      if (error.error?.status === "FAILED_PRECONDITION") {
        return NextResponse.json({
          sessionId,
          mediaItemsSet: false,
          expireTime: null,
        });
      }

      console.error("Google Photos API error:", error);
      return NextResponse.json(
        { error: "GoogleAPIError", message: error.error?.message || "Failed to get session status" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      sessionId: data.id,
      mediaItemsSet: data.mediaItemsSet || false,
      expireTime: data.expireTime,
    });
  } catch (error) {
    console.error("Error polling session status:", error);
    return NextResponse.json(
      { error: "InternalError", message: "Failed to get session status" },
      { status: 500 }
    );
  }
}
