<script lang="ts">
    import menuIcon from '$lib/assets/images/google-icons/menu.svg'
    import closeIcon from '$lib/assets/images/google-icons/close.svg'
    import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte'
    import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte'
    import logo from '$lib/assets/images/logo.svg'
    import logoDark from '$lib/assets/images/logo-dark.svg'
    import { _ } from 'svelte-i18n'
    import { page } from '$app/state'
    import ExternalLinkIcon from '$lib/components/ExternalLinkIcon.svelte'

    interface props {
        items: { name: string; route: string; external?: boolean }[]
    }

    let hamburgerOpen = $state(false)

    let { items }: props = $props()

    $effect(() => {
        document.body.style.overflow = hamburgerOpen ? 'hidden' : ''
        return () => {
            document.body.style.overflow = ''
        }
    })

    function isSelected(route: string) {
        return page.url.pathname === route
    }
</script>

<button
    class="desktop-hide"
    onclick={() => {
        hamburgerOpen = !hamburgerOpen
    }}
>
    <span class="sr-only">Open menu</span>
    <img
        src={menuIcon}
        alt=""
        aria-hidden="true"
        width="32"
        height="32"
        class="hamburger-icon invert"
        hidden={hamburgerOpen}
    />
</button>

<div class:open={hamburgerOpen} class="hamburger-menu">
    <div class="topbar">
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
        <button
            onclick={() => {
                hamburgerOpen = !hamburgerOpen
            }}
        >
            <span class="sr-only">Close menu</span>
            <img
                src={closeIcon}
                alt=""
                aria-hidden="true"
                width="32"
                height="32"
                class="hamburger-icon invert"
            />
        </button>
    </div>
    <ul>
        {#each items as item (item.name)}
            <li class:selected={isSelected(item.route)}>
                <!-- eslint-disable svelte/no-navigation-without-resolve -->
                <a
                    href={item.route}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    onclick={() => {
                        hamburgerOpen = false
                    }}
                >
                    {$_(
                        `header.${item.name}`
                    )}{#if item.external}<ExternalLinkIcon />{/if}</a
                >
                <!-- eslint-enable svelte/no-navigation-without-resolve -->
            </li>
        {/each}
    </ul>
    <div class="bottom-bar">
        <ThemeSwitcher />
        <LocaleSwitcher />
    </div>
</div>

<style>
    .logo-dark {
        display: none;
    }

    :global(.dark) .logo-light {
        display: none;
    }

    :global(.dark) .logo-dark {
        display: block;
    }

    @media only screen and (min-width: 768px) {
        .hamburger-icon {
            display: none;
        }
    }

    .hamburger-icon {
        cursor: pointer;
    }

    .hamburger-menu {
        display: none;
        position: fixed;
        flex-direction: column;
        top: 0;
        left: 0;
        background-color: var(--pg-general-background);
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 0;
        margin: 0;
        width: 100%;
        height: 100dvh;
        overflow: hidden;
        z-index: 4;
    }

    .hamburger-menu.open {
        display: flex;
    }

    .hamburger-menu ul {
        list-style: none;
        padding: 0;
        margin: 0;
        height: 100%;
    }

    .hamburger-menu li {
        border-bottom: 1px solid var(--pg-soft-background);
    }

    .hamburger-menu li:last-child {
        border-bottom: none;
    }

    .hamburger-menu li a {
        display: block;
        padding: 10px 15px;
        color: var(--pg-text);
        text-decoration: none;
    }

    .hamburger-menu li a:hover,
    .hamburger-menu li.selected a {
        background-color: var(--pg-soft-background);
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0.5rem 1rem 1rem 1rem;
    }

    .bottom-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 1rem;
    }
</style>
