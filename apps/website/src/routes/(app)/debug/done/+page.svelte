<script lang="ts">
    import Done from '$lib/components/filesharing/Done.svelte'
    import {
        EncryptionState,
        type EncryptState,
    } from '$lib/types/filesharing/attributes'

    // Hardcoded test data
    let testEncryptState: EncryptState = $state({
        encryptionState: EncryptionState.Done,
        files: [
            new File([''], 'presentation.pdf', {
                type: 'application/pdf',
                lastModified: Date.now(),
            }),
            new File([''], 'budget_2024_final_version_v3.xlsx', {
                type: 'application/vnd.ms-excel',
                lastModified: Date.now(),
            }),
            new File([''], 'team_photo.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now(),
            }),
            new File([''], 'contract_signed.docx', {
                type: 'application/msword',
                lastModified: Date.now(),
            }),
        ],
        recipients: [
            {
                email: 'jan.janssen@example.com',
                extra: [],
            },
            {
                email: 'marie.pietersen@company.nl',
                extra: [
                    {
                        t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                        v: '+31612345678',
                    },
                ],
            },
            {
                email: 'test.user@domain.com',
                extra: [
                    {
                        t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                        v: '+31687654321',
                    },
                    {
                        t: 'pbdf.gemeente.personalData.fullname',
                        v: 'Test User',
                    },
                ],
            },
            {
                email: 'another.recipient@example.org',
                extra: [
                    {
                        t: 'pbdf.gemeente.personalData.fullname',
                        v: 'Another Recipient',
                    },
                ],
            },
        ],
        sender: '',
        message: 'Test message',
        done: [],
        percentages: [],
        abort: new AbortController(),
        selfAborted: false,
        serverError: false,
        encryptStartTime: Date.now(),
    })

    function createDefaultEncryptState(): EncryptState {
        return {
            encryptionState: EncryptionState.FileSelection,
            files: [],
            recipients: [{ email: '', extra: [] }],
            sender: '',
            message: '',
            done: [],
            percentages: [],
            abort: new AbortController(),
            selfAborted: false,
            serverError: false,
            encryptStartTime: 0,
        }
    }
</script>

<!-- Mirrors the .done wrapper from +page.svelte -->
<div class="done">
    <Done bind:encryptState={testEncryptState} {createDefaultEncryptState} />
</div>

<style>
    .done {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
</style>
