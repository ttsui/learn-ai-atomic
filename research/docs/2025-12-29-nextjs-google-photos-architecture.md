---
date: 2025-12-29 07:04:25 UTC
researcher: Claude Research Agent
git_commit: edc2a6d1cd0aa49a8387d8d41f6f0c3e1d7f0f82
branch: claude/research-nextjs-photos-api-RYuoa
repository: learn-ai-atomic
topic: "Next.js + Google Photos Architecture Patterns"
tags: [research, architecture, nextjs, google-photos, patterns, components]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude Research Agent
---

# Next.js + Google Photos Architecture Patterns

## Research Question
What are the recommended architecture patterns, component structures, and implementation strategies for building a Next.js application that integrates with Google Photos Picker API?

## Summary

This document outlines proven architecture patterns for building Next.js applications that integrate with the Google Photos Picker API. Key recommendations:

- **OAuth Flow**: Use NextAuth.js with server-side session management
- **Component Pattern**: Separate picker trigger from gallery display components
- **Data Strategy**: Use SWR or TanStack Query for client-side caching with API routes as proxy
- **File Structure**: Co-locate feature code in `/app` directory with route handlers
- **Error Handling**: Implement error boundaries with user-friendly recovery options

## Detailed Findings

### 1. Component Architecture

#### 1.1 Photo Picker UI Component Patterns

**Recommended File Structure**:
```
components/
├── GooglePhotoPicker/
│   ├── PickerButton.tsx          # Trigger component
│   ├── PickerModal.tsx           # Modal wrapper (optional)
│   ├── PickerStatus.tsx          # Polling status indicator
│   └── index.ts                  # Public API
├── PhotoGallery/
│   ├── Gallery.tsx               # Grid display
│   ├── PhotoCard.tsx             # Individual photo
│   ├── Lightbox.tsx              # Full-size view
│   └── index.ts
└── ui/
    ├── Button.tsx
    ├── Modal.tsx
    └── Spinner.tsx
```

**Picker Button Component**:

```typescript
// components/GooglePhotoPicker/PickerButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { createPickerSession } from '@/app/actions/photos';

interface PickerButtonProps {
  onSessionCreated: (pickerUri: string, sessionId: string) => void;
  children?: React.ReactNode;
}

export function PickerButton({ onSessionCreated, children }: PickerButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { pickerUri, sessionId } = await createPickerSession();
      onSessionCreated(pickerUri, sessionId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
    >
      {isPending ? 'Starting...' : children || 'Select Photos'}
    </button>
  );
}
```

#### 1.2 Image Gallery Components

**Pattern: Server-Rendered Gallery with Client Hydration**

```typescript
// app/gallery/page.tsx (Server Component)
import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { PhotoGallery } from '@/components/PhotoGallery';
import { GallerySkeleton } from '@/components/PhotoGallery/Skeleton';

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: { sessionId?: string };
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <Suspense fallback={<GallerySkeleton />}>
      <PhotoGalleryContent sessionId={searchParams.sessionId} />
    </Suspense>
  );
}

async function PhotoGalleryContent({ sessionId }: { sessionId?: string }) {
  if (!sessionId) {
    return <EmptyState message="Select photos to view them here" />;
  }

  const photos = await fetchSelectedPhotos(sessionId);
  return <PhotoGallery initialPhotos={photos} sessionId={sessionId} />;
}
```

**Photo Card Component**:

```typescript
// components/PhotoGallery/PhotoCard.tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface PhotoCardProps {
  photo: {
    id: string;
    baseUrl: string;
    mimeType: string;
    mediaMetadata?: {
      width: string;
      height: string;
    };
  };
  onClick?: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Google Photos URL with size parameter
  const thumbnailUrl = `${photo.baseUrl}=w400-h400-c`;

  return (
    <div
      className="relative aspect-square cursor-pointer overflow-hidden rounded-lg"
      onClick={onClick}
    >
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}
      <Image
        src={thumbnailUrl}
        alt=""
        fill
        className="object-cover"
        onLoad={() => setIsLoading(false)}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </div>
  );
}
```

#### 1.3 Loading States and Error Boundaries

```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-gray-600">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Skeleton Component**:

```typescript
// components/PhotoGallery/Skeleton.tsx
export function GallerySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse bg-gray-200 rounded-lg"
        />
      ))}
    </div>
  );
}
```

### 2. Data Flow Patterns

#### 2.1 API Call Structure

**Recommended Flow**:
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Client Component│────▶│ Next.js API Route│────▶│ Google Photos API   │
│ (useTransition) │     │ (with session)   │     │ (photospicker.*)    │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
        ▲                        │
        │                        ▼
        │               ┌──────────────────┐
        └───────────────│ Response Data    │
                        │ (no tokens!)     │
                        └──────────────────┘
```

**API Route Implementation**:

```typescript
// app/api/photos/sessions/route.ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json(error, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json({
    sessionId: data.id,
    pickerUri: data.pickerUri,
    pollInterval: data.pollingConfig?.pollInterval,
  });
}
```

#### 2.2 Caching Strategies

**Multi-Layer Caching**:

| Layer | What to Cache | Duration | Implementation |
|-------|--------------|----------|----------------|
| Client (SWR) | Photo metadata | 5 minutes | `useSWR` with `revalidateOnFocus: false` |
| Server (unstable_cache) | Album lists | 1 hour | Next.js cache |
| CDN | Image files | Long-term | Google's CDN handles this |

**Never cache**: `baseUrl` values (expire after 60 minutes)

```typescript
// hooks/usePhotos.ts
import useSWR from 'swr';

export function usePhotos(sessionId: string) {
  return useSWR(
    sessionId ? `/api/photos?sessionId=${sessionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      errorRetryCount: 3,
    }
  );
}
```

#### 2.3 Pagination Handling

**Cursor-Based Pagination with SWR**:

```typescript
// hooks/usePhotosInfinite.ts
import useSWRInfinite from 'swr/infinite';

export function usePhotosInfinite(sessionId: string) {
  const getKey = (pageIndex: number, previousPageData: PhotosResponse | null) => {
    if (!sessionId) return null;
    if (previousPageData && !previousPageData.nextPageToken) return null;

    const token = previousPageData?.nextPageToken || '';
    return `/api/photos?sessionId=${sessionId}&pageToken=${token}`;
  };

  const { data, size, setSize, isValidating, error } = useSWRInfinite(
    getKey,
    fetcher
  );

  const photos = data ? data.flatMap(page => page.mediaItems || []) : [];
  const isLoadingMore = isValidating && data && data.length === size;
  const hasMore = data && data[data.length - 1]?.nextPageToken;

  return {
    photos,
    loadMore: () => setSize(size + 1),
    isLoadingMore,
    hasMore,
    error,
  };
}
```

### 3. File Structure Recommendations

#### 3.1 Recommended Project Structure

```
app/
├── (auth)/
│   ├── signin/
│   │   └── page.tsx
│   └── callback/
│       └── page.tsx
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts
│   └── photos/
│       ├── route.ts                  # GET: list photos
│       ├── sessions/
│       │   ├── route.ts              # POST: create session
│       │   └── [sessionId]/
│       │       └── route.ts          # GET: poll session status
│       └── [photoId]/
│           └── route.ts              # GET: single photo details
├── photos/
│   ├── page.tsx                      # Main photo picker page
│   ├── layout.tsx
│   ├── loading.tsx
│   └── error.tsx
├── gallery/
│   └── page.tsx                      # Display selected photos
├── actions/
│   └── photos.ts                     # Server Actions
└── layout.tsx

lib/
├── auth/
│   └── config.ts                     # NextAuth configuration
├── google-photos/
│   ├── client.ts                     # API client class
│   ├── types.ts                      # TypeScript types
│   └── utils.ts                      # URL builders, formatters
└── utils/
    ├── errors.ts
    └── retry.ts

hooks/
├── usePhotos.ts
├── usePhotosInfinite.ts
├── usePickerSession.ts
└── useSessionPolling.ts

components/
├── GooglePhotoPicker/
│   ├── PickerButton.tsx
│   ├── PickerStatus.tsx
│   └── index.ts
├── PhotoGallery/
│   ├── Gallery.tsx
│   ├── PhotoCard.tsx
│   ├── Lightbox.tsx
│   ├── Skeleton.tsx
│   └── index.ts
├── ErrorBoundary.tsx
└── ui/
    └── ...

types/
├── google-photos.ts
└── next-auth.d.ts                    # Type augmentation
```

#### 3.2 OAuth Logic Placement

All OAuth logic centralized in `lib/auth/config.ts`:

```typescript
// lib/auth/config.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    // ... token refresh logic
  },
};
```

### 4. Integration Patterns

#### 4.1 Complete Picker Flow

**Step-by-step implementation**:

```typescript
// components/PhotoPickerFlow.tsx
'use client';

import { useState, useCallback } from 'react';
import { PickerButton } from './GooglePhotoPicker';
import { useSessionPolling } from '@/hooks/useSessionPolling';
import { PhotoGallery } from './PhotoGallery';

type PickerState = 'idle' | 'picking' | 'polling' | 'complete' | 'error';

export function PhotoPickerFlow() {
  const [state, setState] = useState<PickerState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);

  // Polling hook
  const { startPolling, stopPolling, isPolling } = useSessionPolling({
    onComplete: async (sessionId) => {
      const photos = await fetchPhotos(sessionId);
      setPhotos(photos);
      setState('complete');
    },
    onError: (error) => {
      console.error('Polling error:', error);
      setState('error');
    },
  });

  const handleSessionCreated = useCallback((pickerUri: string, sessionId: string) => {
    setSessionId(sessionId);
    setState('picking');

    // Open picker in new window
    const pickerWindow = window.open(
      `${pickerUri}/autoclose`,
      'GooglePhotosPicker',
      'width=800,height=600'
    );

    // Start polling for completion
    startPolling(sessionId);

    // Listen for window close
    const checkClosed = setInterval(() => {
      if (pickerWindow?.closed) {
        clearInterval(checkClosed);
        setState('polling');
      }
    }, 500);
  }, [startPolling]);

  return (
    <div>
      {state === 'idle' && (
        <PickerButton onSessionCreated={handleSessionCreated}>
          Select Photos from Google Photos
        </PickerButton>
      )}

      {state === 'picking' && (
        <div className="text-center">
          <p>Waiting for photo selection...</p>
          <p className="text-sm text-gray-500">
            A new window has opened for you to select photos.
          </p>
        </div>
      )}

      {state === 'polling' && (
        <div className="text-center">
          <Spinner />
          <p>Processing your selection...</p>
        </div>
      )}

      {state === 'complete' && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p>{photos.length} photos selected</p>
            <button
              onClick={() => {
                setPhotos([]);
                setSessionId(null);
                setState('idle');
              }}
              className="text-blue-600 hover:underline"
            >
              Select more
            </button>
          </div>
          <PhotoGallery photos={photos} />
        </>
      )}

      {state === 'error' && (
        <div className="text-center text-red-600">
          <p>Something went wrong. Please try again.</p>
          <button
            onClick={() => setState('idle')}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 4.2 Session Polling Hook

```typescript
// hooks/useSessionPolling.ts
import { useCallback, useRef, useState } from 'react';

interface PollingOptions {
  onComplete: (sessionId: string) => void;
  onError: (error: Error) => void;
  pollInterval?: number;
  timeout?: number;
}

export function useSessionPolling({
  onComplete,
  onError,
  pollInterval = 5000,
  timeout = 30 * 60 * 1000, // 30 minutes
}: PollingOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPolling(false);
    sessionIdRef.current = null;
  }, []);

  const startPolling = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId;
    setIsPolling(true);

    const poll = async () => {
      try {
        const response = await fetch(`/api/photos/sessions/${sessionId}`);
        const data = await response.json();

        if (data.mediaItemsSet) {
          stopPolling();
          onComplete(sessionId);
        }
      } catch (error) {
        stopPolling();
        onError(error instanceof Error ? error : new Error('Polling failed'));
      }
    };

    // Start polling
    intervalRef.current = setInterval(poll, pollInterval);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      onError(new Error('Session timed out'));
    }, timeout);

    // Initial poll
    poll();
  }, [onComplete, onError, pollInterval, timeout, stopPolling]);

  return { startPolling, stopPolling, isPolling };
}
```

#### 4.3 Error Recovery Strategies

```typescript
// lib/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('401')) {
        throw error;
      }

      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### 5. Performance Optimization

#### 5.1 Image Loading Strategies

```typescript
// components/PhotoGallery/OptimizedPhoto.tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedPhotoProps {
  photo: MediaItem;
  priority?: boolean;
}

export function OptimizedPhoto({ photo, priority = false }: OptimizedPhotoProps) {
  const [loaded, setLoaded] = useState(false);

  // Google Photos URL parameters
  // =w{width} - set width
  // =h{height} - set height
  // =c - crop to exact dimensions
  // =no - no crop
  const thumbnailUrl = `${photo.baseUrl}=w200-h200-c`;
  const fullUrl = `${photo.baseUrl}=w1200`;

  return (
    <div className="relative aspect-square">
      {/* Blur placeholder */}
      {!loaded && (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          className="object-cover blur-sm scale-105"
        />
      )}

      {/* Full image */}
      <Image
        src={fullUrl}
        alt={photo.description || ''}
        fill
        className={`object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    </div>
  );
}
```

#### 5.2 Virtualization for Large Galleries

```typescript
// components/PhotoGallery/VirtualizedGallery.tsx
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface VirtualizedGalleryProps {
  photos: MediaItem[];
  columns?: number;
}

export function VirtualizedGallery({
  photos,
  columns = 4,
}: VirtualizedGalleryProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = Math.ceil(photos.length / columns);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated row height
    overscan: 3,
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowPhotos = photos.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0 grid gap-2"
              style={{
                top: `${virtualRow.start}px`,
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
              }}
            >
              {rowPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 6. TypeScript Types

```typescript
// types/google-photos.ts
export interface MediaItem {
  id: string;
  baseUrl: string;
  mimeType: string;
  filename?: string;
  description?: string;
  mediaMetadata?: {
    width: string;
    height: string;
    creationTime: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
    };
    video?: {
      fps: number;
      status: string;
    };
  };
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet: boolean;
  expireTime: string;
}

export interface PhotosResponse {
  mediaItems: MediaItem[];
  nextPageToken?: string;
}

// types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
```

## Recommended Libraries

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "next-auth": "^4.24.0",
    "swr": "^2.2.0",
    "@tanstack/react-virtual": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

## Common Pitfalls & Solutions

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Token expiration | Access tokens expire after 1 hour | Implement token refresh in NextAuth JWT callback |
| baseUrl expiration | `baseUrl` expires after 60 minutes | Never cache baseUrls; store mediaItemId, fetch fresh URLs |
| Rate limiting | Hitting 10,000 requests/day quota | Aggressive caching, request batching |
| Large libraries | 100,000+ photos cause slow loads | Virtual scrolling, pagination, search/filter |
| Session timeout | Picker session expires | Poll with timeout, clear UI feedback |

## Official Documentation Links

- [Google Photos Picker API](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Sessions Management](https://developers.google.com/photos/picker/guides/sessions)
- [Media Items Retrieval](https://developers.google.com/photos/picker/guides/media-items)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [SWR Documentation](https://swr.vercel.app/)
- [TanStack Virtual](https://tanstack.com/virtual/latest)

---

**Sources**:
- [Google Photos Picker API Documentation](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
