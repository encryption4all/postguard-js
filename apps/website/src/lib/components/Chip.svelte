<script lang="ts">
    interface props {
        text: string
        onclick?: () => void
        size?: 'sm' | 'md' | 'lg'
        variant?: 'default' | 'filled' | 'dark'
        icon?: '+' | '×' | null
        disabled?: boolean
        title?: string
    }

    let {
        text,
        onclick,
        size = 'md',
        variant = 'default',
        icon = null,
        disabled = false,
        title,
    }: props = $props()

    let isInteractive = $derived(onclick !== undefined)
</script>

{#if isInteractive}
    <button
        class="chip"
        class:chip-sm={size === 'sm'}
        class:chip-md={size === 'md'}
        class:chip-lg={size === 'lg'}
        class:chip-default={variant === 'default'}
        class:chip-filled={variant === 'filled'}
        class:chip-dark={variant === 'dark'}
        {onclick}
        {disabled}
        title={title || undefined}
        type="button"
    >
        {#if icon}<span class="chip-icon">{icon}</span>{/if}<span
            class="chip-text">{text}</span
        >
    </button>
{:else}
    <span
        class="chip chip-static"
        class:chip-sm={size === 'sm'}
        class:chip-md={size === 'md'}
        class:chip-lg={size === 'lg'}
        class:chip-default={variant === 'default'}
        class:chip-filled={variant === 'filled'}
        class:chip-dark={variant === 'dark'}
        title={title || undefined}
    >
        {#if icon}<span class="chip-icon">{icon}</span>{/if}<span
            class="chip-text">{text}</span
        >
    </span>
{/if}

<style>
    .chip {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border-radius: var(--pg-border-radius-md);
        font-family: var(--pg-font-family);
        color: var(--pg-text);
        transition: all 0.2s ease;
        box-sizing: border-box;
        white-space: nowrap;
        width: fit-content;
    }

    .chip-icon,
    .chip-text {
        display: inline-block;
    }

    /* Interactive chips (buttons) */
    button.chip {
        cursor: pointer;
    }

    button.chip:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    button.chip:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Static chips (non-interactive) */
    .chip-static {
        cursor: default;
    }

    /* Size variants */
    .chip-sm {
        padding: 0px 8px;
        font-size: var(--pg-font-size-sm);
    }

    .chip-md {
        padding: 2px 10px;
        font-size: var(--pg-font-size-sm);
    }

    .chip-lg {
        padding: 0.2rem 1rem;
        font-size: var(--pg-font-size-md);
    }

    /* Variant: default (white background, light border) */
    .chip-default {
        background-color: var(--pg-general-background);
        border: 1px solid var(--pg-input-normal);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    button.chip-default:hover:not(:disabled) {
        background-color: var(--pg-soft-background);
        border-color: var(--pg-primary);
        color: var(--pg-primary);
        box-shadow: 0 2px 4px rgba(48, 149, 222, 0.15);
    }

    button.chip-default:active:not(:disabled) {
        transform: translateY(1px);
        box-shadow: none;
    }

    /* Variant: filled (gray background) */
    .chip-filled {
        background-color: var(--pg-strong-background);
        border: 1px solid var(--pg-input-normal);
    }

    button.chip-filled:hover:not(:disabled) {
        background-color: var(--pg-soft-background);
        border-color: var(--pg-input-error);
        color: var(--pg-input-error);
    }

    button.chip-filled:active:not(:disabled) {
        transform: translateY(1px);
    }

    /* Variant: dark (black border, for close buttons) */
    .chip-dark {
        background-color: transparent;
        border: 1px solid var(--pg-text);
    }

    button.chip-dark:hover:not(:disabled) {
        background-color: var(--pg-soft-background);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    button.chip-dark:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: none;
    }
</style>
