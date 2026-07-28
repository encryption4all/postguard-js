<script lang="ts">
    import '@privacybydesign/yivi-css'
    import { onMount } from 'svelte'

    interface props {
        /** `qr` renders (and, on mobile, forces) a scannable QR code. `button`
         *  renders Yivi's native "Open Yivi app" button for the user to tap —
         *  used on mobile so the app opens from a genuine user gesture. We must
         *  never auto-click that button: it points at a Universal Link
         *  (https://open.yivi.app/...), and iOS only hands a Universal Link off
         *  to the installed app when the navigation happens inside an active
         *  user-activation context. A synthetic click fired from the load
         *  observer runs outside that window, so iOS ignores the app and just
         *  loads the fallback web page in Safari — which looks exactly as if no
         *  Yivi app were installed. */
        mode?: 'qr' | 'button'
        id?: string
        responsive?: boolean
        /** Called once when the Yivi widget enters a terminal, recoverable
         *  state — the disclosure was cancelled, the Yivi app was closed
         *  mid-flow, or the session timed out. In all of these YiviWeb renders
         *  its own small "session cancelled / try again" screen (identified by
         *  the `.yivi-web-restart-button`) but the surrounding pg-js
         *  `encrypt()` promise never settles, so the send flow would otherwise
         *  hang silently. The parent uses this to surface a clear recovery
         *  action instead. See #294. */
        oninterrupted?: () => void
    }

    let {
        mode = 'qr',
        id = 'crypt-irma-qr',
        responsive = false,
        oninterrupted,
    }: props = $props()

    let widgetLoaded = $state(false)
    let containerEl: HTMLDivElement

    onMount(() => {
        let autoClicked = false
        let interrupted = false

        const observer = new MutationObserver(() => {
            // Terminal recoverable states (Cancelled / TimedOut / Error) all
            // render a restart button. Detect it and hand control back to the
            // parent exactly once so it can offer a clear retry instead of
            // leaving the user stuck on Yivi's buried "try again" link.
            if (
                !interrupted &&
                containerEl.querySelector('.yivi-web-restart-button')
            ) {
                interrupted = true
                observer.disconnect()
                oninterrupted?.()
                return
            }

            // Check for a rendered QR code (Yivi renders it as a <canvas> or,
            // in newer versions, an inline <svg>). We keep observing after it
            // loads so the terminal-state detection above still fires if the
            // user later cancels or the session times out.
            if (
                containerEl.querySelector('canvas') ||
                containerEl.querySelector('.yivi-web-qr-code')
            ) {
                widgetLoaded = true
                return
            }

            // On mobile, YiviWeb shows an "Open Yivi app" button instead of a
            // QR code. Handle based on mode:
            if (mode === 'button') {
                // Button mode: leave Yivi's native app button in place for the
                // user to tap. We must NOT auto-click it — see the `mode` prop
                // doc: a synthetic click can't open the app on iOS and would
                // instead navigate the tab to the Yivi fallback web page.
                if (containerEl.querySelector('.yivi-web-button-link')) {
                    widgetLoaded = true
                }
                return
            }

            // QR mode: on mobile YiviWeb first shows the app button, so click
            // its "QR code" option once to force the QR to render. (On desktop
            // the QR renders directly and this button is absent.)
            if (!autoClicked) {
                const chooseQR = containerEl.querySelector<HTMLElement>(
                    '[data-yivi-glue-transition="chooseQR"]'
                )
                if (chooseQR) {
                    autoClicked = true
                    chooseQR.click()
                }
            }
        })
        observer.observe(containerEl, { childList: true, subtree: true })
        return () => observer.disconnect()
    })
</script>

<div
    {id}
    class="yivi-qr-container"
    class:responsive
    class:button-mode={mode === 'button'}
    bind:this={containerEl}
>
    {#if !widgetLoaded}
        <svg class="spinner" viewBox="0 0 24 24" width="32" height="32">
            <circle
                class="spinner-circle"
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
            ></circle>
        </svg>
    {/if}
</div>

<style>
    .yivi-qr-container {
        width: 330px;
        height: 330px;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        background: white;
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-sm);
        padding: 4px;
    }

    .yivi-qr-container.responsive {
        width: 100%;
        max-width: 330px;
        aspect-ratio: 1 / 1;
        height: auto;
        min-height: 200px;
    }

    .yivi-qr-container.responsive :global(canvas),
    .yivi-qr-container.responsive :global(svg) {
        width: 100% !important;
        height: auto !important;
    }

    /* Button mode renders Yivi's own self-styled "Open Yivi app" widget rather
       than a QR code, so drop the fixed square QR frame and let the widget size
       to its natural content. Placed after the `.responsive` rules so it wins
       when a caller sets both (the decrypt/download flows do). */
    .yivi-qr-container.button-mode {
        width: 100%;
        max-width: 360px;
        height: auto;
        min-height: 0;
        aspect-ratio: auto;
        background: transparent;
        border: none;
        padding: 0;
        overflow: visible;
    }

    .spinner {
        animation: spin 1s linear infinite;
        color: var(--pg-text-secondary);
    }

    .spinner-circle {
        stroke-dasharray: 60;
        stroke-dashoffset: 0;
        animation: dash 1.5s ease-in-out infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dashoffset: 60;
        }
        50% {
            stroke-dashoffset: 15;
        }
        100% {
            stroke-dashoffset: 60;
        }
    }
</style>
