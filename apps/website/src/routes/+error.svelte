<script lang="ts">
    import { page } from '$app/state'
    import { _ } from 'svelte-i18n'
    import { resolve } from '$app/paths'
</script>

<div class="error-page">
    <div class="error-card">
        <span class="error-code">{page.status}</span>
        <h2>
            {#if page.status === 404}
                {$_('error.title')}
            {:else}
                {$_('error.serverTitle')}
            {/if}
        </h2>
        <p>
            {#if page.status === 404}
                {$_('error.message')}
            {:else}
                {$_('error.serverMessage')}
            {/if}
        </p>
        <a href={resolve('/')} class="home-btn">{$_('error.back')}</a>
    </div>
</div>

<style>
    .error-page {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 1rem;
    }

    .error-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        max-width: 420px;
        padding: 2.5rem 2rem;
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        box-shadow: 0 2px 8px rgba(48, 149, 222, 0.08);
        gap: 0.75rem;
    }

    .error-code {
        font-size: 4rem;
        font-weight: var(--pg-font-weight-extrabold);
        color: var(--pg-primary);
        line-height: 1;
    }

    h2 {
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        margin: 0;
    }

    p {
        font-size: var(--pg-font-size-base);
        color: var(--pg-text-secondary);
        line-height: 1.5;
        margin: 0;
    }

    .home-btn {
        margin-top: 0.75rem;
        padding: 0.75rem 2rem;
        background-color: var(--pg-text);
        color: var(--pg-general-background);
        border: none;
        border-radius: var(--pg-border-radius-sm);
        cursor: pointer;
        font-size: var(--pg-font-size-base);
        font-family: var(--pg-font-family);
        font-weight: var(--pg-font-weight-medium);
        text-decoration: none;
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .home-btn:hover {
        background-color: var(--pg-input-active);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .home-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
</style>
