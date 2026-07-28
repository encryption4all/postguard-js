import { expect, test } from '@playwright/test'

// Regression test for encryption4all/postguard-website#289.
//
// In the July 2026 user test a participant typed the recipient's email
// address into the optional *message* box because the recipient field did not
// clearly read as "who you're sending to". The recipient input must therefore:
//   - carry an explicit "Recipient email address" label (accessible name), and
//   - be an unambiguous address field (type=email + email autocomplete), and
//   - appear before the optional message box in DOM order.

test.beforeEach(async ({ page }) => {
    await page.goto('/fileshare/')
    await expect(
        page.getByRole('textbox', { name: /recipient email address/i })
    ).toBeVisible()
})

test('recipient input is labelled distinctly as an address field', async ({
    page,
}) => {
    const recipient = page.getByRole('textbox', {
        name: /recipient email address/i,
    })
    // Reads as an address field for browsers and assistive tech.
    await expect(recipient).toHaveAttribute('type', 'email')
    await expect(recipient).toHaveAttribute('autocomplete', 'email')
    await expect(recipient).toHaveAttribute('inputmode', 'email')
})

test('the recipient field comes before the optional message box', async ({
    page,
}) => {
    const recipient = page.getByRole('textbox', {
        name: /recipient email address/i,
    })
    const message = page.getByPlaceholder(/type your message here/i)
    await expect(message).toBeVisible()

    // recipient precedes message in document order (DOCUMENT_POSITION_FOLLOWING).
    const messageHandle = await message.elementHandle()
    if (!messageHandle) throw new Error('message textarea handle not found')
    const recipientIsFirst = await recipient.evaluate(
        (r, m) =>
            !!(r.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING),
        messageHandle
    )
    expect(recipientIsFirst).toBe(true)
})
