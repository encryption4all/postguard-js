import { expect, test } from '@playwright/test'

// Issue #265: senders didn't understand what the optional recipient attributes
// (date of birth, mobile phone number) actually do. Each add-attribute chip must
// carry an explanatory hover text (a native `title` tooltip) so hovering reveals
// what requiring that attribute means before the file can be opened.

test('the add-attribute chips expose an explanatory hover title', async ({
    page,
}) => {
    await page.goto('/fileshare/')
    await expect(
        page.getByRole('textbox', { name: /email address/i })
    ).toBeVisible()

    const dobButton = page.getByRole('button', { name: /date of birth/i })
    await expect(dobButton).toBeVisible()
    await expect(dobButton).toHaveAttribute(
        'title',
        /require the recipient to prove this date of birth/i
    )

    const phoneButton = page.getByRole('button', {
        name: /mobile phone number/i,
    })
    await expect(phoneButton).toBeVisible()
    await expect(phoneButton).toHaveAttribute(
        'title',
        /require the recipient to prove they own this mobile phone number/i
    )
})
