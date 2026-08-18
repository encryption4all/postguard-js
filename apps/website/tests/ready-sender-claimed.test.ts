import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// Regression test for encryption4all/postguard-js#232.
//
// `/download` reads the sender off the sealed header before anything is
// decrypted (`opened.inspect()`). That value carries a valid signature over
// the header bytes but nothing binds it to the ciphertext
// (encryption4all/postguard#338), so the pre-scan `Ready` state must not
// present it as verified: no tick, no `verifiedEmail` copy, no attribute
// chips. `Confirm` and `Done` render `result.sender` from decrypt() instead;
// #232 scopes this change to the pre-decryption screen, so their tick stays
// and the assertions below pin it in place. Whether a post-decryption tick is
// warranted at all is #338's question, not this test's.
//
// Reaching `Ready` in a browser needs a live upload, and `Confirm`/`Done`
// need a full Yivi disclosure on top of that, so — as in
// done-sender-confirmation.test.ts — this asserts the wiring off disk.

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const page = readFileSync(
    `${repoRoot}src/routes/(app)/download/+page.svelte`,
    'utf8'
)

// The `<h2>` above the panel runs its own `downloadState` chain, so scope the
// search to the panel chain — otherwise 'Confirm' matches the title branch.
const PANEL_CHAIN_START = "{#if downloadState === 'Downloading'}"

/** The markup of one `{:else if downloadState === '<state>'}` branch of the
 *  panel chain, up to the next branch. Throws rather than returning empty, so
 *  renaming a state fails the test instead of making it vacuous. */
function stateBlock(state: string): string {
    const chainStart = page.indexOf(PANEL_CHAIN_START)
    if (chainStart === -1) {
        throw new Error(
            `no ${PANEL_CHAIN_START} in download/+page.svelte — the panel state chain moved`
        )
    }
    const chain = page.slice(chainStart)

    const branch = `{:else if downloadState === '${state}'}`
    const start = chain.indexOf(branch)
    if (start === -1) {
        throw new Error(`no '${state}' branch in the download panel chain`)
    }
    const after = start + branch.length
    const next = chain.indexOf('{:else if downloadState ===', after)
    const block = chain.slice(after, next === -1 ? undefined : next)
    if (block.trim().length === 0) {
        throw new Error(`the '${state}' branch is empty`)
    }
    return block
}

test('the Ready state presents the sender as claimed, not verified', () => {
    const ready = stateBlock('Ready')

    expect(ready).toContain('filesharing.decryptpanel.claimedEmail')
    expect(ready).toContain('filesharing.decryptpanel.claimedEmailCaveat')
    expect(ready).not.toContain('verifiedEmail')
    expect(ready).not.toContain('class="checkmark"')
    expect(ready).not.toContain('verifiedAttributes')
})

for (const state of ['Confirm', 'Done'] as const) {
    test(`the ${state} state still shows the verified sender`, () => {
        const block = stateBlock(state)

        expect(block).toContain('filesharing.decryptpanel.verifiedEmail')
        expect(block).toContain('class="checkmark"')
    })
}

for (const lang of ['en', 'nl'] as const) {
    test(`the ${lang} locale defines the claimed-sender strings`, () => {
        const messages = JSON.parse(
            readFileSync(`${repoRoot}src/lib/locales/${lang}.json`, 'utf8')
        )
        const { claimedEmail, claimedEmailCaveat } =
            messages.filesharing.decryptpanel

        for (const value of [claimedEmail, claimedEmailCaveat]) {
            expect(typeof value).toBe('string')
            expect(value.trim().length).toBeGreaterThan(0)
        }
    })
}
