<!--
    Staging-only preview of the notification email cryptify *would* send
    to a recipient. On staging, cryptify runs with `staging_mode = true`
    (see cryptify/src/email.rs::send_email) and logs the email instead of
    dispatching via SMTP — which makes it tedious to grab a download link
    for testing.

    Source of truth for the rendering lives in cryptify, exposed via
    `GET /staging/preview/<uuid>`. This component fetches that JSON and
    drops the per-recipient HTML body into a sandboxed iframe via
    `srcdoc`, so the email's own inline styles render in isolation. The
    header bar (from / to / subject / reply-to + recipient switcher) is
    the only locally-rendered chrome.
-->
<script lang="ts">
    import { _ } from 'svelte-i18n'
    import { onMount } from 'svelte'
    import { FILEHOST_URL } from '$lib/env'

    interface RenderedEmail {
        recipient: string
        subject: string
        from: string
        reply_to: string | null
        html: string
        text: string
    }

    interface PreviewResponse {
        recipients: RenderedEmail[]
        confirmation: RenderedEmail | null
    }

    interface Props {
        uuid: string
        onClose: () => void
    }

    let { uuid, onClose }: Props = $props()

    type Status = 'loading' | 'ready' | 'empty' | 'error'
    let status: Status = $state('loading')
    let errorMessage = $state('')
    let data = $state<PreviewResponse | null>(null)
    /** Index into the flat list of [...recipients, confirmation?] */
    let activeIdx = $state(0)
    /** Which MIME alternative to show in the body. Mail clients pick
     *  HTML when available; the plain-text branch is what text-only
     *  clients (or accessibility tools) actually render. */
    let bodyView: 'html' | 'text' = $state('html')

    let allEmails = $derived.by<RenderedEmail[]>(() => {
        if (!data) return []
        return data.confirmation
            ? [...data.recipients, data.confirmation]
            : data.recipients
    })
    let active = $derived(allEmails[activeIdx])
    let isConfirmation = $derived(
        !!data?.confirmation && activeIdx === allEmails.length - 1
    )

    onMount(async () => {
        try {
            const url = `${FILEHOST_URL.replace(
                /\/$/,
                ''
            )}/staging/preview/${encodeURIComponent(uuid)}`
            const res = await fetch(url, { credentials: 'omit' })
            if (!res.ok) {
                status = 'error'
                errorMessage = `${res.status} ${res.statusText}`
                return
            }
            data = (await res.json()) as PreviewResponse
            if (allEmails.length === 0) {
                status = 'empty'
                return
            }
            status = 'ready'
        } catch (e) {
            status = 'error'
            errorMessage = e instanceof Error ? e.message : String(e)
        }
    })

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') onClose()
    }

    /** Inject `<base target="_blank">` into the rendered email HTML so
     *  anchor clicks open in a new top-level tab instead of trying to
     *  navigate the sandboxed iframe (which has no `allow-top-navigation`
     *  and would otherwise blank the body). The `allow-popups` /
     *  `allow-popups-to-escape-sandbox` flags already permit the new
     *  tab. We try to splice into an existing `<head>`; if cryptify ever
     *  changes the template shape, the prepended fallback still works
     *  because browsers tolerate a `<base>` before `<html>`. */
    function withBaseTarget(html: string): string {
        const tag = '<base target="_blank" rel="noopener">'
        const headIdx = html.search(/<head[^>]*>/i)
        if (headIdx >= 0) {
            const end = html.indexOf('>', headIdx) + 1
            return html.slice(0, end) + tag + html.slice(end)
        }
        return tag + html
    }
</script>

<svelte:window onkeydown={handleKey} />

<div
    class="backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="email-preview-title"
>
    <button
        class="backdrop-close"
        type="button"
        aria-label={$_('filesharing.emailPreview.close')}
        onclick={onClose}
    ></button>

    <div class="modal">
        <header class="modal-header">
            <div>
                <h2 id="email-preview-title">
                    {$_('filesharing.emailPreview.title')}
                </h2>
                <p class="modal-subtitle">
                    {$_('filesharing.emailPreview.subtitle')}
                </p>
            </div>
            <button
                class="close-btn"
                type="button"
                aria-label={$_('filesharing.emailPreview.close')}
                onclick={onClose}>×</button
            >
        </header>

        {#if status === 'loading'}
            <div class="state">{$_('filesharing.emailPreview.loading')}</div>
        {:else if status === 'error'}
            <div class="state state-error">
                <p>{$_('filesharing.emailPreview.error')}</p>
                <p class="error-detail">{errorMessage}</p>
            </div>
        {:else if status === 'empty'}
            <div class="state">{$_('filesharing.emailPreview.empty')}</div>
        {:else if active}
            <section class="meta">
                <div class="meta-row">
                    <span class="meta-label"
                        >{$_('filesharing.emailPreview.from')}</span
                    >
                    <span class="meta-value">{active.from}</span>
                </div>
                {#if active.reply_to}
                    <div class="meta-row">
                        <span class="meta-label"
                            >{$_('filesharing.emailPreview.replyTo')}</span
                        >
                        <span class="meta-value">{active.reply_to}</span>
                    </div>
                {/if}
                <div class="meta-row">
                    <span class="meta-label"
                        >{$_('filesharing.emailPreview.subject')}</span
                    >
                    <span class="meta-value">{active.subject}</span>
                </div>
                <div class="meta-row meta-row-recipient">
                    <label class="meta-label" for="recipient-switcher"
                        >{$_('filesharing.emailPreview.to')}</label
                    >
                    {#if allEmails.length > 1}
                        <select
                            id="recipient-switcher"
                            class="recipient-select"
                            bind:value={activeIdx}
                        >
                            {#each allEmails as r, i (i)}
                                <option value={i}
                                    >{r.recipient}{data?.confirmation &&
                                    i === allEmails.length - 1
                                        ? ` (${$_(
                                              'filesharing.emailPreview.confirmationTag'
                                          )})`
                                        : ''}</option
                                >
                            {/each}
                        </select>
                    {:else}
                        <span class="meta-value"
                            >{active.recipient}{isConfirmation
                                ? ` (${$_(
                                      'filesharing.emailPreview.confirmationTag'
                                  )})`
                                : ''}</span
                        >
                    {/if}
                </div>
            </section>

            <div class="body-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={bodyView === 'html'}
                    class="body-tab"
                    class:active={bodyView === 'html'}
                    onclick={() => (bodyView = 'html')}
                    >{$_('filesharing.emailPreview.viewHtml')}</button
                >
                <button
                    type="button"
                    role="tab"
                    aria-selected={bodyView === 'text'}
                    class="body-tab"
                    class:active={bodyView === 'text'}
                    onclick={() => (bodyView = 'text')}
                    >{$_('filesharing.emailPreview.viewText')}</button
                >
            </div>

            {#if bodyView === 'html'}
                <iframe
                    class="email-frame"
                    title={$_('filesharing.emailPreview.iframeTitle')}
                    srcdoc={withBaseTarget(active.html)}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                ></iframe>
            {:else}
                <pre class="email-text">{active.text}</pre>
            {/if}
        {/if}
    </div>
</div>

<style lang="scss">
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(3, 14, 23, 0.55);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        z-index: 1000;
        padding: 2rem 1rem;
        overflow-y: auto;
    }

    .backdrop-close {
        position: absolute;
        inset: 0;
        background: transparent;
        border: 0;
        padding: 0;
        cursor: pointer;
    }

    .modal {
        position: relative;
        background: var(--pg-general-background);
        border-radius: var(--pg-border-radius-lg);
        max-width: 720px;
        width: 100%;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
        z-index: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        background: var(--pg-soft-background);
        border-bottom: 1px solid var(--pg-strong-background);
    }

    .modal-header h2 {
        margin: 0;
        font-size: var(--pg-font-size-lg);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
    }

    .modal-subtitle {
        margin: 0.25rem 0 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .close-btn {
        background: transparent;
        border: 0;
        font-size: 1.75rem;
        line-height: 1;
        cursor: pointer;
        color: var(--pg-text-secondary);
        padding: 0 0.25rem;
    }

    .close-btn:hover {
        color: var(--pg-text);
    }

    .close-btn:focus-visible,
    .backdrop-close:focus-visible {
        outline: 2px solid var(--pg-text);
        outline-offset: 2px;
    }

    .meta {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--pg-strong-background);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text);
    }

    .meta-row {
        display: flex;
        gap: 0.75rem;
        align-items: baseline;
    }

    .meta-row-recipient {
        align-items: center;
    }

    .meta-label {
        flex: 0 0 5.5rem;
        color: var(--pg-text-secondary);
        font-weight: var(--pg-font-weight-bold);
    }

    .meta-value {
        word-break: break-word;
    }

    .recipient-select {
        flex: 1;
        padding: 0.35rem 0.6rem;
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-sm);
        background: var(--pg-general-background);
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
    }

    .body-tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem 1.5rem 0;
        background: var(--pg-soft-background);
        border-bottom: 1px solid var(--pg-strong-background);
    }

    .body-tab {
        background: transparent;
        border: 0;
        border-bottom: 2px solid transparent;
        padding: 0.4rem 0.8rem;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        cursor: pointer;
    }

    .body-tab:hover {
        color: var(--pg-text);
    }

    .body-tab.active {
        color: var(--pg-text);
        border-bottom-color: var(--pg-primary-contrast);
    }

    .body-tab:focus-visible {
        outline: 2px solid var(--pg-text);
        outline-offset: 2px;
    }

    .email-frame {
        width: 100%;
        height: min(70vh, 720px);
        border: 0;
        background: var(--pg-soft-background);
    }

    .email-text {
        margin: 0;
        padding: 1rem 1.5rem;
        max-height: min(70vh, 720px);
        overflow: auto;
        background: var(--pg-soft-background);
        color: var(--pg-text);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--pg-font-size-sm);
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .state {
        padding: 2rem 1.5rem;
        text-align: center;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        color: var(--pg-text-secondary);
    }

    .state-error {
        color: var(--pg-text);
    }

    .error-detail {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        margin: 0.5rem 0 0;
        word-break: break-all;
    }
</style>
