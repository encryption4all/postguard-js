<script lang="ts">
    import {
        type AttType,
        EncryptionState,
        type EncryptState,
    } from '$lib/types/filesharing/attributes'
    import SEO from '$lib/components/SEO.svelte'
    import RecipientSelection from '$lib/components/filesharing/RecipientSelection.svelte'
    import MessageInput from '$lib/components/filesharing/inputs/MessageInput.svelte'
    import SendButton from '$lib/components/filesharing/SendButton.svelte'
    import FileInput from '$lib/components/filesharing/inputs/FileInput.svelte'
    import ErrorPanel from '$lib/components/filesharing/Error.svelte'
    import Done from '$lib/components/filesharing/Done.svelte'
    import CrashReport from '$lib/components/filesharing/CrashReport.svelte'
    import { SITE_URL } from '$lib/env'
    import { afterNavigate } from '$app/navigation'
    import { onMount, tick } from 'svelte'
    import {
        loadDraft,
        saveDraftMeta,
        saveDraftFiles,
        clearDraft,
        type DraftMeta,
    } from '$lib/fileshareDraft'

    // The compose step opens inside `#main-content` (and, on desktop, the
    // `.inputs-container` panel), each of which is its own scroll container.
    // SvelteKit's scroll handling targets the window, but the window never
    // scrolls here because html/body are `height: 100%` flex columns — so a
    // scroll position carried over from a previous view can leave this step
    // opening pre-scrolled, hiding the instructional heading at the top of the
    // panel (see encryption4all/postguard-website#295). Reset the relevant
    // containers to the top whenever we navigate to this step so the
    // instructions are the first thing the user sees. `afterNavigate` fires on
    // the initial mount as well as on later navigations into this route.
    afterNavigate(async () => {
        await tick()
        document.getElementById('main-content')?.scrollTo({ top: 0 })
        document.querySelector('.inputs-container')?.scrollTo({ top: 0 })
        window.scrollTo({ top: 0 })
    })

    const ATTRIBUTES: Array<AttType> = [
        'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
        'pbdf.gemeente.personalData.dateofbirth',
    ]

    function createDefaultEncryptState(): EncryptState {
        return {
            recipients: [{ email: '', extra: [] }],
            sender: '',
            message: '',
            files: [],
            percentages: [],
            done: [],
            encryptionState: EncryptionState.FileSelection,
            abort: new AbortController(),
            selfAborted: false,
            serverError: false,
            encryptStartTime: 0,
        }
    }

    let encryptState: EncryptState = $state(createDefaultEncryptState())

    // ---- Draft persistence (survive a page refresh) --------------------------
    // Files restored from a saved draft, handed to FileInput to re-inject.
    let restoredFiles: File[] = $state([])
    // Gate auto-save until the initial load has run, so an early empty save can
    // never clobber the draft we're about to restore.
    let draftLoaded = $state(false)
    let metaSaveTimer: ReturnType<typeof setTimeout> | undefined

    onMount(async () => {
        const draft = await loadDraft()
        if (
            draft &&
            encryptState.encryptionState === EncryptionState.FileSelection
        ) {
            encryptState.recipients = draft.recipients
            encryptState.message = draft.message
            restoredFiles = draft.files
        }
        draftLoaded = true
    })

    // Persist the recipient email(s), attributes and message (debounced) while
    // the user is still composing.
    $effect(() => {
        if (!draftLoaded) return
        if (encryptState.encryptionState !== EncryptionState.FileSelection)
            return
        const meta: DraftMeta = {
            recipients: $state.snapshot(
                encryptState.recipients
            ) as DraftMeta['recipients'],
            message: encryptState.message,
        }
        clearTimeout(metaSaveTimer)
        metaSaveTimer = setTimeout(() => void saveDraftMeta(meta), 400)
    })

    // Persist the attached files whenever the list changes (add/remove).
    $effect(() => {
        if (!draftLoaded) return
        const files = encryptState.files
        if (encryptState.encryptionState !== EncryptionState.FileSelection)
            return
        void saveDraftFiles(files.slice())
    })

    // A successful send lands on the Done step — drop the draft so it isn't
    // restored on the next visit within this session.
    $effect(() => {
        if (encryptState.encryptionState === EncryptionState.Done) {
            void clearDraft()
        }
    })

    // Warn the user before they navigate away mid-upload. Cryptify does not
    // support resume yet, so navigating away silently aborts the upload and
    // discards all progress (see encryption4all/postguard-website#116,
    // encryption4all/postguard-website#117). The built-in browser dialog is
    // the only reliable cross-browser hook for this; modern browsers ignore
    // the returned message and show their own wording.
    $effect(() => {
        if (encryptState.encryptionState !== EncryptionState.Encrypting) return
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    })

    const fileshareJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'PostGuard Secure File Sharing',
        url: `${SITE_URL}/fileshare`,
        description:
            'Send end-to-end encrypted files to anyone using their email address. Encryption happens entirely in your browser.',
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'EUR',
        },
        isPartOf: {
            '@id': `${SITE_URL}/#website`,
        },
    }
</script>

<SEO
    title="Secure File Sharing"
    description="Send end-to-end encrypted files to anyone using their email address. Your files are encrypted in your browser before they leave your device."
    jsonLd={fileshareJsonLd}
/>

<div
    class:container={encryptState.encryptionState ===
        EncryptionState.FileSelection ||
        encryptState.encryptionState === EncryptionState.Sign ||
        encryptState.encryptionState === EncryptionState.Encrypting ||
        encryptState.encryptionState === EncryptionState.Error}
    class:done={encryptState.encryptionState === EncryptionState.Done}
>
    <svelte:boundary>
        <FileInput
            bind:files={encryptState.files}
            bind:percentages={encryptState.percentages}
            bind:done={encryptState.done}
            bind:stage={encryptState.encryptionState}
            initialFiles={restoredFiles}
        />
        {#if encryptState.encryptionState === EncryptionState.FileSelection || encryptState.encryptionState === EncryptionState.Sign || encryptState.encryptionState === EncryptionState.Encrypting}
            <div class="inputs-container">
                <RecipientSelection
                    bind:recipients={encryptState.recipients}
                    attributes={ATTRIBUTES}
                    readonly={encryptState.encryptionState ===
                        EncryptionState.Encrypting}
                />
                <MessageInput
                    bind:message={encryptState.message}
                    readonly={encryptState.encryptionState ===
                        EncryptionState.Encrypting}
                />
                <SendButton bind:encryptState />
            </div>
        {:else if encryptState.encryptionState === EncryptionState.Error}
            <div class="inputs-container">
                <ErrorPanel
                    bind:encryptionState={encryptState.encryptionState}
                    serverError={encryptState.serverError}
                />
            </div>
        {:else if encryptState.encryptionState === EncryptionState.Done}
            <Done bind:encryptState {createDefaultEncryptState} />
        {/if}
        {#snippet failed(error, reset)}
            <CrashReport
                {error}
                reset={() => {
                    encryptState = createDefaultEncryptState()
                    reset()
                }}
            />
        {/snippet}
    </svelte:boundary>
</div>

<style lang="scss">
    * {
        list-style-type: none;
    }

    .container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-inline: 1rem;
        padding: 0.5rem 0;
    }

    .inputs-container {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        font-size: var(--pg-font-size-lg);
        min-width: 0;
        gap: 1.25rem;
        margin: 0;
    }

    .done {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    @media only screen and (min-width: 768px) {
        .container {
            display: grid;
            grid-template-columns: 1fr min(800px, 43%);
            gap: 2rem;
            height: calc(
                100vh - 52px - 0.5rem - 1rem
            ); /* navbar height + margin */
            overflow-y: hidden;
        }

        .inputs-container {
            max-height: 100%;
            margin: 1rem 0 0 0;
            padding-right: 1rem;
            overflow-y: auto;
            border-left: 2px solid var(--pg-strong-background);
            display: flex;
            justify-content: flex-start;
        }
    }
</style>
