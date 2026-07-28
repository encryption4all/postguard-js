<script lang="ts">
    import { _ } from 'svelte-i18n'
    import { EncryptionState } from '$lib/types/filesharing/attributes'

    interface props {
        encryptionState: EncryptionState
        serverError?: boolean
    }

    // eslint-disable-next-line no-useless-assignment
    let { encryptionState = $bindable(), serverError = false }: props = $props()
</script>

<div class="error-container">
    <div class="error-content">
        <h3 class="error-title">
            {serverError
                ? $_('filesharing.serverErrorTitle')
                : $_('filesharing.errorTitle')}
        </h3>
        <p class="error-message">
            {#if serverError}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $_('filesharing.serverError')}
            {:else}
                {$_('filesharing.error')}
            {/if}
        </p>
        <button
            class="error-btn"
            onclick={() => (encryptionState = EncryptionState.FileSelection)}
            type="button"
        >
            {$_('filesharing.tryAgain')}
        </button>
    </div>
</div>

<style>
    .error-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-height: 400px;
        padding: 1.5rem;
    }

    .error-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        max-width: 400px;
        gap: 1rem;
    }

    .error-title {
        color: var(--pg-input-error);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
        margin: 0;
    }

    .error-message {
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-base);
        line-height: 1.5;
        margin: 0;
    }

    .error-btn {
        margin-top: 1rem;
        padding: 0.75rem 2rem;
        background-color: var(--pg-text);
        color: var(--pg-general-background);
        border: none;
        border-radius: var(--pg-border-radius-sm);
        cursor: pointer;
        font-size: var(--pg-font-size-base);
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-medium);
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .error-btn:hover {
        background-color: var(--pg-input-active);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .error-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
</style>
