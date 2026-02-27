/**
 * Demo serving service - orchestrates serving a demo page.
 * Finds the project, version, and page, then applies obfuscation,
 * link rewriting, and tag manager injection.
 */

import fs from 'fs';
import path from 'path';
import { db, dataDir } from '../db/index.js';
import { projects, versions, pages, obfuscationRules, tagManagerConfig } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { applyObfuscation } from './obfuscation.js';
import { rewriteLinks, type PageInfo } from './link-rewriter.js';

export interface DemoPageResult {
  html: string;
  page: {
    id: string;
    title: string;
    urlPath: string;
  };
  project: {
    id: string;
    name: string;
    subdomain: string;
  };
}

/**
 * Serves a demo page by subdomain and path.
 * Orchestrates: find project -> find active version -> find page -> read file
 *   -> apply obfuscation -> rewrite links -> inject tag manager
 */
export async function serveDemoPage(
  subdomain: string,
  requestPath: string
): Promise<DemoPageResult> {
  // 1. Find project by subdomain
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.subdomain, subdomain))
    .get();

  if (!project) {
    throw new NotFoundError(`Project with subdomain "${subdomain}" not found`);
  }

  // 2. Find the most recent active version for this project
  const version = await db
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, project.id), eq(versions.status, 'active')))
    .orderBy(desc(versions.createdAt))
    .get();

  if (!version) {
    throw new NotFoundError(`No active version found for project "${project.name}"`);
  }

  // 3. Find the page matching the request path
  // Normalize the path: remove query string, hash, and leading/trailing slashes
  const normalizedPath = requestPath.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');

  let page;

  if (normalizedPath) {
    page = await db
      .select()
      .from(pages)
      .where(and(eq(pages.versionId, version.id), eq(pages.urlPath, normalizedPath)))
      .get();
  }

  // Fallback: try to find page by synthetic URL (fingerprint-based SPA pages)
  if (!page && normalizedPath.includes('__state/')) {
    page = await db
      .select()
      .from(pages)
      .where(and(eq(pages.versionId, version.id), eq(pages.syntheticUrl, normalizedPath)))
      .get();
  }

  // If no path specified or 'index' not found, try common start pages then fall back to first page
  if (!page) {
    for (const fallback of ['index', 'home', 'dashboard']) {
      page = await db
        .select()
        .from(pages)
        .where(and(eq(pages.versionId, version.id), eq(pages.urlPath, fallback)))
        .get();
      if (page) break;
    }
  }

  // Last resort: serve the first available page
  if (!page) {
    page = await db
      .select()
      .from(pages)
      .where(eq(pages.versionId, version.id))
      .limit(1)
      .get();
  }

  if (!page) {
    throw new NotFoundError(
      `No pages found in version "${version.name}"`
    );
  }

  // 4. Read the HTML file
  const filePath = path.join(dataDir, page.filePath);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError(`HTML file not found on disk: ${page.filePath}`);
  }
  let html = fs.readFileSync(filePath, 'utf-8');

  // 5. Apply obfuscation rules
  const rules = await db
    .select()
    .from(obfuscationRules)
    .where(and(eq(obfuscationRules.projectId, project.id), eq(obfuscationRules.isActive, 1)))
    .all();

  if (rules.length > 0) {
    html = applyObfuscation(html, rules);
  }

  // 6. Rewrite internal links
  const allPages = await db
    .select({
      id: pages.id,
      urlSource: pages.urlSource,
      urlPath: pages.urlPath,
      syntheticUrl: pages.syntheticUrl,
    })
    .from(pages)
    .where(eq(pages.versionId, version.id))
    .all();

  const pageInfos: PageInfo[] = allPages.map((p) => ({
    id: p.id,
    urlSource: p.urlSource,
    urlPath: p.urlPath,
    syntheticUrl: p.syntheticUrl ?? undefined,
  }));

  html = rewriteLinks(html, pageInfos, subdomain, normalizedPath);

  // 7. Strip <base> tags (they break link rewriting in the demo iframe)
  html = html.replace(/<base\s[^>]*>/gi, '');

  // 8. Inject navigation interceptor for iframe embedding
  // Catches clicks on rewritten /demo/ links and notifies the parent frame
  const navScript = `<script>(function(){document.addEventListener("click",function(e){var a=e.target;while(a&&a.tagName!=="A")a=a.parentElement;if(a&&a.getAttribute("href")&&a.getAttribute("href").indexOf("/demo/")===0){e.preventDefault();if(window.parent!==window){window.parent.postMessage({type:"DEMO_NAVIGATE",href:a.getAttribute("href")},"*")}else{window.location.href=a.getAttribute("href")}}},true)})();</script>`;
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${navScript}\n</body>`);
  } else {
    html += `\n${navScript}`;
  }

  // 9. Inject tag manager script if configured
  const tagConfig = await db
    .select()
    .from(tagManagerConfig)
    .where(and(eq(tagManagerConfig.projectId, project.id), eq(tagManagerConfig.isActive, 1)))
    .get();

  if (tagConfig) {
    const scriptTag = `<script src="${tagConfig.scriptUrl}"${tagConfig.configJson ? ` data-config='${tagConfig.configJson}'` : ''}></script>`;
    // Inject before closing </body> tag, or at the end of the document
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      html += `\n${scriptTag}`;
    }
  }

  return {
    html,
    page: {
      id: page.id,
      title: page.title,
      urlPath: page.urlPath,
    },
    project: {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
    },
  };
}

/**
 * Custom error class for "not found" scenarios in demo serving.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
