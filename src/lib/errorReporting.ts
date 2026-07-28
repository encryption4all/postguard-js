import * as Sentry from '@sentry/browser'
import { APP_VERSION, GLITCHTIP_DSN } from '$lib/env'
import { scrubEvent } from '$lib/reportScrub'

let initialised = false

export function initErrorReporting(): void {
    if (initialised || !GLITCHTIP_DSN || typeof window === 'undefined') return
    Sentry.init({
        dsn: GLITCHTIP_DSN,
        release: APP_VERSION,
        // Manual capture only — no automatic global error / unhandledrejection
        // handlers, no breadcrumb tracing. User must press the report button.
        defaultIntegrations: false,
        sendClientReports: false,
        // Last-line scrub for anything sensitive that slips into an event.
        beforeSend: scrubEvent,
    })
    initialised = true
}

export function isErrorReportingEnabled(): boolean {
    return !!GLITCHTIP_DSN
}

/** Captures the error with rich client context and waits for transport.
 *  Resolves to true if the report was delivered within the timeout. */
export async function reportError(
    error: unknown,
    extra: Record<string, unknown> = {}
): Promise<boolean> {
    if (!isErrorReportingEnabled()) return false
    initErrorReporting()

    const ctx: Record<string, unknown> = { ...extra }
    if (typeof window !== 'undefined') {
        // Origin + pathname only — the query string can carry recipient and
        // download-reference values that a diagnostic report does not need.
        ctx.url = window.location.origin + window.location.pathname
        ctx.viewport = `${window.innerWidth}x${window.innerHeight}`
        ctx.devicePixelRatio = window.devicePixelRatio
    }
    if (typeof navigator !== 'undefined') {
        ctx.userAgent = navigator.userAgent
        ctx.language = navigator.language
    }

    Sentry.captureException(error, { extra: ctx })
    return Sentry.flush(3000)
}
