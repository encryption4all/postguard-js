<script lang="ts">
    import {
        type AttType,
        EncryptionState,
        type EncryptState,
    } from '$lib/types/filesharing/attributes'
    import { onMount } from 'svelte'

    import RecipientSelection from '$lib/components/filesharing/RecipientSelection.svelte'
    import MessageInput from '$lib/components/filesharing/inputs/MessageInput.svelte'
    import SendButton from '$lib/components/filesharing/SendButton.svelte'
    import FileInput from '$lib/components/filesharing/inputs/FileInput.svelte'
    import Dropzone from '@deltablot/dropzone'

    const ATTRIBUTES: Array<AttType> = [
        'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
        'pbdf.gemeente.personalData.dateofbirth',
    ]

    // Create mock files for testing
    function createMockFile(
        name: string,
        size: number,
        type: string = 'application/octet-stream'
    ): File {
        const blob = new Blob(['x'.repeat(size)], { type })
        return new File([blob], name, {
            type,
            lastModified: Date.now() - Math.random() * 100000,
        })
    }

    const mockFiles = [
        createMockFile(
            'Contract_2024_Final_v3.pdf',
            1024 * 1024 * 2.5,
            'application/pdf'
        ), // 2.5 MB
        createMockFile(
            'vacation-photo-beach.jpg',
            1024 * 1024 * 3.2,
            'image/jpeg'
        ), // 3.2 MB
        createMockFile(
            'Q4_Financial_Report.xlsx',
            1024 * 1024 * 1.8,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ), // 1.8 MB
        createMockFile(
            'presentation_draft.pptx',
            1024 * 1024 * 5.4,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ), // 5.4 MB
        createMockFile(
            'meeting-notes-2024-02-05.docx',
            1024 * 128,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ), // 128 KB
        createMockFile(
            'backup_database.zip',
            1024 * 1024 * 15.7,
            'application/zip'
        ), // 15.7 MB
        createMockFile('logo-design-v2.png', 1024 * 456, 'image/png'), // 456 KB
    ]

    let testEncryptState: EncryptState = $state({
        recipients: [
            {
                email: 'test@example.com',
                extra: [
                    {
                        t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                        v: '+31612345678',
                    },
                ],
            },
            {
                email: 'another@example.com',
                extra: [],
            },
        ],
        sender: 'sender@example.com',
        message: 'This is a test message to be sent with the encrypted files.',
        files: [],
        percentages: [],
        done: [],
        encryptionState: EncryptionState.FileSelection, // Set to FileSelection state (ready to send)
        abort: new AbortController(),
        selfAborted: false,
        serverError: false,
        encryptStartTime: 0,
    })

    // Add files to Dropzone after it initializes
    onMount(() => {
        setTimeout(() => {
            const dropzoneElement = document.querySelector('#my-form') as
                | (HTMLElement & { dropzone?: Dropzone })
                | null
            if (dropzoneElement && dropzoneElement.dropzone) {
                const dz = dropzoneElement.dropzone as Dropzone
                mockFiles.forEach((file) => {
                    dz.emit('addedfile', file)
                    dz.emit('complete', file)
                })
            }
        }, 100)
    })
</script>

<div class="test-header">
    <h1>Test Before Send State</h1>
    <p>
        This page shows what the UI looks like right before clicking "Sign and
        send"
    </p>
</div>

<div
    class:container={testEncryptState.encryptionState ===
        EncryptionState.FileSelection ||
        testEncryptState.encryptionState === EncryptionState.Sign ||
        testEncryptState.encryptionState === EncryptionState.Encrypting ||
        testEncryptState.encryptionState === EncryptionState.Error}
>
    <FileInput
        bind:files={testEncryptState.files}
        bind:percentages={testEncryptState.percentages}
        bind:done={testEncryptState.done}
        bind:stage={testEncryptState.encryptionState}
    />
    {#if testEncryptState.encryptionState === EncryptionState.FileSelection || testEncryptState.encryptionState === EncryptionState.Sign || testEncryptState.encryptionState === EncryptionState.Encrypting}
        <div class="inputs-container">
            {#if testEncryptState.encryptionState === EncryptionState.FileSelection || testEncryptState.encryptionState === EncryptionState.Encrypting}
                <RecipientSelection
                    bind:recipients={testEncryptState.recipients}
                    attributes={ATTRIBUTES}
                    readonly={testEncryptState.encryptionState ===
                        EncryptionState.Encrypting}
                />
                <MessageInput
                    bind:message={testEncryptState.message}
                    readonly={testEncryptState.encryptionState ===
                        EncryptionState.Encrypting}
                />
                <SendButton bind:encryptState={testEncryptState} />
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    .test-header {
        padding: 1rem;
        background-color: var(--pg-strong-background);
        border-bottom: 2px solid var(--pg-primary-contrast);
        text-align: center;
    }

    .test-header h1 {
        margin: 0 0 0.5rem 0;
        font-size: var(--pg-font-size-xl);
        color: var(--pg-primary-contrast);
    }

    .test-header p {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-primary-contrast);
    }

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

    @media only screen and (min-width: 768px) {
        .container {
            display: grid;
            grid-auto-columns: 4fr 3fr;
            grid-auto-flow: column;
            gap: 2rem;
            height: calc(
                100vh - 52px - 0.5rem - 1rem - 60px
            ); /* navbar height + margin + test header */
            overflow-y: hidden;
        }

        .inputs-container {
            max-height: 100%;
            margin: 1rem 1rem 0 0;
            overflow-y: auto;
            border-left: 2px solid var(--pg-strong-background);
            display: flex;
            justify-content: flex-start;
        }
    }
</style>
