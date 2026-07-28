import { derived, writable, get } from 'svelte/store'
import { browser } from '$app/environment'

export const currSelected = writable(-1)

// localStorage writes can throw QuotaExceededError when an email's `raw`
// MIME pushes the cache past the ~5–10 MB browser cap (typical for
// PostGuard envelopes carrying multi-MB attachments). Persistence is a
// nice-to-have — the in-memory stores are the source of truth for this
// session, so we drop on overflow rather than crashing the decrypt flow.
function safeSetItem(key, value) {
    if (!browser) return
    try {
        localStorage.setItem(key, value)
    } catch (e) {
        console.warn(
            `[PostGuard] Failed to persist "${key}" to localStorage; continuing in memory only.`,
            e
        )
    }
}

export const boolCacheEmail = writable(
    browser && JSON.parse(localStorage.getItem('boolCacheEmail') || 'true')
)

boolCacheEmail.subscribe((val) =>
    safeSetItem('boolCacheEmail', JSON.stringify(val))
)

export const boolCacheYivi = writable(
    browser && JSON.parse(localStorage.getItem('boolCacheYivi') || 'true')
)

boolCacheYivi.subscribe((val) =>
    safeSetItem('boolCacheYivi', JSON.stringify(val))
)

const storeKrCache = []

export const krCache = writable(
    browser &&
        JSON.parse(
            (get(boolCacheYivi) && localStorage.getItem('krCache')) ||
                JSON.stringify(storeKrCache)
        )
)

// Keep localStorage in sync if boolCacheYivi is true
krCache.subscribe((val) => {
    if (!get(boolCacheYivi)) return
    safeSetItem('krCache', JSON.stringify(val))
})

const storeEmails = [
    // {
    //   id: 0,
    //   from: '',
    //   to: '',
    //   date: '',
    //   subject: '',
    //   raw: ''
    // }
]

export const emails = writable(
    browser &&
        JSON.parse(
            (get(boolCacheEmail) && localStorage.getItem('emails')) ||
                JSON.stringify(storeEmails)
        )
)

// Keep localStorage in sync if boolCacheEmail is true
emails.subscribe((val) => {
    if (!get(boolCacheEmail)) return
    safeSetItem('emails', JSON.stringify(val))
})

export const currentId = derived(emails, ($emails) =>
    $emails
        ? $emails.reduce((prev, next) => (next.id > prev ? next.id : prev), -1)
        : -1
)

export const nextId = derived(currentId, ($currentId) => $currentId + 1)
