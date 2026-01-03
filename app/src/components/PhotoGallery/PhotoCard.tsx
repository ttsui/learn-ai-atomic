"use client";

import { useState } from "react";
import Image from "next/image";
import type { MediaItem } from "@/types/google-photos";

interface PhotoCardProps {
  /** Photo data */
  photo: MediaItem;
  /** Callback when photo is clicked */
  onClick?: () => void;
  /** Whether to load with priority (above-fold images) */
  priority?: boolean;
}

export function PhotoCard({ photo, onClick, priority = false }: PhotoCardProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Construct thumbnail URL with Google Photos URL parameters
  // =w400-h400-c means: width 400, height 400, crop to fit
  const thumbnailUrl = `${photo.baseUrl}=w400-h400-c`;

  return (
    <div
      className={`
        relative aspect-square overflow-hidden rounded-lg bg-gray-100
        cursor-pointer group
        ${onClick ? "hover:ring-2 hover:ring-blue-500" : ""}
      `}
      onClick={onClick}
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      <Image
        src={thumbnailUrl}
        alt={photo.filename || "Selected photo"}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={`
          object-cover transition-opacity duration-300
          ${isLoading ? "opacity-0" : "opacity-100"}
          group-hover:scale-105 transition-transform duration-200
        `}
        onLoad={() => setIsLoading(false)}
        priority={priority}
        unoptimized // Google Photos URLs are already optimized
      />

      {/* Hover overlay */}
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
      )}
    </div>
  );
}
