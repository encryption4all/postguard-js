<script>
    import { onMount } from 'svelte'
    import SEO from '$lib/components/SEO.svelte'

    import decryptImg from '$lib/assets/images/decrypt.svg'
    import Decrypt from '$lib/components/fallback/Decrypt.svelte'
    import Settings from '$lib/components/fallback/Settings.svelte'

    import Icon from '@iconify/svelte'

    import { currSelected } from '$lib/components/fallback/stores.js'

    import { _ } from 'svelte-i18n'
    import { resolve } from '$app/paths'
    import { SITE_URL } from '$lib/env'

    import EmailView from '$lib/components/fallback/EmailView.svelte'
    import ListView from '$lib/components/fallback/ListView.svelte'

    const LEFTMODES = { ListView: 'List', Settings: 'Settings' }
    let currLeft = $state(LEFTMODES.ListView)

    const RIGHTMODES = {
        Nothing: 'Nothing',
        MailView: 'MailView',
        Decrypt: 'Decrypt',
    }

    let hashMode = $state(false)
    let currRight = $state()
    $effect(() => {
        if (!hashMode) {
            currRight =
                $currSelected >= 0 ? RIGHTMODES.MailView : RIGHTMODES.Nothing
        }
    })

    let searchTerm = $state()
    let readable = $state()
    let uuid = $state()
    let recipient = $state()

    let unique = $state({})
    const onFile = async (event) => {
        const [inFile] = event.srcElement.files
        readable = inFile.stream()
        unique = {}
        currRight = RIGHTMODES.Decrypt
    }

    function backToList() {
        // On mobile the list and reader are stacked single-screen flows;
        // resetting both selection and hashMode collapses currRight back to
        // Nothing via the effect above, which hides the reader panel.
        currSelected.set(-1)
        hashMode = false
        currRight = RIGHTMODES.Nothing
    }

    function fromUrlSafeBase64(urlSafe) {
        let base64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/')
        const pad = base64.length % 4
        if (pad === 2) base64 += '=='
        else if (pad === 3) base64 += '='
        return base64
    }

    onMount(async () => {
        // Path 1: hash carries the entire ciphertext (tier 1 — small
        // payload embedded in the URL fragment by pg-js's createEnvelope).
        const hash = window.location.hash
        if (hash && hash.length > 1) {
            try {
                const urlSafeBase64 = hash.substring(1)
                const base64 = fromUrlSafeBase64(urlSafeBase64)
                const binaryString = atob(base64)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }
                readable = new ReadableStream({
                    start(c) {
                        c.enqueue(bytes)
                        c.close()
                    },
                })

                hashMode = true
                unique = {}
                currRight = RIGHTMODES.Decrypt
                return
            } catch (e) {
                console.error('[PostGuard] Failed to decode URL hash:', e)
            }
        }

        // Path 2: ?uuid=… points at a Cryptify-uploaded ciphertext (tier
        // 2/3 messages from pg-js >= 1.1.0 in `data: mime` mode). The
        // Decrypt component accepts a uuid prop and calls pg.open({ uuid })
        // to fetch + decrypt; the parsed plaintext is treated as RFC 5322
        // MIME, so attachments and the inner body surface by name (matches
        // the receive-side path the Outlook/TB add-ons take).
        //
        // ?recipient=… is an optional hint matching the /download page —
        // when present and matching one of the encryption policy
        // recipients, the Decrypt component skips the picker and goes
        // straight to that key.
        const params = new URLSearchParams(window.location.search)
        const uuidParam = params.get('uuid')
        const recipientParam = params.get('recipient')
        if (uuidParam) {
            uuid = uuidParam
            recipient = recipientParam ?? undefined
            hashMode = true
            unique = {}
            currRight = RIGHTMODES.Decrypt
        }
    })
</script>

<SEO
    title="Decrypt Emails"
    description="Decrypt PostGuard-encrypted emails securely in your browser. Upload the encrypted file and verify your identity with the Yivi app."
    jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'PostGuard Email Decryption',
        url: `${SITE_URL}/decrypt`,
        description:
            'Decrypt PostGuard-encrypted emails securely in your browser using the Yivi identity wallet.',
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Any',
        isPartOf: { '@id': `${SITE_URL}/#website` },
    }}
/>

<div class="fallback-page">
    <div class="extension-banner">
        <span>{$_('fallback.extensionPrompt')}</span>
        <a href={resolve('/addons/')}>{$_('fallback.extensionLink')}</a>
    </div>
    <div
        class="fallback-container"
        class:mobile-reading={currRight !== RIGHTMODES.Nothing}
    >
        <div class="left-panel">
            {#if !hashMode}
                <label class="upload-area">
                    <Icon
                        icon="mdi:upload-lock"
                        width="28px"
                        aria-hidden="true"
                    />
                    <span class="upload-text upload-text-desktop"
                        >{$_('fallback.drop')}</span
                    >
                    <span class="upload-text upload-text-mobile"
                        >{$_('fallback.upload')}</span
                    >
                    <input
                        type="file"
                        onchange={onFile}
                        aria-label={$_('fallback.upload')}
                    />
                </label>
            {/if}

            <div class="search-bar">
                <div class="search-input-wrapper">
                    <Icon icon="mdi:magnify" class="search-icon" />
                    <input
                        type="search"
                        class="pg-input search-field"
                        placeholder={$_('fallback.search')}
                        bind:value={searchTerm}
                    />
                </div>
                <button
                    class="settings-button"
                    onclick={() =>
                        (currLeft =
                            currLeft === LEFTMODES.Settings
                                ? LEFTMODES.ListView
                                : LEFTMODES.Settings)}
                    type="button"
                >
                    <Icon icon="mdi:cog" width="24px" />
                </button>
            </div>

            <div class="email-list-area">
                {#if currLeft === LEFTMODES.ListView}
                    <ListView bind:rightMode={currRight} bind:searchTerm />
                {:else}
                    <Settings bind:currMode={currLeft} />
                {/if}
            </div>
        </div>

        <div class="right-panel">
            {#if currRight !== RIGHTMODES.Nothing}
                <button class="mobile-back" type="button" onclick={backToList}>
                    <Icon icon="mdi:arrow-left" width="20px" />
                    <span>{$_('fallback.back')}</span>
                </button>
            {/if}
            {#if currRight === RIGHTMODES.MailView}
                <EmailView />
            {:else if currRight === RIGHTMODES.Nothing}
                <div class="placeholder">
                    <img
                        src={decryptImg}
                        class="invert"
                        alt="decrypt"
                        width="200"
                        height="228"
                    />
                    <div class="welcome-text">
                        <h2>{$_('fallback.welcome.title')}</h2>
                        <p>{$_('fallback.welcome.description')}</p>
                        <ol>
                            <li>{$_('fallback.welcome.step1')}</li>
                            <li>{$_('fallback.welcome.step2')}</li>
                            <li>{$_('fallback.welcome.step3')}</li>
                        </ol>
                        <p class="privacy-note">
                            {$_('fallback.welcome.privacy')}
                        </p>
                    </div>
                </div>
            {:else}
                {#key unique}
                    <Decrypt
                        {readable}
                        {uuid}
                        {recipient}
                        bind:rightMode={currRight}
                    />
                {/key}
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    .fallback-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1.5rem;
        height: calc(100vh - 52px);
        box-sizing: border-box;
    }

    .extension-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        margin-bottom: 1rem;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-sm);

        a {
            color: var(--pg-primary);
            font-weight: var(--pg-font-weight-medium);
            text-decoration: none;

            &:hover {
                text-decoration: underline;
            }
        }
    }

    .fallback-container {
        display: flex;
        gap: 1.5rem;
        max-width: 1200px;
        width: 100%;
        height: 100%;
    }

    .left-panel {
        flex: 0 0 360px;
        display: flex;
        flex-direction: column;
        background: var(--pg-general-background);
        border: 1px solid var(--pg-input-normal);
        border-radius: var(--pg-border-radius-lg);
        overflow: hidden;
    }

    .upload-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.5rem;
        margin: 1rem;
        border: 1.5px dashed var(--pg-input-normal);
        border-radius: var(--pg-border-radius-md);
        cursor: pointer;
        color: var(--pg-text-secondary);
        font-size: var(--pg-font-size-sm);
        transition: all 0.2s ease;

        &:hover {
            border-color: var(--pg-primary);
            color: var(--pg-primary);
        }

        input[type='file'] {
            display: none;
        }
    }

    .upload-text-mobile {
        display: none;
    }

    .mobile-back {
        display: none;
    }

    .search-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0 1rem;
        margin-bottom: 0.5rem;
    }

    .search-input-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;

        :global(.search-icon) {
            position: absolute;
            left: 0.6rem;
            color: var(--pg-text-secondary);
            pointer-events: none;
        }
    }

    .search-field {
        padding-left: 2.2rem !important;
        height: 2.2rem !important;
        font-size: var(--pg-font-size-sm) !important;
    }

    .settings-button {
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem;
        border-radius: var(--pg-border-radius-sm);
        color: var(--pg-text-secondary);
        transition: color 0.2s ease;
        flex-shrink: 0;

        &:hover {
            color: var(--pg-primary);
        }

        &:focus-visible {
            outline: 2px solid var(--pg-primary);
            outline-offset: 2px;
        }
    }

    .email-list-area {
        flex: 1;
        overflow-y: auto;
        border-top: 1px solid var(--pg-input-normal);
    }

    .right-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--pg-general-background);
        border: 1px solid var(--pg-input-normal);
        border-radius: var(--pg-border-radius-lg);
        overflow: hidden;
        min-width: 0;
    }

    .placeholder {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
        text-align: center;
    }

    .welcome-text {
        max-width: 420px;

        h2 {
            font-size: var(--pg-font-size-lg);
            font-weight: var(--pg-font-weight-medium);
            margin: 0 0 0.75rem;
        }

        p {
            font-size: var(--pg-font-size-sm);
            line-height: 1.6;
            color: var(--pg-text-secondary);
            margin: 0 0 0.75rem;
        }

        ol {
            text-align: left;
            padding-left: 1.25rem;
            margin: 0 0 1rem;

            li {
                font-size: var(--pg-font-size-sm);
                line-height: 1.6;
                color: var(--pg-text-secondary);
                margin-bottom: 0.25rem;
            }
        }

        .privacy-note {
            font-size: var(--pg-font-size-xs);
            color: var(--pg-text-secondary);
            opacity: 0.8;
            margin: 0;
        }
    }

    @media only screen and (max-width: 768px) {
        .fallback-page {
            height: calc(100vh - 52px);
            min-height: 0;
            padding: 0;
        }

        .extension-banner {
            display: none;
        }

        .upload-area {
            flex: 0 0 auto;
            flex-direction: row;
            padding: 0.75rem 1rem;
            margin: 0.75rem 1rem;
            border-style: solid;
            border-color: var(--pg-primary);
            background: var(--pg-primary);
            color: white;
            order: 3;

            &:hover {
                color: white;
                opacity: 0.9;
            }
        }

        .upload-text-desktop {
            display: none;
        }

        .upload-text-mobile {
            display: inline;
        }

        .search-bar {
            order: 1;
            padding-top: 0.75rem;
            flex: 0 0 auto;
        }

        .email-list-area {
            order: 2;
            flex: 1 1 0;
            min-height: 0;
        }

        .fallback-container {
            flex-direction: column;
            height: 100%;
            gap: 0;
            flex: 1;
            min-height: 0;
        }

        .left-panel {
            flex: 1 1 0;
            min-height: 0;
            max-height: none;
            border: none;
            border-radius: 0;
        }

        .right-panel {
            min-height: 0;
            border: none;
            border-radius: 0;
            flex: 1 1 0;
        }

        // Single-screen flow: list view OR reader view, never both.
        .fallback-container.mobile-reading .left-panel {
            display: none;
        }

        .fallback-container:not(.mobile-reading) .right-panel {
            display: none;
        }

        .mobile-back {
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.75rem 1rem;
            font-size: var(--pg-font-size-sm);
            font-weight: var(--pg-font-weight-medium);
            color: var(--pg-primary);
            border-bottom: 1px solid var(--pg-input-normal);
            flex-shrink: 0;
        }
    }
</style>
