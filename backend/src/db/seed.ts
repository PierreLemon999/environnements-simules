/**
 * Database seed script.
 * Creates realistic demo data for the Environnements Simules platform.
 * Run with: npx tsx src/db/seed.ts
 */

import { db, sqlite } from './index.js';
import {
  users,
  projects,
  versions,
  pages,
  pageLinks,
  guides,
  guidePages,
  obfuscationRules,
  demoAssignments,
  sessions,
  sessionEvents,
  updateRequests,
  captureJobs,
  interestZones,
  tagManagerConfig,
} from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { dataDir } from './index.js';
import { getToolLogo } from './tool-logos.js';

// ── Helper Functions ─────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoFuture(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function main() {
  console.log('Seeding database...');

  // Create tables using raw SQL (Drizzle push equivalent)
  console.log('Creating tables...');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'client',
      company TEXT,
      avatar_url TEXT,
      google_id TEXT,
      language TEXT NOT NULL DEFAULT 'fr',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      subdomain TEXT NOT NULL UNIQUE,
      description TEXT,
      logo_url TEXT,
      icon_color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      language TEXT NOT NULL DEFAULT 'fr',
      author_id TEXT NOT NULL REFERENCES users(id),
      capture_strategy TEXT NOT NULL DEFAULT 'url_based',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
      url_source TEXT NOT NULL,
      url_path TEXT NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      capture_mode TEXT NOT NULL DEFAULT 'free',
      thumbnail_path TEXT,
      health_status TEXT NOT NULL DEFAULT 'ok',
      page_type TEXT NOT NULL DEFAULT 'page',
      parent_page_id TEXT,
      dom_fingerprint TEXT,
      synthetic_url TEXT,
      capture_timing_ms INTEGER,
      state_index INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_links (
      id TEXT PRIMARY KEY,
      source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      original_href TEXT NOT NULL,
      rewritten_href TEXT
    );

    CREATE TABLE IF NOT EXISTS guides (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guide_pages (
      id TEXT PRIMARY KEY,
      guide_id TEXT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS obfuscation_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      search_term TEXT NOT NULL,
      replace_term TEXT NOT NULL,
      is_regex INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS demo_assignments (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      assignment_id TEXT REFERENCES demo_assignments(id),
      version_id TEXT NOT NULL REFERENCES versions(id),
      ip_address TEXT,
      user_agent TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES pages(id),
      event_type TEXT NOT NULL,
      metadata TEXT,
      timestamp TEXT NOT NULL,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS update_requests (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      requested_by TEXT NOT NULL REFERENCES users(id),
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS capture_jobs (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      target_page_count INTEGER NOT NULL,
      pages_captured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      config TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS interest_zones (
      id TEXT PRIMARY KEY,
      capture_job_id TEXT NOT NULL REFERENCES capture_jobs(id) ON DELETE CASCADE,
      url_pattern TEXT NOT NULL,
      depth_multiplier REAL NOT NULL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS tag_manager_config (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      script_url TEXT NOT NULL,
      config_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS page_transitions (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
      source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL,
      trigger_selector TEXT,
      trigger_text TEXT,
      loading_time_ms INTEGER,
      had_loading_indicator INTEGER NOT NULL DEFAULT 0,
      loading_indicator_type TEXT,
      capture_mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Clear existing data
  console.log('Clearing existing data...');
  sqlite.exec(`
    DELETE FROM page_transitions;
    DELETE FROM session_events;
    DELETE FROM sessions;
    DELETE FROM demo_assignments;
    DELETE FROM guide_pages;
    DELETE FROM guides;
    DELETE FROM page_links;
    DELETE FROM update_requests;
    DELETE FROM pages;
    DELETE FROM interest_zones;
    DELETE FROM capture_jobs;
    DELETE FROM obfuscation_rules;
    DELETE FROM tag_manager_config;
    DELETE FROM versions;
    DELETE FROM projects;
    DELETE FROM users;
  `);

  // ── Users ──────────────────────────────────────────────────────────────────

  console.log('Creating users...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const clientPassword = await bcrypt.hash('client123', 10);

  const userMarie = {
    id: uuidv4(),
    name: 'Marie Laurent',
    email: 'marie.laurent@lemonlearning.com',
    passwordHash: null,
    role: 'admin' as const,
    avatarUrl: null,
    googleId: 'google-marie-001',
    language: 'fr',
    createdAt: isoDaysAgo(120),
  };

  const userThomas = {
    id: uuidv4(),
    name: 'Thomas Dupont',
    email: 'thomas.dupont@lemonlearning.com',
    passwordHash: null,
    role: 'admin' as const,
    avatarUrl: null,
    googleId: 'google-thomas-002',
    language: 'fr',
    createdAt: isoDaysAgo(90),
  };

  const userPierre = {
    id: uuidv4(),
    name: 'Pierre Leclerc',
    email: 'pierre.leclerc@lemonlearning.com',
    passwordHash: null,
    role: 'admin' as const,
    avatarUrl: null,
    googleId: 'google-pierre-003',
    language: 'fr',
    createdAt: isoDaysAgo(60),
  };

  const userClient1 = {
    id: uuidv4(),
    name: 'Sophie Martin',
    email: 'sophie.martin@acme-corp.fr',
    passwordHash: clientPassword,
    role: 'client' as const,
    company: 'Acme Corp',
    avatarUrl: null,
    googleId: null,
    language: 'fr',
    createdAt: isoDaysAgo(30),
  };

  const userClient2 = {
    id: uuidv4(),
    name: 'Jean-Marc Dubois',
    email: 'jm.dubois@techvision.fr',
    passwordHash: clientPassword,
    role: 'client' as const,
    company: 'TechVision',
    avatarUrl: null,
    googleId: null,
    language: 'fr',
    createdAt: isoDaysAgo(15),
  };

  await db.insert(users).values([userMarie, userThomas, userPierre, userClient1, userClient2]);

  // ── Projects ───────────────────────────────────────────────────────────────

  console.log('Creating projects...');

  const projectData = [
    {
      id: uuidv4(),
      name: 'Salesforce CRM',
      toolName: 'Salesforce',
      subdomain: 'salesforce',
      description: 'Environnement de demo Salesforce CRM - gestion des opportunites et contacts',
      logoUrl: getToolLogo('Salesforce'),
      iconColor: '#00A1E0',
      createdAt: isoDaysAgo(100),
      updatedAt: isoDaysAgo(5),
    },
    {
      id: uuidv4(),
      name: 'SAP SuccessFactors',
      toolName: 'SAP SuccessFactors',
      subdomain: 'sap-sf',
      description: 'Environnement de demo SAP SuccessFactors - gestion des talents et RH',
      logoUrl: getToolLogo('SAP SuccessFactors'),
      iconColor: '#0070F2',
      createdAt: isoDaysAgo(95),
      updatedAt: isoDaysAgo(10),
    },
    {
      id: uuidv4(),
      name: 'Workday HCM',
      toolName: 'Workday',
      subdomain: 'workday',
      description: 'Environnement de demo Workday - gestion du capital humain',
      logoUrl: getToolLogo('Workday'),
      iconColor: '#F5A623',
      createdAt: isoDaysAgo(80),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: uuidv4(),
      name: 'ServiceNow ITSM',
      toolName: 'ServiceNow',
      subdomain: 'servicenow',
      description: 'Environnement de demo ServiceNow - gestion des incidents et services IT',
      logoUrl: getToolLogo('ServiceNow'),
      iconColor: '#81B5A1',
      createdAt: isoDaysAgo(70),
      updatedAt: isoDaysAgo(7),
    },
    {
      id: uuidv4(),
      name: 'HubSpot Marketing',
      toolName: 'HubSpot',
      subdomain: 'hubspot',
      description: 'Environnement de demo HubSpot - automatisation marketing et CRM',
      logoUrl: getToolLogo('HubSpot'),
      iconColor: '#FF7A59',
      createdAt: isoDaysAgo(50),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: uuidv4(),
      name: 'Zendesk Support',
      toolName: 'Zendesk',
      subdomain: 'zendesk',
      description: 'Environnement de demo Zendesk - support client et ticketing',
      logoUrl: getToolLogo('Zendesk'),
      iconColor: '#03363D',
      createdAt: isoDaysAgo(40),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: uuidv4(),
      name: 'Oracle Cloud ERP',
      toolName: 'Oracle',
      subdomain: 'oracle-erp',
      description: 'Environnement de demo Oracle Cloud ERP - gestion financiere et achats',
      logoUrl: getToolLogo('Oracle'),
      iconColor: '#C74634',
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(4),
    },
  ];

  await db.insert(projects).values(projectData);

  // ── Versions ───────────────────────────────────────────────────────────────

  console.log('Creating versions...');

  const allVersions: Array<{
    id: string;
    projectId: string;
    name: string;
    status: 'active' | 'test' | 'deprecated';
    language: string;
    authorId: string;
    createdAt: string;
  }> = [];

  // Helper to generate versions per project
  const versionConfigs = [
    // Salesforce: 3 versions
    [
      { name: 'Lightning v2024.1', status: 'active' as const, lang: 'fr', author: userMarie },
      { name: 'Lightning v2023.2', status: 'deprecated' as const, lang: 'fr', author: userThomas },
      { name: 'Lightning EN', status: 'active' as const, lang: 'en', author: userMarie },
    ],
    // SAP SF: 2 versions
    [
      { name: 'Q4 2024', status: 'active' as const, lang: 'fr', author: userThomas },
      { name: 'Q2 2024 Test', status: 'test' as const, lang: 'fr', author: userPierre },
    ],
    // Workday: 3 versions
    [
      { name: 'Release 2024.R2', status: 'active' as const, lang: 'fr', author: userPierre },
      { name: 'Release 2024.R1', status: 'deprecated' as const, lang: 'fr', author: userPierre },
      { name: 'Release 2024.R2 DE', status: 'test' as const, lang: 'de', author: userMarie },
    ],
    // ServiceNow: 2 versions
    [
      { name: 'Vancouver', status: 'active' as const, lang: 'fr', author: userMarie },
      { name: 'Utah Legacy', status: 'deprecated' as const, lang: 'fr', author: userThomas },
    ],
    // HubSpot: 2 versions
    [
      { name: 'Marketing Pro 2024', status: 'active' as const, lang: 'fr', author: userThomas },
      { name: 'CRM Free Tier', status: 'test' as const, lang: 'fr', author: userPierre },
    ],
    // Zendesk: 2 versions
    [
      { name: 'Suite Enterprise', status: 'active' as const, lang: 'fr', author: userMarie },
      { name: 'Suite Team', status: 'test' as const, lang: 'en', author: userThomas },
    ],
    // Oracle: 3 versions
    [
      { name: 'Cloud 24C', status: 'active' as const, lang: 'fr', author: userPierre },
      { name: 'Cloud 24B', status: 'deprecated' as const, lang: 'fr', author: userMarie },
      { name: 'Cloud 24C EN', status: 'test' as const, lang: 'en', author: userPierre },
    ],
  ];

  for (let i = 0; i < projectData.length; i++) {
    const project = projectData[i];
    const configs = versionConfigs[i];

    for (let j = 0; j < configs.length; j++) {
      const vc = configs[j];
      const version = {
        id: uuidv4(),
        projectId: project.id,
        name: vc.name,
        status: vc.status,
        language: vc.lang,
        authorId: vc.author.id,
        createdAt: isoDaysAgo(90 - i * 10 - j * 5),
      };
      allVersions.push(version);
    }
  }

  await db.insert(versions).values(allVersions);

  // ── Pages (with actual HTML files) ──────────────────────────────────────────

  console.log('Creating pages...');

  // Helper to generate a simple demo HTML page
  function generateDemoHtml(title: string, tool: string, urlPath: string, links: string[]): string {
    const linkHtml = links.map((l) => `<li><a href="/${l}">${l}</a></li>`).join('\n          ');
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${tool}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .header { background: #1a1a2e; color: white; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
    .header h1 { font-size: 16px; font-weight: 600; }
    .header .tool-badge { background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 6px; font-size: 12px; }
    .sidebar { width: 240px; background: white; border-right: 1px solid #e5e7eb; position: fixed; top: 48px; left: 0; bottom: 0; padding: 16px 0; }
    .sidebar a { display: block; padding: 8px 20px; color: #6b7280; text-decoration: none; font-size: 14px; }
    .sidebar a:hover { background: #f3f4f6; color: #111827; }
    .sidebar a.active { color: #2563eb; background: #eff6ff; border-left: 3px solid #2563eb; }
    .main { margin-left: 240px; margin-top: 48px; padding: 32px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .card h2 { font-size: 18px; margin-bottom: 12px; color: #111827; }
    .card p { color: #6b7280; font-size: 14px; line-height: 1.6; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .stat .value { font-size: 28px; font-weight: 700; color: #111827; }
    .stat .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; border-bottom: 1px solid #e5e7eb; }
    td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <header class="header">
    <h1>${tool}</h1>
    <span class="tool-badge">${title}</span>
  </header>
  <nav class="sidebar">
    ${links.map((l) => `<a href="/${l}" class="${l === urlPath ? 'active' : ''}">${l.split('/').pop() || 'Accueil'}</a>`).join('\n    ')}
  </nav>
  <div class="main">
    <div class="stats">
      <div class="stat"><div class="value">${Math.floor(Math.random() * 500) + 100}</div><div class="label">Total</div></div>
      <div class="stat"><div class="value">${Math.floor(Math.random() * 50) + 10}</div><div class="label">En cours</div></div>
      <div class="stat"><div class="value">${Math.floor(Math.random() * 100)}%</div><div class="label">Progression</div></div>
    </div>
    <div class="card">
      <h2>${title}</h2>
      <p>Ceci est une page de demonstration pour ${tool}. Elle simule l'interface de l'application reelle avec des donnees fictives. Vous pouvez naviguer entre les pages via le menu lateral.</p>
    </div>
    <div class="card">
      <h2>Donnees recentes</h2>
      <table>
        <thead><tr><th>Nom</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>
          <tr><td>Acme Corporation</td><td><span class="badge badge-green">Actif</span></td><td>25 feb. 2026</td></tr>
          <tr><td>TechCorp Inc.</td><td><span class="badge badge-blue">En cours</span></td><td>23 feb. 2026</td></tr>
          <tr><td>Global Industries</td><td><span class="badge badge-yellow">En attente</span></td><td>20 feb. 2026</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  // Write HTML file to disk and return file path + size
  function writeDemoPage(versionId: string, pageId: string, html: string): { filePath: string; fileSize: number } {
    const relPath = `uploads/${versionId}/${pageId}.html`;
    const fullPath = path.join(dataDir, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, html, 'utf-8');
    return { filePath: relPath, fileSize: Buffer.byteLength(html, 'utf-8') };
  }

  const allPages: Array<{
    id: string;
    versionId: string;
    urlSource: string;
    urlPath: string;
    title: string;
    filePath: string;
    fileSize: number;
    captureMode: 'free' | 'guided' | 'auto';
    thumbnailPath: null;
    healthStatus: 'ok' | 'warning' | 'error';
    createdAt: string;
  }> = [];

  // Salesforce pages (for the first active version)
  const sfVersion = allVersions[0]; // Lightning v2024.1 (active)
  const sfPagePaths = ['home', 'opportunities', 'opportunities/new', 'contacts', 'contacts/detail', 'accounts', 'reports', 'dashboards'];
  const sfPages = [
    { path: 'home', title: 'Accueil Salesforce', url: 'https://acme.lightning.force.com/lightning/page/home' },
    { path: 'opportunities', title: 'Opportunites', url: 'https://acme.lightning.force.com/lightning/o/Opportunity/list' },
    { path: 'opportunities/new', title: 'Nouvelle Opportunite', url: 'https://acme.lightning.force.com/lightning/o/Opportunity/new' },
    { path: 'contacts', title: 'Contacts', url: 'https://acme.lightning.force.com/lightning/o/Contact/list' },
    { path: 'contacts/detail', title: 'Fiche Contact', url: 'https://acme.lightning.force.com/lightning/r/Contact/001XX000003DGb2/view' },
    { path: 'accounts', title: 'Comptes', url: 'https://acme.lightning.force.com/lightning/o/Account/list' },
    { path: 'reports', title: 'Rapports', url: 'https://acme.lightning.force.com/lightning/o/Report/home' },
    { path: 'dashboards', title: 'Tableaux de bord', url: 'https://acme.lightning.force.com/lightning/o/Dashboard/home' },
  ];

  for (const p of sfPages) {
    const id = uuidv4();
    const html = generateDemoHtml(p.title, 'Salesforce', p.path, sfPagePaths);
    const { filePath, fileSize } = writeDemoPage(sfVersion.id, id, html);
    allPages.push({
      id,
      versionId: sfVersion.id,
      urlSource: p.url,
      urlPath: p.path,
      title: p.title,
      filePath,
      fileSize,
      captureMode: 'free',
      thumbnailPath: null,
      healthStatus: 'ok',
      createdAt: isoDaysAgo(Math.floor(Math.random() * 30) + 5),
    });
  }

  // ServiceNow pages (for Vancouver version)
  const snVersion = allVersions.find((v) => v.name === 'Vancouver')!;
  const snPagePaths = ['home', 'incidents', 'incidents/new', 'changes', 'knowledge'];
  const snPages = [
    { path: 'home', title: 'Portail ServiceNow', url: 'https://demo.service-now.com/now/nav/ui/classic/params/target/%24pa_dashboard.do' },
    { path: 'incidents', title: 'Liste des incidents', url: 'https://demo.service-now.com/now/nav/ui/classic/params/target/incident_list.do' },
    { path: 'incidents/new', title: 'Nouvel incident', url: 'https://demo.service-now.com/now/nav/ui/classic/params/target/incident.do' },
    { path: 'changes', title: 'Demandes de changement', url: 'https://demo.service-now.com/now/nav/ui/classic/params/target/change_request_list.do' },
    { path: 'knowledge', title: 'Base de connaissances', url: 'https://demo.service-now.com/now/nav/ui/classic/params/target/kb_knowledge_list.do' },
  ];

  for (const p of snPages) {
    const id = uuidv4();
    const html = generateDemoHtml(p.title, 'ServiceNow', p.path, snPagePaths);
    const { filePath, fileSize } = writeDemoPage(snVersion.id, id, html);
    allPages.push({
      id,
      versionId: snVersion.id,
      urlSource: p.url,
      urlPath: p.path,
      title: p.title,
      filePath,
      fileSize,
      captureMode: 'auto',
      thumbnailPath: null,
      healthStatus: 'ok',
      createdAt: isoDaysAgo(Math.floor(Math.random() * 20) + 3),
    });
  }

  // HubSpot pages
  const hsVersion = allVersions.find((v) => v.name === 'Marketing Pro 2024')!;
  const hsPagePaths = ['dashboard', 'contacts', 'emails', 'workflows'];
  const hsPages = [
    { path: 'dashboard', title: 'Tableau de bord marketing', url: 'https://app.hubspot.com/reports-dashboard/12345' },
    { path: 'contacts', title: 'Gestion des contacts', url: 'https://app.hubspot.com/contacts/12345/contacts' },
    { path: 'emails', title: 'Campagnes email', url: 'https://app.hubspot.com/email/12345/manage' },
    { path: 'workflows', title: 'Automatisations', url: 'https://app.hubspot.com/workflows/12345' },
  ];

  for (const p of hsPages) {
    const id = uuidv4();
    const html = generateDemoHtml(p.title, 'HubSpot', p.path, hsPagePaths);
    const { filePath, fileSize } = writeDemoPage(hsVersion.id, id, html);
    allPages.push({
      id,
      versionId: hsVersion.id,
      urlSource: p.url,
      urlPath: p.path,
      title: p.title,
      filePath,
      fileSize,
      captureMode: 'guided',
      thumbnailPath: null,
      healthStatus: Math.random() > 0.8 ? 'warning' : 'ok',
      createdAt: isoDaysAgo(Math.floor(Math.random() * 15) + 1),
    });
  }

  await db.insert(pages).values(allPages);

  // ── Obfuscation Rules ──────────────────────────────────────────────────────

  console.log('Creating obfuscation rules...');

  const obfRules = [
    // Salesforce
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: 'Acme Corporation',
      replaceTerm: 'Entreprise Demo',
      isRegex: 0,
      isActive: 1,
      createdAt: isoDaysAgo(50),
    },
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: 'john\\.doe@acme\\.com',
      replaceTerm: 'utilisateur@demo.fr',
      isRegex: 1,
      isActive: 1,
      createdAt: isoDaysAgo(50),
    },
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: '\\b\\d{10}\\b',
      replaceTerm: '01 23 45 67 89',
      isRegex: 1,
      isActive: 1,
      createdAt: isoDaysAgo(45),
    },
    // More Salesforce rules
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: 'Jean Dupont',
      replaceTerm: 'Utilisateur Test',
      isRegex: 0,
      isActive: 1,
      createdAt: isoDaysAgo(42),
    },
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: '45 000 EUR',
      replaceTerm: 'XX XXX EUR',
      isRegex: 0,
      isActive: 1,
      createdAt: isoDaysAgo(40),
    },
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: 'Paris',
      replaceTerm: 'Ville Demo',
      isRegex: 0,
      isActive: 0,
      createdAt: isoDaysAgo(38),
    },
    {
      id: uuidv4(),
      projectId: projectData[0].id,
      searchTerm: '\\b\\d{2}/\\d{2}/\\d{4}\\b',
      replaceTerm: '01/01/2026',
      isRegex: 1,
      isActive: 1,
      createdAt: isoDaysAgo(35),
    },
    // ServiceNow
    {
      id: uuidv4(),
      projectId: projectData[3].id,
      searchTerm: 'TechCorp Inc.',
      replaceTerm: 'Société Démo',
      isRegex: 0,
      isActive: 1,
      createdAt: isoDaysAgo(30),
    },
    // HubSpot
    {
      id: uuidv4(),
      projectId: projectData[4].id,
      searchTerm: 'contact@realclient.com',
      replaceTerm: 'contact@demo.lemonlearning.com',
      isRegex: 0,
      isActive: 1,
      createdAt: isoDaysAgo(20),
    },
  ];

  await db.insert(obfuscationRules).values(obfRules);

  // ── Demo Assignments ───────────────────────────────────────────────────────

  console.log('Creating demo assignments...');

  const assignmentPassword = await bcrypt.hash('DEMO2024', 10);

  const assignments = [
    {
      id: uuidv4(),
      versionId: sfVersion.id,
      userId: userClient1.id,
      accessToken: 'sf-demo-acme-' + uuidv4().substring(0, 8),
      passwordHash: assignmentPassword,
      expiresAt: isoFuture(730),
      createdAt: isoDaysAgo(25),
    },
    {
      id: uuidv4(),
      versionId: snVersion.id,
      userId: userClient2.id,
      accessToken: 'sn-demo-tech-' + uuidv4().substring(0, 8),
      passwordHash: assignmentPassword,
      expiresAt: isoFuture(365),
      createdAt: isoDaysAgo(10),
    },
  ];

  await db.insert(demoAssignments).values(assignments);

  // ── Sessions & Events ──────────────────────────────────────────────────────

  console.log('Creating sessions and events...');

  const sfPageIds = allPages.filter((p) => p.versionId === sfVersion.id).map((p) => p.id);
  const snPageIds = allPages.filter((p) => p.versionId === snVersion.id).map((p) => p.id);

  const allSessions = [];
  const allEvents = [];

  // Session 1: Sophie Martin on Salesforce
  const session1Id = uuidv4();
  allSessions.push({
    id: session1Id,
    userId: userClient1.id,
    assignmentId: assignments[0].id,
    versionId: sfVersion.id,
    ipAddress: '192.168.1.42',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
    startedAt: isoDaysAgo(5).replace(/T.*$/, 'T14:00:00.000Z'),
    endedAt: isoDaysAgo(5).replace(/T.*$/, 'T15:45:00.000Z'),
  });

  // Events for session 1
  for (let i = 0; i < Math.min(sfPageIds.length, 5); i++) {
    allEvents.push({
      id: uuidv4(),
      sessionId: session1Id,
      pageId: sfPageIds[i],
      eventType: 'page_view' as const,
      metadata: JSON.stringify({ referrer: i > 0 ? sfPageIds[i - 1] : null }),
      timestamp: isoDaysAgo(5).replace(/T.*$/, `T14:${(i * 3 + 10).toString().padStart(2, '0')}:00.000Z`),
      durationSeconds: Math.floor(Math.random() * 120) + 15,
    });
  }

  // Session 2: Jean-Marc Dubois on ServiceNow
  const session2Id = uuidv4();
  allSessions.push({
    id: session2Id,
    userId: userClient2.id,
    assignmentId: assignments[1].id,
    versionId: snVersion.id,
    ipAddress: '10.0.0.15',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0',
    startedAt: isoDaysAgo(3).replace(/T.*$/, 'T10:00:00.000Z'),
    endedAt: isoDaysAgo(3).replace(/T.*$/, 'T11:30:00.000Z'),
  });

  for (let i = 0; i < Math.min(snPageIds.length, 4); i++) {
    allEvents.push({
      id: uuidv4(),
      sessionId: session2Id,
      pageId: snPageIds[i],
      eventType: 'page_view' as const,
      metadata: JSON.stringify({ referrer: i > 0 ? snPageIds[i - 1] : null }),
      timestamp: isoDaysAgo(3).replace(/T.*$/, `T10:${(i * 5 + 5).toString().padStart(2, '0')}:00.000Z`),
      durationSeconds: Math.floor(Math.random() * 90) + 20,
    });
  }

  // Session 3: Marie Laurent (admin testing) on Salesforce
  const session3Id = uuidv4();
  allSessions.push({
    id: session3Id,
    userId: userMarie.id,
    assignmentId: null,
    versionId: sfVersion.id,
    ipAddress: '172.16.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    startedAt: isoDaysAgo(1).replace(/T.*$/, 'T16:00:00.000Z'),
    endedAt: isoDaysAgo(1).replace(/T.*$/, 'T17:00:00.000Z'),
  });

  for (let i = 0; i < sfPageIds.length; i++) {
    allEvents.push({
      id: uuidv4(),
      sessionId: session3Id,
      pageId: sfPageIds[i],
      eventType: 'page_view' as const,
      metadata: null,
      timestamp: isoDaysAgo(1).replace(/T.*$/, `T16:${(i * 2 + 5).toString().padStart(2, '0')}:00.000Z`),
      durationSeconds: Math.floor(Math.random() * 60) + 10,
    });
  }

  // Session 4: Anonymous on HubSpot
  const hsPageIds = allPages.filter((p) => p.versionId === hsVersion.id).map((p) => p.id);
  const session4Id = uuidv4();
  allSessions.push({
    id: session4Id,
    userId: null,
    assignmentId: null,
    versionId: hsVersion.id,
    ipAddress: '203.0.113.50',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile',
    startedAt: isoDaysAgo(2),
    endedAt: null, // Still active
  });

  for (let i = 0; i < Math.min(hsPageIds.length, 3); i++) {
    allEvents.push({
      id: uuidv4(),
      sessionId: session4Id,
      pageId: hsPageIds[i],
      eventType: 'page_view' as const,
      metadata: null,
      timestamp: isoDaysAgo(2).replace(/T.*$/, `T09:${(i * 4 + 10).toString().padStart(2, '0')}:00.000Z`),
      durationSeconds: Math.floor(Math.random() * 45) + 10,
    });
  }

  await db.insert(sessions).values(allSessions);
  await db.insert(sessionEvents).values(allEvents);

  // ── Update Requests ────────────────────────────────────────────────────────

  console.log('Creating update requests...');

  const updateReqs = [
    {
      id: uuidv4(),
      pageId: sfPageIds[1], // Opportunities page
      requestedBy: userThomas.id,
      comment: 'Le menu lateral a change avec la derniere mise a jour Salesforce Lightning. Il faut recapturer cette page.',
      status: 'pending' as const,
      createdAt: isoDaysAgo(3),
      resolvedAt: null,
    },
    {
      id: uuidv4(),
      pageId: sfPageIds[4], // Contact detail page
      requestedBy: userMarie.id,
      comment: 'Les champs personnalises ne sont plus visibles apres la mise a jour. A verifier et recapturer si necessaire.',
      status: 'in_progress' as const,
      createdAt: isoDaysAgo(7),
      resolvedAt: null,
    },
    {
      id: uuidv4(),
      pageId: snPageIds[0], // ServiceNow portal
      requestedBy: userPierre.id,
      comment: 'Le tableau de bord a ete mis a jour avec de nouveaux widgets. La capture est obsolete.',
      status: 'done' as const,
      createdAt: isoDaysAgo(15),
      resolvedAt: isoDaysAgo(12),
    },
  ];

  await db.insert(updateRequests).values(updateReqs);

  // ── Capture Jobs ───────────────────────────────────────────────────────────

  console.log('Creating capture jobs...');

  const captureJobData = [
    {
      id: uuidv4(),
      versionId: sfVersion.id,
      mode: 'free' as const,
      targetPageCount: 20,
      pagesCaptured: 8,
      status: 'done' as const,
      config: JSON.stringify({
        blacklist: ['Logout', 'Deconnexion', 'Delete', 'Supprimer'],
        timeout: 30000,
        retryCount: 3,
      }),
      startedAt: isoDaysAgo(40),
      completedAt: isoDaysAgo(39),
    },
    {
      id: uuidv4(),
      versionId: snVersion.id,
      mode: 'auto' as const,
      targetPageCount: 50,
      pagesCaptured: 5,
      status: 'paused' as const,
      config: JSON.stringify({
        blacklist: ['Logout', 'Se deconnecter', 'Delete'],
        timeout: 45000,
        retryCount: 2,
      }),
      startedAt: isoDaysAgo(20),
      completedAt: null,
    },
  ];

  await db.insert(captureJobs).values(captureJobData);

  // ── Interest Zones ─────────────────────────────────────────────────────────

  const zones = [
    {
      id: uuidv4(),
      captureJobId: captureJobData[1].id,
      urlPattern: '/now/nav/ui/classic/params/target/incident*',
      depthMultiplier: 2.0,
    },
    {
      id: uuidv4(),
      captureJobId: captureJobData[1].id,
      urlPattern: '/now/nav/ui/classic/params/target/change_request*',
      depthMultiplier: 1.5,
    },
  ];

  await db.insert(interestZones).values(zones);

  // ── Tag Manager Config ─────────────────────────────────────────────────────

  console.log('Creating tag manager configs...');

  const tagConfigs = [
    {
      id: uuidv4(),
      projectId: projectData[0].id, // Salesforce
      scriptUrl: 'https://cdn.lemonlearning.com/player/v3/lemon.js',
      configJson: JSON.stringify({
        apiKey: 'demo-sf-key-001',
        environment: 'demo',
        locale: 'fr',
      }),
      isActive: 1,
    },
    {
      id: uuidv4(),
      projectId: projectData[3].id, // ServiceNow
      scriptUrl: 'https://cdn.lemonlearning.com/player/v3/lemon.js',
      configJson: JSON.stringify({
        apiKey: 'demo-sn-key-002',
        environment: 'demo',
        locale: 'fr',
      }),
      isActive: 1,
    },
  ];

  await db.insert(tagManagerConfig).values(tagConfigs);

  // ── Guides ─────────────────────────────────────────────────────────────────

  console.log('Creating guides...');

  const guide1Id = uuidv4();
  const guide2Id = uuidv4();

  await db.insert(guides).values([
    {
      id: guide1Id,
      versionId: sfVersion.id,
      name: 'Creer une nouvelle opportunite',
      description: 'Guide pas a pas pour creer et qualifier une opportunite dans Salesforce.',
      createdAt: isoDaysAgo(30),
    },
    {
      id: guide2Id,
      versionId: snVersion.id,
      name: 'Ouvrir un ticket incident',
      description: 'Guide pour creer et suivre un incident dans ServiceNow.',
      createdAt: isoDaysAgo(18),
    },
  ]);

  // Guide pages - link SF pages to guide 1
  const sfGuidePageIds = sfPageIds.slice(0, 3); // home, opportunities, opportunities/new
  await db.insert(guidePages).values(
    sfGuidePageIds.map((pageId, index) => ({
      id: uuidv4(),
      guideId: guide1Id,
      pageId,
      stepOrder: index + 1,
    }))
  );

  // Guide pages - link SN pages to guide 2
  const snGuidePageIds = snPageIds.slice(0, 3); // home, incidents, incidents/new
  await db.insert(guidePages).values(
    snGuidePageIds.map((pageId, index) => ({
      id: uuidv4(),
      guideId: guide2Id,
      pageId,
      stepOrder: index + 1,
    }))
  );

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log('\n--- Seed complete ---');
  console.log(`Users:             5 (3 admins, 2 clients)`);
  console.log(`Projects:          ${projectData.length}`);
  console.log(`Versions:          ${allVersions.length}`);
  console.log(`Pages:             ${allPages.length}`);
  console.log(`Obfuscation rules: ${obfRules.length}`);
  console.log(`Demo assignments:  ${assignments.length}`);
  console.log(`Sessions:          ${allSessions.length}`);
  console.log(`Session events:    ${allEvents.length}`);
  console.log(`Update requests:   ${updateReqs.length}`);
  console.log(`Capture jobs:      ${captureJobData.length}`);
  console.log(`Interest zones:    ${zones.length}`);
  console.log(`Tag manager cfgs:  ${tagConfigs.length}`);
  console.log(`Guides:            2`);
  console.log(`Guide pages:       ${sfGuidePageIds.length + snGuidePageIds.length}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
