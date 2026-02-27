/**
 * Link rewriter service - rewrites internal links in HTML to point to
 * the demo serving route instead of the original URLs.
 */

export interface PageInfo {
  id: string;
  urlSource: string;
  urlPath: string;
}

/**
 * Rewrites links in HTML content so that internal links (matching captured pages)
 * point to the demo serving route /demo/:subdomain/path.
 *
 * Handles: <a href>, <form action>, and other common link attributes.
 */
export function rewriteLinks(
  html: string,
  pages: PageInfo[],
  subdomain: string,
  basePath: string
): string {
  let result = html;

  // Build a map of original URLs to their rewritten paths
  const urlMap = new Map<string, string>();
  for (const page of pages) {
    // Map the full source URL to the demo path
    urlMap.set(page.urlSource, `/demo/${subdomain}/${page.urlPath}`);

    // Also try to match just the pathname portion
    try {
      const parsed = new URL(page.urlSource);
      urlMap.set(parsed.pathname, `/demo/${subdomain}/${page.urlPath}`);
      // Include with query string as well
      if (parsed.search) {
        urlMap.set(parsed.pathname + parsed.search, `/demo/${subdomain}/${page.urlPath}`);
      }
    } catch {
      // If URL parsing fails, skip pathname matching
    }
  }

  // Rewrite href attributes: <a href="...">, <area href="...">
  result = result.replace(
    /(href\s*=\s*["'])([^"']*)(["'])/gi,
    (_match, prefix, url, suffix) => {
      const rewritten = findRewrittenUrl(url, urlMap);
      if (rewritten) {
        return `${prefix}${rewritten}${suffix}`;
      }
      return `${prefix}${url}${suffix}`;
    }
  );

  // Rewrite form actions: <form action="...">
  result = result.replace(
    /(action\s*=\s*["'])([^"']*)(["'])/gi,
    (_match, prefix, url, suffix) => {
      const rewritten = findRewrittenUrl(url, urlMap);
      if (rewritten) {
        return `${prefix}${rewritten}${suffix}`;
      }
      return `${prefix}${url}${suffix}`;
    }
  );

  return result;
}

/**
 * Tries to find a matching rewritten URL from the map.
 * Handles absolute URLs, relative paths, and query string variations.
 */
function findRewrittenUrl(originalUrl: string, urlMap: Map<string, string>): string | null {
  // Direct match
  if (urlMap.has(originalUrl)) {
    return urlMap.get(originalUrl)!;
  }

  // Try without trailing slash
  const withoutTrailingSlash = originalUrl.replace(/\/$/, '');
  if (urlMap.has(withoutTrailingSlash)) {
    return urlMap.get(withoutTrailingSlash)!;
  }

  // Try with trailing slash
  const withTrailingSlash = originalUrl + '/';
  if (urlMap.has(withTrailingSlash)) {
    return urlMap.get(withTrailingSlash)!;
  }

  // Try to match just the pathname (strip query + hash)
  try {
    // Handle both absolute and relative URLs
    const url = originalUrl.startsWith('http')
      ? new URL(originalUrl)
      : new URL(originalUrl, 'http://placeholder.local');
    if (urlMap.has(url.pathname)) {
      return urlMap.get(url.pathname)!;
    }
  } catch {
    // Not a parseable URL
  }

  return null;
}
