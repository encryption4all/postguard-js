<script lang="ts">
    import { _, locale } from 'svelte-i18n'
    import { APP_VERSION } from '$lib/env'
    import { reportError, isErrorReportingEnabled } from '$lib/errorReporting'

    interface props {
        error: unknown
        reset?: () => void
    }

    let { error, reset }: props = $props()

    type SendState = 'idle' | 'sending' | 'sent' | 'failed'
    let sendState: SendState = $state('idle')

    async function sendReport() {
        if (sendState === 'sending' || sendState === 'sent') return
        sendState = 'sending'
        // Sentry's transport is fire-and-forget but the SDK can still
        // throw synchronously on a malformed DSN or an internal init
        // failure. Catch so the button isn't stuck on "Sending…" forever.
        try {
            const ok = await reportError(error, {
                appVersion: APP_VERSION,
                uiLocale: $locale,
            })
            sendState = ok ? 'sent' : 'failed'
        } catch {
            sendState = 'failed'
        }
    }

    let reportingEnabled = isErrorReportingEnabled()
</script>

<div class="crash-container">
    <div class="crash-content">
        <h3 class="crash-title">{$_('filesharing.crash.title')}</h3>
        <p class="crash-message">{$_('filesharing.crash.message')}</p>

        <!-- Stable live-region wrapper so screen readers announce the
             failed-state message when it appears (WCAG 4.1.3 Status
             Messages, Level AA). The wrapper exists from first render;
             only its child swaps in, which is the announcement trigger. -->
        <div role="status" aria-live="polite" class="crash-status-region">
            {#if sendState === 'failed'}
                <p class="crash-status error">
                    {$_('filesharing.crash.failed')}
                </p>
            {/if}
        </div>

        <div class="crash-actions">
            {#if reportingEnabled}
                <button
                    class="crash-btn primary"
                    type="button"
                    disabled={sendState === 'sending' || sendState === 'sent'}
                    onclick={sendReport}
                >
                    {#if sendState === 'sending'}
                        {$_('filesharing.crash.sending')}
                    {:else if sendState === 'sent'}
                        {$_('filesharing.crash.sentButton')}
                    {:else}
                        {$_('filesharing.crash.report')}
                    {/if}
                </button>
            {/if}
            {#if reset}
                <button class="crash-btn" type="button" onclick={reset}>
                    {$_('filesharing.tryAgain')}
                </button>
            {/if}
        </div>
    </div>
</div>

<style>
    .crash-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-height: 400px;
        padding: 1.5rem;
    }

    .crash-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        max-width: 480px;
        gap: 1rem;
    }

    .crash-title {
        color: var(--pg-input-error);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
    }

    .crash-message {
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-base);
        line-height: 1.5;
        margin: 0;
    }

    .crash-status {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        font-family: var(--pg-font-family);
    }

    .crash-status.error {
        color: var(--pg-input-error);
    }

    .crash-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .crash-btn {
        padding: 0.65rem 1.25rem;
        background-color: var(--pg-soft-background);
        color: var(--pg-text);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-sm);
        cursor: pointer;
        font-size: var(--pg-font-size-base);
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-medium);
        transition: all 0.2s ease;
    }

    .crash-btn.primary {
        background-color: var(--pg-text);
        color: var(--pg-general-background);
        border-color: transparent;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        /* Lock width so swapping the label between "Tell PostGuard…",
           "Sending…", and "Thank you!" doesn't reflow the row. Picked to
           comfortably fit the longest English label. */
        min-width: 14rem;
    }

    .crash-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .crash-btn:not(:disabled):hover {
        transform: translateY(-1px);
    }

    .crash-btn:focus-visible {
        outline: 2px solid var(--pg-text);
        outline-offset: 2px;
    }
</style>
