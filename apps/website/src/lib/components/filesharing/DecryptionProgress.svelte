<script lang="ts">
    import { _ } from 'svelte-i18n'

    interface props {
        percentage: number | undefined
    }

    let { percentage }: props = $props()

    let determinate = $derived(typeof percentage === 'number')
</script>

<div class="container">
    <p class="label" id="decryption-progress-label" role="status">
        {$_('filesharing.decryptpanel.downloadingAndDecrypting')}
    </p>
    {#if determinate}
        <div
            class="bar-track"
            role="progressbar"
            aria-labelledby="decryption-progress-label"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(
                Math.max(0, Math.min(100, percentage ?? 0))
            )}
        >
            <div
                class="bar-fill"
                style="width: {Math.max(0, Math.min(100, percentage ?? 0))}%"
            ></div>
        </div>
    {:else}
        <div
            class="bar-track"
            role="progressbar"
            aria-labelledby="decryption-progress-label"
            aria-busy="true"
        >
            <div class="bar-indeterminate"></div>
        </div>
    {/if}
    {#if determinate}
        <p class="percent">{Math.round(percentage ?? 0)}%</p>
    {/if}
</div>

<style lang="scss">
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.5rem 0;
        width: 100%;
    }

    .label {
        margin: 0;
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        text-align: center;
    }

    .bar-track {
        position: relative;
        width: 100%;
        height: 8px;
        background: var(--pg-strong-background);
        border-radius: 4px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        background: var(--pg-primary-contrast);
        border-radius: 4px;
        transition: width 0.15s ease-out;
    }

    .bar-indeterminate {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 40%;
        background: var(--pg-primary-contrast);
        border-radius: 4px;
        animation: slide 1.4s ease-in-out infinite;
    }

    @keyframes slide {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(250%);
        }
    }

    .percent {
        margin: 0;
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-sm);
    }

    @media (prefers-reduced-motion: reduce) {
        .bar-indeterminate {
            animation: none;
        }
    }
</style>
