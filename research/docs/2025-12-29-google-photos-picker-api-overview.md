---
date: 2025-12-29 07:04:25 UTC
researcher: Claude Research Agent
git_commit: edc2a6d1cd0aa49a8387d8d41f6f0c3e1d7f0f82
branch: claude/research-nextjs-photos-api-RYuoa
repository: learn-ai-atomic
topic: "Google Photos Picker API Overview and Implementation"
tags: [research, google-photos, picker-api, oauth, api-design]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude Research Agent
---

# Google Photos Picker API Overview

## Research Question
What is the Google Photos Picker API, how does it work, and what are the authentication requirements and API structure?

## Summary

The **Google Photos Picker API** is Google's new recommended method for applications to allow users to select and share photos from their Google Photos library. It was launched as a replacement for certain functionality in the legacy Library API, offering a more secure and user-friendly approach where users explicitly select which content to share.

**Key Differentiator**: Unlike the legacy Library API, the Picker API does not give applications broad access to a user's entire photo library. Instead, it follows a "user-initiated selection" model where users pick specific photos or albums through Google's native UI.

## Detailed Findings

### 1. What is the Google Photos Picker API?

The Picker API enables users to share media from Google Photos with your app through a secure, Google-hosted selection interface. Key characteristics:

- **Secure Selection Model**: Users explicitly choose which photos to share
- **Native Google UI**: The selection happens within Google Photos (app or web)
- **Session-Based**: Each picking session generates a unique URI for user interaction
- **No Library-Wide Access**: Apps only receive access to user-selected content

### 2. Difference from Legacy Library API

| Aspect | Picker API (New) | Library API (Legacy) |
|--------|-----------------|---------------------|
| **Access Model** | User-selected content only | Entire library (with scopes) |
| **UI** | Google-hosted picker | App-built UI |
| **Scopes** | `photospicker.mediaitems.readonly` | `photoslibrary.readonly` (deprecated) |
| **Security** | Higher - explicit user consent | Lower - broad access |
| **Use Cases** | Content selection | Library management |

**Important Timeline (2025)**:
- `photoslibrary.readonly`, `photoslibrary.sharing`, and `photoslibrary` scopes will be **removed**
- API calls using only these scopes will return `403 PERMISSION_DENIED` after **March 31, 2025**
- Apps needing user photo selection **must migrate** to the Picker API

### 3. OAuth 2.0 Authentication Requirements

#### Required Scope
```
https://www.googleapis.com/auth/photospicker.mediaitems.readonly
```

#### OAuth Configuration Requirements
1. Enable Google Photos APIs in Google Cloud Console
2. Create OAuth 2.0 Client ID for web application
3. Configure authorized redirect URIs
4. Submit OAuth verification request (required for production)
5. Request only the scopes your application needs

**Important Notes**:
- Google Photos APIs **do not support service accounts**
- Must use OAuth 2.0 for web server applications or mobile/desktop flows
- Apps accessing Google Photos APIs must pass OAuth verification review

### 4. API Structure and Implementation Flow

#### Base URL
```
https://photospicker.googleapis.com/v1/
```

#### Implementation Flow

```
┌──────────────────┐     ┌────────────────────┐     ┌─────────────────────┐
│ 1. Create Session │────▶│ 2. User Selects    │────▶│ 3. Poll Session     │
│    POST /sessions │     │    Photos via URI  │     │    GET /sessions/{id}│
└──────────────────┘     └────────────────────┘     └─────────────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────────┐
                                                    │ 4. List Media Items │
                                                    │ GET /mediaItems     │
                                                    └─────────────────────┘
```

#### Step 1: Create a Session

**Endpoint**: `POST https://photospicker.googleapis.com/v1/sessions`

**Request**: Empty body or optional configuration

**Response**:
```json
{
  "id": "session-unique-id",
  "pickerUri": "https://photos.google.com/picker/...",
  "pollingConfig": {
    "pollInterval": "5s",
    "timeoutIn": "1800s"
  },
  "mediaItemsSet": false,
  "expireTime": "2025-01-01T00:00:00Z"
}
```

#### Step 2: Direct User to pickerUri

- Present `pickerUri` as clickable link or QR code
- For web apps: append `/autoclose` to automatically close after selection
- User selects photos within Google Photos interface

#### Step 3: Poll Session Status

**Endpoint**: `GET https://photospicker.googleapis.com/v1/sessions/{sessionId}`

Poll until `mediaItemsSet` becomes `true`:
```json
{
  "id": "session-unique-id",
  "mediaItemsSet": true,
  "pollingConfig": {
    "pollInterval": "5s",
    "timeoutIn": "1200s"
  }
}
```

**Polling Best Practices**:
- Use `pollInterval` from `pollingConfig` response
- Stop polling when `mediaItemsSet: true`
- Timeout after `timeoutIn` duration
- Handle `FAILED_PRECONDITION` errors

#### Step 4: Retrieve Selected Media Items

**Endpoint**: `GET https://photospicker.googleapis.com/v1/mediaItems?sessionId={sessionId}`

**Response**:
```json
{
  "mediaItems": [
    {
      "id": "media-item-id",
      "baseUrl": "https://lh3.googleusercontent.com/...",
      "mimeType": "image/jpeg",
      "mediaMetadata": {
        "width": "1920",
        "height": "1080",
        "creationTime": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "nextPageToken": "token-for-next-page"
}
```

### 5. Accessing Media Content via baseUrl

The `baseUrl` is used to access the actual image/video content with URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `=w{width}` | Set width | `=w800` |
| `=h{height}` | Set height | `=h600` |
| `=w{w}-h{h}` | Set both dimensions | `=w800-h600` |
| `=c` | Crop to exact dimensions | `=w200-h200-c` |
| `=dv` | Download video | `=dv` |

**Important**: Base URLs are only valid for **60 minutes** and require a valid OAuth token.

### 6. Usage Limits and Quotas

Based on Google Photos API general limits:
- **Daily Quota**: 10,000 requests per project
- **Per-User Limit**: Subject to per-user rate limiting
- **Session Timeout**: Typically 30 minutes for picking sessions

**Best Practices for Quota Management**:
- Cache media item metadata (not baseUrls)
- Use batch requests where available
- Implement request debouncing on client-side
- Store media item IDs for later re-fetching

### 7. Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| `401 UNAUTHENTICATED` | Invalid/expired token | Refresh access token |
| `403 FORBIDDEN` | Scope not granted | Request user re-authorization |
| `403 PERMISSION_DENIED` | Using deprecated scope | Migrate to Picker API |
| `404 NOT_FOUND` | Session expired/invalid | Create new session |
| `429 RESOURCE_EXHAUSTED` | Rate limit exceeded | Implement backoff |
| `FAILED_PRECONDITION` | User hasn't finished picking | Continue polling |

## Code References

### Complete Flow Example (Node.js/TypeScript)

```typescript
// lib/google-photos-picker.ts
import { GoogleAuth } from 'google-auth-library';

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet: boolean;
}

// Step 1: Create a picking session
async function createSession(accessToken: string): Promise<PickerSession> {
  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  return response.json();
}

// Step 2: Poll for completion
async function pollSession(
  sessionId: string,
  accessToken: string,
  pollIntervalMs: number = 5000,
  timeoutMs: number = 1800000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const session = await response.json();

    if (session.mediaItemsSet) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return false; // Timeout
}

// Step 3: Retrieve selected media items
async function getSelectedMedia(
  sessionId: string,
  accessToken: string
): Promise<MediaItem[]> {
  const allItems: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${PICKER_API_BASE}/mediaItems`);
    url.searchParams.set('sessionId', sessionId);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const data = await response.json();
    allItems.push(...data.mediaItems);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}
```

## Official Documentation Links

- [Get Started with the Picker API](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Create and Manage Sessions](https://developers.google.com/photos/picker/guides/sessions)
- [List and Retrieve Media Items](https://developers.google.com/photos/picker/guides/media-items)
- [Photo Picking User Experience](https://developers.google.com/photos/picker/guides/picking-experience)
- [Picker API REST Reference](https://developers.google.com/photos/picker/reference/rest)
- [Authorization Scopes](https://developers.google.com/photos/overview/authorization)
- [API Updates Announcement](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)

## Migration Guidance

If migrating from the legacy Library API:

1. **Update OAuth Scopes**: Change from `photoslibrary.readonly` to `photospicker.mediaitems.readonly`
2. **Implement Session Flow**: Replace direct API calls with session-based picking
3. **Update UI**: Remove custom photo browsing UI, redirect to Google's picker
4. **Handle Polling**: Implement session polling mechanism
5. **Test Before Deadline**: Ensure migration complete before March 31, 2025

## Open Questions

- Specific rate limits for Picker API vs Library API
- Long-term storage strategies for selected media references
- Best practices for handling picker URI on mobile web vs desktop

---

**Sources**:
- [Google Photos Picker API Documentation](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Google Photos API Updates Blog](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)
- [Google Photos Authorization Scopes](https://developers.google.com/photos/overview/authorization)
