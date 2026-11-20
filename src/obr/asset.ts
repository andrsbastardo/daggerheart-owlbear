/**
 * Resolve a path in `public/` against the deployed base URL.
 *
 * The extension may be hosted at a sub-path (GitHub Pages project sites serve
 * from /<repo>/), so hardcoding a leading "/" would 404 there. Owlbear also
 * needs absolute URLs for popovers and embeds, since it loads them from its
 * own page rather than ours.
 */
export function asset(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, location.origin))
    .toString();
}
