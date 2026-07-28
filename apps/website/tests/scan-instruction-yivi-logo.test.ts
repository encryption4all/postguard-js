import { expect, test, type Page } from '@playwright/test'

// The QR scan instruction shows the Yivi wordmark inline in place of the word
// "Yivi". The wordmark image must be decorative (empty alt, aria-hidden) and
// the word kept as visually-hidden text, so a screen reader reads the whole
// sentence normally ("...with the free Yivi app on your phone.") instead of
// announcing an image mid-sentence.

const EXPECTED =
    'Verify your identity by scanning this QR code with the free Yivi app on your phone.'

// Keep the Yivi session INITIALIZED so the signing popup (with the instruction)
// stays on screen without a real Yivi app.
async function mockYiviSession(page: Page) {
    await page.route('**/pkg/v2/request/start', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                sessionPtr: {
                    u: 'http://localhost:4173/mock-yivi-session',
                    irmaqr: 'signing',
                },
                token: 'MOCK-TOKEN',
            }),
        })
    )
    await page.route('**/mock-yivi-session/status', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify('INITIALIZED'),
        })
    )
}

test('the scan instruction shows the Yivi wordmark but reads normally to a screen reader', async ({
    page,
}) => {
    await mockYiviSession(page)
    await page.goto('/fileshare/', { waitUntil: 'networkidle' })

    // Compose a valid message (one file + one recipient) and open the QR.
    await page.locator('input.dz-hidden-input').setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello world'),
    })
    await page
        .getByRole('textbox', { name: /email address/i })
        .first()
        .fill('recipient@example.com')
    await page
        .getByRole('button', { name: /sign & send/i })
        .first()
        .click()

    // The instruction paragraph is the one containing the inline wordmark.
    const instruction = page.locator('p', {
        has: page.locator('.yivi-inline'),
    })
    await expect(instruction).toBeVisible()

    // Accessible text: sr-only "Yivi" is real text, the images contribute none,
    // so the sentence reads in full with no "image"/"graphic" interruption.
    const accessibleText = (await instruction.textContent())
        ?.replace(/\s+/g, ' ')
        .trim()
    expect(accessibleText).toBe(EXPECTED)

    // The wordmark image is decorative and hidden from assistive tech.
    const logo = instruction.locator('.yivi-inline-logo').first()
    await expect(logo).toHaveAttribute('alt', '')
    await expect(logo).toHaveAttribute('aria-hidden', 'true')
})
