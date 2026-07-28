import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// Regression test for encryption4all/postguard-website#275.
//
// In the July 2026 user test (tracked under #288) a sender received no
// confirmation that the email had been sent to them, which added confusion
// when a mistyped recipient meant nothing was actually delivered (#293). The
// upload is always dispatched with `notify.sender: true` in SendButton, so the
// sender does receive a confirmation email — the confirmation page ("Done")
// must state this explicitly.
//
// The confirmation screen (`Done.svelte`) only renders after a full Yivi
// disclosure + encrypted upload, and its `/debug/done` fixture is stripped from
// the production build (see debug-routes-excluded.test.ts). So instead of
// driving the browser we assert the wiring: the component references the
// sender-confirmation copy and both locales define it with non-empty text.

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const I18N_KEY = 'filesharing.encryptPanel.senderConfirmation'

test('the Done screen renders the sender-confirmation copy', () => {
    const done = readFileSync(
        `${repoRoot}src/lib/components/filesharing/Done.svelte`,
        'utf8'
    )
    expect(done).toContain(I18N_KEY)
})

for (const lang of ['en', 'nl'] as const) {
    test(`the ${lang} locale defines a non-empty sender-confirmation string`, () => {
        const messages = JSON.parse(
            readFileSync(`${repoRoot}src/lib/locales/${lang}.json`, 'utf8')
        )
        const value = messages.filesharing.encryptPanel.senderConfirmation
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
    })
}
