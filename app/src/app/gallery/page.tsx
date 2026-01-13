import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth/config";
import { Gallery, GallerySkeleton } from "@/components/PhotoGallery";
import { getSelectedPhotos } from "@/app/actions/photos";
import Link from "next/link";

export const metadata = {
  title: "Photo Gallery | Google Photos Integration",
  description: "View your selected photos from Google Photos",
};

interface GalleryPageProps {
  searchParams: Promise<{ sessionId?: string }>;
}

async function PhotosContent({ sessionId }: { sessionId: string }) {
  const { mediaItems } = await getSelectedPhotos(sessionId);
  return <Gallery photos={mediaItems} />;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const session = await auth();
  const { sessionId } = await searchParams;

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Photos</h1>
            <p className="text-gray-600 mt-1">
              Photos you selected from Google Photos
            </p>
          </div>
          <Link
            href="/photos"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select More Photos
          </Link>
        </div>

        {sessionId ? (
          <Suspense fallback={<GallerySkeleton count={12} />}>
            <PhotosContent sessionId={sessionId} />
          </Suspense>
        ) : (
          <div className="text-center py-12">
            <svg
              className="h-16 w-16 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              No photos to display
            </h2>
            <p className="text-gray-500 mb-6">
              Select photos from Google Photos to see them here
            </p>
            <Link
              href="/photos"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
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
              Select Photos
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
