<script lang="ts">
    import { _ } from 'svelte-i18n'
    import logo from '$lib/assets/images/logo.svg'
    import logoDark from '$lib/assets/images/logo-dark.svg'
    import LocaleSwitcher from './LocaleSwitcher.svelte'
    import '$lib/global.scss'
    import Hamburger from '$lib/components/header/Hamburger.svelte'
    import { page } from '$app/state'
    import { resolve } from '$app/paths'
    import ThemeSwitcher from './ThemeSwitcher.svelte'
    import ExternalLinkIcon from './ExternalLinkIcon.svelte'
    import { BUSINESS_URL } from '$lib/env'

    const items = [
        { name: 'fs', route: '/fileshare' },
        { name: 'about', route: '/about/' },
        { name: 'blog', route: '/blog/' },
        { name: 'pol', route: '/privacy/' },
        { name: 'business', route: BUSINESS_URL, external: true },
        { name: 'docs', route: 'https://docs.postguard.eu', external: true },
    ]

    function isSelected(route: string) {
        return page.url.pathname === route
    }
</script>

<div class="pg-topbar">
    <a href={resolve('/')}>
        <img
            src={logo}
            alt="postguard logo"
            width="128"
            height="70"
            class="logo-light"
        />
        <img
            src={logoDark}
            alt="postguard logo"
            width="128"
            height="70"
            class="logo-dark"
        />
    </a>
    <div class="pg-desktop-menu">
        <ul>
            {#each items as item (item.name)}
                <li class:selected={isSelected(item.route)}>
                    <!-- eslint-disable svelte/no-navigation-without-resolve -->
                    <a
                        href={item.route}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                    >
                        {$_(
                            `header.${item.name}`
                        )}{#if item.external}<ExternalLinkIcon />{/if}
                    </a>
                    <!-- eslint-enable svelte/no-navigation-without-resolve -->
                </li>
            {/each}
        </ul>
        <LocaleSwitcher />
        <ThemeSwitcher />
        <a
            href={resolve('/decrypt')}
            class="inbox-btn"
            class:selected={isSelected('/decrypt')}
        >
            {$_('header.inbox')}
        </a>
    </div>
    <Hamburger items={[...items, { name: 'inbox', route: '/decrypt' }]} />
</div>

<style lang="scss">
    .logo-light {
        display: block;
    }

    .logo-dark {
        display: none;
    }

    :global(.dark) .logo-light {
        display: none;
    }

    :global(.dark) .logo-dark {
        display: block;
    }

    .pg-topbar {
        width: auto;
        margin: 0.5rem 1rem 1rem 1rem;

        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }

    .pg-desktop-menu {
        display: none;
        margin-left: auto;
        flex-direction: row;
        align-items: center;
        gap: 1rem;
    }

    @media only screen and (min-width: 768px) {
        .pg-desktop-menu {
            display: flex;
        }
    }

    .inbox-btn {
        padding: 0.25rem 1rem;
        background: var(--pg-primary);
        color: white;
        border-radius: var(--pg-border-radius-sm);
        text-decoration: none;
        font-weight: var(--pg-font-weight-medium);
        font-size: var(--pg-font-size-sm);
        transition: opacity 0.2s ease;
        white-space: nowrap;

        &:hover {
            opacity: 0.9;
        }

        &.selected {
            opacity: 0.85;
            box-shadow: 0 0 0 2px var(--pg-primary);
            background: transparent;
            color: var(--pg-primary);
        }
    }

    .pg-desktop-menu ul li {
        display: inline-block;
        position: relative;
        list-style-type: none;
        margin-left: 15px;
        padding-right: 15px;

        &:not(:last-child) {
            border-right: 1px solid var(--pg-text);
        }

        &.selected a {
            text-decoration: 2px underline;
            text-decoration-color: var(--pg-text);
            text-underline-offset: 4px;
        }

        &:not(.selected) a {
            text-decoration: none;

            &:after {
                content: '';
                position: absolute;
                width: calc(100% - 15px);
                transform: scaleX(0);
                height: 2px;
                bottom: 0;
                left: 0;
                background-color: var(--pg-text);
                transform-origin: bottom right;
                transition: transform 0.25s ease-out;
            }

            &:hover:after {
                transform: scaleX(1);
                transform-origin: bottom left;
            }
        }
    }
</style>
