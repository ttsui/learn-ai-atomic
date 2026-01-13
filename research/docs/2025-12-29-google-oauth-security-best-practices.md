---
date: 2025-12-29 07:04:25 UTC
researcher: Claude Research Agent
git_commit: edc2a6d1cd0aa49a8387d8d41f6f0c3e1d7f0f82
branch: claude/research-nextjs-photos-api-RYuoa
repository: learn-ai-atomic
topic: "Google OAuth Security Best Practices"
tags: [research, security, oauth, pkce, csrf, xss, google-photos]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude Research Agent
---

# Google OAuth Security Best Practices for Web Applications

## Research Question
What are the security best practices for implementing Google OAuth in a Next.js web application, including token management, CORS, CSP, and common vulnerabilities?

## Summary

This document consolidates security best practices for implementing Google OAuth in web applications. Key findings:

- **PKCE is now mandatory** for all OAuth flows (OAuth 2.1 requirement)
- **Refresh tokens should be stored server-side only**, never in browser storage
- **State parameter is required** for CSRF protection
- **Token rotation** should be implemented for refresh tokens
- **HttpOnly, Secure, SameSite cookies** are essential for session management

## Detailed Findings

### 1. OAuth Security Best Practices

#### 1.1 PKCE (Proof Key for Code Exchange)

**Status**: Required for OAuth 2.1 (supersedes implicit flow)

PKCE protects against authorization code interception attacks by:
1. Generating a cryptographic `code_verifier` on the client
2. Creating a `code_challenge` from the verifier
3. Sending the challenge with the authorization request
4. Sending the verifier with the token exchange

**Implementation**:

```typescript
// Generate code verifier (43-128 characters)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Generate code challenge (S256 method)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

// Authorization request with PKCE
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Store code_verifier in session (server-side only!)
session.codeVerifier = codeVerifier;

// Build auth URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
```

#### 1.2 State Parameter Usage

The state parameter prevents CSRF attacks by binding requests to sessions.

**Implementation**:

```typescript
// Generate cryptographically random state
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Before redirecting to OAuth provider
const state = generateState();
session.oauthState = state;
session.oauthStateCreatedAt = Date.now();

// In callback handler - ALWAYS validate
if (!req.query.state || req.query.state !== session.oauthState) {
  throw new Error('Invalid state parameter - possible CSRF attack');
}

// Validate state age (prevent replay attacks)
const stateAge = Date.now() - session.oauthStateCreatedAt;
if (stateAge > 10 * 60 * 1000) { // 10 minutes
  throw new Error('State parameter expired');
}

// Clear state after use (single-use)
delete session.oauthState;
delete session.oauthStateCreatedAt;
```

**Common Mistakes**:
- Using predictable values (timestamps, user IDs)
- Not validating state on callback
- Reusing state tokens
- Storing state in localStorage (vulnerable to XSS)

#### 1.3 Secure Redirect URI Handling

**Critical Rules**:
1. **Exact Match Only** - Never use wildcards or partial matching
2. **Whitelist Approach** - Pre-register all valid redirect URIs
3. **HTTPS Only** - Except localhost for development
4. **No Open Redirects** - Validate before any redirect

```typescript
// Strict validation
const ALLOWED_REDIRECT_URIS = [
  'https://yourdomain.com/api/auth/callback',
  'https://staging.yourdomain.com/api/auth/callback',
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/api/auth/callback'
    : null,
].filter(Boolean);

export async function validateRedirectUri(uri: string): Promise<boolean> {
  return ALLOWED_REDIRECT_URIS.includes(uri);
}
```

### 2. API Key and Secret Management

#### 2.1 Environment Variable Patterns

**Next.js Specific**:

```bash
# .env.local (NEVER commit this file)

# Public variables (exposed to browser, prefix with NEXT_PUBLIC_)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Server-only secrets (NO NEXT_PUBLIC_ prefix)
GOOGLE_CLIENT_SECRET=your-client-secret

# Encryption keys for session/token storage
SESSION_SECRET=generate-with-openssl-rand-hex-32
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
```

**Critical Rules**:
1. **Never prefix secrets with `NEXT_PUBLIC_`** - These are bundled into client JavaScript
2. **Use different credentials per environment** - Dev, staging, production
3. **Validate on startup** - Fail fast if required vars are missing

```typescript
// lib/config.ts
const requiredServerEnvVars = [
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
];

for (const envVar of requiredServerEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Runtime check - this should never happen if configured correctly
if (typeof window !== 'undefined' && process.env.GOOGLE_CLIENT_SECRET) {
  console.error('CRITICAL: Client secret exposed to browser!');
}
```

#### 2.2 Never Exposing Secrets in Client-Side Code

```typescript
// ❌ NEVER DO THIS - Secret in client bundle
const config = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, // EXPOSED!
};

// ✅ CORRECT - Secret only on server
// app/api/auth/token/route.ts
export async function POST(request: Request) {
  const { code } = await request.json();

  // Secret only used server-side
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET, // Server-only
      code,
      grant_type: 'authorization_code',
    }),
  });

  // Return only what's needed, never refresh token to client
  const { access_token, expires_in } = await response.json();
  return Response.json({ expires_in });
}
```

### 3. Token Security

#### 3.1 Access Token vs Refresh Token Handling

| Token Type | Storage Location | Lifetime | Exposure Risk | Usage |
|------------|------------------|----------|---------------|-------|
| Access Token | Server-side/short-lived cookie | 1 hour | Medium | API calls |
| Refresh Token | Server-side database (encrypted) | 90 days - 1 year | High | Token refresh only |
| ID Token | Validated then discarded | N/A | Low | User info extraction |

**Key Principle**: Refresh tokens NEVER leave the server.

```typescript
// ✅ CORRECT: Server-side token storage
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/encryption';
import db from '@/lib/db';

export async function handleOAuthCallback(code: string, userId: string) {
  const tokenResponse = await exchangeCodeForTokens(code);

  // Store refresh token in database (encrypted)
  await db.user.update({
    where: { id: userId },
    data: {
      encryptedRefreshToken: encrypt(tokenResponse.refresh_token),
    },
  });

  // Create session with only session ID (not tokens!)
  const sessionId = crypto.randomUUID();
  await db.session.create({
    data: { id: sessionId, userId },
  });

  // Set secure session cookie
  cookies().set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });
}
```

#### 3.2 Token Expiration and Refresh Logic

```typescript
// lib/google-api-client.ts
export class GoogleAPIClient {
  private accessToken: string | null = null;
  private accessTokenExpiry: number = 0;

  constructor(private userId: string) {}

  async getValidAccessToken(): Promise<string> {
    // Check if current access token is still valid (5-min buffer)
    if (this.accessToken && Date.now() < this.accessTokenExpiry - 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Token expired or missing, refresh it
    const user = await db.user.findUnique({
      where: { id: this.userId },
      select: { encryptedRefreshToken: true },
    });

    if (!user?.encryptedRefreshToken) {
      throw new Error('No refresh token - user needs to re-authenticate');
    }

    const refreshToken = decrypt(user.encryptedRefreshToken);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      // Refresh token may be revoked
      await db.user.update({
        where: { id: this.userId },
        data: { encryptedRefreshToken: null },
      });
      throw new Error('Refresh token invalid - user needs to re-authenticate');
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } =
      await response.json();

    // Google may issue a new refresh token (rotation)
    if (newRefreshToken) {
      await db.user.update({
        where: { id: this.userId },
        data: { encryptedRefreshToken: encrypt(newRefreshToken) },
      });
    }

    this.accessToken = access_token;
    this.accessTokenExpiry = Date.now() + (expires_in * 1000);

    return access_token;
  }
}
```

#### 3.3 Secure Cookie Configurations

```typescript
// Complete cookie security configuration
cookies().set('session_id', sessionId, {
  httpOnly: true,      // Prevents JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'lax',     // CSRF protection
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
  // domain: '.yourdomain.com', // Optional: share across subdomains
});
```

| Attribute | Purpose | Recommendation |
|-----------|---------|----------------|
| `httpOnly` | Prevents XSS attacks | Always `true` |
| `secure` | HTTPS only | `true` in production |
| `sameSite` | CSRF protection | `lax` for OAuth flows |
| `maxAge` | Cookie lifetime | Match session lifetime |
| `path` | Scope | Usually `/` |

### 4. CORS and CSP Considerations

#### 4.1 Cross-Origin Request Handling

```typescript
// Next.js middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const origin = request.headers.get('origin');

  const allowedOrigins = [
    'https://yourdomain.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  ].filter(Boolean);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin!)
          ? origin! : 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return NextResponse.next();
}
```

#### 4.2 Content Security Policy Headers

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com",
      "frame-src 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

**CSP Directives for Google APIs**:

| Directive | Google Domains | Purpose |
|-----------|----------------|---------|
| `script-src` | `accounts.google.com`, `apis.google.com` | OAuth buttons, API libs |
| `connect-src` | `*.googleapis.com` | API requests |
| `frame-src` | `accounts.google.com` | OAuth popup/iframe |
| `img-src` | `*.googleusercontent.com` | User photos |

### 5. Common Vulnerabilities to Avoid

#### 5.1 CSRF Protection

**Protection Mechanisms**:

1. **State Parameter** (covered in Section 1.2)
2. **SameSite Cookies** (covered in Section 3.3)
3. **Origin Validation**:

```typescript
export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  if (!origin?.startsWith(process.env.NEXT_PUBLIC_APP_URL!)) {
    return new Response('Invalid origin', { status: 403 });
  }

  // Proceed with OAuth
}
```

#### 5.2 XSS Prevention with OAuth

**Vulnerable Pattern**:
```typescript
// ❌ DANGEROUS - Token accessible to XSS
localStorage.setItem('access_token', token);
```

**Prevention**:
1. Never store tokens in localStorage/sessionStorage
2. Use HttpOnly cookies for session IDs
3. Store tokens server-side only
4. Sanitize all user input from OAuth profile data

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeUserProfile(profile: GoogleProfile) {
  return {
    id: profile.id,
    email: profile.email, // Email format validated by Google
    name: DOMPurify.sanitize(profile.name),
    picture: profile.picture, // URL validated by origin
  };
}
```

#### 5.3 Open Redirect Vulnerabilities

```typescript
// ❌ DANGEROUS - Open redirect
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  return Response.redirect(redirect!); // Attacker: ?redirect=https://evil.com
}

// ✅ SECURE - Whitelist approach
const ALLOWED_REDIRECTS = ['/dashboard', '/profile', '/settings'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');

  if (!redirect || !ALLOWED_REDIRECTS.includes(redirect)) {
    return Response.redirect('/dashboard');
  }

  // Additional: must be relative path
  if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
    return Response.redirect('/dashboard');
  }

  return Response.redirect(redirect);
}
```

### 6. Security Checklist

#### OAuth Configuration
- [ ] PKCE implemented and enforced
- [ ] State parameter generated cryptographically and validated
- [ ] Redirect URIs explicitly whitelisted (no wildcards)
- [ ] Redirect URIs use HTTPS (except localhost dev)
- [ ] Separate OAuth clients for dev/staging/production

#### Secret Management
- [ ] Client secrets never exposed to client-side code
- [ ] No secrets prefixed with `NEXT_PUBLIC_`
- [ ] `.env.local` in `.gitignore`
- [ ] Environment variables validated on startup

#### Token Security
- [ ] Refresh tokens stored server-side only (encrypted)
- [ ] Access tokens never stored in localStorage
- [ ] Session cookies use `httpOnly`, `secure`, `sameSite`
- [ ] Automatic token refresh implemented
- [ ] Token revocation on logout

#### CORS & Headers
- [ ] CORS origins explicitly whitelisted
- [ ] CSP configured for Google domains
- [ ] Security headers configured

#### Vulnerability Protection
- [ ] CSRF protection via state parameter
- [ ] XSS protection via CSP and input sanitization
- [ ] Open redirect validation on all redirects
- [ ] Rate limiting on auth endpoints

## Official References

### OAuth & Security Standards
- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

### OWASP Resources
- [OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

### Google Documentation
- [Google Identity Platform](https://developers.google.com/identity)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)

### Next.js Security
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)

## Common Mistakes Summary

| Mistake | Impact | Fix |
|---------|--------|-----|
| Storing refresh tokens in localStorage | Token theft via XSS | Store server-side only, encrypted |
| Not validating state parameter | CSRF attacks | Always validate, single-use |
| Using wildcard redirect URIs | Open redirect attacks | Exact match whitelist |
| Exposing client secret in frontend | Account takeover | Keep server-side |
| Missing PKCE | Code interception | Implement for all flows |
| Not revoking tokens on logout | Sessions persist | Call revocation endpoint |

---

**Sources**:
- [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [Google OAuth Security](https://developers.google.com/identity/protocols/oauth2)
