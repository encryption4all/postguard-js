<script>
    import { run } from 'svelte/legacy'
    import { onMount } from 'svelte'

    import * as email from './email'
    import { emails, currSelected } from './../fallback/stores.js'
    import { _, locale } from 'svelte-i18n'

    import Icon from '@iconify/svelte'

    let parsed = $state()
    let date = $state()
    let isDark = $state(false)

    onMount(() => {
        const html = document.documentElement
        isDark = html.classList.contains('dark')
        const obs = new MutationObserver(() => {
            isDark = html.classList.contains('dark')
        })
        obs.observe(html, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    })

    run(() => {
        if ($currSelected >= 0) {
            const mail = $emails.find((e) => e.id === $currSelected)
            if (mail) {
                date = new Date(mail.date)
                email.parseMail(mail.raw).then((x) => {
                    parsed = x
                })
            }
        }
    })

    function escapeHtml(s) {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    }

    // HTML emails carry their own design — leave their styling untouched.
    // Plain-text emails have no styling of their own, so mirror the site
    // theme so the text stays legible when dark mode is toggled, and use
    // a monospace face — that's what real mail clients render text/plain
    // in, and ASCII tables / signatures / quoted replies rely on it.
    let bodyDoc = $derived.by(() => {
        if (!parsed) return ''
        if (parsed.html) {
            return `<!doctype html><html><body style="margin:1rem">${parsed.html}</body></html>`
        }
        const bg = isDark ? '#061b2d' : '#ffffff'
        const fg = isDark ? '#ffffff' : '#030e17'
        const scheme = isDark ? 'dark' : 'light'
        const text = escapeHtml(parsed.text ?? '')
        const bodyStyle = `margin:1rem;background:${bg};color:${fg};color-scheme:${scheme};font-size:13px;line-height:1.5`
        const preStyle =
            'margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace'
        return `<!doctype html><html><body style="${bodyStyle}"><pre style="${preStyle}">${text}</pre></body></html>`
    })
</script>

{#if parsed}
    <div class="email-view">
        <div class="email-header">
            {#if parsed.from}
                <div class="header-row">
                    <span class="header-label"
                        >{$_('fallback.email.from')}:</span
                    >
                    <span class="header-value">
                        {#if parsed.from.name}{parsed.from.name} &lt;{parsed
                                .from.address}&gt;{:else}{parsed.from
                                .address}{/if}
                    </span>
                </div>
            {/if}
            {#if parsed.to && parsed.to.length > 0}
                <div class="header-row">
                    <span class="header-label">{$_('fallback.email.to')}:</span>
                    <span class="header-value">
                        {#each parsed.to as { name, address } (address)}
                            {#if name}{name} &lt;{address}&gt;{:else}{address}{/if}
                        {/each}
                    </span>
                </div>
            {/if}
            {#if parsed.subject}
                <div class="header-row">
                    <span class="header-label"
                        >{$_('fallback.email.subject')}:</span
                    >
                    <span class="header-value">{parsed.subject}</span>
                </div>
            {/if}
            {#if date && !isNaN(date.getTime())}
                <div class="header-row">
                    <span class="header-label"
                        >{$_('fallback.email.date')}:</span
                    >
                    <span class="header-value"
                        >{date.toLocaleString($locale)}</span
                    >
                </div>
            {/if}
        </div>

        <div class="email-body">
            <iframe srcdoc={bodyDoc} title="Mail message" sandbox=""></iframe>
        </div>

        {#if parsed.attachments && parsed.attachments.length > 0}
            <div class="email-attachments">
                {#each parsed.attachments as att (att.filename)}
                    <button
                        class="attachment-chip"
                        onclick={(e) => {
                            e.preventDefault()
                            email.downloadAttachment(
                                att.content,
                                att.mimeType,
                                att.filename
                            )
                        }}
                        type="button"
                    >
                        <Icon icon="mdi:attachment" width="16px" />
                        {att.filename}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    .email-view {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .email-header {
        display: flex;
        flex-direction: column;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--pg-input-normal);
    }

    .header-row {
        display: flex;
        gap: 0.5rem;
        padding: 0.1rem 0;
        font-size: var(--pg-font-size-sm);
        line-height: 1.3;
    }

    .header-label {
        font-weight: var(--pg-font-weight-bold);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .header-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .email-body {
        flex: 1;
        min-height: 0;

        iframe {
            border: none;
            width: 100%;
            height: 100%;
        }
    }

    .email-attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--pg-input-normal);
    }

    .attachment-chip {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.75rem;
        font-size: var(--pg-font-size-sm);
        background: var(--pg-general-background);
        border: 1px solid var(--pg-input-normal);
        border-radius: var(--pg-border-radius-md);
        transition: all 0.2s ease;

        &:hover {
            border-color: var(--pg-primary);
            color: var(--pg-primary);
        }

        &:focus-visible {
            outline: 2px solid var(--pg-primary);
            outline-offset: 2px;
        }
    }
</style>
