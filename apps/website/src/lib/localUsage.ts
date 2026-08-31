import { browser } from '$app/environment'

const STORAGE_KEY = 'postguard_upload_history'

interface UploadRecord {
    bytes: number
    timestamp: number
}

function readRecords(): UploadRecord[] {
    if (!browser) return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(
            (r: unknown): r is UploadRecord =>
                typeof r === 'object' &&
                r !== null &&
                typeof (r as UploadRecord).bytes === 'number' &&
                typeof (r as UploadRecord).timestamp === 'number'
        )
    } catch {
        return []
    }
}

function writeRecords(records: UploadRecord[]): void {
    if (!browser) return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    } catch {
        // localStorage full or unavailable — degrade silently
    }
}

// `windowMs` and `rollingLimitBytes` are cryptify's own numbers, fetched from
// `GET /limits` (see $lib/limits) rather than baked in here, so every entry
// point takes them from the caller.

/** Remove entries older than the rolling window. */
function pruneOld(records: UploadRecord[], windowMs: number): UploadRecord[] {
    const cutoff = Date.now() - windowMs
    return records.filter((r) => r.timestamp >= cutoff)
}

/** Record a successful upload. Call after the server confirms the upload. */
export function recordUpload(bytes: number, windowMs: number): void {
    const records = pruneOld(readRecords(), windowMs)
    records.push({ bytes, timestamp: Date.now() })
    writeRecords(records)
}

/** Total bytes uploaded in the current window (from this browser). */
export function getLocalUsedBytes(windowMs: number): number {
    const records = pruneOld(readRecords(), windowMs)
    return records.reduce((sum, r) => sum + r.bytes, 0)
}

/** Estimated remaining bytes before hitting the rolling limit. */
export function getLocalRemainingBytes(
    rollingLimitBytes: number,
    windowMs: number
): number {
    return Math.max(0, rollingLimitBytes - getLocalUsedBytes(windowMs))
}

/** Earliest date when some capacity frees up (oldest record expires). */
export function getLocalResetsAt(windowMs: number): Date | null {
    const records = pruneOld(readRecords(), windowMs)
    if (records.length === 0) return null
    const oldest = Math.min(...records.map((r) => r.timestamp))
    return new Date(oldest + windowMs)
}

/** Check whether a new upload of `bytes` would exceed the rolling limit. */
export function wouldExceedLimit(
    bytes: number,
    rollingLimitBytes: number,
    windowMs: number
): boolean {
    return getLocalUsedBytes(windowMs) + bytes > rollingLimitBytes
}
