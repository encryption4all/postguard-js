<script lang="ts">
    import { _ } from 'svelte-i18n'
    import type { EncryptState } from '$lib/types/filesharing/attributes'
    import HelpToggle from '$lib/components/HelpToggle.svelte'
    import Chip from '$lib/components/Chip.svelte'
    import FileList from '$lib/components/filesharing/FileList.svelte'
    import EmailPreviewModal from '$lib/components/filesharing/EmailPreviewModal.svelte'
    import airplane from '$lib/assets/images/airplane.svg'
    import { STAGING } from '$lib/env'

    interface props {
        encryptState: EncryptState
        createDefaultEncryptState: () => EncryptState
    }
    let { encryptState = $bindable(), createDefaultEncryptState }: props =
        $props()

    // On staging, cryptify renders the notification email but does not
    // dispatch via SMTP. Auto-open the preview modal so developers don't
    // have to scrape cryptify logs for the /download link. The modal
    // fetches the actual rendered HTML from cryptify, so this branch
    // never runs in production (STAGING is false there).
    let previewOpen = $state(STAGING && !!encryptState.uploadUuid)
</script>

<div class="container">
    <h2>{$_('filesharing.encryptPanel.succes')}</h2>

    <!-- Files box -->
    <FileList files={encryptState.files.map((f) => f.name)} />

    <!-- Recipients box -->
    <div class="info-box">
        <h3>{$_('filesharing.encryptPanel.recipientsHeader')}</h3>
        <div class="divider"></div>
        <div class="recipients-list">
            {#each encryptState.recipients as recipient (recipient.email)}
                <div class="recipient-item">
                    <div class="recipient-email">{recipient.email}</div>
                    {#if recipient.extra.length > 0}
                        <div class="recipient-attributes">
                            {#each recipient.extra.filter((a) => a.v) as attr (attr.t)}
                                <Chip
                                    text={attr.v!}
                                    size="sm"
                                    variant="default"
                                />
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <!-- Confirmation email note: the sender always receives a confirmation
         email too (upload is sent with notify.sender: true in SendButton). -->
    <p class="sender-confirmation">
        {$_('filesharing.encryptPanel.senderConfirmation')}
    </p>

    <!-- Help section -->
    <HelpToggle
        title={$_('filesharing.encryptPanel.whatRecipientGets')}
        content={$_('filesharing.encryptPanel.whatRecipientGetsText')}
        bordered={true}
    />

    <!-- Send another button -->
    <Chip
        text={$_('filesharing.encryptPanel.another')}
        onclick={() => (encryptState = createDefaultEncryptState())}
        size="lg"
        variant="dark"
    />

    {#if STAGING && encryptState.uploadUuid}
        <Chip
            text={$_('filesharing.emailPreview.reopen')}
            onclick={() => (previewOpen = true)}
            size="lg"
            variant="default"
        />
    {/if}

    <div class="spacer"></div>

    <!-- Airplane decoration -->
    <img src={airplane} alt="" aria-hidden="true" class="airplane-decoration" />
</div>

{#if STAGING && previewOpen && encryptState.uploadUuid}
    <EmailPreviewModal
        uuid={encryptState.uploadUuid}
        onClose={() => (previewOpen = false)}
    />
{/if}

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem 2rem 0 2rem;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        box-sizing: border-box;
        flex: 1; /* fill the .done wrapper in +page.svelte */
        min-width: 0;
    }

    h2 {
        font-size: var(--pg-font-size-2xl);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        margin: 0 0 1rem 0;
        text-align: center;
    }

    .info-box {
        width: 100%;
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        box-shadow: 0 2px 8px rgba(48, 149, 222, 0.08);
    }

    .info-box h3 {
        padding: 0.5rem 1rem;
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-md);
        font-family: var(--pg-font-family);
        margin: 0;
    }

    .divider {
        width: 100%;
        height: 1px;
        background-color: var(--pg-strong-background);
        margin: 0rem 0rem;
    }

    .recipients-list {
        display: flex;
        flex-direction: column;
    }

    .recipient-item {
        padding: 0.4rem 1rem;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        color: var(--pg-text);
        border-bottom: 1px solid var(--pg-strong-background);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .recipient-email {
        font-weight: var(--pg-font-weight-regular);
    }

    .recipient-attributes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .sender-confirmation {
        width: 100%;
        margin: 0;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        color: var(--pg-text);
        text-align: center;
    }

    .spacer {
        flex: 1;
    }

    .airplane-decoration {
        width: 120%;
        max-width: 800px;
        height: auto;
        opacity: 0.6;
        pointer-events: none;
        margin: 0;
        padding: 0;

        @media only screen and (max-width: 768px) {
            width: 100%;
        }
    }
</style>
