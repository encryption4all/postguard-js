import { writable, type Readable } from 'svelte/store'

/**
 * Body of cryptify's `GET /limits` (encryption4all/postguard#386). All three
 * numbers are decimal: bytes, bytes, days.
 */
export type LimitsResponse = {
    per_upload_limit_bytes: number
    rolling_limit_bytes: number
    window_days: number
}

/** The served limits, in the units the compose screen works in. */
export type Limits = {
    perUploadBytes: number
    rollingBytes: number
    windowMs: number
}

export type LimitsState =
    | { status: 'loading' }
    | { status: 'failed' }
    | { status: 'ready'; limits: Limits }

export type LimitsStore = Readable<LimitsState> & {
    /** Fetch `GET {filehostUrl}/limits` and publish the outcome. */
    load(filehostUrl: string, fetchImpl?: typeof fetch): Promise<LimitsState>
}

const DAY_MS = 24 * 60 * 60 * 1000

function toLimits(body: unknown): Limits | null {
    const parsed = body as Partial<LimitsResponse> | null
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof parsed.per_upload_limit_bytes !== 'number' ||
        typeof parsed.rolling_limit_bytes !== 'number' ||
        typeof parsed.window_days !== 'number'
    ) {
        return null
    }
    return {
        perUploadBytes: parsed.per_upload_limit_bytes,
        rollingBytes: parsed.rolling_limit_bytes,
        windowMs: parsed.window_days * DAY_MS,
    }
}

export function createLimitsStore(): LimitsStore {
    const state = writable<LimitsState>({ status: 'loading' })
    return {
        subscribe: state.subscribe,
        async load(filehostUrl, fetchImpl = fetch) {
            let next: LimitsState = { status: 'failed' }
            try {
                const response = await fetchImpl(
                    `${filehostUrl.replace(/\/+$/, '')}/limits`
                )
                if (response.ok) {
                    const limits = toLimits(await response.json())
                    if (limits) next = { status: 'ready', limits }
                }
            } catch {
                // Host unreachable, blocked by CORS, or a body that isn't the
                // JSON we expect. Each of those fails closed.
            }
            state.set(next)
            return next
        },
    }
}

/**
 * The upload limits cryptify enforces, fetched once per compose screen.
 *
 * Nothing here falls back to a baked-in default when the fetch fails: the send
 * button stays disabled until the numbers arrive. The fetch targets the same
 * host the upload itself needs, so a failure means the upload was never going
 * to succeed, and saying so at page load is cheaper for the user than saying
 * it after they have picked files, encrypted them and waited out a
 * multi-gigabyte transfer. A fallback would also be a second copy of numbers
 * only the server can be right about, read in the one case where nobody can
 * see that it is stale: when the fetch failed.
 */
export const uploadLimits = createLimitsStore()

/** Whether cryptify has told us its limits yet. Sending is gated on this. */
export function limitsKnown(
    state: LimitsState
): state is { status: 'ready'; limits: Limits } {
    return state.status === 'ready'
}

/**
 * The largest upload we accept right now: the per-upload cap, or what is left
 * of the rolling window if that is smaller. `usedBytes` is this browser's own
 * localStorage estimate, so the cap is authoritative but the remainder is not.
 */
export function effectiveLimitBytes(limits: Limits, usedBytes: number): number {
    return Math.min(limits.perUploadBytes, limits.rollingBytes - usedBytes)
}
