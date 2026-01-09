# Debug Report: Next.js revalidatePath During Render Error

**Generated:** 2026-01-03
**Next.js Version:** 16.1.1 (Turbopack)
**Error Type:** Runtime Error - Invalid Cache Revalidation

---

## Executive Summary

The application throws a Next.js error when attempting to render the `/gallery` route. The root cause is calling `revalidatePath()` inside a Server Action (`getSelectedPhotos`) that is invoked during Server Component rendering. Next.js 13+ strictly prohibits cache revalidation functions during the render phase.

**Severity:** HIGH - Blocks gallery page rendering
**Impact:** Users cannot view their selected photos

---

## Error Details

### Error Message
```
Route /gallery used "revalidatePath /photos" during render which is unsupported.
To ensure revalidation is performed consistently it must always happen outside
of renders and cached functions.
```

### Stack Trace
```
at undefined.getSelectedPhotos (src/app/actions/photos.ts:95:5)
at processTicksAndRejections (<anonymous>:1:34)
at undefined.GalleryPage (src/app/gallery/page.tsx:50:13)
at processTicksAndRejections (<anonymous>:1:34)
```

### Error Location
- **File:** [app/src/app/actions/photos.ts:95](app/src/app/actions/photos.ts#L95)
- **Function:** `getSelectedPhotos()`
- **Triggered by:** [app/src/app/gallery/page.tsx:18](app/src/app/gallery/page.tsx#L18) during Server Component render

---

## Root Cause Analysis

### The Problem

The `getSelectedPhotos()` Server Action contains a `revalidatePath("/photos")` call at line 95:

```typescript
// app/src/app/actions/photos.ts:92-95
const data = await response.json();

// Revalidate the photos page cache
revalidatePath("/photos");  // ❌ PROBLEM: Called during render
```

This function is invoked directly in the `PhotosContent` component during Server Component rendering:

```typescript
// app/src/app/gallery/page.tsx:17-19
async function PhotosContent({ sessionId }: { sessionId: string }) {
  const { mediaItems } = await getSelectedPhotos(sessionId);  // ❌ Called during render
  return <Gallery photos={mediaItems} />;
}
```

### Why This Fails

Next.js enforces a strict separation between:

1. **Render Phase**: Building the React component tree (Server Components)
2. **Action Phase**: Handling user interactions (Server Actions with form submissions/client calls)

Cache revalidation functions (`revalidatePath`, `revalidateTag`) are **action-only APIs** because:
- They cause side effects (cache invalidation)
- They need to run at specific, predictable times
- They should not run during speculative or parallel renders
- They must execute after mutations, not during data fetching

### Evidence

The call chain shows the violation:
1. `GalleryPage` (Server Component) renders
2. `PhotosContent` (Server Component) renders
3. `getSelectedPhotos` (Server Action) executes **during render**
4. `revalidatePath` is called **during render** ❌

---

## Reproduction Steps

1. Navigate to `/gallery?sessionId=<valid-session-id>`
2. Server Component `GalleryPage` renders
3. `PhotosContent` calls `getSelectedPhotos()` during render
4. `revalidatePath()` is invoked
5. Next.js throws the error and halts rendering

---

## Proposed Solution

### Option 1: Remove revalidatePath (Recommended)

**Rationale:** The `revalidatePath("/photos")` call is unnecessary in this context because:
- We're fetching fresh data directly from the Google Photos API
- The `/gallery` page doesn't cache the fetched photos
- The `/photos` page (photo picker page) doesn't need revalidation when viewing the gallery
- Revalidation should occur when photos are **selected**, not when they're **viewed**

**Implementation:**
```typescript
// app/src/app/actions/photos.ts:92-100
const data = await response.json();

// Remove this line entirely
// revalidatePath("/photos");

return {
  mediaItems: data.mediaItems || [],
  nextPageToken: data.nextPageToken,
};
```

**Files to modify:**
- [app/src/app/actions/photos.ts:95](app/src/app/actions/photos.ts#L95) - Delete the `revalidatePath("/photos")` line

---

### Option 2: Move to a Separate Mutation Action

**Rationale:** If cache revalidation is truly needed after photo selection is complete, create a dedicated mutation action.

**Implementation:**

1. Create a new Server Action for handling photo selection completion:
```typescript
// app/src/app/actions/photos.ts (add new function)
"use server";

export async function completePhotoSelection(sessionId: string) {
  // Mark selection as complete (if needed)
  // ...

  // Now safe to revalidate
  revalidatePath("/photos");
  revalidatePath("/gallery");

  return { success: true };
}
```

2. Call it from a client component after user action:
```typescript
// app/src/components/PhotoSelectionComplete.tsx
"use client";

import { completePhotoSelection } from "@/app/actions/photos";

export function PhotoSelectionComplete({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    completePhotoSelection(sessionId);
  }, [sessionId]);

  return null;
}
```

**Files to modify:**
- [app/src/app/actions/photos.ts](app/src/app/actions/photos.ts) - Add new action, remove revalidatePath from `getSelectedPhotos`
- Create new client component for triggering revalidation

**Note:** This is more complex and likely over-engineered for the current use case.

---

### Option 3: Convert to Client-Side Data Fetching

**Rationale:** If revalidation is critical, move data fetching to client-side with SWR/React Query.

**Implementation:**
```typescript
// app/src/app/gallery/page.tsx
"use client";

import useSWR from 'swr';

export default function GalleryPage() {
  const { data, mutate } = useSWR(
    sessionId ? `/api/photos?sessionId=${sessionId}` : null,
    fetcher
  );

  // Can now call mutate() to revalidate
  return <Gallery photos={data?.mediaItems} />;
}
```

**Files to modify:**
- [app/src/app/gallery/page.tsx](app/src/app/gallery/page.tsx) - Convert to Client Component
- Create new API route handler

**Trade-offs:**
- ✅ Full control over revalidation
- ❌ Loses Server Component benefits (SEO, initial load performance)
- ❌ Increases client bundle size

---

## Recommended Fix: Option 1

Remove the `revalidatePath` call entirely. It serves no functional purpose in the current architecture.

### Code Change

**File:** [app/src/app/actions/photos.ts](app/src/app/actions/photos.ts#L95)

**Before:**
```typescript
    const data = await response.json();

    // Revalidate the photos page cache
    revalidatePath("/photos");

    return {
      mediaItems: data.mediaItems || [],
      nextPageToken: data.nextPageToken,
    };
```

**After:**
```typescript
    const data = await response.json();

    return {
      mediaItems: data.mediaItems || [],
      nextPageToken: data.nextPageToken,
    };
```

### Testing Approach

1. **Remove the line**
   ```bash
   # Edit app/src/app/actions/photos.ts
   # Delete line 95: revalidatePath("/photos");
   ```

2. **Start dev server**
   ```bash
   cd app
   pnpm dev
   ```

3. **Test the gallery page**
   - Navigate to `/gallery?sessionId=<valid-session-id>`
   - Verify photos load without error
   - Verify gallery renders correctly

4. **Test the full flow**
   - Go to `/photos`
   - Select photos via Google Photos Picker
   - Return to `/gallery`
   - Confirm photos display

5. **Verify no regressions**
   - Check browser console for errors
   - Test without sessionId: `/gallery`
   - Test navigation between `/photos` and `/gallery`

---

## Prevention Recommendations

### 1. Add ESLint Rule for Server Actions

Create a custom ESLint rule or use `eslint-plugin-next` to warn when cache functions are used in Server Actions that might be called during render.

### 2. Architecture Pattern

**Separate concerns:**
- **Data Fetching Functions:** Pure functions that return data (no side effects)
- **Mutation Actions:** Handle user actions and cache revalidation
- **Render Functions:** Server/Client Components (read-only)

**Example:**
```typescript
// ✅ GOOD: Data fetching (no side effects)
export async function getSelectedPhotos(sessionId: string) {
  // Just fetch and return data
  return { mediaItems: [...] };
}

// ✅ GOOD: Mutation action (side effects allowed)
export async function confirmPhotoSelection(sessionId: string) {
  // Perform mutation
  await saveToDatabase(sessionId);
  // Safe to revalidate
  revalidatePath("/photos");
}
```

### 3. Documentation

Add to project documentation:
```markdown
## Server Actions Best Practices

1. **Data Fetching Actions** - Return data only, no `revalidatePath/Tag`
2. **Mutation Actions** - Handle state changes + revalidation
3. Never call mutation actions during Server Component render
4. Use route handlers for read operations if caching is needed
```

### 4. Code Comments

Add warning comments near cache revalidation:
```typescript
// WARNING: Only call this from client components or after form submissions
// Never call during Server Component render
export async function mutateData() {
  revalidatePath("/path");
}
```

---

## Related Documentation

- [Next.js: Data Fetching, Caching, and Revalidating](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
- [Next.js: Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js: revalidatePath API](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js Error: revalidatePath during render](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering)

---

## Conclusion

This is a straightforward architectural issue caused by mixing data-fetching and cache-mutation concerns in a single function. The fix is simple: remove the unnecessary `revalidatePath()` call from `getSelectedPhotos()`.

**Estimated Fix Time:** < 5 minutes
**Risk Level:** LOW (simple deletion, no functional change)
**Testing Required:** Basic smoke testing of gallery page
