/**
 * Google Photos Picker API Type Definitions
 * Based on: https://developers.google.com/photos/picker
 */

/**
 * Media item returned from Google Photos Picker API
 */
export interface MediaItem {
  /** Unique identifier for the media item */
  id: string;
  /** Base URL for the media item (expires after 60 minutes) */
  baseUrl: string;
  /** MIME type (e.g., "image/jpeg", "image/png") */
  mimeType: string;
  /** Original filename if available */
  filename?: string;
  /** Metadata about the media */
  mediaMetadata?: MediaMetadata;
}

/**
 * Metadata for a media item
 */
export interface MediaMetadata {
  /** Width in pixels */
  width: string;
  /** Height in pixels */
  height: string;
  /** Creation timestamp in RFC 3339 format */
  creationTime: string;
  /** Photo-specific metadata */
  photo?: PhotoMetadata;
}

/**
 * Photo-specific metadata
 */
export interface PhotoMetadata {
  /** Camera make */
  cameraMake?: string;
  /** Camera model */
  cameraModel?: string;
  /** Focal length */
  focalLength?: number;
  /** Aperture f-stop */
  apertureFNumber?: number;
  /** ISO equivalent */
  isoEquivalent?: number;
}

/**
 * Picker session configuration from API
 */
export interface PickerSession {
  /** Unique session identifier */
  id: string;
  /** URL to open Google Photos picker UI */
  pickerUri: string;
  /** Polling configuration */
  pollingConfig: PollingConfig;
  /** Whether user has finished selecting photos */
  mediaItemsSet: boolean;
  /** Session expiration time in RFC 3339 format */
  expireTime: string;
}

/**
 * Polling configuration from picker session
 */
export interface PollingConfig {
  /** Recommended poll interval (e.g., "5s") */
  pollInterval: string;
  /** Timeout duration (e.g., "1800s") */
  timeoutIn: string;
}

/**
 * Response from listing media items
 */
export interface PhotosResponse {
  /** Array of selected media items */
  mediaItems: MediaItem[];
  /** Token for fetching next page, if available */
  nextPageToken?: string;
}

/**
 * Response from creating a picker session
 */
export interface CreateSessionResponse {
  /** Session identifier */
  sessionId: string;
  /** URL to open picker UI */
  pickerUri: string;
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Timeout in milliseconds */
  timeout: number;
}

/**
 * Response from polling session status
 */
export interface SessionStatusResponse {
  /** Session identifier */
  sessionId: string;
  /** Whether photos have been selected */
  mediaItemsSet: boolean;
  /** Session expiration time */
  expireTime: string;
}

/**
 * Picker flow states
 */
export type PickerState = "idle" | "picking" | "polling" | "complete" | "error";

/**
 * Error codes from Google Photos API
 */
export enum GooglePhotosErrorCode {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  FAILED_PRECONDITION = "FAILED_PRECONDITION",
  INTERNAL = "INTERNAL",
}
