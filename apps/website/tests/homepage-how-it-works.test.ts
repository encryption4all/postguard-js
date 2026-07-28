import { expect, test } from '@playwright/test'

// Regression test for the homepage onboarding rework.
//
// New visitors reached the bottom of the homepage without understanding what
// PostGuard does or where to go next. The homepage must therefore:
//   - state the value proposition in the hero headline,
//   - explain the flow as a 1-2-3 "how it works" with numbered, ordered steps,
//   - demote "PostGuard for Business" to a single callout linking to the
//     business site, and
//   - close with a call-to-action pointing at the file-sharing app.

test.beforeEach(async ({ page }) => {
    await page.goto('/')
})

test('the hero states the value proposition', async ({ page }) => {
    await expect(page.locator('.intro h1')).toHaveText(/no keys, no setup/i)
})

test('the "how it works" section shows three ordered, numbered steps', async ({
    page,
}) => {
    await expect(page.locator('.hiw-step')).toHaveCount(3)
    await expect(page.locator('.hiw-step .hiw-badge')).toHaveText([
        '1',
        '2',
        '3',
    ])
    await expect(page.locator('.hiw-step .hiw-title')).toHaveText([
        /add your files/i,
        /recipient's identity/i,
        /sign with your own identity/i,
    ])
})

test('PostGuard for Business is a single callout linking to the business site', async ({
    page,
}) => {
    const callout = page.locator('a.business-callout')
    await expect(callout).toBeVisible()
    // BUSINESS_URL is environment-configurable (e.g. a staging host), so assert
    // it points at a business PostGuard host rather than one exact URL.
    const href = await callout.getAttribute('href')
    expect(href, 'business callout should link to the business site').toMatch(
        /^https:\/\/business\.[\w.]*postguard\.eu/
    )
})

test('a closing call-to-action points at the file-sharing app', async ({
    page,
}) => {
    const cta = page.locator('.final-cta a')
    await expect(cta).toBeVisible()
    const href = await cta.getAttribute('href')
    expect(href, 'closing CTA should link to /fileshare').toContain(
        '/fileshare'
    )
})
