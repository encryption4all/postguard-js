import { browser } from '$app/environment'

function isMobile(): boolean {
    if (!browser || typeof window === 'undefined') {
        return false
    }
    // IE11 doesn't have window.navigator, test differently
    // https://stackoverflow.com/questions/21825157/internet-explorer-11-detection
    // @ts-expect-error IE11-only API
    if (!!window.MSInputMethodContext && !!document.documentMode) {
        return false
    }

    if (/Android/i.test(window.navigator.userAgent)) {
        return true
    }

    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    // @ts-expect-error MSStream is not in standard types
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        return true
    }

    // https://stackoverflow.com/questions/57776001/how-to-detect-ipad-pro-as-ipad-using-javascript
    if (
        /Macintosh/.test(navigator.userAgent) &&
        navigator.maxTouchPoints &&
        navigator.maxTouchPoints > 2
    ) {
        return true
    }

    // Neither Android nor iOS, assuming desktop
    return false
}

export { isMobile }
