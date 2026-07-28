import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// Regression test for issue encryption4all/postguard-website#218.
//
// The `/debug/*` route group holds developer-only fixtures. They used to be
// guarded by a runtime `dev` redirect only, which left the page components
// (heavy mock data, console.log calls, sandbox UI) bundled into the production
// output. `vite.config.ts` now strips those `+page.svelte` components during
// `vite build`, so none of their source should appear in `build/`.

const buildDir = fileURLToPath(new URL('../build', import.meta.url))

// Strings that only ever appear in a debug page component. If any of these
// shows up in the production output, that page's code leaked into the bundle.
const DEBUG_ONLY_MARKERS = [
    'QR test page loaded', // debug/qr console.log
    'Yivi QR Code Test Page', // debug/qr heading
    'Test Before Send State', // debug/before-send heading
    'Test Upload/Encryption State', // debug/upload heading
    'Download Flow Sandbox', // debug/download-flow heading
    'budget_2024_final_version_v3.xlsx', // debug/done mock data
    'Alice Jansen', // debug/download mock identity
    'postguard-main.cs.ru.nl/pkg', // debug/url hardcoded PKG
]

// Debug markers only ever leak into text output, so skip binary assets
// (images, fonts, .wasm) — reading those as utf8 is wasteful and never matches.
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json'])

function walk(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
            files.push(...walk(full))
        } else if (TEXT_EXTENSIONS.has(extname(full))) {
            files.push(full)
        }
    }
    return files
}

test('debug page components are absent from the production build', () => {
    expect(
        existsSync(buildDir),
        `expected a production build at ${buildDir} (run "npm run build")`
    ).toBe(true)

    const offenders: string[] = []
    for (const file of walk(buildDir)) {
        const contents = readFileSync(file, 'utf8')
        for (const marker of DEBUG_ONLY_MARKERS) {
            if (contents.includes(marker)) {
                offenders.push(`${file} contains debug marker "${marker}"`)
            }
        }
    }

    expect(offenders, offenders.join('\n')).toEqual([])
})

// In the production build the debug routes resolve to empty stub components and
// the `(app)/debug/+layout.svelte` redirect sends visitors back home, so no
// debug UI is ever rendered to a production user.
test('navigating to a debug route renders no debug UI in production', async ({
    page,
}) => {
    await page.goto('/debug/qr/')
    await expect(
        page.locator('h1', { hasText: 'Yivi QR Code Test Page' })
    ).toHaveCount(0)
})
