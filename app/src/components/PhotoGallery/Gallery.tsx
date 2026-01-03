"use client";

import { PhotoCard } from "./PhotoCard";
import type { MediaItem } from "@/types/google-photos";

interface GalleryProps {
  /** Array of photos to display */
  photos: MediaItem[];
  /** Callback when a photo is clicked */
  onPhotoClick?: (photo: MediaItem) => void;
  /** Optional additional class names */
  className?: string;
}

export function Gallery({ photos, onPhotoClick, className = "" }: GalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="h-16 w-16 text-gray-300 mb-4"
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
        <p className="text-gray-500 text-lg">No photos selected</p>
        <p className="text-gray-400 text-sm mt-1">
          Click the button above to select photos from Google Photos
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        grid gap-4
        grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
        ${className}
      `}
    >
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onClick={onPhotoClick ? () => onPhotoClick(photo) : undefined}
          priority={index < 8} // Prioritize first 8 images
        />
      ))}
    </div>
  );
}
