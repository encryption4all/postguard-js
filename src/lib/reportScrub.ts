import type { Event } from '@sentry/browser'

// Query parameters that can carry recipient-identifying data or a
// single-use download reference. Their values are stripped from any URL
// or error text before a report leaves the browser so an opt-in crash
// report never carries more than the diagnostic minimum.
const SENSITIVE_QUERY_PARAMS = ['uuid', 'recipient', 'token', 'email']
const REDACTED = '[redacted]'

const sensitiveParamPattern = new RegExp(
    `([?&](?:${SENSITIVE_QUERY_PARAMS.join('|')})=)[^&#\\s'"]*`,
    'gi'
)

// A download reference is a UUID and can surface inside a request URL
// (e.g. as a path segment) in a pg-js network error message, not only as
// a query parameter, so redact that shape wherever it appears in text.
const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Redacts recipient-identifying and download-reference values from a
 *  string — whether they appear as query parameters (`?recipient=…`) or as
 *  a bare download reference embedded in a message. Everything else is
 *  left untouched. */
export function sanitizeReportText(text: string): string {
    return text
        .replace(sensitiveParamPattern, `$1${REDACTED}`)
        .replace(uuidPattern, REDACTED)
}

/** Scrubs a Sentry event in place: redacts sensitive values from the event
 *  message, every captured exception message (e.g. pg-js network errors),
 *  the request URL, and any string values in the extra context. Wired up
 *  as Sentry's `beforeSend`. */
export function scrubEvent<T extends Event>(event: T): T {
    if (event.message) event.message = sanitizeReportText(event.message)

    for (const value of event.exception?.values ?? []) {
        if (value.value) value.value = sanitizeReportText(value.value)
    }

    if (event.request?.url)
        event.request.url = sanitizeReportText(event.request.url)

    const extra = event.extra
    if (extra) {
        for (const key of Object.keys(extra)) {
            const v = extra[key]
            if (typeof v === 'string') extra[key] = sanitizeReportText(v)
        }
    }

    return event
}
