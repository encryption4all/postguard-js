import { expect, test, type Page } from '@playwright/test'

// The compose screen takes cryptify's per-upload and rolling limits from
// `GET /limits` instead of from a value baked into the build (issue
// encryption4all/postguard-js#267). When that call fails there is no cap to
// validate against, so the screen fails closed: it says so and refuses to
// send, rather than falling back to a stale default nobody can see is wrong.
//
// The unit side of this lives in src/lib/limits.test.ts. What this pins is the
// wiring: that the send button and the validation modal actually read the
// store.

const LIMITS = '**/limits'

async function compose(page: Page) {
    await page.goto('/fileshare/', { waitUntil: 'networkidle' })
    // Dropzone's hidden file input lives on <body>, not inside the form.
    await page.locator('input.dz-hidden-input').setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello world'),
    })
    await page
        .getByRole('textbox', { name: /email address/i })
        .first()
        .fill('recipient@example.com')
}

test('an otherwise valid message cannot be sent when the limits fetch fails', async ({
    page,
}) => {
    await page.route(LIMITS, (route) => route.fulfill({ status: 503 }))
    await compose(page)

    const sendButton = page
        .getByRole('button', { name: /sign & send/i })
        .first()
    await expect(sendButton).toHaveAttribute('aria-disabled', 'true')

    // The failure is surfaced at load time, before the user has spent an
    // encrypt and an upload on it.
    const banner = page
        .getByRole('alert')
        .filter({ hasText: /upload limits unavailable/i })
    await expect(banner).toBeVisible()

    // The button stays clickable so the modal can explain why (see #300).
    await sendButton.click({ force: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/upload limits could not be loaded/i)
})

test('the same message sends once the limits are served', async ({ page }) => {
    await page.route(LIMITS, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                per_upload_limit_bytes: 4_000_000_000,
                rolling_limit_bytes: 9_000_000_000,
                window_days: 14,
            }),
        })
    )
    await compose(page)

    await expect(
        page.getByRole('button', { name: /sign & send/i }).first()
    ).toHaveAttribute('aria-disabled', 'false')
    await expect(page.locator('.limits-unavailable-banner')).toHaveCount(0)
    // The served per-upload cap is what the size line reports, in decimal GB.
    await expect(page.locator('.file-summary')).toContainText('4.00 GB')
})
