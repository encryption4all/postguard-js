import { expect, test } from '@playwright/test'

// Regression tests for encryption4all/postguard-website#290 (July 2026 user
// test): a message could be sent before any file was attached.
//
// A fileless message is never valid, so with zero attachments:
//  - the send button must be marked aria-disabled (it stays clickable so the
//    validation modal can explain what is missing, per #300), and
//  - clicking it opens that validation modal telling the user a file is missing.

test.beforeEach(async ({ page }) => {
    await page.goto('/fileshare/')
    await expect(
        page.getByRole('textbox', { name: /email address/i })
    ).toBeVisible()
})

test('send button is inactive when no files are attached', async ({ page }) => {
    const sendButton = page.locator('button.send-btn')
    await expect(sendButton).toBeVisible()
    await expect(sendButton).toHaveAttribute('aria-disabled', 'true')
})

test('clicking send with no files opens the validation modal explaining a file is missing', async ({
    page,
}) => {
    // The button is only aria-disabled, not natively disabled, so a real user
    // can still click it (which surfaces the validation modal). force past
    // Playwright's aria-disabled actionability guard to mimic that click.
    await page.locator('button.send-btn').click({ force: true })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/haven't added any files/i)
})
