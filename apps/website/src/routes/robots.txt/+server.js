import { SITE_URL } from '$lib/env'

export const prerender = true

const DISALLOW_RULES = `Disallow: /fileshare
Disallow: /decrypt
Disallow: /download
Disallow: /debug`

export function GET() {
    const body = `User-agent: *
Allow: /
${DISALLOW_RULES}

User-agent: GPTBot
Allow: /
${DISALLOW_RULES}

User-agent: OAI-SearchBot
Allow: /
${DISALLOW_RULES}

User-agent: ClaudeBot
Allow: /
${DISALLOW_RULES}

User-agent: PerplexityBot
Allow: /
${DISALLOW_RULES}

User-agent: Google-Extended
Allow: /
${DISALLOW_RULES}

Sitemap: ${SITE_URL}/sitemap.xml
`

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain' },
    })
}
