import { describe, it, expect } from 'vitest'
import type { Event } from '@sentry/browser'
import { sanitizeReportText, scrubEvent } from './reportScrub'

const UUID = '3f1c9a2b-4d5e-6789-0abc-def012345678'

describe('sanitizeReportText', () => {
    it('redacts recipient and download-reference query parameters in a URL', () => {
        const clean = sanitizeReportText(
            `https://postguard.eu/download?uuid=${UUID}&recipient=alice%40example.com`
        )
        expect(clean).not.toContain(UUID)
        expect(clean).not.toContain('alice%40example.com')
        expect(clean).toContain('https://postguard.eu/download')
        expect(clean).toContain('uuid=[redacted]')
        expect(clean).toContain('recipient=[redacted]')
    })

    it('redacts token and email query parameters', () => {
        const clean = sanitizeReportText(
            '/decrypt?token=abc123secret&email=bob@example.com'
        )
        expect(clean).not.toContain('abc123secret')
        expect(clean).not.toContain('bob@example.com')
    })

    it('redacts a bare download reference embedded in a message (path segment)', () => {
        const clean = sanitizeReportText(
            `NetworkError: GET https://main.postguard.eu/v2/download/${UUID} failed`
        )
        expect(clean).not.toContain(UUID)
        expect(clean).toContain('[redacted]')
    })

    it('leaves text without sensitive values untouched', () => {
        const msg = 'TypeError: cannot read properties of undefined'
        expect(sanitizeReportText(msg)).toBe(msg)
    })
})

describe('scrubEvent', () => {
    it('redacts sensitive values from the exception message, event message, request url and string extras', () => {
        const event: Event = {
            message: 'failed on ?recipient=alice%40example.com',
            exception: {
                values: [
                    {
                        type: 'NetworkError',
                        value: `GET https://main.postguard.eu/v2/download/${UUID} failed`,
                    },
                ],
            },
            request: {
                url: `https://postguard.eu/download?uuid=${UUID}`,
            },
            extra: {
                url: `https://postguard.eu/download?uuid=${UUID}&recipient=alice%40example.com`,
                viewport: '800x600',
            },
        }

        const scrubbed = scrubEvent(event)

        const serialized = JSON.stringify(scrubbed)
        expect(serialized).not.toContain(UUID)
        expect(serialized).not.toContain('alice%40example.com')
        // Non-sensitive diagnostic context is preserved.
        expect(scrubbed.extra?.viewport).toBe('800x600')
    })

    it('is a no-op on an event with no sensitive fields', () => {
        const event: Event = {
            exception: {
                values: [
                    { type: 'TypeError', value: 'undefined is not a function' },
                ],
            },
        }
        expect(scrubEvent(event).exception?.values?.[0].value).toBe(
            'undefined is not a function'
        )
    })
})
