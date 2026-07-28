<script>
    import { createEventDispatcher } from 'svelte'

    const dispatch = createEventDispatcher()

    /** @type {{tabItems: any, activeItem: any}} */
    let { tabItems, activeItem } = $props()
</script>

<div class="tabs" role="tablist" aria-label="Mail client">
    {#each tabItems as { item, logo } (item)}
        <button
            type="button"
            role="tab"
            aria-selected={item === activeItem}
            class:active={item === activeItem}
            onclick={() => dispatch('tabChange', item)}
        >
            <img src={logo} alt="" width={20} height={20} />
            <span>{item}</span>
        </button>
    {/each}
</div>

<style lang="scss">
    .tabs {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 8px 0 16px 0;
        padding: 4px;
        background: rgba(var(--pg-primary-rgb), 0.06);
        border-radius: var(--pg-border-radius-lg);
    }

    button {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        font-size: var(--pg-font-size-sm);
        font-weight: 600;
        color: var(--pg-text);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--pg-border-radius-md);
        transition:
            background-color 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    button:hover {
        background: rgba(var(--pg-primary-rgb), 0.12);
        border-color: rgba(var(--pg-primary-rgb), 0.25);
    }

    button:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    button.active {
        background: var(--pg-primary);
        color: white;
        border-color: var(--pg-primary-contrast);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    }

    button.active:hover {
        background: var(--pg-primary-contrast);
    }
</style>
