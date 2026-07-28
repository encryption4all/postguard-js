<script lang="ts">
    import { browser } from '$app/environment'
    import { onMount } from 'svelte'
    import sun from '$lib/assets/images/google-icons/sun.svg'
    import moon from '$lib/assets/images/google-icons/moon.svg'

    function getInitialTheme(): {
        theme: 'light' | 'dark'
        pref: 'light' | 'dark' | null
    } {
        if (!browser) return { theme: 'light', pref: null }
        const stored = localStorage.getItem('preferredtheme')
        if (stored === 'light' || stored === 'dark') {
            return { theme: stored, pref: stored }
        }
        return {
            theme: window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light',
            pref: null,
        }
    }

    const initial = getInitialTheme()
    let userPreference: 'light' | 'dark' | null = $state(initial.pref)

    if (browser) {
        document.documentElement.classList.toggle(
            'dark',
            initial.theme === 'dark'
        )
    }

    function setTheme(newTheme: 'light' | 'dark') {
        userPreference = newTheme
        if (!browser) return
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
        localStorage.setItem('preferredtheme', newTheme)
    }

    onMount(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        function handleSystemChange(e: MediaQueryListEvent) {
            if (!localStorage.getItem('preferredtheme')) {
                const newTheme = e.matches ? 'dark' : 'light'
                document.documentElement.classList.toggle(
                    'dark',
                    newTheme === 'dark'
                )
            }
        }

        mediaQuery.addEventListener('change', handleSystemChange)
        return () =>
            mediaQuery.removeEventListener('change', handleSystemChange)
    })

    let isLight = $derived(userPreference === 'light')
    let isDark = $derived(userPreference === 'dark')
</script>

<div class="theme" role="radiogroup" aria-labelledby="theme-switcher">
    <p class="hidden" id="theme-switcher">Choose a theme for this website</p>

    <div class="theme-container-left" class:selected={isLight}>
        <input
            type="radio"
            class="theme-control"
            id="theme-light"
            name="theme"
            checked={isLight}
            onchange={() => setTheme('light')}
        />
        <label class="theme-label" for="theme-light">
            <img
                src={sun}
                width="16"
                height="16"
                alt="Light mode"
                class="invert"
            />
        </label>
    </div>

    <div class="theme-container-right" class:selected={isDark}>
        <input
            type="radio"
            class="theme-control"
            id="theme-dark"
            name="theme"
            checked={isDark}
            onchange={() => setTheme('dark')}
        />
        <label class="theme-label" for="theme-dark">
            <img
                src={moon}
                width="16"
                height="16"
                alt="Dark mode"
                class="invert"
            />
        </label>
    </div>
</div>

<style lang="scss">
    $theme-width: 100%;
    $theme-height: 100%;
    $theme-focus: var(--pg-primary);
    $theme-border: var(--pg-input-normal);
    $theme-hover: var(--pg-soft-background);
    $theme-checked: var(--pg-strong-background);
    $white: var(--pg-general-background);

    // hide radio buttons language and theme switcher
    input.theme-control {
        /*
      Source - https://stackoverflow.com/a/22462740
      Posted by Joe H, modified by community. See post 'Timeline' for change history
      Retrieved 2026-02-10, License - CC BY-SA 4.0
      */

        position: fixed;
        opacity: 0;
        pointer-events: none;
    }

    .hidden {
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
    }

    .theme {
        display: flex;
        width: 6rem;
        height: auto;
        font-size: var(--pg-font-size-base);
        line-height: 1;
        margin: 1rem 0;
        align-content: center;
        align-items: center;
    }

    .theme-container-left,
    .theme-container-right {
        position: relative;
        float: left;
        width: $theme-width;
        height: 30px;
        padding: 0;
    }

    .theme-label {
        position: absolute;
        top: 0;
        left: 0;
        width: $theme-width;
        height: $theme-height;
        border: 1px solid $theme-border;
        padding: 0;
        background-color: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .theme-container-left .theme-label {
        border-radius: 4px 0 0 4px;
        border-right: 1px solid $theme-border;
    }

    .theme-container-right .theme-label {
        border-left: 1px solid $theme-border;
        border-radius: 0 4px 4px 0;
    }

    .theme-label:hover {
        background-color: $theme-hover;
    }

    .selected .theme-label::after {
        content: '';
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 2px;
        background-color: var(--pg-text);
    }

    .theme-control:focus-visible + .theme-label {
        outline: 2px solid $theme-focus;
        outline-offset: 2px;
    }
</style>
