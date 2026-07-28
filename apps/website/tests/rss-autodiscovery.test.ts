import { expect, test } from '@playwright/test'

const RSS_LINK =
    'head > link[rel="alternate"][type="application/rss+xml"][href="/blog/rss.xml"]'

// Regression test for the site-wide RSS autodiscovery link (issue
// encryption4all/postguard-business#58). The autodiscovery <link> lives in the
// marketing layout head, so every public page must advertise the blog feed
// exactly once — including non-blog pages and blog pages, which must not carry
// a leftover per-page duplicate.
for (const path of ['/', '/about/', '/blog/']) {
    test(`RSS autodiscovery link is present exactly once on ${path}`, async ({
        page,
    }) => {
        await page.goto(path)
        await expect(page.locator(RSS_LINK)).toHaveCount(1)
    })
}

test('RSS autodiscovery link is present exactly once on a blog post page', async ({
    page,
}) => {
    await page.goto('/blog/')
    const firstPost = page.locator('a.post-card').first()
    const href = await firstPost.getAttribute('href')
    expect(href, 'expected at least one blog post link on /blog/').toBeTruthy()

    await page.goto(href as string)
    await expect(page.locator(RSS_LINK)).toHaveCount(1)
})
