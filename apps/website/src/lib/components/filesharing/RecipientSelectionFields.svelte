<script lang="ts">
    import { _ } from 'svelte-i18n'
    import validator from 'validator'
    import emailSpellChecker from '@zootools/email-spell-checker'
    import type { AttributeCon } from '$lib/types/filesharing/attributes'
    import type { AttType } from '$lib/types/filesharing/attributes'
    import closebutton from '$lib/assets/images/google-icons/close.svg'
    import AttributeButton from '$lib/components/filesharing/inputs/AttributeButton.svelte'
    import MultiInput from '$lib/components/filesharing/inputs/MultiInput.svelte'
    interface props {
        recipient: { email: string; extra: AttributeCon }
        remove: () => void
        addAttribute: (att: AttType) => void
        attributes: AttType[]
        isConfirming?: boolean
        isFirstRecipient?: boolean
    }

    let {
        recipient = $bindable(),
        remove,
        addAttribute,
        attributes,
        isConfirming = false,
        isFirstRecipient = false,
    }: props = $props()

    let addableButtons: AttType[] = $derived(
        attributes.filter((att) => !recipient.extra.some(({ t }) => t === att))
    )

    // Suggest a correction for a likely-mistyped domain (e.g. `gmial.com` →
    // `gmail.com`). This catches the structurally-valid typo class that
    // `isEmail` cannot — the root cause of the silent send failure in #293.
    // Advisory only: the address still validates, so we never block on it.
    let emailSuggestion = $derived.by(() => {
        const email = recipient.email?.trim()
        if (isConfirming || !email) return undefined
        return emailSpellChecker.run({ email })
    })

    // Inline invalidity, shown only after the field has been left (`touched`)
    // so we don't nag mid-typing, then live-updated until it becomes valid.
    // Native `:invalid` can't cover this: `type="email"` treats `r@h` (no TLD)
    // as valid, so the field never went red. `validator.isEmail` matches the
    // send-time check, so what turns red here is exactly what would be blocked.
    let touched = $state(false)
    let showEmailError = $derived.by(() => {
        const email = recipient.email?.trim()
        return touched && !isConfirming && !!email && !validator.isEmail(email)
    })
</script>

<li class="crypt-recipient" class:is-confirming-bg={isConfirming}>
    <div class="recipient-container">
        {#if !isFirstRecipient}
            <button
                class="btn-delete"
                class:hidden={isConfirming}
                onclick={remove}
            >
                <img
                    class="invert"
                    style="width: 14px; height: 14px;"
                    src={closebutton}
                    alt="close button"
                />
            </button>
        {/if}

        <div class="recipient-content">
            <div class="recipient-heading">
                <label
                    class="field-label"
                    for="recipient-email-{recipient.email}"
                >
                    {$_('filesharing.encryptPanel.emailRecipient')}
                    <span class="required-asterisk" aria-hidden="true">*</span>
                </label>
            </div>
            <input
                id="recipient-email-{recipient.email}"
                placeholder={$_(
                    'filesharing.encryptPanel.emailRecipientPlaceholder'
                )}
                type="email"
                required
                aria-required="true"
                aria-invalid={showEmailError || undefined}
                aria-describedby="required-fields-legend"
                autocomplete="email"
                inputmode="email"
                autocapitalize="none"
                spellcheck="false"
                class="pg-input"
                class:is-confirming-bg={isConfirming}
                class:input-invalid={showEmailError}
                bind:value={recipient.email}
                disabled={isConfirming}
                onblur={() => (touched = true)}
            />

            {#if showEmailError}
                <p class="email-error" aria-live="polite">
                    {$_('filesharing.encryptPanel.validation.invalidEmail', {
                        values: { email: recipient.email.trim() },
                    })}
                </p>
            {/if}

            {#if emailSuggestion}
                {@const suggested = emailSuggestion.full}
                <p class="email-suggestion" aria-live="polite">
                    {$_('filesharing.encryptPanel.emailSuggestion')}
                    <button
                        type="button"
                        class="email-suggestion-btn"
                        onclick={() => (recipient.email = suggested)}
                    >
                        {suggested}
                    </button>?
                </p>
            {/if}

            <div class="optionals-container">
                {#if isConfirming}
                    {#if recipient.extra.length > 0}
                        <div class="attributes-list">
                            {#each recipient.extra as attribute (attribute.t)}
                                <AttributeButton
                                    type="added"
                                    translation_key={'filesharing.attributes.' +
                                        attribute.t}
                                />
                            {/each}
                        </div>
                    {/if}
                {:else}
                    {#each recipient.extra as attribute, index (attribute.t)}
                        <MultiInput
                            translation_key={'filesharing.attributes.' +
                                attribute.t}
                            bind:value={attribute.v}
                            deleteAction={() => {
                                recipient.extra.splice(index, 1)
                            }}
                        />
                    {/each}
                    {#if addableButtons.length > 0}
                        <p class="attributes-explainer">
                            {$_('filesharing.encryptPanel.attributesExplainer')}
                        </p>
                    {/if}
                    <div class="attributes-list">
                        {#each addableButtons as attribute (attribute)}
                            <AttributeButton
                                type="add"
                                translation_key={'filesharing.attributes.' +
                                    attribute}
                                clickAction={() => addAttribute(attribute)}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</li>

<style>
    .crypt-recipient {
        background-color: var(--pg-soft-background);
        padding: 1rem;
        border-radius: var(--pg-border-radius-lg);
        border: 1px solid var(--pg-strong-background);
    }

    .crypt-recipient:not(:last-child) {
        margin-bottom: 0.5rem;
    }

    .recipient-container {
        display: flex;
        gap: 0.75rem;
        align-items: center;
    }

    .btn-delete {
        all: unset;
        cursor: pointer;
        padding: 4px;
        border-radius: var(--pg-border-radius-md);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .btn-delete:hover {
        background-color: var(--pg-soft-background);
    }

    .btn-delete:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .recipient-content {
        flex: 1;
        min-width: 0;
    }

    .recipient-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .field-label {
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-extrabold);
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    .required-asterisk {
        color: var(--pg-error, #e53e3e);
        margin-left: 0.125rem;
    }

    .optionals-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    /* Short helper above the add-attribute chips explaining what requiring an
       extra attribute (date of birth, phone number) does for the recipient. */
    .attributes-explainer {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        line-height: 1.4;
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .email-suggestion {
        margin: 0.4rem 0 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .email-suggestion-btn {
        all: unset;
        cursor: pointer;
        color: var(--pg-primary-contrast);
        font-weight: var(--pg-font-weight-medium);
        text-decoration: underline;
    }

    .email-suggestion-btn:hover {
        color: var(--pg-primary);
    }

    .email-suggestion-btn:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
        border-radius: var(--pg-border-radius-sm);
    }

    .email-error {
        margin: 0.4rem 0 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-input-error);
        font-family: var(--pg-font-family);
    }

    /* Red border for the invalid state. Native `input:invalid` styling in
       global.scss can't catch it (see the script), and the pairing here
       (two classes, plus the :focus variant) outweighs the global base and
       focus border rules so the red shows whether or not the field is focused. */
    .pg-input.input-invalid,
    .pg-input.input-invalid:focus {
        border-color: var(--pg-input-error);
    }
</style>
