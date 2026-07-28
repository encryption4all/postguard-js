<!--
    Extra confirmation shown when a recipient chooses to download an
    unsigned file (no verifiable sender). The download page only opens
    this for the unsigned case — signed files download on a single click —
    so the weakest identity claim takes one deliberate step more.
-->
<script lang="ts">
    import { _ } from 'svelte-i18n'
    import type { Attachment } from 'svelte/attachments'

    interface Props {
        onConfirm: () => void
        onCancel: () => void
    }

    let { onConfirm, onCancel }: Props = $props()

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') onCancel()
    }

    /** Move focus to the safe (Cancel) action when the dialog opens so a
     *  stray Enter press cannot confirm a risky download. */
    const focusOnMount: Attachment<HTMLElement> = (node) => {
        node.focus()
    }
</script>

<svelte:window onkeydown={handleKey} />

<div
    class="backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="unsigned-confirm-title"
    aria-describedby="unsigned-confirm-body"
>
    <button
        class="backdrop-close"
        type="button"
        aria-label={$_('filesharing.decryptpanel.trustConfirmCancel')}
        onclick={onCancel}
    ></button>

    <div class="modal">
        <svg
            class="modal-icon"
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
        <h2 id="unsigned-confirm-title">
            {$_('filesharing.decryptpanel.trustConfirmHeader')}
        </h2>
        <p id="unsigned-confirm-body">
            {$_('filesharing.decryptpanel.trustWarnUnsigned')}
        </p>
        <div class="modal-actions">
            <button
                type="button"
                class="modal-btn modal-btn-cancel"
                onclick={onCancel}
                {@attach focusOnMount}
            >
                {$_('filesharing.decryptpanel.trustConfirmCancel')}
            </button>
            <button
                type="button"
                class="modal-btn modal-btn-confirm"
                onclick={onConfirm}
            >
                {$_('filesharing.decryptpanel.trustConfirmAccept')}
            </button>
        </div>
    </div>
</div>

<style lang="scss">
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(3, 14, 23, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1.5rem;
    }

    .backdrop-close {
        position: absolute;
        inset: 0;
        background: transparent;
        border: 0;
        padding: 0;
        cursor: pointer;
    }

    .modal {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
        max-width: 26rem;
        width: 100%;
        padding: 1.75rem 1.5rem 1.5rem;
        background: var(--pg-general-background);
        border-radius: var(--pg-border-radius-lg);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    }

    .modal-icon {
        width: 40px;
        height: 40px;
        color: var(--pg-input-error);
    }

    .modal h2 {
        margin: 0;
        font-size: var(--pg-font-size-lg);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
    }

    .modal p {
        margin: 0;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
        line-height: 1.5;
        color: var(--pg-text);
    }

    .modal-actions {
        display: flex;
        gap: 0.6rem;
        width: 100%;
        margin-top: 0.5rem;
    }

    .modal-btn {
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

    .modal-btn:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .modal-btn-cancel:hover,
    .modal-btn-cancel:focus-visible {
        color: var(--pg-text);
        border-color: var(--pg-input-hover);
        background: color-mix(in srgb, var(--pg-text) 8%, transparent);
    }

    /* Downloading an unsigned file is the risky path, so the confirm
       action is marked red rather than neutral. */
    .modal-btn-confirm {
        color: var(--pg-input-error);
        border-color: var(--pg-input-error);
    }

    .modal-btn-confirm:hover,
    .modal-btn-confirm:focus-visible {
        color: var(--pg-on-primary);
        background: var(--pg-input-error);
        border-color: var(--pg-input-error);
    }
</style>
