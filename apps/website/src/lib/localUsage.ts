import { ROLLING_LIMIT } from '$lib/env'
import { browser } from '$app/environment'

const STORAGE_KEY = 'postguard_upload_history'
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

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

/** Remove entries older than the 14-day rolling window. */
function pruneOld(records: UploadRecord[]): UploadRecord[] {
    const cutoff = Date.now() - WINDOW_MS
    return records.filter((r) => r.timestamp >= cutoff)
}

/** Record a successful upload. Call after the server confirms the upload. */
export function recordUpload(bytes: number): void {
    const records = pruneOld(readRecords())
    records.push({ bytes, timestamp: Date.now() })
    writeRecords(records)
}

/** Total bytes uploaded in the current 14-day window (from this browser). */
export function getLocalUsedBytes(): number {
    const records = pruneOld(readRecords())
    return records.reduce((sum, r) => sum + r.bytes, 0)
}

/** Estimated remaining bytes before hitting the rolling limit. */
export function getLocalRemainingBytes(): number {
    return Math.max(0, ROLLING_LIMIT - getLocalUsedBytes())
}

/** Earliest date when some capacity frees up (oldest record expires). */
export function getLocalResetsAt(): Date | null {
    const records = pruneOld(readRecords())
    if (records.length === 0) return null
    const oldest = Math.min(...records.map((r) => r.timestamp))
    return new Date(oldest + WINDOW_MS)
}

/** Check whether a new upload of `bytes` would exceed the rolling limit. */
export function wouldExceedLimit(bytes: number): boolean {
    return getLocalUsedBytes() + bytes > ROLLING_LIMIT
}
