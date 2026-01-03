import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extended Session interface with Google Photos access token
   */
  interface Session {
    /** Google access token for API calls */
    accessToken?: string;
    /** Error state if token refresh failed */
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  /**
   * Extended JWT interface with token management fields
   */
  interface JWT {
    /** Google access token */
    accessToken?: string;
    /** Google refresh token for obtaining new access tokens */
    refreshToken?: string;
    /** Unix timestamp (ms) when access token expires */
    accessTokenExpires?: number;
    /** Error state if token refresh failed */
    error?: "RefreshAccessTokenError";
  }
}
