import '$lib/i18n'
import { locale, waitLocale } from 'svelte-i18n'
import { browser } from '$app/environment'

export const ssr = false
export const prerender = false

if (browser) {
    const stored = localStorage.getItem('preferredLanguage')
    if (stored) {
        locale.set(stored)
    } else {
        const lang = window.navigator.language
        locale.set(lang.startsWith('nl') ? 'nl-NL' : 'en-US')
    }
}

await waitLocale()
