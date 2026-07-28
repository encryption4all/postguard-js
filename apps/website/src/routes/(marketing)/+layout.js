import '$lib/i18n'
import { locale, waitLocale } from 'svelte-i18n'
import { browser } from '$app/environment'

export const prerender = true
export const trailingSlash = 'always'

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
