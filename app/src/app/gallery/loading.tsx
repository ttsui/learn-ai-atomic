import { GallerySkeleton } from "@/components/PhotoGallery";

export default function GalleryLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-9 w-48 bg-gray-200 animate-pulse rounded" />
            <div className="h-5 w-64 bg-gray-200 animate-pulse rounded mt-2" />
          </div>
          <div className="h-10 w-36 bg-gray-200 animate-pulse rounded-lg" />
        </div>

        <GallerySkeleton count={12} />
      </div>
    </main>
  );
}
