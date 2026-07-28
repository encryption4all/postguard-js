<script lang="ts">
    import Header from '$lib/components/Header.svelte'
    import ExternalLinkIcon from '$lib/components/ExternalLinkIcon.svelte'
    import { isLoading } from 'svelte-i18n'
    import { resolve } from '$app/paths'
    import { page } from '$app/state'

    let { children } = $props()

    // Debug sandboxes are dev-only and use the full viewport for their
    // own chrome; suppress the global footer there.
    const isDebug = $derived(page.url.pathname.startsWith('/debug'))
</script>

{#if !$isLoading}
    <a class="sr-only sr-only-focusable skip-link" href="#main-content">
        Skip to main content
    </a>
    <Header />
    <main id="main-content" tabindex="-1">
        {@render children()}
    </main>
    {#if !isDebug}
        <footer class="app-footer">
            <a href={resolve('/about/')}>About</a>
            <span class="sep">&middot;</span>
            <a href={resolve('/privacy/')}>Privacy Policy</a>
            <span class="sep">&middot;</span>
            <span
                >Built by <a
                    href="https://yivi.app"
                    target="_blank"
                    rel="noopener noreferrer">Yivi<ExternalLinkIcon /></a
                ></span
            >
        </footer>
    {/if}
{/if}

<style>
    main {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        padding: 0.5rem 1rem;
        background: var(--pg-primary);
        color: var(--pg-on-primary);
        font-weight: 600;
        text-decoration: none;
        z-index: 1000;
        transform: translateY(-200%);
        transition: transform 0.15s ease-in-out;
    }
    .skip-link:focus {
        transform: translateY(0);
        outline: 2px solid var(--pg-on-primary);
        outline-offset: 2px;
    }

    .app-footer {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.75rem 1rem;
        font-size: var(--pg-font-size-xs);
        color: var(--pg-text-secondary);

        a {
            color: var(--pg-text-secondary);
            text-decoration: none;
        }

        a:hover {
            color: var(--pg-primary);
        }

        .sep {
            opacity: 0.5;
        }
    }

    /* Match Header's 768px desktop breakpoint. */
    @media only screen and (max-width: 767.98px) {
        .app-footer {
            display: none;
        }
    }
</style>
