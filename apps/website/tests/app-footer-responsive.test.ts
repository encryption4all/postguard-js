import { expect, test } from '@playwright/test'

// Regression test for hiding the compact app footer on mobile viewports
// (issue encryption4all/postguard-website#279). The footer lives in the (app)
// layout and is hidden below Header's 768px desktop breakpoint, where it cost
// too much screen real estate. It must stay visible on desktop.
const FOOTER = '.app-footer'

test('app footer is hidden on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/fileshare/')
    await expect(page.locator(FOOTER)).toBeHidden()
})

test('app footer is visible on a desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/fileshare/')
    await expect(page.locator(FOOTER)).toBeVisible()
})
