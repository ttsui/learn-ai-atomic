# Code Review Checklist

## Server Actions & Cache Revalidation

This checklist helps prevent common pitfalls when working with Next.js Server Actions, particularly around cache revalidation.

### ✅ Before Merging: Server Actions Review

When reviewing code that adds or modifies Server Actions (`"use server"`), check the following:

#### 1. Server Action Classification

- [ ] **Is this a data-fetching action (read-only)?**
  - Returns data from external APIs or databases
  - Does NOT modify any state
  - Can be called from Server Components during render
  - **MUST NOT** use `revalidatePath()` or `revalidateTag()`

- [ ] **Is this a mutation action (write operation)?**
  - Modifies database records, files, or server state
  - Typically triggered by user interactions (form submit, button click)
  - **MUST** be called from Client Components only
  - **SHOULD** use `revalidatePath()` or `revalidateTag()` to update caches

#### 2. Cache Revalidation Usage

- [ ] **If `revalidatePath()` or `revalidateTag()` is used:**
  - [ ] Is this Server Action a mutation (not data-fetching)?
  - [ ] Is it documented that this must be called from Client Components only?
  - [ ] Is there a JSDoc comment explaining why cache revalidation is needed?

- [ ] **If NO cache revalidation is used:**
  - [ ] Is there a comment explaining why it's not needed?
  - [ ] Is the action fetching fresh data from an external source?
  - [ ] Is the data flow documented (e.g., "always fetches fresh from Google API")?

#### 3. Component Integration

- [ ] **Where is this Server Action called from?**
  - [ ] If called from Server Component → Must NOT use cache revalidation
  - [ ] If called from Client Component → Cache revalidation is allowed
  - [ ] Is the calling context clearly documented?

- [ ] **Are there proper error boundaries?**
  - [ ] Server Action errors are caught and handled
  - [ ] User-friendly error messages are displayed
  - [ ] Loading states are shown during action execution

#### 4. Documentation

- [ ] **JSDoc comments exist for:**
  - [ ] What the Server Action does
  - [ ] Parameters and return types
  - [ ] Whether it's data-fetching or mutation
  - [ ] Cache revalidation strategy (or why it's not used)

- [ ] **Examples are provided showing:**
  - [ ] Correct usage from Server Components
  - [ ] Correct usage from Client Components
  - [ ] Error handling patterns

### ❌ Common Anti-Patterns to Watch For

#### Anti-Pattern 1: Cache Revalidation in Data-Fetching Actions

```typescript
// ❌ WRONG: Don't revalidate in data-fetching actions
export async function getPhotos(sessionId: string) {
  const data = await fetch(API_URL);
  revalidatePath('/gallery'); // ERROR when called from Server Component!
  return data;
}
```

**Why it's wrong:**
- Causes runtime error: "revalidatePath cannot be called during render"
- Violates separation of concerns (data-fetching vs mutation)
- Cannot be called from Server Components during render phase

**Correct approach:**
```typescript
// ✅ CORRECT: Pure data-fetching, no cache revalidation
export async function getPhotos(sessionId: string) {
  // Fetch fresh data directly - no cache to revalidate
  const data = await fetch(API_URL);
  return data;
}
```

#### Anti-Pattern 2: Calling Mutation Actions from Server Components

```typescript
// ❌ WRONG: Server Component calling mutation action
// app/page.tsx
export default async function Page() {
  await updateUserProfile({ name: "John" }); // ERROR!
  return <div>Profile Updated</div>;
}
```

**Why it's wrong:**
- Mutations should be triggered by user actions, not during render
- If mutation uses `revalidatePath()`, it will fail

**Correct approach:**
```typescript
// ✅ CORRECT: Client Component triggers mutation
// app/profile-form.tsx
"use client";

export function ProfileForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      await updateUserProfile({ name: "John" });
    });
  };

  return <button onClick={handleSubmit}>Update</button>;
}
```

#### Anti-Pattern 3: Missing Error Handling

```typescript
// ❌ WRONG: No error handling
export async function deletePhoto(id: string) {
  revalidatePath('/photos');
  await fetch(`${API}/photos/${id}`, { method: 'DELETE' });
}
```

**Why it's wrong:**
- API call can fail, leaving cache in invalid state
- No user feedback on errors

**Correct approach:**
```typescript
// ✅ CORRECT: Proper error handling
export async function deletePhoto(id: string) {
  try {
    const response = await fetch(`${API}/photos/${id}`, { method: 'DELETE' });

    if (!response.ok) {
      throw new Error('Failed to delete photo');
    }

    // Only revalidate after successful deletion
    revalidatePath('/photos');
    return { success: true };
  } catch (error) {
    console.error('Delete photo error:', error);
    throw error instanceof Error ? error : new Error('Delete failed');
  }
}
```

### 📝 Quick Reference Guide

#### Data-Fetching Server Actions

**Characteristics:**
- Read-only operations
- Fetch from external APIs or databases
- Return data without side effects
- Can be called from Server or Client Components

**Rules:**
- ✅ Can be called during Server Component render
- ❌ Must NOT use `revalidatePath()` or `revalidateTag()`
- ✅ Should have JSDoc explaining cache strategy

**Example:**
```typescript
/**
 * Fetches photos from Google Photos API
 *
 * This is a data-fetching Server Action that always returns fresh data
 * from Google's API. No cache revalidation is needed because we don't
 * cache the data - the API is the single source of truth.
 */
export async function getSelectedPhotos(sessionId: string) {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_URL}/mediaItems?sessionId=${sessionId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  return response.json();
}
```

#### Mutation Server Actions

**Characteristics:**
- Write operations (create, update, delete)
- Modify server-side state
- Triggered by user interactions
- Must be called from Client Components

**Rules:**
- ❌ Must NOT be called from Server Components during render
- ✅ Should use `revalidatePath()` or `revalidateTag()` after successful mutation
- ✅ Must have proper error handling
- ✅ Should use `useTransition` or `useFormState` from Client Components

**Example:**
```typescript
/**
 * Completes a photo selection session
 *
 * This is a mutation Server Action that updates server state and
 * revalidates affected pages. Must be called from Client Components only.
 */
export async function completePhotoSelection(sessionId: string) {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  try {
    // Mutation: Update database
    await db.photoSessions.update({
      where: { id: sessionId },
      data: { completedAt: new Date() },
    });

    // Revalidate affected pages
    revalidatePath('/gallery');
    revalidatePath('/photos');

    return { success: true };
  } catch (error) {
    console.error('Complete photo selection error:', error);
    throw error instanceof Error ? error : new Error('Failed to complete');
  }
}
```

### 🔍 Code Review Questions

When reviewing Server Actions, ask yourself:

1. **Is this action correctly classified?**
   - Data-fetching (read) vs Mutation (write)

2. **Is cache revalidation used appropriately?**
   - Only in mutations, never in data-fetching
   - Only after successful state changes
   - All affected paths are revalidated

3. **Can this be called safely from Server Components?**
   - Yes if it's data-fetching without cache revalidation
   - No if it's a mutation or uses cache revalidation

4. **Is the error handling robust?**
   - Try-catch blocks around fallible operations
   - User-friendly error messages
   - Prevents cache invalidation on errors

5. **Is it well documented?**
   - Clear JSDoc explaining purpose
   - Classification (data-fetching vs mutation)
   - Cache strategy documented
   - Examples provided

### 📚 Additional Resources

- **Architecture Decision:** `research/docs/2026-01-03-cache-revalidation-decision.md`
- **Implementation:** `app/src/app/actions/photos.ts` (see JSDoc comments)
- **Next.js Docs:** [Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- **Next.js Docs:** [Caching and Revalidation](https://nextjs.org/docs/app/building-your-application/caching)

### 🚨 When to Escalate

Escalate to a senior engineer if:

- Uncertain whether cache revalidation is needed
- Complex data flow involving multiple Server Actions
- Performance implications of cache strategy
- Novel pattern not covered in this checklist
