import { expect, test } from '@playwright/test'

// Accessibility regression tests for the recipient attribute-entry form
// (issues encryption4all/postguard-website#268 and #269).
//
// #268: a screenreader did not clearly announce whether a field was required.
//       The required email field must expose `aria-required`, carry a visible
//       asterisk, and the form must show an explanatory legend for the asterisk.
// #269: it was not clear that the phone number and birthday attributes are
//       optional. Each optional attribute label must say "(optional)" so it is
//       announced to screenreader users.

test.beforeEach(async ({ page }) => {
    await page.goto('/fileshare/')
    // The recipient form renders in the initial FileSelection state.
    await expect(
        page.getByRole('textbox', { name: /email address/i })
    ).toBeVisible()
})

test('required email field exposes aria-required and a visible asterisk', async ({
    page,
}) => {
    const email = page.getByRole('textbox', { name: /email address/i })
    await expect(email).toHaveAttribute('aria-required', 'true')
    // Native required is still present so browser validation also fires.
    await expect(email).toHaveAttribute('required', '')

    // The asterisk is rendered in the label and hidden from the a11y tree
    // (the required state itself is conveyed by aria-required).
    const asterisk = page.locator('label.field-label .required-asterisk')
    await expect(asterisk).toHaveText('*')
    await expect(asterisk).toHaveAttribute('aria-hidden', 'true')
})

test('the form shows a legend explaining the required-field asterisk', async ({
    page,
}) => {
    const legend = page.locator('#required-fields-legend')
    await expect(legend).toBeVisible()
    await expect(legend).toContainText('*')

    // The required email input points at the legend for assistive tech.
    const email = page.getByRole('textbox', { name: /email address/i })
    await expect(email).toHaveAttribute(
        'aria-describedby',
        'required-fields-legend'
    )
})

test('optional attributes are announced as optional via their label', async ({
    page,
}) => {
    // Add the mobile-number attribute (#269 phone number).
    await page.getByRole('button', { name: /mobile phone number/i }).click()
    const phone = page.getByLabel(/mobile phone number/i)
    await expect(phone).toBeVisible()
    // The accessible name of the field must include "(optional)".
    await expect(phone).toHaveAccessibleName(/\(optional\)/i)

    // Add the date-of-birth attribute (#269 birthday).
    await page.getByRole('button', { name: /date of birth/i }).click()
    const birthday = page.getByLabel(/date of birth/i)
    await expect(birthday).toBeVisible()
    await expect(birthday).toHaveAccessibleName(/\(optional\)/i)
})
