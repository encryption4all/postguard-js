import { PostGuard, type RetryEvent } from '@e4a/pg-js'
import { writable } from 'svelte/store'
import { PKG_URL, FILEHOST_URL, CHUNK_SIZE } from '$lib/env'

/**
 * Latest cryptify retry event observed during an upload or download.
 * pg-js v1.4 retries chunk PUTs and downloads with exponential backoff on
 * transient failures (5xx, network errors, internal timeouts). Components
 * subscribe to this store to surface "retrying… (attempt N of M)" status
 * during the retry window. `null` whenever the SDK isn't actively retrying.
 *
 * Cleared by the consumer (e.g. SendButton) on successful completion or
 * terminal error so a stale event doesn't leak into the next operation.
 */
export const retryStatus = writable<RetryEvent | null>(null)

export const pg = new PostGuard({
    pkgUrl: PKG_URL,
    cryptifyUrl: FILEHOST_URL,
    // Identifies traffic from this site in cryptify's per-channel
    // upload metrics. Without this, cryptify falls back to matching the
    // browser Origin header, which collides with the Outlook add-in
    // (also served from a *.postguard.eu host).
    headers: { 'X-Cryptify-Source': 'website' },
    ...(CHUNK_SIZE !== undefined && { uploadChunkSize: CHUNK_SIZE }),
    retry: {
        // Defaults (5 attempts, 500ms initial) exhaust the retry budget in
        // ~7.5s — shorter than a typical cryptify restart, so a brief outage
        // surfaces as a hard failure to the user. Stretch the budget so the
        // total wait covers a realistic restart window (~90s).
        maxAttempts: 8,
        initialDelayMs: 1000,
        onRetry: (event) => retryStatus.set(event),
    },
})
