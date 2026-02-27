/**
 * One-time migration: add SVG logos to existing projects that don't have one.
 * Run with: npx tsx src/db/add-logos.ts
 */

import { db } from './index.js';
import { projects } from './schema.js';
import { eq, isNull } from 'drizzle-orm';
import { getToolLogo, TOOL_LOGOS } from './tool-logos.js';

async function main() {
  console.log('Adding logos to projects...');

  const allProjects = await db.select().from(projects).all();
  let updated = 0;

  for (const project of allProjects) {
    if (project.logoUrl) {
      console.log(`  ✓ ${project.name} — already has logo`);
      continue;
    }

    const logo = getToolLogo(project.toolName);
    if (logo) {
      await db
        .update(projects)
        .set({ logoUrl: logo })
        .where(eq(projects.id, project.id));
      console.log(`  + ${project.name} — logo added (${project.toolName})`);
      updated++;
    } else {
      console.log(`  - ${project.name} — no logo available for "${project.toolName}"`);
    }
  }

  console.log(`\nDone. Updated ${updated} project(s).`);
  console.log(`Available tool logos: ${Object.keys(TOOL_LOGOS).join(', ')}`);
}

main().catch(console.error);
