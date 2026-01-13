import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint Configuration for Next.js 16+ with Server Actions
 *
 * IMPORTANT NOTE: Cache Revalidation in Server Actions
 * =====================================================
 *
 * ESLint cannot currently detect runtime issues related to calling
 * revalidatePath() or revalidateTag() from Server Actions during the
 * render phase. This is a runtime error that depends on the calling context.
 *
 * ❌ Runtime Error Pattern (cannot be caught by ESLint):
 * ```typescript
 * // app/actions/data.ts
 * export async function getData() {
 *   const data = await fetchData();
 *   revalidatePath('/page'); // ERROR when called from Server Component
 *   return data;
 * }
 *
 * // app/page.tsx (Server Component)
 * export default async function Page() {
 *   const data = await getData(); // Causes error!
 *   return <div>{data}</div>;
 * }
 * ```
 *
 * ✅ Correct Pattern:
 * - Data-fetching Server Actions: NO revalidatePath/revalidateTag
 * - Mutation Server Actions: YES revalidatePath/revalidateTag (Client Component only)
 *
 * See CODE_REVIEW_CHECKLIST.md for detailed guidelines.
 * See research/docs/2026-01-03-cache-revalidation-decision.md for architecture decision.
 */

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
