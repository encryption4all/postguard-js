<script lang="ts">
    import { _ } from 'svelte-i18n'
    import { onMount } from 'svelte'
    import Dropzone from '@deltablot/dropzone'
    import '@deltablot/dropzone/dist/dropzone.css'
    import BasketDrawing from '$lib/assets/images/basket_no_plane.svg'
    import closeIcon from '$lib/assets/images/google-icons/close.svg'
    import Chip from '$lib/components/Chip.svelte'
    import { EncryptionState } from '$lib/types/filesharing/attributes'

    // Disable auto-discover to prevent Dropzone from automatically attaching to all .dropzone elements
    Dropzone.discover = () => []

    let myDropzone: Dropzone | null = null
    let isDragging = $state(false)
    // Flips true once Dropzone is constructed so the restore effect below can
    // wait for it (files restored from a draft may arrive after mount).
    let dropzoneReady = $state(false)
    let injectedInitial = false

    interface props {
        files: File[]
        percentages: number[]
        done: boolean[]
        stage: EncryptionState
        /** Files restored from a saved draft, re-injected into Dropzone on load
         *  so their previews appear and they flow into `files` like a normal
         *  add. Empty in the common (no draft) case. */
        initialFiles?: File[]
    }

    import { MAX_UPLOAD_SIZE, ROLLING_LIMIT } from '$lib/env'
    import { getLocalUsedBytes } from '$lib/localUsage'

    let maxFileSizeMB = MAX_UPLOAD_SIZE / (1024 * 1024)

    let {
        files = $bindable(),
        percentages = $bindable(),
        done = $bindable(),
        stage = $bindable(),
        initialFiles = [],
    }: props = $props()

    $effect(() => {
        if (files.length === 0 && myDropzone && myDropzone.files.length > 0) {
            myDropzone.removeAllFiles(true)
        }
    })

    // Re-inject draft files once Dropzone exists. addFile() emits 'addedfile',
    // so the handler below renders each preview and appends to `files` exactly
    // as a user drop would — no separate restore path to keep in sync.
    $effect(() => {
        if (!dropzoneReady || injectedInitial || !myDropzone) return
        if (initialFiles.length === 0) return
        injectedInitial = true
        for (const file of initialFiles) {
            // addFile() augments a plain File into a DropzoneFile at runtime;
            // the type just doesn't reflect that it accepts a bare File.
            myDropzone.addFile(file as Parameters<Dropzone['addFile']>[0])
        }
    })

    let totalSize = $derived(files.reduce((acc, file) => acc + file.size, 0))
    let usedBytes = $derived(getLocalUsedBytes())
    let effectiveLimit = $derived(
        Math.min(MAX_UPLOAD_SIZE, ROLLING_LIMIT - usedBytes)
    )
    let remainingSize = $derived(effectiveLimit - totalSize)
    let remainingSizeGB = $derived(
        (Math.max(0, remainingSize) / 1e9).toFixed(2)
    )
    let effectiveLimitGB = $derived(
        (Math.max(0, effectiveLimit) / 1e9).toFixed(1)
    )
    let overLimit = $derived(totalSize > effectiveLimit)

    const previewTemplate = `
        <div class="dz-preview dz-file-preview files">
            <div>
                <div><p class="file-title" data-dz-name></p></div>
            </div>
            <div>
                <p data-dz-size></p>
                <button class="remove-button" data-dz-remove type="button">
                    <img class="invert" src="${closeIcon}" alt="remove button" />
                </button>
                <div class="dz-error-message"><span data-dz-errormessage></span></div>
            </div>
        </div>`

    // handle all the Dropzone setup in onMount to ensure it only runs in the browser
    onMount(() => {
        myDropzone = new Dropzone('#my-form', {
            url: '#', // Dummy URL, can't be empty
            autoProcessQueue: false, // Prevent automatic upload
            maxFilesize: maxFileSizeMB,
            filesizeBase: 1000,
            dictFileSizeUnits: {
                tb: 'TB',
                gb: 'GB',
                mb: 'MB',
                kb: 'KB',
                b: 'b',
            },
            previewsContainer: '#previews',
            previewTemplate: previewTemplate,
            clickable: '#my-form .primary-btn, .add-more-chip-container', // Only these elements trigger file selection
        })

        myDropzone.on('addedfile', (file) => {
            const isDuplicate = files.some(
                (f) =>
                    f.name === file.name &&
                    f.size === file.size &&
                    f.lastModified === file.lastModified
            )
            if (isDuplicate) {
                myDropzone!.removeFile(file)
                return
            }

            files = files.concat([file])
            percentages = percentages.concat([0])
            done = done.concat([false])

            myDropzone!.emit('complete', file)
        })

        myDropzone.on('dragover', () => {
            isDragging = true
        })
        myDropzone.on('dragleave', () => {
            isDragging = false
        })
        myDropzone.on('drop', () => {
            isDragging = false
        })

        myDropzone.on('removedfile', (file) => {
            const index = files.findIndex(
                (f) =>
                    f.name === file.name &&
                    f.size === file.size &&
                    f.lastModified === file.lastModified
            )
            if (index !== -1) {
                files = files.slice(0, index).concat(files.slice(index + 1))
                percentages = percentages
                    .slice(0, index)
                    .concat(percentages.slice(index + 1))
                done = done.slice(0, index).concat(done.slice(index + 1))
            }
        })

        dropzoneReady = true

        return () => {
            if (myDropzone) {
                myDropzone.destroy()
            }
        }
    })
</script>

<form
    id="my-form"
    class="dropzone"
    class:dropzone-with-files={files.length > 0}
    class:hidden={stage === EncryptionState.Done}
>
    <div class="dz-message">
        <h1 class="file-tagline">
            {$_('filesharing.encryptPanel.fileBox.tagline')}
        </h1>

        <div
            class="dropzone-box"
            class:has-files={files.length > 0}
            class:encrypting={stage === EncryptionState.Encrypting}
            class:signing={stage === EncryptionState.Sign}
            class:error={stage === EncryptionState.Error}
            class:dragging={isDragging}
        >
            <div
                class="upload-butt middle-block-size"
                class:hidden={files.length > 0}
            >
                <img
                    class="drawing invert"
                    src={BasketDrawing}
                    alt="Add files"
                />
                <p class="drag-text">
                    {$_('filesharing.encryptPanel.fileBox.dragText')}
                </p>
                <p class="or-text">
                    {$_('filesharing.encryptPanel.fileBox.orText')}
                </p>
                <button class="primary-btn" type="button"
                    >{$_(
                        'filesharing.encryptPanel.fileBox.chooseFilesButton'
                    )}</button
                >
                <p class="max-size-text">
                    {$_('filesharing.encryptPanel.fileBox.maxSizeText', {
                        values: { max: effectiveLimitGB },
                    })}
                </p>
            </div>

            {#if isDragging}
                <div class="drop-overlay">
                    <p class="drop-hint-text">
                        {files.length > 0
                            ? $_(
                                  'filesharing.encryptPanel.fileBox.dropMoreText'
                              )
                            : $_('filesharing.encryptPanel.fileBox.dropText')}
                    </p>
                </div>
            {/if}

            <!-- couldn't simply do an else because the item was expected to be in the DOM before items can be dropped -->
            <div class="files-container" class:hidden={files.length <= 0}>
                {#if stage === EncryptionState.FileSelection}
                    <div
                        class="files-attached"
                        role="status"
                        aria-live="polite"
                    >
                        <span class="files-attached-text">
                            {$_(
                                'filesharing.encryptPanel.fileBox.filesAttached',
                                { values: { count: files.length } }
                            )}
                        </span>
                    </div>
                {/if}

                <div
                    id="previews"
                    class="dz-previews"
                    class:signing={stage === EncryptionState.Sign}
                    class:encrypting={stage === EncryptionState.Encrypting}
                    class:error={stage === EncryptionState.Error}
                ></div>

                <div class="file-summary" class:over-limit={overLimit}>
                    <p>
                        {#if overLimit}
                            {$_(
                                'filesharing.encryptPanel.fileBox.overLimitText',
                                {
                                    values: {
                                        over: (
                                            (totalSize - effectiveLimit) /
                                            1024 ** 3
                                        ).toFixed(2),
                                    },
                                }
                            )}
                        {:else}
                            {$_(
                                'filesharing.encryptPanel.fileBox.fileSummary',
                                {
                                    values: {
                                        size: remainingSizeGB,
                                    },
                                }
                            )}
                        {/if}
                    </p>
                </div>

                {#if stage !== EncryptionState.Encrypting}
                    <div class="add-more-chip-container">
                        <Chip
                            text={$_(
                                'filesharing.encryptPanel.fileBox.addMoreFiles'
                            )}
                            icon="+"
                            size="sm"
                            variant="default"
                        />
                    </div>
                {/if}
            </div>
        </div>
    </div>
</form>

<style>
    h1 {
        font-size: var(--pg-font-size-2xl);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        margin: 0;
    }

    .file-tagline {
        margin-bottom: 1rem;
        text-align: center;
    }

    .dropzone {
        border: none;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 0;
    }

    @media only screen and (min-width: 768px) {
        .dropzone {
            height: 100%;
        }
    }

    .dz-message {
        margin: 0;
        width: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
    }

    .middle-block-size {
        width: 95%;
        max-width: 600px;
        min-height: fit-content;
    }

    .dropzone-box {
        width: 100%;
        max-width: 600px;
        background: var(--pg-soft-background) 0%;
        border: 2px dashed var(--pg-primary);
        border-radius: var(--pg-border-radius-lg);
        padding: 1.5rem 1rem;
        box-shadow: 0 2px 8px rgba(48, 149, 222, 0.08);
        transition: all 0.3s ease;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: fit-content;
        position: relative;
    }

    /* Override Dropzone's default dimming of .dz-message on drag — we use our own overlay */
    :global(.dropzone.dz-drag-hover .dz-message) {
        opacity: 1 !important;
    }

    .dropzone-box.dragging {
        border-style: solid;
        box-shadow: 0 4px 20px rgba(48, 149, 222, 0.25);
    }

    .drop-overlay {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--pg-soft-background);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 1;
    }

    .drop-hint-text {
        /* Fluid, but anchored to a rem base so it tracks the root type scale.
           A bare `vw` middle term is viewport-locked and ignores the root
           font size; `calc(rem + vw)` keeps the fluidity while still scaling. */
        font-size: clamp(
            var(--pg-font-size-lg),
            calc(var(--pg-font-size-lg) + 2vw),
            var(--pg-font-size-2xl)
        );
        font-weight: var(--pg-font-weight-extrabold);
        color: var(--pg-primary);
        text-align: center;
        margin: 0;
    }

    .dropzone-box.has-files {
        cursor: default;
        pointer-events: none;
    }

    .dropzone-box.encrypting,
    .dropzone-box.signing,
    .dropzone-box.error {
        cursor: default;
        pointer-events: none !important;
    }

    .dz-previews.encrypting {
        pointer-events: none;
    }

    .dropzone-box:hover:not(.has-files) {
        border-color: var(--pg-primary);
        box-shadow: 0 4px 16px rgba(48, 149, 222, 0.15);
    }

    .upload-butt {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-weight: var(--pg-font-weight-medium);
        margin: 0;
        padding: 0;
        transition: all 0.3s ease;
        width: 100%;
    }

    .upload-butt img {
        margin-bottom: 0.5rem;
        width: 80%;
        max-width: 300px;
        height: auto;
        user-select: none;
        pointer-events: none;
    }

    .drag-text {
        display: none;
        margin: 1rem 0 0rem 0;
        font-size: clamp(var(--pg-font-size-xl), 2.5vw, var(--pg-font-size-lg));
        font-weight: var(--pg-font-weight-extrabold);
        color: var(--pg-text);
        text-align: center;
    }

    .or-text {
        display: none;
        margin: 0.5rem 0;
        font-size: var(--pg-font-size-md);
        font-weight: 300;
        color: var(--pg-text-secondary);
        text-align: center;
    }

    .max-size-text {
        margin: 0.75rem 0 0 0;
        font-size: var(--pg-font-size-md);
        font-weight: 300;
        color: var(--pg-text-secondary);
        text-align: center;
    }

    .files-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .files-attached {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--pg-primary);
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-lg);
    }

    .files-attached-text {
        min-width: 0;
    }

    .dropzone-box.has-files .files-container {
        pointer-events: auto;
    }

    .dropzone-box.encrypting .files-container,
    .dropzone-box.signing .files-container {
        pointer-events: none;
    }

    .dropzone-box.encrypting .add-more-chip-container,
    .dropzone-box.signing .add-more-chip-container,
    .dropzone-box.error .add-more-chip-container {
        pointer-events: none;
        display: none;
    }

    .dz-previews {
        height: fit-content;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
        overflow-x: clip;
        overflow-clip-margin: 4px;
        pointer-events: auto;
        padding-right: 4px;
    }

    .dz-previews.encrypting :global(.remove-button),
    .dz-previews.error :global(.remove-button) {
        display: none !important;
    }

    /* Override Dropzone's default .dz-preview styles */
    .dz-previews :global(.dz-preview) {
        display: block;
        margin: 0;
        min-height: 0;
        position: relative;
        background: transparent;
    }

    /* Preview template styles (injected by Dropzone, so must be :global) */
    .dz-previews :global(.files) {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        margin-bottom: 0;
        padding: 0;
        border-bottom: 2px solid var(--pg-input-normal);
    }

    .dz-previews :global(.files > div:first-child) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
    }

    .dz-previews :global(.files > div:first-child > div) {
        min-width: 0;
        flex: 1;
    }

    .dz-previews :global(.files > div:last-child) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .dz-previews :global(.file-title) {
        overflow: hidden;
        white-space: nowrap;
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-regular);
        margin: 0;
        color: var(--pg-text);
        min-width: 0;
        font-size: var(--pg-font-size-sm);
        direction: rtl;
        text-align: left;
        text-overflow: ellipsis;
    }

    .dz-previews :global(.files > div:last-child p) {
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-regular);
        margin: 0;
        color: var(--pg-text-secondary);
        font-size: var(--pg-font-size-sm);
    }

    .dz-previews :global(.remove-button) {
        cursor: pointer;
        height: 100%;
        padding: 4px 4px 4px 4px;
        border-radius: var(--pg-border-radius-md);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }

    .dz-previews :global(.remove-button:hover) {
        background-color: var(--pg-soft-background);
    }

    .dz-previews :global(.remove-button:focus-visible) {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
        z-index: 1;
    }

    .dz-previews :global(.remove-button *) {
        cursor: pointer;
    }

    .dz-previews :global(.remove-button img) {
        width: 18px;
        height: 18px;
    }

    .dz-previews :global(.dz-error-message) {
        display: none;
    }

    .dz-previews :global(.dz-error .dz-error-message) {
        display: block;
    }

    .add-more-chip-container {
        display: flex;
        justify-content: center;
        pointer-events: auto;
    }

    .add-more-chip-container :global(.chip) {
        cursor: pointer;
    }

    .add-more-chip-container :global(.chip:hover) {
        background-color: var(--pg-soft-background);
        border-color: var(--pg-primary);
        color: var(--pg-primary);
        box-shadow: 0 2px 4px rgba(48, 149, 222, 0.15);
    }

    .add-more-chip-container :global(.chip:active) {
        transform: translateY(1px);
        box-shadow: none;
    }

    .file-summary {
        width: 100%;
        text-align: center;
        padding: 0.5rem 0;
        pointer-events: none;
    }

    .file-summary p {
        margin: 0;
        font-size: var(--pg-font-size-md);
        color: var(--pg-text-secondary);
        font-weight: var(--pg-font-weight-medium);
    }

    .file-summary.over-limit p {
        color: var(--pg-input-error);
        font-weight: var(--pg-font-weight-bold);
    }

    .dropzone-with-files {
        padding: 0;
        justify-content: start;
        height: fit-content;
    }

    .upload-butt :global(.primary-btn) {
        margin-top: 1.5rem;
    }

    @media only screen and (min-width: 768px) {
        .drag-text,
        .or-text {
            display: block;
        }

        .upload-butt :global(.primary-btn) {
            margin-top: 0;
        }

        .middle-block-size {
            min-height: 50vh;
            width: 70%;
        }

        .dropzone-box {
            width: 70%;
            padding: 3rem 2rem;
            min-height: 20rem;
            max-height: 30rem;
        }

        .dropzone-box.has-files {
            min-height: fit-content;
            padding: 1.5rem 1rem;
        }

        .upload-butt {
            padding: 0;
        }

        .upload-butt img {
            margin-bottom: 1rem;
            width: 60%;
            max-width: 400px;
        }

        .dz-previews {
            gap: 0.5rem;
        }

        .dropzone-with-files {
            height: auto;
            justify-content: center;
        }

        .signing {
            margin-top: 0;
        }
    }
</style>
