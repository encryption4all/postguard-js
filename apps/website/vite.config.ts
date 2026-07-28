import { sveltekit } from '@sveltejs/kit/vite'
import type { Plugin, UserConfig } from 'vite'

// Matches the `+page.svelte` components inside the `/debug/*` route group, e.g.
// `src/routes/(app)/debug/qr/+page.svelte`. The path separator is normalised to
// `/` first so the pattern also works on Windows.
const DEBUG_PAGE_RE = /\/routes\/\(app\)\/debug\/.*\+page\.svelte$/

// Build-time exclusion of the `/debug/*` route group.
//
// The debug pages are developer-only fixtures. A runtime `dev` redirect in
// `(app)/debug/+layout.svelte` keeps them unreachable in production, but the
// page components (and their heavy imports, console.log calls, mock data, …)
// were still compiled into the production bundle. During `vite build` this
// plugin replaces the source of every debug `+page.svelte` with an empty
// component before the Svelte compiler sees it, so none of that code ships.
//
// In `vite dev`/`vite preview` of a dev build nothing is touched, so the pages
// remain fully usable while developing. The `+layout.svelte` redirect is kept
// as a second line of defence for anyone navigating to `/debug/*` in prod.
function excludeDebugRoutesInProduction(): Plugin {
    let isBuild = false
    return {
        name: 'exclude-debug-routes-in-production',
        // Run before the Svelte plugin so it compiles our stub, not the original.
        enforce: 'pre',
        configResolved(resolved) {
            isBuild = resolved.command === 'build'
        },
        transform(_code, id) {
            if (!isBuild) return null
            const path = id.replace(/\\/g, '/').split('?')[0]
            if (!DEBUG_PAGE_RE.test(path)) return null
            return {
                code: '<!-- debug route excluded from production build -->\n',
                map: null,
            }
        },
    }
}

const config: UserConfig = {
    server: {
        fs: {
            allow: ['..'],
        },
        // Polling mode so Claude Code file changes are picked up by the HMR watcher
        watch: {
            usePolling: true,
            interval: 300,
        },
    },
    plugins: [excludeDebugRoutesInProduction(), sveltekit()],
}

export default config
