import { SITE_URL } from '$lib/env'

export const prerender = true

const FEED_URL = `${SITE_URL}/blog/rss.xml`
const FEED_TITLE = 'PostGuard Blog'
const FEED_DESCRIPTION =
    'News, updates, and insights about PostGuard — secure end-to-end encryption for email and files.'

/**
 * Escape XML special characters so user-supplied frontmatter values are safe
 * to embed in element text and attributes.
 * @param {unknown} value
 */
function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/**
 * Format an ISO date as an RFC 822 string, which is what RSS 2.0 requires.
 * @param {string | undefined} iso
 */
function toRfc822(iso) {
    const d = iso ? new Date(iso) : new Date()
    return Number.isNaN(d.getTime())
        ? new Date().toUTCString()
        : d.toUTCString()
}

export function GET() {
    /** @type {Record<string, { metadata?: Record<string, any> }>} */
    const postFiles = /** @type {any} */ (
        import.meta.glob('/src/content/blog/*.svx', { eager: true })
    )

    const posts = Object.entries(postFiles)
        .map(([path, mod]) => {
            const slug = /** @type {string} */ (path.split('/').pop()).replace(
                '.svx',
                ''
            )
            const metadata = mod?.metadata ?? {}
            return {
                slug,
                title: metadata.title ?? slug,
                description: metadata.description ?? '',
                date: metadata.date ?? '',
                author: metadata.author ?? 'PostGuard',
            }
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const lastBuildDate = toRfc822(posts[0]?.date)

    const items = posts
        .map((post) => {
            const url = `${SITE_URL}/blog/${post.slug}/`
            return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <dc:creator>${escapeXml(post.author)}</dc:creator>
      <description>${escapeXml(post.description)}</description>
    </item>`
        })
        .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/blog/</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

    return new Response(xml, {
        headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    })
}
