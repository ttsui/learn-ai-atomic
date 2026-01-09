---
date: 2025-12-29 07:04:25 UTC
researcher: Claude Research Agent
git_commit: edc2a6d1cd0aa49a8387d8d41f6f0c3e1d7f0f82
branch: claude/research-nextjs-photos-api-RYuoa
repository: learn-ai-atomic
topic: "Next.js OAuth and API Integration Patterns for Google Photos"
tags: [research, nextjs, oauth, nextauth, app-router, google-photos]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude Research Agent
---

# Next.js OAuth and API Integration Patterns

## Research Question
What are the best practices and architecture patterns for implementing OAuth and API integration with Google Photos in a Next.js application?

## Summary

This document covers OAuth integration patterns for Next.js 14/15 App Router applications connecting to Google Photos APIs. The recommended approach uses **NextAuth.js (Auth.js) v5** for OAuth handling, **Server Components** for authenticated data fetching, **Route Handlers** for API proxying, and **HTTP-only cookies** for secure session management.

**Key Recommendations**:
1. Use NextAuth.js v5 for OAuth - battle-tested, handles edge cases
2. Keep tokens server-side only - never expose to client JavaScript
3. Implement automatic token refresh in JWT callbacks
4. Use middleware for fast route protection at the edge
5. Leverage Server Actions for secure mutations from Client Components

## Detailed Findings

### 1. Next.js App Router OAuth Patterns

#### 1.1 Server Components vs Client Components for OAuth

| Aspect | Server Components | Client Components |
|--------|-------------------|-------------------|
| **Token Access** | Direct access via `getServerSession()` | Never - use API routes |
| **Data Fetching** | Can call Google APIs directly | Must call Next.js API routes |
| **Security** | Tokens never leave server | Risk of token exposure |
| **Use Cases** | Initial page load, SSR | Interactive features |

**Pattern: Server Component with Authentication**

```typescript
// app/photos/page.tsx (Server Component)
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PhotoGallery } from '@/components/PhotoGallery';

export default async function PhotosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    redirect('/auth/signin');
  }

  // Fetch photos server-side with access token
  const photos = await fetchPhotosFromGoogle(session.accessToken);

  // Pass data (not token!) to Client Component
  return <PhotoGallery initialPhotos={photos} />;
}
```

#### 1.2 Route Handlers for OAuth Callbacks

**File Structure**:
```
app/
└── api/
    └── auth/
        └── [...nextauth]/
            └── route.ts    # NextAuth.js handler
```

**Implementation**:

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

#### 1.3 Middleware for Token Validation

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    '/photos/:path*',
    '/gallery/:path*',
    '/api/photos/:path*',
  ],
};
```

#### 1.4 NextAuth.js Configuration for Google Photos

```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Photos Picker scope
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
          ].join(' '),
          access_type: 'offline',  // Get refresh token
          prompt: 'consent',       // Always show consent screen
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // Initial sign in
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (account.expires_in as number) * 1000,
        };
      }

      // Return previous token if not expired
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token expired, try to refresh
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // Only pass accessToken to session on server-side
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },

  session: {
    strategy: 'jwt',  // Use JWT for serverless compatibility
  },
};

async function refreshAccessToken(token: JWT) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refreshToken as string,
        grant_type: 'refresh_token',
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}
```

### 2. API Route Architecture

#### 2.1 API Routes for External API Calls

**Pattern: Proxy Route with Token Management**

```typescript
// app/api/photos/route.ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Handle token refresh errors
  if (session.error === 'RefreshAccessTokenError') {
    return NextResponse.json(
      { error: 'TokenExpired', message: 'Please sign in again' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Proxy to Google Photos Picker API
    const response = await fetch(
      `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Photos API error:', error);
    return NextResponse.json(
      { error: 'InternalError' },
      { status: 500 }
    );
  }
}
```

#### 2.2 Error Handling Patterns

```typescript
// lib/errors.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleGoogleAPIError(error: unknown): never {
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        throw new APIError(401, 'UNAUTHENTICATED', 'Token expired or invalid');
      case 403:
        throw new APIError(403, 'FORBIDDEN', 'Permission denied');
      case 429:
        throw new APIError(429, 'RATE_LIMITED', 'Too many requests');
      default:
        throw new APIError(error.status, 'UNKNOWN', 'Google API error');
    }
  }
  throw error;
}

// API Route usage
export async function GET(request: Request) {
  try {
    // ... API logic
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

#### 2.3 Token Refresh Mechanisms

**Automatic Refresh (Recommended)**:
- Handled in NextAuth.js JWT callback (shown above)
- Token refreshed before expiration
- Seamless user experience

**Manual Refresh (For Specific Cases)**:

```typescript
// lib/google-auth.ts
export async function getValidToken(session: Session): Promise<string> {
  // Check if token is about to expire (5-minute buffer)
  const tokenExpiry = session.tokenExpiry as number;
  const needsRefresh = Date.now() > tokenExpiry - 5 * 60 * 1000;

  if (!needsRefresh) {
    return session.accessToken as string;
  }

  // Refresh via API route
  const response = await fetch('/api/auth/refresh', { method: 'POST' });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const { accessToken } = await response.json();
  return accessToken;
}
```

### 3. State Management for Auth

#### 3.1 Session Management Approaches

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **JWT Session** | Stateless, serverless-friendly | Token size, can't revoke | Vercel, Cloudflare |
| **Database Session** | Revocable, smaller tokens | Requires DB | Traditional servers |
| **Hybrid** | Best of both | More complex | Large apps |

**Recommended: JWT Session Strategy**

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60,
  },
};
```

#### 3.2 Token Storage Comparison

| Location | Security | XSS Risk | CSRF Risk | Recommendation |
|----------|----------|----------|-----------|----------------|
| **HTTP-only Cookie** | High | None | Mitigated with SameSite | **Use this** |
| **localStorage** | Low | High | None | Never for tokens |
| **sessionStorage** | Medium | High | None | Never for tokens |
| **Memory** | High | Medium | None | Short-lived only |

**NextAuth.js Default**: HTTP-only cookie with session ID, JWT stored server-side

#### 3.3 Secure Token Handling in Next.js

```typescript
// NEVER do this - exposes token to client
// ❌ BAD
export default function ClientComponent() {
  const { data: session } = useSession();
  // session.accessToken is undefined on client (if properly configured)
  const token = session?.accessToken; // WRONG
}

// ✅ GOOD - Keep tokens server-side
export default async function ServerComponent() {
  const session = await getServerSession(authOptions);
  const photos = await fetchWithToken(session?.accessToken);
  return <Gallery photos={photos} />;
}

// ✅ GOOD - Use API routes for client components
export default function ClientComponent() {
  const { data, error } = useSWR('/api/photos', fetcher);
  // Token handled entirely server-side
}
```

### 4. Next.js 14/15 Specific Patterns

#### 4.1 Server Actions for API Calls

```typescript
// app/actions/photos.ts
'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createPickerSession() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return { pickerUri: data.pickerUri, sessionId: data.id };
}

export async function getSelectedPhotos(sessionId: string) {
  const session = await getServerSession(authOptions);

  const response = await fetch(
    `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`,
    {
      headers: { 'Authorization': `Bearer ${session?.accessToken}` },
    }
  );

  const data = await response.json();
  revalidatePath('/photos');
  return data.mediaItems;
}
```

**Using Server Actions in Client Component**:

```typescript
// components/PhotoPicker.tsx
'use client';

import { createPickerSession, getSelectedPhotos } from '@/app/actions/photos';
import { useTransition } from 'react';

export function PhotoPicker() {
  const [isPending, startTransition] = useTransition();
  const [pickerUri, setPickerUri] = useState<string | null>(null);

  const handleStartPicker = () => {
    startTransition(async () => {
      const { pickerUri, sessionId } = await createPickerSession();
      setPickerUri(pickerUri);
      // Store sessionId for later polling
    });
  };

  return (
    <button onClick={handleStartPicker} disabled={isPending}>
      {isPending ? 'Starting...' : 'Select Photos'}
    </button>
  );
}
```

#### 4.2 React Server Components Data Fetching

```typescript
// app/gallery/page.tsx
import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';

// Server Component - can fetch directly
async function PhotosList({ sessionId }: { sessionId: string }) {
  const session = await getServerSession(authOptions);

  const photos = await fetch(
    `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`,
    {
      headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      next: { revalidate: 300 }, // Cache for 5 minutes
    }
  ).then(r => r.json());

  return (
    <div className="grid grid-cols-4 gap-4">
      {photos.mediaItems?.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}

export default function GalleryPage({ searchParams }) {
  return (
    <Suspense fallback={<PhotosSkeleton />}>
      <PhotosList sessionId={searchParams.sessionId} />
    </Suspense>
  );
}
```

#### 4.3 Streaming and Suspense with External APIs

```typescript
// app/photos/page.tsx
import { Suspense } from 'react';

// Each component can stream independently
export default function PhotosPage() {
  return (
    <div>
      <Suspense fallback={<AlbumsSkeleton />}>
        <AlbumsList />
      </Suspense>

      <Suspense fallback={<RecentPhotosSkeleton />}>
        <RecentPhotos />
      </Suspense>
    </div>
  );
}

// Nested Suspense for pagination
function PhotosWithPagination({ sessionId }) {
  return (
    <div>
      <Suspense fallback={<Loading />}>
        <PhotoGrid sessionId={sessionId} />
        <Suspense fallback={<MoreLoading />}>
          <LoadMorePhotos sessionId={sessionId} />
        </Suspense>
      </Suspense>
    </div>
  );
}
```

### 5. Complete Implementation Example

#### File Structure

```
app/
├── (auth)/
│   ├── signin/
│   │   └── page.tsx
│   └── signout/
│       └── page.tsx
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts
│   └── photos/
│       ├── route.ts           # List photos
│       ├── sessions/
│       │   └── route.ts       # Create picker session
│       └── [sessionId]/
│           └── route.ts       # Get session status
├── photos/
│   ├── page.tsx               # Main photos page
│   ├── loading.tsx
│   └── error.tsx
├── actions/
│   └── photos.ts              # Server Actions
└── layout.tsx

lib/
├── auth.ts                    # NextAuth config
├── google-photos-client.ts    # API wrapper
└── utils/
    ├── errors.ts
    └── retry.ts

components/
├── PhotoPicker/
│   ├── PickerButton.tsx
│   ├── PickerModal.tsx
│   └── index.ts
├── PhotoGallery/
│   ├── Gallery.tsx
│   ├── PhotoCard.tsx
│   └── index.ts
└── auth/
    ├── SignInButton.tsx
    └── SessionProvider.tsx

types/
└── next-auth.d.ts             # Type augmentation
```

#### Type Augmentation for NextAuth

```typescript
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

## Code References

### Official Documentation Links

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [NextAuth.js JWT Callbacks](https://next-auth.js.org/configuration/callbacks#jwt-callback)
- [Next.js App Router Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

### Tutorial References

- [Adding Google Authentication in Next.js 14 with App Router](https://dev.to/souravvmishra/adding-google-authentication-in-nextjs-14-with-app-router-a-beginner-friendly-guide-3ag)
- [NextAuth.js in Next.js 14: Complete Authentication Guide](https://www.djamware.com/post/693c24bbf706092e50ed9479/nextauthjs-in-nextjs-14-complete-authentication-guide)
- [Accessing the Google Access Token in NextAuth.js](https://blog.srij.dev/nextauth-google-access-token)
- [How to Implement Google Authentication in a Next.js App](https://www.telerik.com/blogs/how-to-implement-google-authentication-nextjs-app-using-nextauth)

## Open Questions

- Optimal polling strategy for picker session status in Next.js
- Best practices for handling multiple simultaneous picker sessions
- Edge runtime compatibility with Google Photos API calls

---

**Sources**:
- [NextAuth.js OAuth Documentation](https://next-auth.js.org/configuration/providers/oauth)
- [Next.js 14 App Router Authentication Guide](https://nextjs.org/docs/app/building-your-application/authentication)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
