import { SITE_URL } from '$lib/env'

export const prerender = true

export function GET() {
    /**
     * Static pages with their last-modified dates. Bump these when the page
     * content changes meaningfully. Values are ISO-8601 date strings (YYYY-MM-DD).
     * @type {{ path: string, lastmod: string }[]}
     */
    const staticPages = [
        { path: '', lastmod: '2026-04-23' },
        { path: '/about', lastmod: '2026-04-23' },
        { path: '/addons', lastmod: '2026-04-23' },
        { path: '/privacy', lastmod: '2026-04-23' },
        { path: '/blog', lastmod: '2026-04-23' },
    ]

    /** @type {Record<string, { metadata?: { date?: string } }>} */
    const postFiles = /** @type {any} */ (
        import.meta.glob('/src/content/blog/*.svx', { eager: true })
    )
    const blogEntries = Object.entries(postFiles).map(([path, mod]) => {
        const slug = /** @type {string} */ (path.split('/').pop()).replace(
            '.svx',
            ''
        )
        const date = mod?.metadata?.date ?? '2026-04-23'
        return {
            path: `/blog/${slug}`,
            lastmod: String(date).slice(0, 10),
        }
    })

    const entries = [...staticPages, ...blogEntries]

    const urls = entries
        .map(
            (e) =>
                `  <url>\n    <loc>${SITE_URL}${e.path}/</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
        )
        .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

    return new Response(xml, {
        headers: { 'Content-Type': 'application/xml' },
    })
}
