<script lang="ts">
    import { _, locale } from 'svelte-i18n'
    import { APP_VERSION } from '$lib/env'
    import { reportError, isErrorReportingEnabled } from '$lib/errorReporting'

    interface props {
        error: unknown
        context?: Record<string, unknown>
    }

    let { error, context = {} }: props = $props()

    type SendState = 'idle' | 'sending' | 'sent' | 'failed'
    let sendState: SendState = $state('idle')

    let reportingEnabled = isErrorReportingEnabled()

    async function sendReport() {
        if (sendState === 'sending' || sendState === 'sent') return
        sendState = 'sending'
        try {
            const ok = await reportError(error, {
                appVersion: APP_VERSION,
                uiLocale: $locale,
                ...context,
            })
            sendState = ok ? 'sent' : 'failed'
        } catch {
            sendState = 'failed'
        }
    }
</script>

{#if reportingEnabled}
    <div class="report-wrapper">
        <button
            class="report-btn"
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

        <!-- Stable live-region wrapper so AT announces the failed-state
             message when it appears (WCAG 4.1.3). -->
        <div role="status" aria-live="polite" class="status-region">
            {#if sendState === 'failed'}
                <p class="status error">{$_('filesharing.crash.failed')}</p>
            {/if}
        </div>
    </div>
{/if}

<style>
    .report-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .report-btn {
        padding: 0.65rem 1.25rem;
        background-color: var(--pg-text);
        color: var(--pg-general-background);
        border: 1px solid transparent;
        border-radius: var(--pg-border-radius-sm);
        cursor: pointer;
        font-size: var(--pg-font-size-base);
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-medium);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s ease;
        /* Lock width so swapping labels doesn't reflow the row. */
        min-width: 14rem;
    }

    .report-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .report-btn:not(:disabled):hover {
        transform: translateY(-1px);
    }

    .report-btn:focus-visible {
        outline: 2px solid var(--pg-text);
        outline-offset: 2px;
    }

    .status {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        font-family: var(--pg-font-family);
        text-align: center;
    }

    .status.error {
        color: var(--pg-input-error);
    }
</style>
