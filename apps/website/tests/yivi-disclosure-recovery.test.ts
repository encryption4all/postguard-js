import { expect, test, type Page } from '@playwright/test'

// Recovery from an interrupted / cancelled Yivi disclosure
// (encryption4all/postguard-website#294, part of #288 — July 2026 user test).
//
// When the user closes the Yivi app (or otherwise cancels/times out) mid
// disclosure, YiviWeb transitions to its own terminal "session cancelled"
// screen (rendered with a `.yivi-web-restart-button`) but the surrounding
// pg-js `encrypt()` promise never settles. The send flow used to hang silently
// on the QR screen. SendButton now detects that terminal widget state and
// surfaces a clear recovery banner with a retry action while keeping the
// composed files/recipients intact.
//
// These tests mock the Yivi session network so we can deterministically drive
// the widget into the cancelled state without a real Yivi app. The disclosure
// itself is Yivi's concern; what we assert here is purely the postguard-side
// recovery behaviour.

const SESSION_START = '**/pkg/v2/request/start'
// Base URL we hand back as the session pointer so we control the status poll.
const MOCK_YIVI_BASE = 'http://localhost:4173/mock-yivi-session'

/** Wire up the mocked Yivi session. `state.cancel` flips the polled status
 *  from INITIALIZED to CANCELLED, simulating the user closing the Yivi app. */
async function mockYiviSession(page: Page, state: { cancel: boolean }) {
    let startCalls = 0
    await page.route(SESSION_START, (route) => {
        startCalls++
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                sessionPtr: { u: MOCK_YIVI_BASE, irmaqr: 'signing' },
                token: `MOCK-TOKEN-${startCalls}`,
            }),
        })
    })
    await page.route(`${MOCK_YIVI_BASE}/status`, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(state.cancel ? 'CANCELLED' : 'INITIALIZED'),
        })
    )
    return { startCalls: () => startCalls }
}

/** Fill in a valid compose form (one file + one recipient) and open the QR. */
async function composeAndOpenDisclosure(page: Page) {
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
    // The send button is aria-disabled (not natively disabled) until valid.
    const sendButton = page
        .getByRole('button', { name: /sign & send/i })
        .first()
    await expect(sendButton).toHaveAttribute('aria-disabled', 'false')
    await sendButton.click()
    // Wait for the QR widget to render (ShowingQRCode state).
    await page.locator('#crypt-irma-qr .yivi-web-qr-code').first().waitFor()
}

test('a cancelled Yivi disclosure surfaces a recovery banner instead of hanging or erroring', async ({
    page,
}) => {
    const state = { cancel: false }
    await mockYiviSession(page, state)
    await composeAndOpenDisclosure(page)

    // User closes the Yivi app mid-flow -> the session polls CANCELLED.
    state.cancel = true

    const banner = page.getByRole('alert').filter({ hasText: /interrupted/i })
    await expect(banner).toBeVisible()
    // It is our own recovery banner, not the generic error panel.
    await expect(page.locator('.error-container')).toHaveCount(0)
    // The QR popup is dismissed so the user isn't stuck on a dead QR screen.
    await expect(page.locator('.desktop-yivi-popup')).toHaveCount(0)
    // The composed input is preserved so retrying costs nothing.
    await expect(
        page.getByRole('textbox', { name: /email address/i }).first()
    ).toHaveValue('recipient@example.com')
})

test('the recovery banner "try again" re-triggers the disclosure', async ({
    page,
}) => {
    const state = { cancel: false }
    const session = await mockYiviSession(page, state)
    await composeAndOpenDisclosure(page)
    expect(session.startCalls()).toBe(1)

    state.cancel = true
    await expect(
        page.getByRole('alert').filter({ hasText: /interrupted/i })
    ).toBeVisible()

    // Retry without re-cancelling: a fresh Yivi session must start.
    state.cancel = false
    await page.getByRole('button', { name: /^try again$/i }).click()
    await page.locator('#crypt-irma-qr .yivi-web-qr-code').first().waitFor()
    expect(session.startCalls()).toBe(2)
    await expect(page.locator('.yivi-interrupted-banner')).toHaveCount(0)
})

test('the recovery banner can be dismissed back to the compose screen', async ({
    page,
}) => {
    const state = { cancel: false }
    await mockYiviSession(page, state)
    await composeAndOpenDisclosure(page)

    state.cancel = true
    await expect(
        page.getByRole('alert').filter({ hasText: /interrupted/i })
    ).toBeVisible()

    await page.getByRole('button', { name: /^dismiss$/i }).click()
    await expect(page.locator('.yivi-interrupted-banner')).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: /sign & send/i }).first()
    ).toBeVisible()
})
