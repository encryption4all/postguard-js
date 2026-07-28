import { browser } from '$app/environment'
import type { AttributeCon } from '$lib/types/filesharing/attributes'

/**
 * Session-scoped persistence for the /fileshare compose step so a page refresh
 * doesn't wipe a half-written message: the recipient email(s), any requested
 * attributes, the message, and the attached files are restored.
 *
 * Scope & lifetime:
 *  - Files are stored in IndexedDB (they can be large — sessionStorage can't
 *    hold them). Metadata rides along in the same store.
 *  - A marker in sessionStorage bounds the draft to the current tab session:
 *    it survives a refresh but not closing the tab. On the next load in a new
 *    session we treat any stored draft as stale and drop it, so sensitive file
 *    contents don't linger across sessions.
 *  - The draft is also cleared explicitly once a send succeeds.
 *
 * Privacy note: while a session is live the attached files sit unencrypted in
 * the browser's IndexedDB. That is the deliberate trade-off for surviving a
 * refresh; it is dropped on tab close (next-load cleanup) and on successful
 * send.
 */

const DB_NAME = 'postguard-fileshare'
const DB_VERSION = 1
const STORE = 'draft'
const META_KEY = 'meta'
const FILES_KEY = 'files'
const SESSION_MARKER = 'pg-fileshare-session'

export interface DraftMeta {
    recipients: { email: string; extra: AttributeCon }[]
    message: string
}

export interface FileshareDraft extends DraftMeta {
    files: File[]
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) {
                req.result.createObjectStore(STORE)
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
    const db = await openDB()
    try {
        return await new Promise<T | undefined>((resolve, reject) => {
            const req = db
                .transaction(STORE, 'readonly')
                .objectStore(STORE)
                .get(key)
            req.onsuccess = () => resolve(req.result as T | undefined)
            req.onerror = () => reject(req.error)
        })
    } finally {
        db.close()
    }
}

async function idbPut(key: string, value: unknown): Promise<void> {
    const db = await openDB()
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            tx.objectStore(STORE).put(value, key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    } finally {
        db.close()
    }
}

async function idbDelete(keys: string[]): Promise<void> {
    const db = await openDB()
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            for (const key of keys) store.delete(key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    } finally {
        db.close()
    }
}

function sameSession(): boolean {
    return sessionStorage.getItem(SESSION_MARKER) === '1'
}

function markSession(): void {
    sessionStorage.setItem(SESSION_MARKER, '1')
}

/**
 * Load the draft for this session, or `null` if there is nothing to restore.
 * On the first load of a new tab session this also drops any stale draft left
 * over from a previous session.
 */
export async function loadDraft(): Promise<FileshareDraft | null> {
    if (!browser) return null
    try {
        if (!sameSession()) {
            await clearDraft()
            markSession()
            return null
        }
        const [meta, files] = await Promise.all([
            idbGet<DraftMeta>(META_KEY),
            idbGet<File[]>(FILES_KEY),
        ])
        const hasFiles = !!files && files.length > 0
        const hasMeta =
            !!meta &&
            (meta.message.trim().length > 0 ||
                meta.recipients.some((r) => r.email.trim().length > 0))
        if (!hasFiles && !hasMeta) return null
        return {
            recipients: meta?.recipients ?? [{ email: '', extra: [] }],
            message: meta?.message ?? '',
            files: files ?? [],
        }
    } catch {
        return null
    }
}

export async function saveDraftMeta(meta: DraftMeta): Promise<void> {
    if (!browser) return
    try {
        markSession()
        await idbPut(META_KEY, meta)
    } catch {
        // Best-effort: a failed draft save must never break composing.
    }
}

export async function saveDraftFiles(files: File[]): Promise<void> {
    if (!browser) return
    try {
        markSession()
        await idbPut(FILES_KEY, files)
    } catch {
        // Best-effort.
    }
}

export async function clearDraft(): Promise<void> {
    if (!browser) return
    try {
        await idbDelete([META_KEY, FILES_KEY])
    } catch {
        // Best-effort.
    }
}
