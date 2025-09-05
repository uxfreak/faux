import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display projects dashboard', async ({ page }) => {
    // Check for main dashboard elements
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
    await expect(page.locator('.dashboard-title')).toContainText('Projects');
    
    // Check for header actions
    await expect(page.locator('[data-section="actions"]')).toBeVisible();
  });

  test('should open create project modal', async ({ page }) => {
    // Click create project button
    await page.click('.create-project-action');
    
    // Verify modal is open
    await expect(page.locator('[data-component="create-project-modal"]')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('Create New Project');
    
    // Check form fields
    await expect(page.locator('input[placeholder="Enter project name"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Brief description of your project"]')).toBeVisible();
  });

  test('should create new project', async ({ page }) => {
    // Open create modal
    await page.click('.create-project-action');
    
    // Fill form
    await page.fill('input[placeholder="Enter project name"]', 'Test Project');
    await page.fill('textarea[placeholder="Brief description of your project"]', 'This is a test project');
    
    // Submit form
    await page.click('.create-button');
    
    // Wait for modal to close
    await expect(page.locator('[data-component="create-project-modal"]')).not.toBeVisible();
    
    // Check if project appears in grid
    await expect(page.locator('[data-grid="projects"]')).toContainText('Test Project');
  });

  test('should validate project creation form', async ({ page }) => {
    await page.click('.create-project-action');
    
    // Try to submit empty form
    await page.click('.create-button');
    
    // Should show validation error (form should still be open)
    await expect(page.locator('[data-component="create-project-modal"]')).toBeVisible();
    
    // Fill only name
    await page.fill('input[placeholder="Enter project name"]', 'Test');
    await page.click('.create-button');
    
    // Should succeed with name only
    await expect(page.locator('[data-component="create-project-modal"]')).not.toBeVisible();
  });

  test('should search projects', async ({ page }) => {
    // Create a few test projects first
    const projects = ['Alpha Project', 'Beta Project', 'Gamma Project'];
    
    for (const projectName of projects) {
      await page.click('.create-project-action');
      await page.fill('input[placeholder="Enter project name"]', projectName);
      await page.click('.create-button');
      await page.waitForTimeout(500); // Small delay between creates
    }
    
    // Open search
    await page.click('[data-control="search"] .search-trigger');
    
    // Search for specific project
    await page.fill('.search-input', 'Alpha');
    
    // Should show only Alpha project
    await expect(page.locator('[data-grid="projects"]')).toContainText('Alpha Project');
    await expect(page.locator('[data-grid="projects"]')).not.toContainText('Beta Project');
  });

  test('should sort projects', async ({ page }) => {
    // Create test projects with delays to ensure different timestamps
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'First Project');
    await page.click('.create-button');
    
    await page.waitForTimeout(1000);
    
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Second Project');
    await page.click('.create-button');
    
    // Click sort dropdown
    await page.click('[data-section="controls"] .dropdown-trigger');
    
    // Select name sorting
    await page.click('[data-option-value="name-asc"]');
    
    // Verify order (First should come before Second alphabetically)
    const projectCards = page.locator('[data-item="project-card"]');
    await expect(projectCards.first()).toContainText('First Project');
  });

  test('should open project viewer', async ({ page }) => {
    // Create a test project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Viewer Test');
    await page.click('.create-button');
    
    // Click on the project card
    await page.click('[data-item="project-card"]');
    
    // Should navigate to project viewer
    await expect(page.locator('[data-component="project-viewer"]')).toBeVisible();
    await expect(page.locator('.project-title')).toContainText('Viewer Test');
    
    // Check for header controls
    await expect(page.locator('[data-control="mode-toggle"]')).toBeVisible();
    await expect(page.locator('[data-control="terminal"]')).toBeVisible();
  });

  test('should toggle between preview and components modes', async ({ page }) => {
    // Create and open project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Mode Test');
    await page.click('.create-button');
    await page.click('[data-item="project-card"]');
    
    // Should start in preview mode
    await expect(page.locator('[data-mode="preview"][data-active="true"]')).toBeVisible();
    
    // Switch to components mode
    await page.click('[data-mode="components"]');
    
    // Verify mode switch
    await expect(page.locator('[data-mode="components"][data-active="true"]')).toBeVisible();
    await expect(page.locator('[data-view="components"]')).toBeVisible();
  });

  test('should toggle terminal pane', async ({ page }) => {
    // Create and open project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Terminal Test');
    await page.click('.create-button');
    await page.click('[data-item="project-card"]');
    
    // Terminal should be closed initially
    await expect(page.locator('[data-section="terminal"]')).not.toBeVisible();
    
    // Open terminal
    await page.click('[data-control="terminal"]');
    
    // Terminal should be visible
    await expect(page.locator('[data-section="terminal"]')).toBeVisible();
    await expect(page.locator('[data-component="terminal-pane"]')).toBeVisible();
    
    // Close terminal
    await page.click('[data-control="terminal"]');
    
    // Terminal should be hidden
    await expect(page.locator('[data-section="terminal"]')).not.toBeVisible();
  });

  test('should toggle fullscreen mode in preview', async ({ page }) => {
    // Create and open project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Fullscreen Test');
    await page.click('.create-button');
    await page.click('[data-item="project-card"]');
    
    // Should be in preview mode and fullscreen button should be visible
    await expect(page.locator('[data-control="fullscreen"]')).toBeVisible();
    
    // Click fullscreen
    await page.click('[data-control="fullscreen"]');
    
    // Should be in fullscreen mode (header hidden, fullscreen close button visible)
    await expect(page.locator('.project-header')).not.toBeVisible();
    await expect(page.locator('[data-control="fullscreen-close"]')).toBeVisible();
    
    // Exit fullscreen
    await page.click('[data-control="fullscreen-close"]');
    
    // Should return to normal view
    await expect(page.locator('.project-header')).toBeVisible();
    await expect(page.locator('[data-control="fullscreen-close"]')).not.toBeVisible();
  });

  test('should navigate back to dashboard from project viewer', async ({ page }) => {
    // Create and open project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Navigation Test');
    await page.click('.create-button');
    await page.click('[data-item="project-card"]');
    
    // Should be in project viewer
    await expect(page.locator('[data-component="project-viewer"]')).toBeVisible();
    
    // Click back button
    await page.click('[data-control="back"]');
    
    // Should return to dashboard
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
    await expect(page.locator('.dashboard-title')).toContainText('Projects');
  });

  test('should delete project', async ({ page }) => {
    // Create test project
    await page.click('.create-project-action');
    await page.fill('input[placeholder="Enter project name"]', 'Delete Test');
    await page.click('.create-button');
    
    // Open project actions menu
    await page.click('[data-control="project-actions"]');
    
    // Click delete
    await page.click('[data-action="delete"]');
    
    // Accept confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Project should be removed from grid
    await expect(page.locator('[data-grid="projects"]')).not.toContainText('Delete Test');
  });

  test('should show empty state when no projects', async ({ page }) => {
    // If there are no projects, should show empty state
    const projectGrid = page.locator('[data-grid="projects"]');
    const emptyState = page.locator('[data-state="empty"]');
    
    // Either projects grid or empty state should be visible
    const hasProjects = await projectGrid.count() > 0;
    
    if (!hasProjects) {
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('No projects yet');
    }
  });
});

test.describe('Loading States Demo', () => {
  test('should access loading states demo', async ({ page }) => {
    await page.goto('/');
    
    // Click loading demo button
    await page.click('.demo-button');
    
    // Should navigate to demo page
    await expect(page.locator('[data-component="loading-demo"]')).toBeVisible();
    await expect(page.locator('.demo-title')).toContainText('Loading States Demo');
  });

  test('should show all loading components in demo', async ({ page }) => {
    await page.goto('/');
    await page.click('.demo-button');
    
    // Check for all demo sections
    await expect(page.locator('text=Loading Spinners')).toBeVisible();
    await expect(page.locator('text=Project Card Skeletons')).toBeVisible();
    await expect(page.locator('text=Content Loaders')).toBeVisible();
    await expect(page.locator('text=Progress Modal')).toBeVisible();
    await expect(page.locator('text=Terminal Command Indicators')).toBeVisible();
    await expect(page.locator('text=Button Loading States')).toBeVisible();
  });

  test('should simulate progress modal', async ({ page }) => {
    await page.goto('/');
    await page.click('.demo-button');
    
    // Click simulate button
    await page.click('text=Simulate Project Creation');
    
    // Progress modal should appear
    await expect(page.locator('[data-component="demo-progress-modal"]')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('Creating New Project');
    
    // Wait for progress to complete
    await page.waitForTimeout(7000);
    
    // Modal should close
    await expect(page.locator('[data-component="demo-progress-modal"]')).not.toBeVisible();
  });

  test('should navigate back from demo', async ({ page }) => {
    await page.goto('/');
    await page.click('.demo-button');
    
    // Click back button
    await page.click('text=Back to Projects');
    
    // Should return to main dashboard
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
  });
});

test.describe('Theme Management', () => {
  test('should toggle theme', async ({ page }) => {
    await page.goto('/');
    
    // Click theme toggle
    await page.click('[data-control="theme-toggle"]');
    
    // Should show theme options
    await expect(page.locator('[data-theme="light"]')).toBeVisible();
    await expect(page.locator('[data-theme="dark"]')).toBeVisible();
    await expect(page.locator('[data-theme="system"]')).toBeVisible();
    
    // Switch to dark theme
    await page.click('[data-theme="dark"]');
    
    // Verify theme change by checking CSS custom properties or class
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Responsive Design', () => {
  test('should work on different viewport sizes', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-component="dashboard"]')).toBeVisible();
  });
});