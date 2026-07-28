<script lang="ts">
    import { _, locale } from 'svelte-i18n'
    import { isValidPhoneNumber } from 'libphonenumber-js/mobile'
    // `validator.isEmail` requires a dotted TLD by default, so no-TLD typos
    // like `jane@examplecom` / `jane@localhost` are rejected — the silent-
    // failure class from the July 2026 user test
    // (encryption4all/postguard-website#293). Import the package entry, not the
    // `validator/lib/isEmail` deep path: validator is CJS-only and Vite's dev
    // server fails to resolve the subpath.
    import validator from 'validator'
    import {
        NetworkError,
        UploadSessionExpiredError,
        YiviSessionError,
        type PreparedSign,
        type SigningKeys,
    } from '@e4a/pg-js'
    import { tick } from 'svelte'

    import yiviLogo from '$lib/assets/images/non-free/yivi-logo.svg'
    import yiviLogoDark from '$lib/assets/images/non-free/yivi-logo-dark.svg'
    import {
        EncryptionState,
        type EncryptState,
    } from '$lib/types/filesharing/attributes'
    import { pg, retryStatus } from '$lib/postguard'
    import { browser } from '$app/environment'
    import { isMobile } from '$lib/browser-detect'
    import YiviQRCode from './YiviQRCode.svelte'
    import HelpToggle from '../HelpToggle.svelte'
    import Chip from '../Chip.svelte'

    import { MAX_UPLOAD_SIZE, ROLLING_LIMIT } from '$lib/env'
    import { parseLimitExceededBody, bytesToGB } from '$lib/usage'
    import { recordUpload, getLocalUsedBytes } from '$lib/localUsage'
    import { SIGN_ATTRIBUTES } from './signAttributes'

    interface props {
        encryptState: EncryptState
    }

    let { encryptState = $bindable() }: props = $props()

    // The QR instruction ("… scanning this QR code with the free Yivi app …")
    // renders the Yivi wordmark in place of the word "Yivi". The wordmark is
    // just the word, so the image is decorative (alt="", aria-hidden) and the
    // word is kept as visually-hidden text — screen readers read the whole
    // sentence normally instead of announcing an image. Splitting on the word
    // keeps the logo where "Yivi" sits in each locale (EN "Yivi app" /
    // NL "Yivi-app").
    let scanQrParts = $derived($_('filesharing.sign.scanQR').split('Yivi'))

    let isMobileDevice = isMobile()
    let mobilePopupMode: 'none' | 'direct' | 'qr' | 'onetap' = $state('none')

    // --- iOS one-tap pre-warm ---------------------------------------------
    // On iOS a Yivi Universal Link only opens the app inside a genuine user
    // gesture. If we start the signing session on tap, the deep-link URL
    // doesn't exist yet, so the tap can't open the app. Instead we pre-warm
    // the session as soon as the compose form is valid (see the $effect
    // below): pg.prepareSign() runs the disclosure ahead of time and hands us
    // the app URL, which we put on the send button as a real <a href>. One tap
    // then opens the app; the resolved signing keys are reused for encryption.
    // Best-effort — until the URL is ready (or on desktop) we fall back to the
    // two-tap button/QR flow.
    let preparedSign: PreparedSign | null = null
    let yiviAppUrl: string | null = $state(null)
    // True while an actual send is in flight, so the pre-warm effect doesn't
    // start a competing session or tear down the one we're consuming.
    let sending = $state(false)
    let showValidationModal = $state(false)
    let validationErrors: string[] = $state([])
    let limitExceededMessage: string | null = $state(null)
    // Set when a Yivi disclosure is cancelled or interrupted (the user closed
    // the Yivi app, declined, or the session timed out). We stay on the
    // compose screen with all input intact and surface a friendly banner with
    // a retry action rather than the generic error panel. See #294.
    let yiviInterrupted = $state(false)

    let SMOOTH_TIME = 2

    let canEncrypt = $derived.by(() => {
        if (encryptState.files.length === 0) return false
        const totalSize = encryptState.files.reduce((a, f) => a + f.size, 0)
        if (totalSize >= MAX_UPLOAD_SIZE) return false
        if (
            !encryptState.recipients.every(({ email }) =>
                validator.isEmail(email.trim())
            )
        )
            return false
        if (
            !encryptState.recipients.every(({ extra }) =>
                extra.every((att) => {
                    if (!att.v || att.v.length === 0) return false
                    if (
                        att.t === 'pbdf.sidn-pbdf.mobilenumber.mobilenumber' &&
                        !isValidPhoneNumber(att.v)
                    )
                        return false
                    return true
                })
            )
        )
            return false
        return true
    })

    // Start (or restart) a pre-warmed Yivi signing session for the one-tap
    // flow. Renders the Yivi widget into a hidden host purely to drive the
    // session; the user never sees it — they tap our own send anchor instead.
    // Synchronous up to assigning `preparedSign` so a re-entrant effect run
    // can't start a second competing session. The hidden host is always in the
    // DOM on mobile (rendered at mount), and effects run post-mount, so it's
    // present here; if not, we simply skip and retry on the next trigger.
    function startPrewarm(): void {
        if (preparedSign || !browser) return
        if (!document.querySelector('#prewarm-yivi')) return
        const handle = pg.prepareSign({
            element: '#prewarm-yivi',
            attributes: SIGN_ATTRIBUTES,
            includeSender: true,
        })
        preparedSign = handle
        handle.mobileUrl
            .then((url) => {
                if (preparedSign === handle) yiviAppUrl = url
            })
            .catch(() => {
                // Session failed before showing the app button; the keys
                // handler below resets us to the fallback flow.
            })
        handle.keys.catch(() => {
            // Session ended without a send (idle timeout, or cancelled in the
            // app before tapping). Drop back to the two-tap fallback; a fresh
            // pre-warm starts on the next form-valid / focus transition.
            if (preparedSign === handle && !sending) {
                preparedSign = null
                yiviAppUrl = null
            }
        })
    }

    function cancelPrewarm(): void {
        preparedSign?.cancel()
        preparedSign = null
        yiviAppUrl = null
    }

    // Drive the pre-warm lifecycle from compose state: warm while the form is
    // valid and we're still composing; tear down otherwise (unless a send is
    // consuming the session).
    $effect(() => {
        if (!browser || !isMobileDevice) return
        const composing =
            encryptState.encryptionState === EncryptionState.FileSelection
        if (canEncrypt && composing && !preparedSign) {
            startPrewarm()
        } else if ((!canEncrypt || !composing) && preparedSign && !sending) {
            cancelPrewarm()
        }
    })

    // A pre-warmed session has a TTL. If the user backgrounds the tab and
    // returns after it lapsed, re-warm so the one-tap URL is fresh. Reads
    // canEncrypt inside the handler (not at setup) so this listener is
    // installed once.
    $effect(() => {
        if (!browser || !isMobileDevice) return
        const onFocus = () => {
            if (
                canEncrypt &&
                encryptState.encryptionState ===
                    EncryptionState.FileSelection &&
                !preparedSign &&
                !sending
            ) {
                startPrewarm()
            }
        }
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    })

    function getValidationErrors(): string[] {
        const errors: string[] = []
        if (encryptState.files.length === 0) {
            errors.push($_('filesharing.encryptPanel.validation.noFiles'))
        }
        const totalSize = encryptState.files.reduce((a, f) => a + f.size, 0)
        const effectiveLimit = Math.min(
            MAX_UPLOAD_SIZE,
            ROLLING_LIMIT - getLocalUsedBytes()
        )
        if (totalSize > effectiveLimit) {
            const over = ((totalSize - effectiveLimit) / 1024 ** 3).toFixed(2)
            errors.push(
                $_('filesharing.encryptPanel.fileBox.overLimitText', {
                    values: { over },
                })
            )
        }
        encryptState.recipients.forEach(({ email, extra }) => {
            if (!email || email.trim() === '') {
                errors.push($_('filesharing.encryptPanel.validation.noEmail'))
            } else if (!validator.isEmail(email.trim())) {
                errors.push(
                    $_('filesharing.encryptPanel.validation.invalidEmail', {
                        values: { email },
                    })
                )
            } else {
                extra.forEach(({ t, v }) => {
                    if (!v || v.length === 0) {
                        const attrName = $_(`filesharing.attributes.${t}`)
                        errors.push(
                            $_(
                                'filesharing.encryptPanel.validation.missingAttribute',
                                { values: { attribute: attrName, email } }
                            )
                        )
                    } else if (
                        t === 'pbdf.sidn-pbdf.mobilenumber.mobilenumber' &&
                        !isValidPhoneNumber(v)
                    ) {
                        errors.push(
                            $_(
                                'filesharing.encryptPanel.validation.invalidPhone',
                                { values: { email } }
                            )
                        )
                    }
                })
            }
        })
        return errors
    }

    async function onSign(): Promise<void> {
        // Clear any interrupted-disclosure banner from a previous attempt.
        yiviInterrupted = false
        const errors = getValidationErrors()
        if (errors.length > 0) {
            validationErrors = errors
            showValidationModal = true
            return
        }
        if (isMobileDevice && mobilePopupMode === 'none') {
            mobilePopupMode = 'direct'
        }
        await startEncryption()
    }

    // `signingKeys` is supplied by the one-tap flow (pg.prepareSign already ran
    // the disclosure); when omitted, encrypt() starts its own Yivi session and
    // renders the QR/button widget into #crypt-irma-qr as before.
    async function startEncryption(signingKeys?: SigningKeys): Promise<void> {
        sending = true
        encryptState.encryptionState = EncryptionState.Sign

        // Fallback (widget) path: retire any idle pre-warmed session so we
        // don't leave a second Yivi session dangling.
        if (!signingKeys) cancelPrewarm()

        // Wait for Svelte to render the Yivi QR element into the DOM
        await tick()

        try {
            if (!canEncrypt) return

            // Build recipients
            const recipients = encryptState.recipients.map(
                ({ email, extra }) => {
                    // Trim before lowercasing so a pasted address with stray
                    // surrounding whitespace is encrypted to the same value the
                    // recipient's wallet holds — a mismatch here decrypts to a
                    // silent KEM error on their end.
                    const r = pg.recipient.email(email.trim().toLowerCase())
                    for (const a of extra) {
                        r.extraAttribute(a.t, a.v ?? '')
                    }
                    return r
                }
            )

            // Build sign method — email is always required; name is optional
            // (any of four credentials accepted). See signAttributes.ts.
            const sign = pg.sign.yivi({
                element: '#crypt-irma-qr',
                attributes: SIGN_ATTRIBUTES,
                includeSender: true,
            })

            let selectedLang: string =
                localStorage.getItem('preferredLanguage') ?? 'en-US'
            const lang = selectedLang === 'nl-NL' ? 'NL' : 'EN'

            const sealed = pg.encrypt({
                files: encryptState.files,
                recipients,
                sign,
                signingKeys,
                onProgress: (pct) => {
                    // First progress callback means signing is done
                    if (encryptState.encryptionState === EncryptionState.Sign) {
                        encryptState.encryptionState =
                            EncryptionState.Encrypting
                        encryptState.encryptStartTime = Date.now()
                        mobilePopupMode = 'none'
                    }
                    updateProgress(pct)
                },
                signal: encryptState.abort.signal,
            })

            // Reset any retry banner state from a previous attempt before
            // we start streaming chunks.
            retryStatus.set(null)

            await sealed.upload({
                notify: {
                    recipients: true,
                    sender: true,
                    message: encryptState.message,
                    language: lang as 'EN' | 'NL',
                },
                // Captured here (not from the upload() return value) so the
                // staging email-preview modal can render even if a later
                // chunk fails — the uuid is what links the preview to the
                // /download?uuid=… link cryptify would have emailed.
                onUploadInit: ({ uuid }) => {
                    encryptState.uploadUuid = uuid
                },
            })

            const totalBytes = encryptState.files.reduce(
                (a, f) => a + f.size,
                0
            )
            recordUpload(totalBytes)

            retryStatus.set(null)
            encryptState.encryptionState = EncryptionState.Done
            encryptState.selfAborted = false
        } catch (e) {
            console.error('Error occurred during encryption:', e)
            retryStatus.set(null)
            if (encryptState.selfAborted) {
                encryptState.percentages = encryptState.files.map(() => 0)
                encryptState.done = encryptState.files.map(() => false)
                encryptState.encryptionState = EncryptionState.FileSelection
                encryptState.selfAborted = false
                encryptState.encryptStartTime = 0
            } else if (e instanceof YiviSessionError) {
                // Fallback path: the Yivi session rejected outright (e.g. the
                // widget aborted, or a build where restart isn't offered). The
                // common cancel/close/timeout case is caught earlier at the DOM
                // level by `onYiviInterrupted` because pg-js leaves the
                // encrypt() promise pending in that state. Either way this is a
                // recoverable, user-driven interruption — not a failure on our
                // side — so recover gracefully rather than showing the generic
                // error panel. See #294.
                enterInterruptedRecovery()
            } else if (e instanceof UploadSessionExpiredError) {
                // cryptify evicted the upload session (idle past the
                // configured TTL or the server restarted). Retry won't help —
                // the user must start a fresh upload. Surface a distinct
                // message so it doesn't blur into a generic server error.
                encryptState.serverError = false
                encryptState.encryptionState = EncryptionState.Error
            } else if (e instanceof NetworkError && e.status === 413) {
                // cryptify#100: 413 Payload Too Large — either per-upload or rolling limit.
                const status = parseLimitExceededBody(e.body ?? '')
                const resetsAt = status.resetsAt
                    ? status.resetsAt.toLocaleDateString(
                          $locale === 'nl-NL' ? 'nl-NL' : 'en-US',
                          {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                          }
                      )
                    : ''
                limitExceededMessage = $_(
                    'filesharing.encryptPanel.usage.serverBlocked',
                    {
                        values: {
                            used: bytesToGB(status.usedBytes),
                            limit: bytesToGB(status.limitBytes),
                            resets: resetsAt,
                        },
                    }
                )
                encryptState.percentages = encryptState.files.map(() => 0)
                encryptState.done = encryptState.files.map(() => false)
                encryptState.encryptionState = EncryptionState.FileSelection
                encryptState.encryptStartTime = 0
            } else {
                encryptState.serverError =
                    e instanceof NetworkError && e.status >= 500
                encryptState.encryptionState = EncryptionState.Error
            }
            mobilePopupMode = 'none'
        } finally {
            sending = false
        }
    }

    // One-tap send (iOS): the send control is an <a href> to the pre-warmed
    // Yivi app URL, so tapping it opens the app on a genuine gesture. We do NOT
    // preventDefault — the navigation is what opens the app. Alongside it we
    // wait for the disclosure to complete (the user returns from Yivi), then
    // encrypt with the pre-resolved keys. Falls back to onSign() if the
    // pre-warmed session vanished between render and tap.
    async function onSignOneTap(): Promise<void> {
        yiviInterrupted = false
        const handle = preparedSign
        if (!handle) {
            onSign()
            return
        }
        sending = true
        mobilePopupMode = 'onetap'
        encryptState.encryptionState = EncryptionState.Sign
        try {
            const signingKeys = await handle.keys
            // Consume the session so the pre-warm effect doesn't reuse it.
            preparedSign = null
            yiviAppUrl = null
            await startEncryption(signingKeys)
        } catch (e) {
            preparedSign = null
            yiviAppUrl = null
            sending = false
            if (e instanceof YiviSessionError) {
                // Cancelled / timed out in the app — recover gracefully.
                enterInterruptedRecovery()
            } else {
                encryptState.serverError = false
                encryptState.encryptionState = EncryptionState.Error
                mobilePopupMode = 'none'
            }
        }
    }

    function onCancelUpload(): void {
        if (!browser) return
        // Mark before aborting so the catch in startEncryption() takes the
        // self-aborted path and resets to FileSelection rather than showing
        // the generic Error panel.
        encryptState.selfAborted = true
        encryptState.abort.abort()
        // AbortController is single-use — provide a fresh one so a subsequent
        // send attempt can be cancelled too.
        encryptState.abort = new AbortController()
    }

    // Drop back to the compose screen with all input intact and surface the
    // interrupted-disclosure banner (with its retry action). Shared by the DOM
    // detection callback and the YiviSessionError fallback. See #294.
    function enterInterruptedRecovery(): void {
        encryptState.percentages = encryptState.files.map(() => 0)
        encryptState.done = encryptState.files.map(() => false)
        encryptState.encryptionState = EncryptionState.FileSelection
        encryptState.encryptStartTime = 0
        mobilePopupMode = 'none'
        yiviInterrupted = true
    }

    // The Yivi widget entered a terminal recoverable state (cancelled, app
    // closed mid-flow, or timed out). pg-js leaves the encrypt() promise
    // pending in that case, so we detect it via the widget DOM and recover
    // here rather than hanging on the QR screen.
    function onYiviInterrupted(): void {
        if (encryptState.encryptionState !== EncryptionState.Sign) return
        enterInterruptedRecovery()
    }

    function updateProgress(pct: number) {
        const totalSize = encryptState.files.reduce((a, f) => a + f.size, 0)
        if (totalSize === 0) return

        let offset = 0
        const percentages = encryptState.files.map((f) => {
            const fileStart = (offset / totalSize) * 100
            const fileEnd = ((offset + f.size) / totalSize) * 100
            offset += f.size
            if (pct >= fileEnd) return 100
            if (pct <= fileStart) return 0
            return Math.round(((pct - fileStart) / (fileEnd - fileStart)) * 100)
        })
        encryptState.percentages = percentages

        // Delay done status for smooth animation
        percentages.forEach((p, i) => {
            if (p >= 100 && !encryptState.done[i]) {
                window.setTimeout(() => {
                    const dones = encryptState.done.map((d) => d)
                    dones[i] = true
                    encryptState.done = dones
                }, 1000 * SMOOTH_TIME)
            }
        })
    }

    let buttonRef: HTMLButtonElement | null = $state(null)
    let dialogRef: HTMLDialogElement | null = $state(null)

    $effect(() => {
        if (!browser || !dialogRef) return
        if (showValidationModal) {
            dialogRef.showModal()
        } else if (dialogRef.open) {
            dialogRef.close()
        }
    })
</script>

{#snippet yiviScanInstruction()}{#if scanQrParts.length === 2}{scanQrParts[0]}<span
            class="yivi-inline"
            ><span class="sr-only">Yivi</span><img
                class="yivi-inline-logo yivi-inline-logo--light"
                src={yiviLogo}
                alt=""
                aria-hidden="true"
            /><img
                class="yivi-inline-logo yivi-inline-logo--dark"
                src={yiviLogoDark}
                alt=""
                aria-hidden="true"
            /></span
        >{scanQrParts[1]}{:else}{$_('filesharing.sign.scanQR')}{/if}{/snippet}

<div class="button-container">
    {#if limitExceededMessage}
        <div class="limit-exceeded-banner" role="alert">
            <p class="limit-exceeded-title">
                {$_('filesharing.encryptPanel.usage.serverBlockedTitle')}
            </p>
            <p class="limit-exceeded-body">{limitExceededMessage}</p>
            <button
                type="button"
                class="limit-exceeded-dismiss"
                aria-label={$_(
                    'filesharing.encryptPanel.validation.continueButton'
                )}
                onclick={() => (limitExceededMessage = null)}>×</button
            >
        </div>
    {/if}
    {#if yiviInterrupted}
        <div class="yivi-interrupted-banner" role="alert">
            <p class="yivi-interrupted-title">
                {$_('filesharing.encryptPanel.yiviInterrupted.title')}
            </p>
            <p class="yivi-interrupted-body">
                {$_('filesharing.encryptPanel.yiviInterrupted.body')}
            </p>
            <div class="yivi-interrupted-actions">
                <button
                    type="button"
                    class="yivi-interrupted-retry"
                    onclick={onSign}
                >
                    {$_('filesharing.encryptPanel.yiviInterrupted.retryButton')}
                </button>
                <button
                    type="button"
                    class="yivi-interrupted-dismiss"
                    onclick={() => (yiviInterrupted = false)}
                >
                    {$_('filesharing.encryptPanel.yiviInterrupted.dismiss')}
                </button>
            </div>
        </div>
    {/if}
    {#if encryptState.encryptionState === EncryptionState.Encrypting}
        {@const totalProgress =
            encryptState.percentages.length > 0
                ? Math.round(
                      encryptState.percentages.reduce((a, b) => a + b, 0) /
                          encryptState.percentages.length
                  )
                : 0}
        <!-- Loading info box during upload -->
        <div class="upload-info-box">
            <div
                class="progress-bar"
                class:complete={totalProgress >= 100}
                style="width: {totalProgress >= 100
                    ? '100%'
                    : totalProgress + '%'}"
            ></div>
            <div class="upload-info-content">
                <svg class="spinner" viewBox="0 0 24 24" width="24" height="24">
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
                <span class="upload-info-label">
                    {$_('filesharing.encryptPanel.sending')}
                </span>
                <button
                    type="button"
                    class="cancel-upload-btn"
                    onclick={onCancelUpload}
                    disabled={encryptState.selfAborted}
                >
                    {$_('filesharing.cancel')}
                </button>
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
    {:else if isMobileDevice && yiviAppUrl && canEncrypt}
        <!-- iOS one-tap: a real <a href> to the pre-warmed Yivi app URL so a
             single genuine tap opens the app (a Universal Link only hands off
             to the app inside a user gesture). onSignOneTap runs alongside the
             navigation; it must not preventDefault. The href is an external
             Yivi deep link resolved at runtime, so SvelteKit's resolve() (for
             internal routes) does not apply. -->
        <!-- eslint-disable svelte/no-navigation-without-resolve -->
        <a
            class="primary-btn send-btn send-btn--link"
            href={yiviAppUrl}
            onclick={onSignOneTap}
        >
            {$_('filesharing.encryptPanel.encryptSend')}
        </a>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
    {:else}
        <!-- Normal button. When the message isn't sendable yet (e.g. no files
             attached) the button is aria-disabled but still clickable, so a
             click surfaces the validation modal explaining what's missing.
             On mobile this is also the fallback until the one-tap URL is
             ready (or if the pre-warmed session lapsed). -->
        <button
            bind:this={buttonRef}
            class="primary-btn send-btn"
            aria-disabled={!canEncrypt}
            onclick={onSign}
        >
            {$_('filesharing.encryptPanel.encryptSend')}
        </button>

        <!-- Yivi attribution below the button. The wordmark is a fixed
             multi-colour asset, so it sits on the page background (not the
             coloured button) and swaps between the light and dark variants to
             stay legible on either theme — mirrors Header.svelte's logo swap. -->
        <p class="powered-by">
            {$_('filesharing.encryptPanel.poweredBy')}
            <img
                class="yivi-logo yivi-logo--light"
                src={yiviLogo}
                alt="Yivi"
                width={38}
                height={21}
            />
            <img
                class="yivi-logo yivi-logo--dark"
                src={yiviLogoDark}
                alt="Yivi"
                width={38}
                height={21}
            />
        </p>

        <!-- Mobile: Always show QR option when button is enabled -->
        {#if isMobileDevice}
            <Chip
                text={$_('filesharing.sign.signOtherDevice')}
                onclick={() => {
                    mobilePopupMode = 'qr'
                    onSign()
                }}
                size="md"
                variant="default"
            />
        {/if}
    {/if}

    <p class="yivi-tip">
        {$_('filesharing.encryptPanel.yiviTip')}
    </p>

    <HelpToggle
        title={$_('filesharing.encryptPanel.yiviInfo')}
        content={$_('filesharing.encryptPanel.yiviInfoText')}
        linkText={$_('filesharing.encryptPanel.yiviInfoLink')}
        linkUrl="https://yivi.app"
        bordered
    />

    <!-- Desktop Yivi popup above the button -->
    {#if !isMobileDevice && encryptState.encryptionState === EncryptionState.Sign && buttonRef}
        <button
            type="button"
            class="desktop-backdrop"
            tabindex="-1"
            aria-hidden="true"
            onclick={() => {
                encryptState.encryptionState = EncryptionState.FileSelection
            }}
        ></button>
        <div
            class="desktop-yivi-popup"
            style="
                left: {buttonRef.getBoundingClientRect().left +
                buttonRef.offsetWidth / 2}px;
                top: {buttonRef.getBoundingClientRect().top - 15}px;
            "
        >
            <div class="popup-content">
                <div class="popup-header">
                    <h2 class="popup-title">
                        {$_('filesharing.encryptPanel.encryptSend')}
                    </h2>
                    <Chip
                        text={$_('filesharing.sign.close')}
                        onclick={() => {
                            encryptState.encryptionState =
                                EncryptionState.FileSelection
                        }}
                        icon="×"
                        size="md"
                        variant="default"
                    />
                </div>

                <p class="popup-instruction">{@render yiviScanInstruction()}</p>

                <div class="qr-code-wrapper">
                    <YiviQRCode oninterrupted={onYiviInterrupted} />
                </div>

                <HelpToggle
                    title={$_('filesharing.encryptPanel.yiviInfo')}
                    content={$_('filesharing.encryptPanel.yiviInfoText')}
                    linkText={$_('filesharing.encryptPanel.yiviInfoLink')}
                    linkUrl="https://yivi.app"
                />
            </div>
            <div class="popup-arrow"></div>
        </div>
    {/if}

    <!-- Mobile bottom sheet -->
    {#if isMobileDevice && mobilePopupMode !== 'none' && encryptState.encryptionState === EncryptionState.Sign}
        <button
            type="button"
            class="mobile-backdrop"
            tabindex="-1"
            aria-hidden="true"
            onclick={() => {
                encryptState.encryptionState = EncryptionState.FileSelection
                mobilePopupMode = 'none'
            }}
        ></button>
        <div class="mobile-bottom-sheet">
            <div class="bottom-sheet-content">
                {#if mobilePopupMode === 'qr'}
                    <h2 class="bottom-sheet-title">
                        {$_('filesharing.encryptPanel.encryptSend')}
                    </h2>
                    <p class="bottom-sheet-instruction">
                        {@render yiviScanInstruction()}
                    </p>
                    <div class="qr-code-wrapper">
                        <YiviQRCode oninterrupted={onYiviInterrupted} />
                    </div>
                    <HelpToggle
                        title={$_('filesharing.encryptPanel.yiviInfo')}
                        content={$_('filesharing.encryptPanel.yiviInfoText')}
                        linkText={$_('filesharing.encryptPanel.yiviInfoLink')}
                        linkUrl="https://yivi.app"
                    />
                    <Chip
                        text={$_('filesharing.sign.close')}
                        onclick={() => {
                            encryptState.encryptionState =
                                EncryptionState.FileSelection
                            mobilePopupMode = 'none'
                        }}
                        icon="×"
                        size="md"
                        variant="dark"
                    />
                {:else if mobilePopupMode === 'onetap'}
                    <!-- One-tap: the Yivi app has been opened from the send
                         anchor. No widget here — the disclosure runs in the
                         pre-warmed session; we just wait for the user to come
                         back from Yivi. -->
                    <h2 class="bottom-sheet-title">
                        {$_('filesharing.encryptPanel.encryptSend')}
                    </h2>
                    <p class="bottom-sheet-instruction">
                        {$_('filesharing.sign.oneTapWaiting')}
                    </p>
                    <svg
                        class="spinner"
                        viewBox="0 0 24 24"
                        width="28"
                        height="28"
                    >
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
                    <Chip
                        text={$_('filesharing.sign.cancel')}
                        onclick={() => {
                            cancelPrewarm()
                            sending = false
                            encryptState.encryptionState =
                                EncryptionState.FileSelection
                            mobilePopupMode = 'none'
                        }}
                        icon="×"
                        size="md"
                        variant="dark"
                    />
                {:else}
                    <p class="bottom-sheet-instruction">
                        {$_('filesharing.sign.followSteps')}
                    </p>
                    <div class="qr-code-wrapper">
                        <YiviQRCode
                            mode="button"
                            oninterrupted={onYiviInterrupted}
                        />
                    </div>
                    <Chip
                        text={$_('filesharing.sign.cancel')}
                        onclick={() => {
                            encryptState.encryptionState =
                                EncryptionState.FileSelection
                            mobilePopupMode = 'none'
                        }}
                        icon="×"
                        size="md"
                        variant="dark"
                    />
                {/if}
            </div>
        </div>
    {/if}

    <!-- Hidden host for the pre-warmed one-tap Yivi session. Kept in the DOM on
         mobile so pg.prepareSign() can render its (invisible) widget here to
         drive the session; the user interacts with the send anchor instead. -->
    {#if isMobileDevice}
        <div id="prewarm-yivi" class="prewarm-host" aria-hidden="true"></div>
    {/if}
</div>

<!-- Required-fields legend: kept out of `.button-container` so it can sit as
     a footnote pinned to the bottom of the compose column, not glued to the
     button group. `id` is unchanged — RecipientSelectionFields still points
     its `aria-describedby` here. -->
<p id="required-fields-legend" class="required-legend">
    {$_('filesharing.encryptPanel.requiredFieldsLegend')}
</p>

<dialog
    bind:this={dialogRef}
    class="validation-modal"
    tabindex="-1"
    oncancel={() => (showValidationModal = false)}
>
    <h2 class="validation-title">
        {$_('filesharing.encryptPanel.validation.title')}
    </h2>
    <ul class="validation-errors">
        {#each validationErrors as error (error)}
            <li>{error}</li>
        {/each}
    </ul>
    <button
        type="button"
        class="primary-btn"
        onclick={() => (showValidationModal = false)}
    >
        {$_('filesharing.encryptPanel.validation.continueButton')}
    </button>
</dialog>

<style lang="scss">
    .send-btn {
        margin: 1.5rem 0 0 0;
    }

    /* One-tap send rendered as an <a>. `.primary-btn` assumes a button, so
       normalise the anchor: no underline, centred label, and inline-flex so it
       matches the button's box. */
    .send-btn--link {
        text-decoration: none;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    /* Invisible host that drives the pre-warmed one-tap Yivi session. Not
       `display:none` — some widget internals measure layout — but pulled fully
       out of flow and hidden from view and a11y. */
    .prewarm-host {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        pointer-events: none;
    }

    /* Yivi attribution caption below the send button. */
    .powered-by {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .yivi-logo {
        height: 18px;
        width: auto;
    }

    /* Theme-aware wordmark swap — same mechanism as Header.svelte's logo. */
    .yivi-logo--light {
        display: block;
    }

    .yivi-logo--dark {
        display: none;
    }

    :global(.dark) .yivi-logo--light {
        display: none;
    }

    :global(.dark) .yivi-logo--dark {
        display: block;
    }

    /* Yivi wordmark shown inline within the scan instruction, sized to the
       surrounding text. The word itself is kept as visually-hidden text
       (.sr-only) for screen readers, so these images are decorative and use
       the same light/dark swap as the "powered by" wordmark above. */
    .yivi-inline-logo {
        height: 1em;
        width: auto;
        vertical-align: -0.1em;
    }

    .yivi-inline-logo--light {
        display: inline-block;
    }

    .yivi-inline-logo--dark {
        display: none;
    }

    :global(.dark) .yivi-inline-logo--light {
        display: none;
    }

    :global(.dark) .yivi-inline-logo--dark {
        display: inline-block;
    }

    .limit-exceeded-banner {
        position: relative;
        width: 100%;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        margin: 0.5rem 0;
        border-radius: var(--pg-border-radius-md);
        background: color-mix(
            in srgb,
            var(--pg-input-error) 8%,
            var(--pg-general-background)
        );
        font-family: var(--pg-font-family);
        box-sizing: border-box;
    }

    .limit-exceeded-title {
        margin: 0 0 0.25rem 0;
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-sm);
        color: var(--pg-input-error);
    }

    .limit-exceeded-body {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        line-height: 1.4;
    }

    .limit-exceeded-dismiss {
        position: absolute;
        top: 0.25rem;
        right: 0.5rem;
        background: transparent;
        border: none;
        color: var(--pg-text-secondary);
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
    }

    .limit-exceeded-dismiss:hover {
        color: var(--pg-text);
    }

    .yivi-interrupted-banner {
        width: 100%;
        padding: 0.85rem 1rem;
        margin: 0.5rem 0;
        border-radius: var(--pg-border-radius-md);
        background: color-mix(
            in srgb,
            var(--pg-primary) 8%,
            var(--pg-general-background)
        );
        border: 1px solid color-mix(in srgb, var(--pg-primary) 30%, transparent);
        font-family: var(--pg-font-family);
        box-sizing: border-box;
    }

    .yivi-interrupted-title {
        margin: 0 0 0.25rem 0;
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text);
    }

    .yivi-interrupted-body {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        line-height: 1.4;
    }

    .yivi-interrupted-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.75rem;
    }

    .yivi-interrupted-retry {
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-general-background);
        background: var(--pg-text);
        border: none;
        border-radius: var(--pg-border-radius-sm);
        padding: 0.4rem 1rem;
        cursor: pointer;
        transition:
            background 0.2s ease,
            transform 0.1s ease;
    }

    .yivi-interrupted-retry:hover {
        background: var(--pg-input-active);
        transform: translateY(-1px);
    }

    .yivi-interrupted-retry:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .yivi-interrupted-dismiss {
        all: unset;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-text-secondary);
        cursor: pointer;
        padding: 0.4rem 0.5rem;
        border-radius: var(--pg-border-radius-sm);
    }

    .yivi-interrupted-dismiss:hover {
        color: var(--pg-text);
    }

    .yivi-interrupted-dismiss:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }
    /* The send button is never natively `disabled`: it must stay focusable
       (in the tab order) and clickable so activating it can surface the
       validation modal that explains what is still wrong. We mark it
       `aria-disabled` instead and mirror the disabled look here, so a sighted
       user can see at a glance whether the form is ready to send. */
    .send-btn[aria-disabled='true'] {
        background: var(--pg-disabled-background);
        color: var(--pg-disabled-foreground);
        box-shadow: none;
        cursor: not-allowed;
    }

    .send-btn[aria-disabled='true']:hover,
    .send-btn[aria-disabled='true']:active {
        background: var(--pg-disabled-background);
        transform: none;
        box-shadow: none;
    }

    .button-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        position: relative;
    }

    @media only screen and (min-width: 768px) {
        .button-container {
            padding-left: 1.25rem;
        }
    }

    .upload-info-box {
        position: relative;
        width: 100%;
        border-radius: var(--pg-border-radius-sm);
        background: var(--pg-strong-background);
        margin-bottom: 0.75rem;
        box-sizing: border-box;
        overflow: hidden;
    }

    .progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 4px;
        background: var(--pg-primary-contrast);
        transition: width 0.3s ease;
    }

    .upload-info-content {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0.75rem;
        padding: 1rem 1rem;
        font-size: var(--pg-font-size-base);
        font-weight: var(--pg-font-weight-regular);
        font-family: var(--pg-font-family);
        color: var(--pg-text);
        z-index: 1;
    }

    .upload-info-box .spinner-circle {
        stroke: var(--pg-text);
    }

    .upload-info-label {
        flex: 1;
    }

    .cancel-upload-btn {
        all: unset;
        box-sizing: border-box;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-text-secondary);
        background: transparent;
        border: 1px solid var(--pg-input-normal);
        border-radius: var(--pg-border-radius-sm);
        padding: 0.35rem 0.85rem;
        cursor: pointer;
        transition:
            background 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease;
    }

    .cancel-upload-btn:hover:not(:disabled) {
        color: var(--pg-text);
        background: color-mix(in srgb, var(--pg-text) 8%, transparent);
        border-color: var(--pg-input-hover);
    }

    .cancel-upload-btn:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .cancel-upload-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .retry-status {
        margin: 0;
        padding: 0 1rem 0.75rem 1rem;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .spinner {
        animation: spin 1s linear infinite;
        margin-right: 0.5rem;
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

    .yivi-tip {
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        margin: 0;
        line-height: 1.4;
    }

    /* Required-fields legend as a footnote at the foot of the compose column:
       small and muted. On desktop it's pinned to the bottom of the column
       (see the media query). */
    .required-legend {
        margin: 0;
        font-size: var(--pg-font-size-xs);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        line-height: 1.4;
    }

    @media only screen and (min-width: 768px) {
        /* The column (`.inputs-container`) is a fixed-height flex column; an
           auto top margin collects any slack above the legend so it rests at
           the very bottom rather than trailing the "What is Yivi?" block.
           `padding-left` matches the column's other items (`.button-container`,
           `.crypt-select-protection-input-box`) so the footnote lines up. */
        .required-legend {
            margin-top: auto;
            padding-left: 1.25rem;
        }
    }

    /* Desktop Yivi popup styles */
    .desktop-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(3, 14, 23, 0.09);
        z-index: 3;
        cursor: pointer;
    }

    .desktop-yivi-popup {
        position: fixed;
        transform: translate(-50%, -100%);
        background: var(--pg-soft-background);
        border-radius: var(--pg-border-radius-md);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        padding: 1rem;
        width: fit-content;
        max-width: calc(330px + 2rem);
        z-index: 4;
    }

    .popup-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 0.5rem;
    }

    .popup-title {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
        text-align: left;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        flex: 1;
    }

    .popup-instruction {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        margin: 0 0 0.5rem 0;
        text-align: left;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        width: 100%;
    }

    .qr-code-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .popup-arrow {
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 10px solid var(--pg-soft-background);
    }

    /* Mobile bottom sheet styles */
    .mobile-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 3;
    }

    .mobile-bottom-sheet {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--pg-soft-background);
        border-radius: var(--pg-border-radius-lg) var(--pg-border-radius-lg) 0 0;
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
        padding: 1.5rem;
        z-index: 4;
    }

    .bottom-sheet-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .bottom-sheet-title {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
        text-align: center;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    .bottom-sheet-instruction {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
        text-align: center;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    /* Validation modal */
    dialog.validation-modal {
        border: none;
        border-radius: var(--pg-border-radius-lg);
        padding: 1.75rem 1.5rem 1.5rem;
        width: 90%;
        max-width: 380px;
        gap: 1rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        background: var(--pg-general-background);
        color: var(--pg-text);
    }

    /* Only apply flex layout when the dialog is open.
     Setting display on dialog directly overrides the UA's display:none for closed dialogs. */
    dialog.validation-modal[open] {
        display: flex;
        flex-direction: column;
    }

    dialog.validation-modal::backdrop {
        background: rgba(0, 0, 0, 0.45);
    }

    .validation-title {
        font-size: var(--pg-font-size-lg);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    .validation-errors {
        margin: 0;
        padding-left: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .validation-errors li {
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        line-height: 1.4;
    }

    .validation-modal .primary-btn {
        /* Full-width so the dismiss action reads as the modal's primary,
           clickable control rather than a label that happens to be dark.
           `.primary-btn` sets `width: fit-content`, which silently defeats
           `align-self: stretch`, so set the width explicitly here. */
        align-self: stretch;
        width: 100%;
        justify-content: center;
        margin-top: 0.25rem;
    }
</style>
