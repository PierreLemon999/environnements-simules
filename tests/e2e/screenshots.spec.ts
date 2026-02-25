import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');

// Helper: login as admin by calling the backend API directly and injecting the token
async function loginAsAdmin(page) {
  // Call backend API directly to get a valid JWT token
  const response = await page.request.post('http://localhost:3001/api/auth/google', {
    data: {
      googleToken: 'mock-google-token',
      email: 'marie.laurent@lemonlearning.com',
      name: 'Marie Laurent',
      googleId: 'google-marie-001'
    }
  });

  const body = await response.json();
  const token = body.data?.token;

  if (!token) {
    // Fallback: navigate to login page and let it handle
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    return;
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
    // Try to collapse sidebar
    const collapseBtn = page.locator('[aria-label*="collapse"], [aria-label*="Réduire"], button:has(.lucide-panel-left-close), button:has(.lucide-chevrons-left)');
    if (await collapseBtn.isVisible()) await collapseBtn.click();
    await page.waitForTimeout(500);
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

});
