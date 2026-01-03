"use client";

interface GallerySkeletonProps {
  /** Number of skeleton items to show */
  count?: number;
}

export function GallerySkeleton({ count = 12 }: GallerySkeletonProps) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-square rounded-lg bg-gray-200 animate-pulse"
        />
      ))}
    </div>
  );
}
