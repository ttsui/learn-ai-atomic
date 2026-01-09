---
date: 2025-12-29 07:04:25 UTC
researcher: Claude Research Agent
git_commit: edc2a6d1cd0aa49a8387d8d41f6f0c3e1d7f0f82
branch: claude/research-nextjs-photos-api-RYuoa
repository: learn-ai-atomic
topic: "Next.js Web App Integration with Google Photos Picker API - Best Practices and Architecture"
tags: [research, nextjs, google-photos, picker-api, oauth, architecture, security]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude Research Agent
---

# Next.js + Google Photos Picker API Integration Research

## Research Question

I'm building a Next.js Web App which integrates with Google Photos Picker API. Research best practices and architecture patterns for these requirements.

## Summary

This research provides comprehensive guidance for building a Next.js application that integrates with Google Photos Picker API. The key findings are organized into four main areas:

### Key Recommendations

1. **Use the Google Photos Picker API** (not the legacy Library API)
   - The legacy `photoslibrary.readonly` scope is **deprecated** and will return `403 PERMISSION_DENIED` after **March 31, 2025**
   - Use the new `photospicker.mediaitems.readonly` scope instead
   - Picker API provides a secure, user-initiated selection model

2. **Implement OAuth with NextAuth.js**
   - Use NextAuth.js v5 (Auth.js) for robust OAuth handling
   - Configure custom scopes for Google Photos access
   - Implement automatic token refresh in JWT callbacks
   - Store tokens server-side only (never in client code)

3. **Follow Security Best Practices**
   - Use HTTP-only cookies for session management
   - Implement PKCE (required for OAuth 2.1)
   - Validate state parameter to prevent CSRF
   - Never expose client secrets in client-side code

4. **Architecture Pattern: Session-Based Picker Flow**
   - Create picker session → User selects in Google UI → Poll for completion → Fetch media items
   - Use Server Components for authenticated data fetching
   - Use Route Handlers for API proxying
   - Implement error boundaries and loading states

## Detailed Findings

### 1. Google Photos Picker API Overview

The Picker API is Google's new method for allowing users to select and share photos from their library.

**API Flow**:
```
1. Create Session ──▶ POST /v1/sessions
                           │
                           ▼
2. User Selects ◀─── pickerUri (Google's UI)
                           │
                           ▼
3. Poll Status ────▶ GET /v1/sessions/{id}
                           │
                           ▼ (mediaItemsSet: true)
4. Get Photos ─────▶ GET /v1/mediaItems?sessionId={id}
```

**Base URL**: `https://photospicker.googleapis.com/v1`

**Required OAuth Scope**: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

**Key Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions` | POST | Create a new picker session |
| `/sessions/{id}` | GET | Poll session status |
| `/mediaItems` | GET | Retrieve selected photos |

**Important**: Base URLs for images expire after **60 minutes**. Never cache them long-term.

### 2. Next.js OAuth Integration

**Recommended Stack**:
- NextAuth.js (Auth.js) for OAuth
- Next.js 14+ App Router
- Server Components for authenticated data fetching
- SWR or TanStack Query for client-side caching

**NextAuth.js Configuration**:

```typescript
// lib/auth/config.ts
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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Date.now() + account.expires_in! * 1000;
      }

      // Refresh token if expired
      if (Date.now() > (token.accessTokenExpires as number)) {
        return refreshAccessToken(token);
      }

      return token;
    },
  },
  session: { strategy: 'jwt' },
};
```

### 3. Security Requirements

**OAuth Security Checklist**:
- [x] PKCE implementation (required for OAuth 2.1)
- [x] State parameter validation (CSRF protection)
- [x] HTTPS-only redirect URIs (except localhost)
- [x] HTTP-only, Secure, SameSite cookies
- [x] Server-side token storage only
- [x] Environment variable validation on startup

**Token Security**:
| Token Type | Where to Store | Never Store In |
|------------|----------------|----------------|
| Access Token | Server-side session | localStorage, client state |
| Refresh Token | Encrypted database | Any client-accessible storage |
| Session ID | HTTP-only cookie | localStorage, sessionStorage |

### 4. Recommended Architecture

**File Structure**:
```
app/
├── api/
│   ├── auth/[...nextauth]/route.ts   # OAuth handler
│   └── photos/
│       ├── route.ts                   # List photos
│       └── sessions/route.ts          # Create/poll sessions
├── photos/
│   ├── page.tsx                       # Picker page
│   └── gallery/page.tsx               # Display page
└── actions/photos.ts                  # Server Actions

lib/
├── auth/config.ts                     # NextAuth config
└── google-photos/client.ts            # API wrapper

components/
├── GooglePhotoPicker/
│   ├── PickerButton.tsx
│   └── PickerStatus.tsx
└── PhotoGallery/
    ├── Gallery.tsx
    └── PhotoCard.tsx
```

**Component Pattern**:
- **Server Components**: Fetch data with tokens, never expose tokens
- **Client Components**: Handle interactions, call API routes (not Google directly)
- **Server Actions**: Create sessions, fetch photos with server-side tokens

### 5. Implementation Checklist

#### Phase 1: Setup
- [ ] Create Google Cloud project
- [ ] Enable Google Photos Picker API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 Client ID
- [ ] Set up environment variables

#### Phase 2: Authentication
- [ ] Install and configure NextAuth.js
- [ ] Set up Google OAuth provider with Photos scope
- [ ] Implement token refresh logic
- [ ] Add middleware for route protection

#### Phase 3: API Integration
- [ ] Create session creation API route
- [ ] Implement session polling logic
- [ ] Create media items fetch API route
- [ ] Add error handling and retries

#### Phase 4: UI Components
- [ ] Build picker button component
- [ ] Create polling status indicator
- [ ] Implement photo gallery grid
- [ ] Add lightbox for full-size view
- [ ] Handle loading and error states

#### Phase 5: Production Readiness
- [ ] Submit OAuth verification request
- [ ] Configure CSP headers
- [ ] Implement rate limiting
- [ ] Add monitoring and logging
- [ ] Test error scenarios

## Code References

### Quick Start Implementation

**1. Create Picker Session (Server Action)**:
```typescript
// app/actions/photos.ts
'use server';
import { getServerSession } from 'next-auth/next';

export async function createPickerSession() {
  const session = await getServerSession(authOptions);

  const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session?.accessToken}` },
  });

  const data = await response.json();
  return { pickerUri: data.pickerUri, sessionId: data.id };
}
```

**2. Poll Session Status (API Route)**:
```typescript
// app/api/photos/sessions/[sessionId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions);

  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${params.sessionId}`,
    { headers: { 'Authorization': `Bearer ${session?.accessToken}` } }
  );

  return NextResponse.json(await response.json());
}
```

**3. Picker Button Component**:
```typescript
// components/GooglePhotoPicker/PickerButton.tsx
'use client';
export function PickerButton({ onComplete }: { onComplete: (photos: any[]) => void }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { pickerUri, sessionId } = await createPickerSession();
      window.open(`${pickerUri}/autoclose`, 'picker', 'width=800,height=600');
      // Start polling for completion...
    });
  };

  return <button onClick={handleClick} disabled={isPending}>Select Photos</button>;
}
```

## Related Research Documents

- [Google Photos Picker API Overview](./2025-12-29-google-photos-picker-api-overview.md)
- [Next.js OAuth Integration Patterns](./2025-12-29-nextjs-oauth-integration-patterns.md)
- [Google OAuth Security Best Practices](./2025-12-29-google-oauth-security-best-practices.md)
- [Next.js + Google Photos Architecture Patterns](./2025-12-29-nextjs-google-photos-architecture.md)

## Official Documentation Links

### Google Photos
- [Picker API Getting Started](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Sessions Management](https://developers.google.com/photos/picker/guides/sessions)
- [Media Items Retrieval](https://developers.google.com/photos/picker/guides/media-items)
- [Authorization Scopes](https://developers.google.com/photos/overview/authorization)
- [API Updates Blog](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)

### Next.js & Auth
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Next.js App Router Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

### Security
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP OAuth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

## Open Questions

1. **Optimal polling interval** - The API provides `pollInterval` in the response, but what's the best UX balance?
2. **Session persistence** - Should picker sessions be stored in database for resume capability?
3. **Multi-tab handling** - How to handle users opening picker in multiple tabs?
4. **Quota management** - Strategies for staying within 10,000 requests/day limit in high-traffic apps

---

**Research completed**: 2025-12-29
**Primary sources**: Google Photos API Documentation, NextAuth.js Documentation, OWASP Security Guidelines
**Status**: Complete - Ready for implementation planning
