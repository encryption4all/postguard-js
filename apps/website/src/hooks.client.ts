import type { HandleClientError } from '@sveltejs/kit'
import { initErrorReporting } from '$lib/errorReporting'

initErrorReporting()

export const handleError: HandleClientError = ({ error }) => {
    // When a new deployment happens, old JS chunks are gone.
    // Detect this and reload the page to get fresh assets.
    if (
        error instanceof TypeError &&
        error.message.includes('Importing a module script failed')
    ) {
        window.location.reload()
        return
    }
}
