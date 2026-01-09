---
date: 2026-01-03
researcher: Claude Code Assistant
topic: "Server Actions Patterns: Correct vs Incorrect Usage"
tags: [patterns, server-actions, cache-revalidation, best-practices]
status: reference
---

# Server Actions Patterns Guide

## Quick Reference: Correct vs Incorrect Patterns

### Pattern 1: Data-Fetching Server Actions

#### ❌ INCORRECT: Revalidating in Data-Fetching

```typescript
// app/actions/photos.ts
"use server";

import { revalidatePath } from "next/cache";

export async function getPhotos(sessionId: string) {
  const data = await fetch(`${API}/photos?sessionId=${sessionId}`);
  revalidatePath('/gallery'); // ❌ ERROR when called from Server Component!
  return data.json();
}

// app/gallery/page.tsx (Server Component)
export default async function GalleryPage({ searchParams }) {
  const photos = await getPhotos(searchParams.sessionId); // ❌ Will fail!
  return <Gallery photos={photos} />;
}
```

**Error:**
```
Error: revalidatePath cannot be called during render
```

#### ✅ CORRECT: Pure Data-Fetching

```typescript
// app/actions/photos.ts
"use server";

/**
 * Fetches photos from Google Photos API
 *
 * This is a pure data-fetching Server Action. No cache revalidation is used
 * because we fetch fresh data directly from Google's API on every request.
 */
export async function getPhotos(sessionId: string) {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  // Fetch fresh data - API is source of truth
  const response = await fetch(`${API}/photos?sessionId=${sessionId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch photos");
  }

  return response.json();
}

// app/gallery/page.tsx (Server Component)
export default async function GalleryPage({ searchParams }) {
  const photos = await getPhotos(searchParams.sessionId); // ✅ Works!
  return <Gallery photos={photos} />;
}
```

---

### Pattern 2: Mutation Server Actions

#### ❌ INCORRECT: Calling from Server Component

```typescript
// app/actions/photos.ts
"use server";

import { revalidatePath } from "next/cache";

export async function deletePhoto(photoId: string) {
  await db.photos.delete({ where: { id: photoId } });
  revalidatePath('/gallery');
  return { success: true };
}

// app/gallery/page.tsx (Server Component)
export default async function GalleryPage() {
  await deletePhoto('photo-123'); // ❌ Mutation during render!
  return <div>Photo deleted</div>;
}
```

**Problems:**
1. Mutations should not happen during render
2. No user interaction triggering the deletion
3. No loading state or error handling

#### ✅ CORRECT: Calling from Client Component

```typescript
// app/actions/photos.ts
"use server";

import { revalidatePath } from "next/cache";

/**
 * Deletes a photo from the database
 *
 * This is a mutation Server Action that modifies database state and
 * revalidates the gallery page cache. Must be called from Client Components.
 */
export async function deletePhoto(photoId: string) {
  const session = await auth();

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    await db.photos.delete({
      where: { id: photoId, userId: session.user.id },
    });

    // Revalidate after successful deletion
    revalidatePath('/gallery');
    revalidatePath(`/photos/${photoId}`);

    return { success: true };
  } catch (error) {
    console.error('Delete photo error:', error);
    throw error instanceof Error ? error : new Error('Failed to delete photo');
  }
}

// app/gallery/delete-button.tsx (Client Component)
"use client";

import { useTransition } from "react";
import { deletePhoto } from "@/app/actions/photos";

export function DeleteButton({ photoId }: { photoId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    startTransition(async () => {
      try {
        await deletePhoto(photoId);
        // Success! Page will revalidate automatically
      } catch (error) {
        alert('Failed to delete photo');
      }
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
    >
      {isPending ? 'Deleting...' : 'Delete Photo'}
    </button>
  );
}
```

---

### Pattern 3: Mixed Data Flow (Fetch → Display → Mutate)

#### ✅ CORRECT: Separation of Concerns

```typescript
// ============================================
// 1. Data-Fetching Server Action (No Revalidation)
// ============================================
// app/actions/photos.ts
"use server";

export async function getPhotos(sessionId: string) {
  const response = await fetch(`${API}/photos?sessionId=${sessionId}`);
  return response.json();
}

// ============================================
// 2. Server Component Renders Data
// ============================================
// app/gallery/page.tsx
import { Suspense } from "react";
import { getPhotos } from "@/app/actions/photos";
import { PhotoGrid } from "./photo-grid";
import { GallerySkeleton } from "./skeleton";

export default async function GalleryPage({ searchParams }) {
  return (
    <Suspense fallback={<GallerySkeleton />}>
      <PhotosContent sessionId={searchParams.sessionId} />
    </Suspense>
  );
}

async function PhotosContent({ sessionId }: { sessionId: string }) {
  const photos = await getPhotos(sessionId);
  return <PhotoGrid photos={photos} />;
}

// ============================================
// 3. Client Component Handles Mutations
// ============================================
// app/gallery/photo-grid.tsx
"use client";

import { useState, useTransition } from "react";
import { deletePhoto } from "@/app/actions/photos";

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (photoId: string) => {
    startTransition(async () => {
      await deletePhoto(photoId);
      // Page revalidates automatically, photos refetch
    });
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {photos.map(photo => (
        <div key={photo.id}>
          <img src={photo.url} alt="" />
          <button
            onClick={() => handleDelete(photo.id)}
            disabled={isPending}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 4. Mutation Server Action (With Revalidation)
// ============================================
// app/actions/photos.ts (continued)
"use server";

import { revalidatePath } from "next/cache";

export async function deletePhoto(photoId: string) {
  await db.photos.delete({ where: { id: photoId } });
  revalidatePath('/gallery'); // ✅ Safe: called from Client Component
  return { success: true };
}
```

---

### Pattern 4: Form Actions

#### ✅ CORRECT: Form Submission with Validation

```typescript
// app/actions/profile.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();

  if (!session) {
    return { error: "Not authenticated" };
  }

  // Validate input
  const validation = profileSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validation.success) {
    return {
      error: "Validation failed",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    // Mutation: Update database
    await db.users.update({
      where: { id: session.user.id },
      data: validation.data,
    });

    // Revalidate profile page
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Update profile error:', error);
    return { error: "Failed to update profile" };
  }
}

// app/profile/profile-form.tsx
"use client";

import { useFormState } from "react-dom";
import { updateProfile } from "@/app/actions/profile";

export function ProfileForm({ initialData }) {
  const [state, formAction] = useFormState(updateProfile, null);

  return (
    <form action={formAction}>
      <input
        type="text"
        name="name"
        defaultValue={initialData.name}
      />
      {state?.errors?.name && (
        <p className="text-red-600">{state.errors.name}</p>
      )}

      <input
        type="email"
        name="email"
        defaultValue={initialData.email}
      />
      {state?.errors?.email && (
        <p className="text-red-600">{state.errors.email}</p>
      )}

      <button type="submit">Update Profile</button>

      {state?.success && (
        <p className="text-green-600">Profile updated!</p>
      )}
      {state?.error && (
        <p className="text-red-600">{state.error}</p>
      )}
    </form>
  );
}
```

---

### Pattern 5: Optimistic Updates

#### ✅ CORRECT: Optimistic UI with Revalidation

```typescript
// app/actions/favorites.ts
"use server";

import { revalidatePath } from "next/cache";

export async function toggleFavorite(photoId: string, isFavorited: boolean) {
  const session = await auth();

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    if (isFavorited) {
      await db.favorites.delete({
        where: {
          userId_photoId: {
            userId: session.user.id,
            photoId,
          },
        },
      });
    } else {
      await db.favorites.create({
        data: {
          userId: session.user.id,
          photoId,
        },
      });
    }

    revalidatePath('/favorites');
    revalidatePath(`/photos/${photoId}`);

    return { success: true, isFavorited: !isFavorited };
  } catch (error) {
    console.error('Toggle favorite error:', error);
    throw error instanceof Error ? error : new Error('Failed to toggle favorite');
  }
}

// app/gallery/favorite-button.tsx
"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/favorites";

export function FavoriteButton({
  photoId,
  initialIsFavorited,
}: {
  photoId: string;
  initialIsFavorited: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticIsFavorited, setOptimisticIsFavorited] = useOptimistic(
    initialIsFavorited
  );

  const handleToggle = () => {
    startTransition(async () => {
      // Optimistically update UI
      setOptimisticIsFavorited(!optimisticIsFavorited);

      try {
        await toggleFavorite(photoId, optimisticIsFavorited);
        // Success! Server state matches optimistic state
      } catch (error) {
        // Error: UI will revert to server state
        alert('Failed to update favorite');
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={optimisticIsFavorited ? "text-red-600" : "text-gray-400"}
    >
      {optimisticIsFavorited ? '❤️' : '🤍'}
    </button>
  );
}
```

---

## Decision Tree: When to Use Cache Revalidation

```
Is this a Server Action?
│
├─ YES → Is it modifying server state? (database, files, etc.)
│        │
│        ├─ YES → Use revalidatePath/revalidateTag
│        │        • Call from Client Components only
│        │        • Revalidate after successful mutation
│        │        • Handle errors properly
│        │
│        └─ NO → Data-fetching action
│                 • Do NOT use cache revalidation
│                 • Can be called from Server or Client Components
│                 • Fetch fresh data directly
│
└─ NO → Not applicable
```

## Common Scenarios

| Scenario | Data-Fetching | Mutation | Cache Revalidation |
|----------|---------------|----------|-------------------|
| Fetch photos from API | ✅ | ❌ | ❌ No |
| Create new album | ❌ | ✅ | ✅ Yes |
| Delete photo | ❌ | ✅ | ✅ Yes |
| Update user profile | ❌ | ✅ | ✅ Yes |
| Toggle favorite | ❌ | ✅ | ✅ Yes |
| Search photos | ✅ | ❌ | ❌ No |
| Get photo details | ✅ | ❌ | ❌ No |

## References

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [revalidatePath API](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- [useFormState Hook](https://react.dev/reference/react-dom/hooks/useFormState)
