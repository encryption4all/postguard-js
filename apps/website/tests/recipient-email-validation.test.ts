import { expect, test } from '@playwright/test'

// Regression tests for encryption4all/postguard-website#293.
//
// In the July 2026 user test a participant mistyped the recipient address.
// The address still passed the format check, so the flow reported "sent"
// while no mail was ever delivered to either party — a silent failure.
//
// The recipient address must be validated BEFORE the send starts and, when it
// is malformed, a clear blocking modal must appear instead of the flow
// proceeding. The key gap was that an address with no dotted TLD (a common
// typo, e.g. a missing dot before "com") used to be accepted.

test.beforeEach(async ({ page }) => {
    await page.goto('/fileshare/')
    await expect(
        page.getByRole('textbox', { name: /email address/i })
    ).toBeVisible()
})

test('a mistyped recipient with no TLD is blocked with a clear error', async ({
    page,
}) => {
    await page
        .getByRole('textbox', { name: /email address/i })
        .fill('jane@examplecom')

    await page
        .getByRole('button', { name: /encrypt|send/i })
        .first()
        .click({ force: true })

    // The blocking validation dialog appears and names the offending address.
    const dialog = page.locator('dialog.validation-modal')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/not valid/i)
    await expect(dialog).toContainText('jane@examplecom')

    // The Yivi signing step must NOT have started — nothing was sent.
    await expect(page.locator('#crypt-irma-qr')).toHaveCount(0)
})

test('a correctly formatted recipient passes the email format check', async ({
    page,
}) => {
    await page
        .getByRole('textbox', { name: /email address/i })
        .fill('jane@example.com')

    await page
        .getByRole('button', { name: /encrypt|send/i })
        .first()
        .click({ force: true })

    // With no file attached the modal still opens, but it must complain about
    // the missing file — never about the (valid) email address.
    const dialog = page.locator('dialog.validation-modal')
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toContainText(/not valid/i)
})

test('a mistyped domain surfaces a "did you mean" suggestion that fixes the address', async ({
    page,
}) => {
    // `jane@gmial.com` is *structurally valid* — a format/TLD check accepts it —
    // yet the domain is a typo of `gmail.com`. This is exactly the #293 class a
    // regex/isEmail cannot catch, so we surface an advisory correction instead.
    const emailField = page.getByRole('textbox', { name: /email address/i })
    await emailField.fill('jane@gmial.com')

    const suggestion = page.getByRole('button', { name: 'jane@gmail.com' })
    await expect(suggestion).toBeVisible()

    // Clicking the suggestion applies the correction to the field.
    await suggestion.click()
    await expect(emailField).toHaveValue('jane@gmail.com')
    await expect(suggestion).toBeHidden()
})

test('an invalid address shows an inline error once the field is left', async ({
    page,
}) => {
    const emailField = page.getByRole('textbox', { name: /email address/i })
    await emailField.fill('r@h')

    // Nothing while still editing — we don't nag mid-typing.
    await expect(page.locator('.email-error')).toHaveCount(0)

    // Leaving the field surfaces the inline invalidity (native :invalid never
    // fires for `r@h`, which is why this is driven by validator.isEmail).
    await emailField.blur()
    await expect(emailField).toHaveAttribute('aria-invalid', 'true')
    const error = page.locator('.email-error')
    await expect(error).toBeVisible()
    await expect(error).toContainText('r@h')
    await expect(error).toContainText(/not valid/i)

    // Correcting the address clears the error live.
    await emailField.fill('r@hotmail.com')
    await expect(page.locator('.email-error')).toHaveCount(0)
    await expect(emailField).not.toHaveAttribute('aria-invalid', 'true')
})
