import { describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import {
    createLimitsStore,
    effectiveLimitBytes,
    limitsKnown,
    type LimitsResponse,
} from './limits'

// The limits come from cryptify and only from cryptify. What these tests hold
// is the fail-closed half of that: while the fetch is in flight, and after it
// has failed, the store carries no limits at all, so every gate reading it
// (the send button, the dropzone cap) stays shut. That branch is the one a
// later refactor is most likely to "fix" by putting a default back.

const SERVED: LimitsResponse = {
    per_upload_limit_bytes: 4_000_000_000,
    rolling_limit_bytes: 9_000_000_000,
    window_days: 14,
}

const DAY_MS = 24 * 60 * 60 * 1000

function served(body: unknown, status = 200): typeof fetch {
    return (() =>
        Promise.resolve(
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
            })
        )) as unknown as typeof fetch
}

describe('the upload limits store', () => {
    it('knows no limits before the fetch answers', () => {
        const limits = createLimitsStore()

        expect(get(limits)).toEqual({ status: 'loading' })
        expect(limitsKnown(get(limits))).toBe(false)
    })

    it('requests /limits on the filehost and publishes what it serves', async () => {
        const limits = createLimitsStore()
        const urls: string[] = []
        const fetchImpl = ((url: string) => {
            urls.push(url)
            return served(SERVED)(url)
        }) as unknown as typeof fetch

        const state = await limits.load('https://cryptify.example/', fetchImpl)

        expect(urls).toEqual(['https://cryptify.example/limits'])
        expect(state).toEqual({
            status: 'ready',
            limits: {
                perUploadBytes: 4_000_000_000,
                rollingBytes: 9_000_000_000,
                windowMs: 14 * DAY_MS,
            },
        })
        expect(get(limits)).toEqual(state)
        expect(limitsKnown(state)).toBe(true)
    })

    it('fails closed when the filehost is unreachable', async () => {
        const limits = createLimitsStore()
        const fetchImpl = (() =>
            Promise.reject(new TypeError('fetch failed'))) as typeof fetch

        const state = await limits.load('https://cryptify.example', fetchImpl)

        expect(state).toEqual({ status: 'failed' })
        expect(get(limits)).toEqual({ status: 'failed' })
        expect(limitsKnown(state)).toBe(false)
    })

    it('fails closed on a non-2xx response', async () => {
        const limits = createLimitsStore()

        const state = await limits.load(
            'https://cryptify.example',
            served(SERVED, 503)
        )

        expect(state).toEqual({ status: 'failed' })
        expect(limitsKnown(get(limits))).toBe(false)
    })

    it('fails closed on a body that is missing a field', async () => {
        const limits = createLimitsStore()

        const state = await limits.load(
            'https://cryptify.example',
            served({ per_upload_limit_bytes: 4_000_000_000, window_days: 14 })
        )

        expect(state).toEqual({ status: 'failed' })
        expect(limitsKnown(get(limits))).toBe(false)
    })
})

describe('effectiveLimitBytes', () => {
    const limits = {
        perUploadBytes: 4_000_000_000,
        rollingBytes: 9_000_000_000,
        windowMs: 14 * DAY_MS,
    }

    it('caps at the per-upload limit while the window has room to spare', () => {
        expect(effectiveLimitBytes(limits, 1_000_000_000)).toBe(4_000_000_000)
    })

    it('caps at what is left of the rolling window once that is smaller', () => {
        expect(effectiveLimitBytes(limits, 6_000_000_000)).toBe(3_000_000_000)
    })
})
