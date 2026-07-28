<script lang="ts">
    import { _ } from 'svelte-i18n'

    interface props {
        files: string[]
    }

    let { files }: props = $props()
</script>

{#if files.length > 0}
    <div class="file-list">
        <div class="file-list-header">
            {$_('filesharing.encryptPanel.filesHeader')}
        </div>
        {#each files as filename (filename)}
            <div class="file-list-item">{filename}</div>
        {/each}
    </div>
{/if}

<style>
    .file-list {
        width: 100%;
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        overflow: hidden;
    }

    .file-list-header {
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-md);
        padding: 0.5rem 1rem;
        color: var(--pg-text);
        border-bottom: 1px solid var(--pg-strong-background);
        font-family: var(--pg-font-family);
    }

    .file-list-item {
        padding: 0.4rem 1rem;
        font-size: var(--pg-font-size-md);
        color: var(--pg-text);
        font-family: var(--pg-font-family);

        &:not(:last-child) {
            border-bottom: 1px solid var(--pg-strong-background);
        }
    }
</style>
