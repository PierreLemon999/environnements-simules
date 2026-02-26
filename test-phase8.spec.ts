import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@lemonlearning.com';
const API_BASE = 'http://localhost:3001/api';

async function loginAsAdmin(page) {
  // Get admin token via dev bypass
  const res = await page.request.post(`${API_BASE}/auth/google`, {
    data: { devBypass: true, email: ADMIN_EMAIL, name: 'Admin Test', googleId: 'google-admin-1' }
  });
  const body = await res.json();
  const token = body.data.token;
  const user = body.data.user;

  // Set auth in localStorage before navigating
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, { token, user });
}

test.describe('Phase 8: Obfuscation page', () => {

  test('page loads and displays project selector', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: '/tmp/obfuscation-initial.png', fullPage: true });

    // Check page title
    await expect(page.locator('h1')).toContainText('Obfuscation');

    // Check project selector exists
    const select = page.locator('#project-select, select').first();
    await expect(select).toBeVisible();
  });

  test('tabs work correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');

    // Check both tabs are visible
    const autoTab = page.getByText('Règles auto');
    const manualTab = page.getByText('Manuel');
    await expect(autoTab).toBeVisible();
    await expect(manualTab).toBeVisible();

    // Click manual tab
    await manualTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/obfuscation-manual-tab.png', fullPage: true });

    // Click back to auto tab
    await autoTab.click();
    await page.waitForTimeout(300);
  });

  test('rules table shows correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check rules table headers
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check some rules exist
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    console.log(`Found ${count} rules rows`);
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: '/tmp/obfuscation-rules-table.png', fullPage: true });
  });

  test('add rule form works', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click "Ajouter une règle" button
    const addButton = page.getByText('Ajouter une règle');
    await addButton.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: '/tmp/obfuscation-add-form.png', fullPage: true });

    // Fill in the form
    const searchInput = page.locator('input[placeholder*="masquer"]');
    const replaceInput = page.locator('input[placeholder*="Auto-généré"]');

    await searchInput.fill('Test Company');
    await replaceInput.fill('DemoCompany');

    // Click Ajouter (the button within the form, not the one in header)
    const addSubmit = page.locator('button:has-text("Ajouter"):not(:has-text("une règle"))');
    await addSubmit.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/tmp/obfuscation-after-add.png', fullPage: true });

    // Verify the rule appears in the table
    await expect(page.locator('code:has-text("Test Company")')).toBeVisible();
  });

  test('toggle rule active/inactive', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find a toggle switch
    const toggles = page.locator('button[role="switch"]');
    const count = await toggles.count();
    console.log(`Found ${count} toggles`);

    if (count > 0) {
      const firstToggle = toggles.first();
      const initialState = await firstToggle.getAttribute('aria-checked');
      console.log(`Initial toggle state: ${initialState}`);

      await firstToggle.click();
      await page.waitForTimeout(500);

      const newState = await firstToggle.getAttribute('aria-checked');
      console.log(`New toggle state: ${newState}`);
      expect(newState).not.toBe(initialState);

      // Toggle back
      await firstToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('edit rule via dialog', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click edit on first rule
    const editButtons = page.locator('button[title="Modifier"]');
    const editCount = await editButtons.count();
    console.log(`Found ${editCount} edit buttons`);

    if (editCount > 0) {
      await editButtons.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: '/tmp/obfuscation-edit-dialog.png', fullPage: true });

      // Check dialog opened
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check dialog has the right title
      await expect(page.getByText('Modifier la règle')).toBeVisible();

      // Close dialog
      const cancelButton = dialog.locator('button:has-text("Annuler")');
      await cancelButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('delete rule via dialog', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // First, create a rule to delete
    const addButton = page.getByText('Ajouter une règle');
    await addButton.click();
    await page.waitForTimeout(300);

    const searchInput = page.locator('input[placeholder*="masquer"]');
    const replaceInput = page.locator('input[placeholder*="Auto-généré"]');
    await searchInput.fill('ToDelete');
    await replaceInput.fill('Replacement');

    const addSubmit = page.locator('button:has-text("Ajouter"):not(:has-text("une règle"))');
    await addSubmit.click();
    await page.waitForTimeout(1000);

    // Now find and delete it
    const deleteButtons = page.locator('button[title="Supprimer"]');
    const lastDelete = deleteButtons.last();
    await lastDelete.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: '/tmp/obfuscation-delete-dialog.png', fullPage: true });

    // Check dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('Supprimer la règle')).toBeVisible();

    // Confirm delete
    const deleteConfirm = dialog.locator('button:has-text("Supprimer")');
    await deleteConfirm.click();
    await page.waitForTimeout(1000);

    // Verify the rule is gone
    await expect(page.locator('code:has-text("ToDelete")')).toHaveCount(0);
  });

  test('preview panel works', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/obfuscation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Check preview panel exists
    await expect(page.getByText('Aperçu en direct')).toBeVisible();

    // Check before/after toggle
    await expect(page.getByText('Avant')).toBeVisible();
    await expect(page.getByText('Après')).toBeVisible();

    // Check coverage section exists
    await expect(page.getByText("Couverture d'obfuscation")).toBeVisible();

    await page.screenshot({ path: '/tmp/obfuscation-preview-panel.png', fullPage: true });
  });
});
