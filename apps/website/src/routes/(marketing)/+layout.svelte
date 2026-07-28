<script lang="ts">
    import Header from '$lib/components/Header.svelte'
    import ExternalLinkIcon from '$lib/components/ExternalLinkIcon.svelte'
    import { isLoading } from 'svelte-i18n'
    import { _ } from 'svelte-i18n'
    import { onMount } from 'svelte'
    import { resolve } from '$app/paths'
    import { BUSINESS_URL } from '$lib/env'

    let { children } = $props()
    let contactEl = $state<HTMLAnchorElement>()

    onMount(() => {
        if (contactEl) {
            const addr = `${contactEl.dataset.name}@${contactEl.dataset.domain}`
            contactEl.href = `mailto:${addr}`
            // eslint-disable-next-line svelte/no-dom-manipulating
            contactEl.textContent = addr
        }
    })
</script>

<svelte:head>
    <!-- Site-wide RSS autodiscovery so feed readers pointed at any marketing
         page (including the root domain) find the blog feed. -->
    <link
        rel="alternate"
        type="application/rss+xml"
        title="PostGuard Blog RSS Feed"
        href="/blog/rss.xml"
    />
</svelte:head>

{#if !$isLoading}
    <a class="sr-only sr-only-focusable skip-link" href="#main-content">
        {$_('common.skipToMain', { default: 'Skip to main content' })}
    </a>
    <Header />
    <main id="main-content" tabindex="-1">
        {@render children()}
    </main>
    <footer>
        <div class="footer-content">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>{$_('footer.productTitle')}</h4>
                    <ul>
                        <li>
                            <a href={resolve('/fileshare')}>{$_('footer.fs')}</a
                            >
                        </li>
                        <li>
                            <a href={resolve('/decrypt')}
                                >{$_('footer.inbox')}</a
                            >
                        </li>
                        <li>
                            <a href={resolve('/addons/')}
                                >{$_('footer.addons')}</a
                            >
                        </li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>{$_('footer.resourcesTitle')}</h4>
                    <ul>
                        <li>
                            <a href={resolve('/about/')}>{$_('footer.about')}</a
                            >
                        </li>
                        <li>
                            <a href={resolve('/blog/')}>{$_('footer.blog')}</a>
                        </li>
                        <li>
                            <a
                                href="https://docs.postguard.eu"
                                target="_blank"
                                rel="noopener noreferrer"
                                >{$_('footer.docs')}<ExternalLinkIcon /></a
                            >
                        </li>
                        <li>
                            <a href={resolve('/privacy/')}>{$_('footer.pol')}</a
                            >
                        </li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>{$_('footer.connectTitle')}</h4>
                    <ul>
                        <li>
                            <a
                                href="mailto:"
                                bind:this={contactEl}
                                data-name="info"
                                data-domain="postguard.eu"
                                >{$_('footer.contact')}</a
                            >
                        </li>
                        <li>
                            <a
                                href="https://github.com/encryption4all"
                                target="_blank"
                                rel="noopener noreferrer"
                                >GitHub<ExternalLinkIcon /></a
                            >
                        </li>
                        <!-- eslint-disable svelte/no-navigation-without-resolve -->
                        <li>
                            <a
                                href={BUSINESS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                >PostGuard for Business<ExternalLinkIcon /></a
                            >
                        </li>
                        <!-- eslint-enable svelte/no-navigation-without-resolve -->
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>
                    {$_('footer.builtBy')}
                    <a
                        href="https://yivi.app"
                        target="_blank"
                        rel="noopener noreferrer">Yivi<ExternalLinkIcon /></a
                    >
                    @
                    <a
                        href="https://caesar.nl"
                        target="_blank"
                        rel="noopener noreferrer"
                        >Caesar Groep<ExternalLinkIcon /></a
                    >
                </p>
            </div>
        </div>
    </footer>
{/if}

<style lang="scss">
    main {
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        padding: 0.5rem 1rem;
        background: var(--pg-primary);
        color: var(--pg-on-primary);
        font-weight: var(--pg-font-weight-medium);
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

    footer {
        margin-top: 4rem;
        padding: 0 1rem 1.5rem;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
    }

    .footer-content {
        max-width: 1100px;
        margin: 0 auto;
        border-top: 1px solid var(--pg-strong-background);
        padding-top: 3rem;
    }

    .footer-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
        margin-bottom: 2rem;
    }

    /* Anchor the columns to the left, centre and right of the row so the
       footer reads as intentionally spread rather than left-clumped. Reset
       to left when the grid collapses to a single column (mobile). */
    .footer-grid .footer-col:nth-child(2) {
        text-align: center;
    }

    .footer-grid .footer-col:nth-child(3) {
        text-align: right;
    }

    .footer-col {
        h4 {
            font-size: var(--pg-font-size-sm);
            font-weight: var(--pg-font-weight-medium);
            color: var(--pg-text);
            margin: 0 0 0.75rem;
        }

        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        li {
            margin-bottom: 0.4rem;
        }

        a {
            color: var(--pg-text-secondary);
            text-decoration: none;

            &:hover {
                color: var(--pg-primary);
            }
        }
    }

    .footer-bottom {
        border-top: 1px solid var(--pg-strong-background);
        padding-top: 1.5rem;
        text-align: center;

        p {
            margin: 0;
            font-size: var(--pg-font-size-xs);
        }

        a {
            color: var(--pg-text-secondary);
            text-decoration: none;
            font-weight: var(--pg-font-weight-medium);

            &:hover {
                color: var(--pg-primary);
            }
        }
    }

    @media only screen and (max-width: 768px) {
        .footer-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }

        .footer-grid .footer-col:nth-child(2),
        .footer-grid .footer-col:nth-child(3) {
            text-align: left;
        }
    }
</style>
