import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    // Only the e2e specs. Playwright's default testDir is the config's own
    // directory, which also picks up the vitest unit tests in src/**.
    testDir: 'tests',
    // A stray test.only would silently skip the rest of the suite in CI.
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : 'list',
    use: {
        // Artifacts for the CI failure upload; nothing is kept for a pass.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    webServer: {
        command: 'pnpm build && pnpm preview',
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
}

export default config
