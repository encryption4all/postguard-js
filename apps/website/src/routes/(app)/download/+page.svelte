<script lang="ts">
    import { onMount, tick } from 'svelte'
    import { fade, slide } from 'svelte/transition'
    import { browser, dev } from '$app/environment'
    import { _ } from 'svelte-i18n'
    import { pg, retryStatus } from '$lib/postguard'
    import {
        IdentityMismatchError,
        NetworkError,
        UploadSessionExpiredError,
    } from '@e4a/pg-js'
    import type {
        DecryptFileResult,
        FriendlySender,
        InspectResult,
    } from '@e4a/pg-js'
    import YiviQRCode from '$lib/components/filesharing/YiviQRCode.svelte'
    import FileList from '$lib/components/filesharing/FileList.svelte'
    import DecryptionProgress from '$lib/components/filesharing/DecryptionProgress.svelte'
    import ReportErrorButton from '$lib/components/filesharing/ReportErrorButton.svelte'
    import {
        isUnsignedSender,
        isWeakSenderIdentity,
        verifiedAttributesFor,
    } from '$lib/components/filesharing/verifiedAttributes'
    import UnsignedConfirmModal from '$lib/components/filesharing/UnsignedConfirmModal.svelte'
    import { isMobile } from '$lib/browser-detect'
    import Chip from '$lib/components/Chip.svelte'
    import HelpToggle from '$lib/components/HelpToggle.svelte'

    type DownloadState =
        | 'Downloading'
        | 'Recipients'
        | 'Ready'
        | 'Decrypting'
        | 'Confirm'
        | 'Done'
        | 'Discarded'
        | 'Fail'
        | 'ServerError'
        | 'IdentityMismatch'
        | 'SessionExpired'

    let downloadState: DownloadState = $state('Downloading')

    let uuid = ''
    let recipientParam = ''

    let keylist: string[] = $state([])
    let key = $state('')
    let senderIdentity: FriendlySender | null = $state(null)
    // The disclosed non-email signing attributes, derived once and reused
    // across every panel that renders them (Ready, Confirm, Done).
    const verifiedAttributes = $derived(verifiedAttributesFor(senderIdentity))
    let fileList: string[] = $state([])
    let decryptPct: number | undefined = $state(undefined)
    let lastError: unknown = $state(null)
    // Held in memory between decrypt completion and the user accepting
    // the trust gate. Cleared after a successful download (so blobs can
    // be GC'd once the browser has them) or on discard.
    let decryptResult: DecryptFileResult | null = $state(null)

    let opened: Awaited<ReturnType<typeof pg.open>> | null = null

    // Hold on the QR card briefly after Yivi succeeds so its success
    // animation can finish before we swap in the progress banner.
    const YIVI_SUCCESS_HOLD_MS = 1400
    let pendingDecryptFlip: ReturnType<typeof setTimeout> | null = null

    // An unsigned file (no verifiable sender) is the weakest case, so
    // accepting it takes one extra confirmation in a modal rather than a
    // single click. Every other case downloads immediately on click.
    let showUnsignedConfirm = $state(false)

    let isMobileDevice = isMobile()

    onMount(() => {
        if (!browser) return
        const params = new URLSearchParams(window.location.search)
        uuid = params.get('uuid') ?? ''
        recipientParam = params.get('recipient') ?? ''

        if (!uuid) {
            downloadState = 'Fail'
        } else {
            startDownload()
        }
    })

    async function startDownload() {
        downloadState = 'Downloading'
        retryStatus.set(null)
        try {
            opened = pg.open({ uuid })
            const info: InspectResult = await opened.inspect()

            if (dev)
                console.debug('[download] header recipients:', info.recipients)

            senderIdentity = info.sender

            retryStatus.set(null)
            checkRecipients(info.recipients)
        } catch (e) {
            retryStatus.set(null)
            lastError = e
            if (e instanceof UploadSessionExpiredError) {
                downloadState = 'SessionExpired'
            } else if (e instanceof NetworkError && e.status >= 500) {
                downloadState = 'ServerError'
            } else {
                downloadState = 'Fail'
            }
        }
    }

    function checkRecipients(recipients: string[]) {
        const nonEmpty = recipients.filter((k) => k)

        if (recipientParam && nonEmpty.includes(recipientParam)) {
            key = recipientParam
            startDecryption()
            return
        }

        if (nonEmpty.length === 1) {
            key = nonEmpty[0]
            startDecryption()
        } else {
            keylist = nonEmpty
            downloadState = 'Recipients'
        }
    }

    function onRecipientSelected() {
        startDecryption()
    }

    async function startDecryption() {
        downloadState = 'Ready'
        decryptPct = undefined
        retryStatus.set(null)
        await tick()

        try {
            if (!opened) throw new Error('No opened instance')

            const result = (await opened.decrypt({
                element: '#yivi-download',
                recipient: key,
                enableCache: true,
                onDownloadProgress: (pct) => {
                    decryptPct = pct
                    if (
                        downloadState !== 'Decrypting' &&
                        pendingDecryptFlip === null
                    ) {
                        pendingDecryptFlip = setTimeout(() => {
                            pendingDecryptFlip = null
                            if (downloadState === 'Ready') {
                                downloadState = 'Decrypting'
                            }
                        }, YIVI_SUCCESS_HOLD_MS)
                    }
                },
            })) as DecryptFileResult

            senderIdentity = result.sender
            fileList = result.files.map((f) => f.name)
            decryptResult = result

            // Files are decrypted into in-memory blobs; we hand them to
            // the browser only after the user passes the trust gate.
            retryStatus.set(null)
            downloadState = 'Confirm'
        } catch (e) {
            if (dev) console.error('[download] decrypt error:', e)
            retryStatus.set(null)
            lastError = e
            if (e instanceof IdentityMismatchError) {
                downloadState = 'IdentityMismatch'
            } else if (e instanceof UploadSessionExpiredError) {
                downloadState = 'SessionExpired'
            } else if (e instanceof NetworkError && e.status >= 500) {
                downloadState = 'ServerError'
            } else {
                downloadState = 'Fail'
            }
        }
    }

    // Unsigned files route through an extra confirmation modal; everything
    // else downloads straight away.
    function requestAccept() {
        if (isUnsignedSender(senderIdentity)) {
            showUnsignedConfirm = true
        } else {
            acceptDownload()
        }
    }

    function acceptDownload() {
        showUnsignedConfirm = false
        decryptResult?.download()
        decryptResult = null
        downloadState = 'Done'
    }

    function discardDownload() {
        decryptResult = null
        downloadState = 'Discarded'
    }

    function retry() {
        startDecryption()
    }
</script>

<div class="page-wrapper">
    <div class="content">
        <h2>
            {#if downloadState === 'Fail'}
                {$_('filesharing.decryptpanel.notFoundTitle')}
            {:else if downloadState === 'SessionExpired'}
                {$_('filesharing.decryptpanel.sessionExpiredTitle')}
            {:else if downloadState === 'ServerError'}
                {$_('filesharing.decryptpanel.serverErrorTitle')}
            {:else if downloadState === 'IdentityMismatch'}
                {$_('filesharing.decryptpanel.identityMismatchTitle')}
            {:else if downloadState === 'Confirm'}
                {$_('filesharing.decryptpanel.trustHeader')}
            {:else if downloadState === 'Discarded'}
                {$_('filesharing.decryptpanel.discardedTitle')}
            {:else}
                {$_('filesharing.decryptpanel.header')}
            {/if}
        </h2>

        {#if downloadState === 'Downloading'}
            <div class="spinner-wrapper">
                <svg class="spinner" viewBox="0 0 24 24" width="36" height="36">
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
            </div>
            {#if $retryStatus}
                <p class="retry-status" role="status">
                    {$_('filesharing.encryptPanel.retrying', {
                        values: {
                            attempt: $retryStatus.attempt + 1,
                            max: $retryStatus.maxAttempts,
                        },
                    })}
                </p>
            {/if}
        {:else if downloadState === 'Recipients'}
            <p class="description">
                {$_('filesharing.decryptpanel.pageDescription')}
            </p>
            <div class="decrypt-card">
                <h3>
                    {$_('filesharing.decryptpanel.irmaInstructionHeaderQr')}
                </h3>
                <p class="card-subtitle">
                    Please select which email belongs to you:
                </p>
                <select bind:value={key} class="recipient-select">
                    <option value="" disabled selected
                        >Select your email…</option
                    >
                    {#each keylist as k (k)}
                        <option value={k}>{k}</option>
                    {/each}
                </select>
                <Chip
                    text={$_('filesharing.decryptpanel.askDownload')}
                    onclick={onRecipientSelected}
                    size="lg"
                    variant="dark"
                    disabled={!key}
                />
            </div>
        {:else if downloadState === 'Ready'}
            <div
                class="state-wrap"
                in:fade={{ duration: 250, delay: 200 }}
                out:fade={{ duration: 200 }}
            >
                <p class="description">
                    {$_('filesharing.decryptpanel.pageDescription')}
                </p>
                <div class="decrypt-card">
                    <h3>
                        {isMobileDevice
                            ? $_(
                                  'filesharing.decryptpanel.irmaInstructionHeaderMobile'
                              )
                            : $_(
                                  'filesharing.decryptpanel.irmaInstructionHeaderQr'
                              )}
                    </h3>
                    <p class="card-subtitle">
                        {isMobileDevice
                            ? $_(
                                  'filesharing.decryptpanel.irmaInstructionMobile'
                              )
                            : $_('filesharing.decryptpanel.irmaInstructionQr')}
                    </p>
                    <YiviQRCode
                        id="yivi-download"
                        responsive
                        mode={isMobileDevice ? 'button' : 'qr'}
                    />
                </div>
                <HelpToggle
                    title={$_('filesharing.encryptPanel.yiviInfo')}
                    content={$_('filesharing.encryptPanel.yiviInfoText')}
                    linkText={$_('filesharing.encryptPanel.yiviInfoLink')}
                    linkUrl="https://yivi.app"
                    bordered
                />
                {#if senderIdentity?.email}
                    <div class="sender-section">
                        <svg
                            class="checkmark"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M1 5L4.5 8.5L11 1"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p class="sender-label">
                            {$_('filesharing.decryptpanel.verifiedEmail')}
                        </p>
                        <strong class="sender-email"
                            >{senderIdentity.email}</strong
                        >
                        {#if verifiedAttributes.length > 0}
                            <div class="attr-chips">
                                {#each verifiedAttributes as attr (attr.type)}
                                    <span class="attr-chip">{attr.value}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {:else if downloadState === 'Decrypting'}
            <div
                class="state-wrap"
                in:fade={{ duration: 300, delay: 200 }}
                out:fade={{ duration: 200 }}
            >
                <div class="success-banner">
                    <div class="banner-row">
                        <p role="status">
                            {$_('filesharing.decryptpanel.doneMessage')}
                        </p>
                    </div>
                    <div transition:slide={{ duration: 280 }}>
                        <DecryptionProgress percentage={decryptPct} />
                    </div>
                </div>
                {#if $retryStatus}
                    <p class="retry-status" role="status">
                        {$_('filesharing.encryptPanel.retrying', {
                            values: {
                                attempt: $retryStatus.attempt + 1,
                                max: $retryStatus.maxAttempts,
                            },
                        })}
                    </p>
                {/if}
            </div>
        {:else if downloadState === 'Confirm'}
            <div
                class="state-wrap"
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 200 }}
            >
                <div class="success-banner">
                    <div class="banner-row">
                        <svg
                            class="banner-check"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            in:fade={{ duration: 250, delay: 100 }}
                        >
                            <path
                                d="M1 5L4.5 8.5L11 1"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p role="status">
                            {$_('filesharing.decryptpanel.readyToDownload')}
                        </p>
                    </div>
                </div>

                <FileList files={fileList} />

                {#if senderIdentity?.email}
                    <div class="sender-section">
                        <svg
                            class="checkmark"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M1 5L4.5 8.5L11 1"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p class="sender-label">
                            {$_('filesharing.decryptpanel.verifiedEmail')}
                        </p>
                        <strong class="sender-email"
                            >{senderIdentity.email}</strong
                        >
                        {#if verifiedAttributes.length > 0}
                            <div class="attr-chips">
                                {#each verifiedAttributes as attr (attr.type)}
                                    <span class="attr-chip">{attr.value}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if isUnsignedSender(senderIdentity)}
                    <div
                        class="trust-warning trust-warning-strong"
                        role="alert"
                    >
                        <svg
                            class="trust-warning-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                d="M12 3L2 21h20L12 3zm0 6v6m0 2v2"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p>
                            {$_('filesharing.decryptpanel.trustWarnUnsigned')}
                        </p>
                    </div>
                {:else if isWeakSenderIdentity(senderIdentity)}
                    <div class="trust-warning" role="alert">
                        <svg
                            class="trust-warning-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                d="M12 3L2 21h20L12 3zm0 6v6m0 2v2"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p>
                            {$_('filesharing.decryptpanel.trustWarnEmailOnly')}
                        </p>
                    </div>
                {/if}

                <div class="trust-actions">
                    <button
                        type="button"
                        class="trust-btn trust-btn-decline"
                        onclick={discardDownload}
                    >
                        {$_('filesharing.decryptpanel.trustDecline')}
                    </button>
                    <button
                        type="button"
                        class="trust-btn trust-btn-accept"
                        onclick={requestAccept}
                    >
                        {$_('filesharing.decryptpanel.trustAccept')}
                    </button>
                </div>

                {#if showUnsignedConfirm}
                    <UnsignedConfirmModal
                        onConfirm={acceptDownload}
                        onCancel={() => (showUnsignedConfirm = false)}
                    />
                {/if}
            </div>
        {:else if downloadState === 'Done'}
            <div
                class="state-wrap"
                in:fade={{ duration: 300, delay: 200 }}
                out:fade={{ duration: 200 }}
            >
                <div class="success-banner">
                    <div class="banner-row">
                        <svg
                            class="banner-check"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            in:fade={{ duration: 250, delay: 100 }}
                        >
                            <path
                                d="M1 5L4.5 8.5L11 1"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p role="status">
                            {$_('filesharing.decryptpanel.doneMessageComplete')}
                        </p>
                    </div>
                </div>

                <div in:fade={{ duration: 300, delay: 200 }}>
                    <FileList files={fileList} />
                </div>

                {#if senderIdentity?.email}
                    <div
                        class="sender-section"
                        in:fade={{ duration: 300, delay: 280 }}
                    >
                        <svg
                            class="checkmark"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M1 5L4.5 8.5L11 1"
                                stroke="currentColor"
                                stroke-width="1.75"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <p class="sender-label">
                            {$_('filesharing.decryptpanel.verifiedEmail')}
                        </p>
                        <strong class="sender-email"
                            >{senderIdentity.email}</strong
                        >
                        {#if verifiedAttributes.length > 0}
                            <div class="attr-chips">
                                {#each verifiedAttributes as attr (attr.type)}
                                    <span class="attr-chip">{attr.value}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {:else if downloadState === 'Discarded'}
            <div
                class="state-wrap"
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 200 }}
            >
                <p class="description" role="status">
                    {$_('filesharing.decryptpanel.discardedBody')}
                </p>
            </div>
        {:else if downloadState === 'SessionExpired'}
            <p class="error-description">
                {$_('filesharing.decryptpanel.sessionExpiredSubtitle')}
            </p>
            <p class="error-description">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $_('filesharing.decryptpanel.sessionExpiredMessage')}
            </p>
        {:else if downloadState === 'ServerError'}
            <p class="error-description">
                {$_('filesharing.decryptpanel.serverErrorSubtitle')}
            </p>
            <p class="error-description">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $_('filesharing.decryptpanel.serverErrorMessage')}
            </p>
            <div class="report-wrapper">
                <ReportErrorButton
                    error={lastError}
                    context={{ source: 'download', state: 'ServerError' }}
                />
            </div>
        {:else if downloadState === 'Fail'}
            <p class="error-description">
                {$_('filesharing.decryptpanel.notFoundSubtitle')}
            </p>
            <p class="error-description">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $_('filesharing.decryptpanel.notFoundMessage')}
            </p>
        {:else if downloadState === 'IdentityMismatch'}
            <p class="error-description">
                {$_('filesharing.decryptpanel.identityMismatchSubtitle')}
            </p>
            <p class="error-description">
                {$_('filesharing.decryptpanel.identityMismatchMessage')}
            </p>
            <div class="retry-wrapper">
                <Chip
                    text={$_('filesharing.decryptpanel.tryAgain')}
                    onclick={retry}
                    size="lg"
                    variant="dark"
                />
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .page-wrapper {
        min-height: calc(100vh - 52px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 3rem 1rem 2rem;
    }

    .content {
        width: 100%;
        max-width: 350px;
        padding-inline: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    /* Let the Yivi QR fill the (now narrower) column instead of capping
       at the global 330px. With column = 350px and the decrypt-card's
       padding the QR lands around the previous 330px mark while staying
       linked to the column width. */
    :global(#yivi-download.yivi-qr-container.responsive) {
        max-width: 100%;
    }

    h2 {
        text-align: center;
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        margin: 0 0 0.25rem;
    }

    .description {
        margin: 0;
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
    }

    .decrypt-card {
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .decrypt-card h3 {
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-lg);
        margin: 0;
        color: var(--pg-text);
    }

    .card-subtitle {
        margin: 0;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
    }

    .spinner-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem 0;
    }

    .retry-status {
        text-align: center;
        margin: 0 0 1rem 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
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

    .recipient-select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-sm);
        background: var(--pg-general-background);
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-base);
    }

    .sender-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.5rem 0;
        text-align: center;
    }

    .checkmark {
        width: 14px;
        height: 14px;
        color: var(--pg-text-secondary);
        flex-shrink: 0;
    }

    .sender-label {
        margin: 0;
        font-size: var(--pg-font-size-md);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .sender-email {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    .success-banner {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        padding: 1rem 1.25rem;

        p {
            margin: 0;
            font-family: var(--pg-font-family);
            font-size: var(--pg-font-size-md);
            line-height: 1.4;
            color: var(--pg-text);
        }
    }

    .banner-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        position: relative;

        p {
            margin: 0;
        }
    }

    .state-wrap {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .success-banner :global(.container) {
        padding: 0;
    }

    .success-banner :global(.container .label) {
        display: none;
    }

    .banner-check {
        width: 14px;
        height: 14px;
        color: var(--pg-text-secondary);
        flex-shrink: 0;
        margin-top: 0.1rem;
    }

    .attr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        justify-content: center;
    }

    .attr-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.6rem;
        border: 1px solid var(--pg-strong-background);
        border-radius: 4px;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        background: var(--pg-general-background);
    }

    .retry-wrapper,
    .report-wrapper {
        display: flex;
        justify-content: center;
        margin-top: 0.5rem;
    }

    .error-description {
        margin: 0;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
        text-align: center;
        color: var(--pg-text);
    }

    .trust-warning {
        --trust-accent: var(--pg-warning);
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
        padding: 0.85rem 1rem;
        border: 1px solid var(--trust-accent);
        background: color-mix(in srgb, var(--trust-accent) 8%, transparent);
        border-radius: var(--pg-border-radius-md);
        color: var(--pg-text);

        p {
            margin: 0;
            font-family: var(--pg-font-family);
            font-size: var(--pg-font-size-sm);
            line-height: 1.45;
        }
    }

    /* The unsigned case is the most severe: same layout as the email-only
       warning, but red instead of orange. */
    .trust-warning-strong {
        --trust-accent: var(--pg-input-error);
    }

    .trust-warning-icon {
        width: 20px;
        height: 20px;
        color: var(--trust-accent);
        flex-shrink: 0;
        margin-top: 0.05rem;
    }

    .trust-actions {
        display: flex;
        gap: 0.6rem;
        justify-content: center;
        margin-top: 0.25rem;
    }

    .trust-btn {
        all: unset;
        flex: 1 1 0;
        box-sizing: border-box;
        text-align: center;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-text-secondary);
        background: transparent;
        border: 1px solid var(--pg-input-normal);
        border-radius: var(--pg-border-radius-sm);
        padding: 0.55rem 1rem;
        cursor: pointer;
        transition:
            background 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease;
    }

    .trust-btn:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .trust-btn-decline:hover,
    .trust-btn-decline:focus-visible {
        color: var(--pg-input-error);
        border-color: var(--pg-input-error);
        background: color-mix(in srgb, var(--pg-input-error) 8%, transparent);
    }

    .trust-btn-accept:hover,
    .trust-btn-accept:focus-visible {
        color: var(--pg-success);
        border-color: var(--pg-success);
        background: color-mix(in srgb, var(--pg-success) 10%, transparent);
    }
</style>
