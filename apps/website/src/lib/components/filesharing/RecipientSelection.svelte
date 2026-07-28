<script lang="ts">
    import { _ } from 'svelte-i18n'
    import RecipientSelectionFields from '$lib/components/filesharing/RecipientSelectionFields.svelte'
    import HelpToggle from '$lib/components/HelpToggle.svelte'
    import Chip from '$lib/components/Chip.svelte'
    import type { AttributeCon } from '$lib/types/filesharing/attributes'
    import type { AttType } from '$lib/types/filesharing/attributes'

    interface props {
        recipients: { email: string; extra: AttributeCon }[]
        attributes: AttType[]
        isConfirming?: boolean
        readonly?: boolean
    }

    let {
        recipients = $bindable([]),
        attributes,
        isConfirming = false,
        readonly = false,
    }: props = $props()

    function removeRecipient(index: number) {
        recipients.splice(index, 1)
    }

    function addRecipient() {
        recipients.push({ email: '', extra: [] })
    }

    function addAttributeToRecipient(index: number, att: AttType) {
        recipients[index].extra.push({ t: att, v: '' })
    }
</script>

<div>
    <div
        class="crypt-select-protection-input-box"
        class:remove-border={isConfirming}
    >
        {#if !isConfirming}
            <div class="recipient-heading">
                <h3>
                    {$_('filesharing.encryptPanel.RecipientsHeading')}
                </h3>
            </div>
            <HelpToggle
                title={$_('filesharing.encryptPanel.RecipientsHelpToggle')}
                content={$_('filesharing.encryptPanel.RecipientsText')}
            />
        {/if}

        {#each recipients as recipient, index (recipient)}
            <RecipientSelectionFields
                bind:recipient={recipients[index]}
                remove={() => removeRecipient(index)}
                addAttribute={(att: AttType) =>
                    addAttributeToRecipient(index, att)}
                {attributes}
                isConfirming={isConfirming || readonly}
                isFirstRecipient={index === 0}
            />
        {/each}

        {#if !isConfirming && !readonly}
            <Chip
                text={$_('filesharing.encryptPanel.addRecipientButton')}
                onclick={addRecipient}
                icon="+"
                size="lg"
                variant="default"
            />
        {/if}
    </div>
</div>

<style lang="scss">
    .recipient-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .remove-border {
        border: none;
    }
</style>
