/**
 * Io's sealed-return copy. Keep every runtime consumer pointed here so a
 * wording adjustment lands in the served scene, memory surfaces, and reveal
 * beats together.
 *
 * Kept as `.ts` (not `.js`) so `typecheck:aftersign` — whose tsconfig has
 * `include: ["src"]` and no `allowJs` — can see this module and its `.ts`
 * importers can resolve it under strict tsc. The `.js` import specifiers
 * used elsewhere in the tree keep working under `moduleResolution: Bundler`
 * (rewrites `.js` → `.ts` at resolve time). Do not rename back to `.js`:
 * that reintroduces the exact failure mode Soren blocked on PR #1795 and
 * again on PR #1862 (routeRiskRenderSignature.ts's header comment documents
 * the same reasoning for the sibling file).
 */
export const IO_SEALED_RETURN_LINE =
  "You came back. So did the blue seal, unbroken. That makes two reasons to trust you.";

export const IO_SEALED_RETURN_BEATS = IO_SEALED_RETURN_LINE.split(/(?<=\.)\s+/);
