---
date: 2026-01-03
researcher: Claude Code Assistant
topic: "Cache Revalidation Decision for Photo Selection Flow"
tags: [decision, architecture, caching, nextjs, server-actions]
status: final
---

# Cache Revalidation Decision for Photo Selection Flow

## Decision

**We do NOT need a separate mutation action with cache revalidation for the photo selection flow.**

## Context

After implementing the Google Photos Picker integration, we evaluated whether cache revalidation (`revalidatePath` or `revalidateTag`) is necessary for the photo selection workflow.

## Analysis

### Current Data Flow

```
1. User clicks "Select Photos" button
   ↓
2. createPickerSession() Server Action creates session with Google API
   ↓
3. Picker window opens (Google's interface)
   ↓
4. User selects photos in Google Photos
   ↓
5. Picker window closes
   ↓
6. Polling detects completion (useSessionPolling hook)
   ↓
7. Client-side navigation: router.push('/gallery?sessionId=xxx')
   ↓
8. Gallery page (Server Component) renders
   ↓
9. getSelectedPhotos() Server Action fetches data from Google API
   ↓
10. Photos displayed to user
```

### Key Observations

1. **No Server-Side State Mutations**:
   - We don't write to a database
   - We don't modify files on our server
   - We don't update any server-side cache

2. **External API as Source of Truth**:
   - All photo data lives on Google's servers
   - We fetch fresh data on every request
   - Google's API handles data consistency

3. **Client-Side Navigation Triggers Re-Render**:
   - `router.push('/gallery?sessionId=xxx')` causes Next.js to re-render the gallery page
   - Server Components re-execute on navigation
   - Fresh data is automatically fetched

4. **No Next.js Page Caching**:
   - Gallery page uses dynamic rendering (calls `auth()`)
   - No static generation or ISR involved
   - Every request executes server code

## Decision Rationale

### Why Cache Revalidation is NOT Needed

| Reason | Explanation |
|--------|-------------|
| **No state to invalidate** | We don't cache photo data on our server. Every call to `getSelectedPhotos()` hits Google's API fresh. |
| **External source of truth** | Data changes happen on Google's infrastructure, not ours. We're a read-only consumer. |
| **Automatic re-render** | Client-side navigation already triggers Server Component re-execution, fetching fresh data. |
| **Dynamic rendering** | Gallery page uses `auth()`, forcing dynamic rendering. No static cache to invalidate. |

### When Revalidation WOULD Be Needed

Cache revalidation would be necessary if:

- ✅ We stored photo metadata in our database
- ✅ We cached photo lists server-side for performance
- ✅ We displayed photos on a statically generated page
- ✅ User actions modified our server state (favorites, albums, etc.)

None of these apply to our current architecture.

## Reference Implementation (For Future Use)

If cache revalidation becomes necessary in the future (e.g., if we add a database layer), here's how to implement it:

### app/actions/photos.ts

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";

/**
 * Mutation Server Action - Marks a photo selection as complete
 * This is a mutation action that modifies server state and revalidates caches.
 *
 * IMPORTANT: Only call from Client Components, never from Server Components.
 */
export async function completePhotoSelection(sessionId: string): Promise<{ success: boolean }> {
  const session = await auth();

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  // Example: Store completion in database (hypothetical)
  // await db.photoSessions.update({
  //   where: { id: sessionId },
  //   data: { completedAt: new Date() }
  // });

  // Revalidate affected pages
  revalidatePath("/gallery");
  revalidatePath("/photos");

  return { success: true };
}
```

### components/PhotoPickerFlow.tsx

```typescript
"use client";

import { completePhotoSelection } from "@/app/actions/photos";

export function PhotoPickerFlow() {
  const handleComplete = useCallback(
    async (completedSessionId: string) => {
      setState("complete");

      // Call mutation action to revalidate caches
      await completePhotoSelection(completedSessionId);

      // Navigate to gallery
      router.push(`/gallery?sessionId=${completedSessionId}`);
    },
    [router]
  );

  // ... rest of component
}
```

## Best Practices Documented

This decision reinforces the best practices documented in:

1. **Server Actions File** (`app/actions/photos.ts`):
   - Comprehensive JSDoc explaining data-fetching vs mutation distinction
   - Inline comments about when to use each type

2. **Architecture Documentation** (`research/docs/2025-12-29-nextjs-google-photos-architecture.md`):
   - Section 2.3: Cache Revalidation Strategy for Server Actions
   - Code examples of correct patterns
   - Decision criteria for when to use cache revalidation

## Conclusion

For the current Google Photos Picker integration:

- ✅ **Data-fetching Server Actions** are sufficient (e.g., `getSelectedPhotos`)
- ❌ **Mutation Server Actions** with cache revalidation are NOT needed
- ✅ Client-side navigation handles UI updates automatically
- ✅ Fresh data is fetched on every gallery page load

This decision may be revisited if we add:
- Server-side data persistence (database)
- Server-side caching layers
- Static page generation for galleries
- User-specific photo metadata storage

## References

- Next.js Caching Documentation: https://nextjs.org/docs/app/building-your-application/caching
- Server Actions Documentation: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- revalidatePath API: https://nextjs.org/docs/app/api-reference/functions/revalidatePath
