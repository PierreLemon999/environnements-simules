import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Helper: get an admin JWT token from the backend
async function getAdminToken(request: any): Promise<string | null> {
  try {
    const response = await request.post('http://localhost:3001/api/auth/google', {
      data: {
        googleToken: 'mock-google-token',
        email: 'marie.laurent@lemonlearning.com',
        name: 'Marie Laurent',
        googleId: 'google-marie-001'
      }
    });
    const body = await response.json();
    return body.data?.token ?? null;
  } catch {
    return null;
  }
}

// Helper: login as admin by calling the backend API directly and injecting the token
async function loginAsAdmin(page) {
  const token = await getAdminToken(page.request);

  if (!token) {
    // Fallback: navigate to login page and let it handle
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    return null;
  }

  // Navigate to login first to set the origin
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Inject token into localStorage
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);

  // Navigate to admin
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  return token;
}

// Helper: login as client
async function loginAsClient(page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill credentials
  await page.locator('input[type="email"], input[placeholder*="email"]').fill('sophie.martin@acme.com');
  await page.locator('input[type="password"]').fill('demo1234');

  // Submit
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  await page.waitForTimeout(1500);
}

// Helper: make an authenticated API call
async function apiGet(request: any, path: string, token: string) {
  const response = await request.get(`http://localhost:3001/api${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

test.describe('Screenshot all pages', () => {

  test('01 - Login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png`, fullPage: true });
  });

  test('02 - Login page - Form filled', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Fill some sample data to show the form in use
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('sophie.martin@acme.com');
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png`, fullPage: true });
  });

  test('03 - Login page - Error state', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Try to submit with wrong credentials
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('wrong@email.com');
      await passwordInput.fill('wrongpassword');
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-login-error.png`, fullPage: true });
  });

  test('04 - Admin Dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-dashboard.png`, fullPage: true });
  });

  test('05 - Admin Dashboard - Sidebar collapsed', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Hover over the sidebar to reveal the floating collapse button
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible()) {
      // Hover over the middle of the sidebar to trigger onmouseenter
      await sidebar.hover({ position: { x: 100, y: 300 } });
      await page.waitForTimeout(500);
    }
    // Click the floating collapse button (title="Réduire")
    const collapseBtn = page.locator('button[title="Réduire"]');
    if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-dashboard-collapsed.png`, fullPage: true });
  });

  test('06 - Projects list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/projects');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-projects.png`, fullPage: true });
  });

  test('07 - Project detail', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/projects');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Click first project
    const projectLink = page.locator('a[href*="/admin/projects/"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-project-detail.png`, fullPage: true });
  });

  test('08 - Tree view', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/tree');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-tree.png`, fullPage: true });
  });

  test('09 - Analytics', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-analytics.png`, fullPage: true });
  });

  test('10 - Invitations', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/invitations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-invitations.png`, fullPage: true });
  });

  test('11 - Users', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-users.png`, fullPage: true });
  });

  test('12 - Obfuscation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-obfuscation.png`, fullPage: true });
  });

  test('13 - Update requests', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/update-requests');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-update-requests.png`, fullPage: true });
  });

  test('14 - Command palette', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Open command palette with Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-command-palette.png`, fullPage: true });
  });

  test('15 - Page editor', async ({ page }) => {
    const token = await loginAsAdmin(page);
    if (!token) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/15-editor.png`, fullPage: true });
      return;
    }
    // Get a page ID from the API using authenticated requests
    try {
      const projectsBody = await apiGet(page.request, '/projects', token);
      const firstProject = projectsBody.data?.[0];
      if (firstProject) {
        const detailBody = await apiGet(page.request, `/projects/${firstProject.id}`, token);
        const activeVersion = detailBody.data?.versions?.find((v: any) => v.status === 'active') ?? detailBody.data?.versions?.[0];
        if (activeVersion) {
          const pagesBody = await apiGet(page.request, `/versions/${activeVersion.id}/pages`, token);
          const firstPage = pagesBody.data?.[0];
          if (firstPage) {
            await page.goto(`/admin/editor/${firstPage.id}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
          }
        }
      }
    } catch (err) {
      console.error('Failed to get page ID for editor test:', err);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-editor.png`, fullPage: true });
  });

  test('16 - Demo viewer', async ({ page }) => {
    // Demo viewer is public — but we need auth to get the subdomain from API
    const token = await getAdminToken(page.request);
    let subdomain = 'salesforce'; // fallback to known seed subdomain
    if (token) {
      try {
        const projectsBody = await apiGet(page.request, '/projects', token);
        const firstProject = projectsBody.data?.[0];
        if (firstProject?.subdomain) {
          subdomain = firstProject.subdomain;
        }
      } catch {}
    }
    await page.goto(`/demo/${subdomain}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-demo-viewer.png`, fullPage: true });
  });

  test('17 - Commercial viewer', async ({ page }) => {
    // View/commercial viewer is public — but we need auth to get the subdomain from API
    const token = await getAdminToken(page.request);
    let subdomain = 'salesforce'; // fallback to known seed subdomain
    if (token) {
      try {
        const projectsBody = await apiGet(page.request, '/projects', token);
        const firstProject = projectsBody.data?.[0];
        if (firstProject?.subdomain) {
          subdomain = firstProject.subdomain;
        }
      } catch {}
    }
    await page.goto(`/view/${subdomain}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/17-commercial-viewer.png`, fullPage: true });
  });

});
