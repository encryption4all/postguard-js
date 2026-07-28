import { expect, test } from '@playwright/test'

// Regression test for encryption4all/postguard-website#295.
//
// In the July 2026 user test the email/compose step opened already scrolled
// down, so the instructional heading at the top of the panel was hidden and
// the user was unsure how to proceed. The real scroll container here is
// `#main-content` (the (app) layout's <main>), which persists across
// client-side navigations while SvelteKit's scroll handling only resets the
// window — so a scroll position carried over from a previous view stuck.
//
// The fix resets the scroll containers to the top on navigation into the
// step, so its instructions ("Recipients" heading) are visible on arrival.

// A short viewport guarantees both routes overflow their scroll container so
// the pre-scrolled state can actually be reproduced.
test.use({ viewport: { width: 390, height: 560 } })

test('compose step opens scrolled to the top with the instructions visible', async ({
    page,
}) => {
    // Land directly on the compose step: the instructional heading must be
    // visible without the user having to scroll.
    await page.goto('/fileshare/')
    const heading = page.getByRole('heading', { name: 'Recipients' })
    await expect(heading).toBeVisible()
    await expect(heading).toBeInViewport()
})

test('scroll position carried in from another view is reset on arrival', async ({
    page,
}) => {
    // Start on another in-app route (shares the (app) <main> scroll container)
    // and scroll it down. A tall spacer appended directly to <main> guarantees
    // the container overflows regardless of that route's own content height;
    // it persists across the client navigation (it is a child of the
    // long-lived <main>), so the carried-over scroll position stays valid on
    // the destination — exactly the situation the fix must undo.
    await page.goto('/decrypt/')
    await expect(page.locator('#main-content')).toBeVisible()
    await page.evaluate(() => {
        const main = document.getElementById('main-content')!
        const spacer = document.createElement('div')
        spacer.id = 'test-scroll-spacer'
        spacer.style.height = '3000px'
        // <main> is a flex column, so a bare child would shrink; pin it so the
        // container genuinely overflows.
        spacer.style.flex = '0 0 3000px'
        main.appendChild(spacer)
        main.scrollTo({ top: main.scrollHeight })
    })
    // Sanity check: the container is actually scrolled before we navigate.
    const scrolledBefore = await page.evaluate(
        () => document.getElementById('main-content')!.scrollTop
    )
    expect(scrolledBefore).toBeGreaterThan(0)

    // Client-side navigate to the compose step via the mobile menu. The
    // <main> element persists across this navigation, so without the reset it
    // would stay scrolled down.
    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('link', { name: 'File Sharing' }).click()

    await expect(page).toHaveURL(/\/fileshare\/?$/)
    const heading = page.getByRole('heading', { name: 'Recipients' })
    await expect(heading).toBeVisible()
    await expect(heading).toBeInViewport()
    await expect
        .poll(() =>
            page.evaluate(
                () => document.getElementById('main-content')!.scrollTop
            )
        )
        .toBe(0)
})
