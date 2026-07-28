<script lang="ts">
    import close from '$lib/assets/images/google-icons/close.svg'
</script>

<div class="files">
    <div>
        <div><p class="file-title" data-dz-name></p></div>
    </div>

    <div>
        <p data-dz-size></p>
        <button class="remove-button" data-dz-remove type="button">
            <img class="invert" src={close} alt="remove button" />
        </button>
        <div class="dz-error-message"><span data-dz-errormessage></span></div>
    </div>
</div>

<style>
    .files {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        margin-bottom: 0;
        padding: 8px 0;
        border-bottom: 2px solid var(--pg-input-normal);
    }

    .files > div:first-child {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
    }

    .files > div:first-child > div {
        min-width: 0;
        flex: 1;
    }

    .files > div:last-child {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    /* .preview-img {
        width: 40px;
        height: 30px;
        border-radius: var(--pg-border-radius-md);
        object-fit: contain;
        background-color: #f9fafb;
        padding: 4px;
    } */

    .file-title {
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

    .files > div:last-child p {
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-regular);
        margin: 0;
        color: var(--pg-text-secondary);
        font-size: var(--pg-font-size-sm);
    }

    .remove-button {
        cursor: pointer;
        height: 100%;
        padding: 4px 0 4px 4px;
        border-radius: var(--pg-border-radius-md);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }

    .remove-button:hover {
        background-color: var(--pg-soft-background);
    }

    .remove-button:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .remove-button * {
        cursor: pointer;
    }

    .remove-button img {
        width: 18px;
        height: 18px;
    }

    .dz-error-message {
        display: none;
    }

    :global(.dz-error) .dz-error-message {
        display: block;
    }
</style>
