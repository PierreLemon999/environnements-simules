/**
 * Demo serving service - orchestrates serving a demo page.
 * Finds the project, version, and page, then applies obfuscation,
 * link rewriting, and tag manager injection.
 */

import fs from 'fs';
import path from 'path';
import { db, dataDir } from '../db/index.js';
import { projects, versions, pages, obfuscationRules, tagManagerConfig } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
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

  // 2. Find the active version for this project
  const version = await db
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, project.id), eq(versions.status, 'active')))
    .get();

  if (!version) {
    throw new NotFoundError(`No active version found for project "${project.name}"`);
  }

  // 3. Find the page matching the request path
  // Normalize the path: remove leading/trailing slashes
  const normalizedPath = requestPath.replace(/^\/+|\/+$/g, '') || 'index';

  const page = await db
    .select()
    .from(pages)
    .where(and(eq(pages.versionId, version.id), eq(pages.urlPath, normalizedPath)))
    .get();

  if (!page) {
    throw new NotFoundError(
      `Page "${normalizedPath}" not found in version "${version.name}"`
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
    })
    .from(pages)
    .where(eq(pages.versionId, version.id))
    .all();

  const pageInfos: PageInfo[] = allPages.map((p) => ({
    id: p.id,
    urlSource: p.urlSource,
    urlPath: p.urlPath,
  }));

  html = rewriteLinks(html, pageInfos, subdomain, normalizedPath);

  // 7. Inject tag manager script if configured
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
