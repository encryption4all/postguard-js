<script lang="ts">
    import { locale } from 'svelte-i18n'
    import { browser } from '$app/environment'

    let isNL = $derived($locale === 'nl-NL')
    let isEN = $derived($locale === 'en-US')

    function handleChange(newLocale: string) {
        locale.set(newLocale)
        if (browser) localStorage.setItem('preferredLanguage', newLocale)
    }
</script>

<div class="language" role="radiogroup" aria-labelledby="language-switcher">
    <p class="hidden" id="language-switcher">
        Choose a language for this website
    </p>
    <div
        class="language-container-left language-container-nl"
        class:selected={isNL}
    >
        <input
            type="radio"
            class="language-control"
            id="language1-1"
            name="language-switch1"
            value="nl-NL"
            checked={isNL}
            onchange={() => handleChange('nl-NL')}
        />
        <label class="language-label" for="language1-1">
            NL<span class="hidden"> Nederlands</span>
        </label>
    </div>
    <div
        class="language-container-right language-container-en"
        class:selected={isEN}
    >
        <input
            type="radio"
            class="language-control"
            id="language1-2"
            name="language-switch1"
            value="en-US"
            checked={isEN}
            onchange={() => handleChange('en-US')}
        />
        <label class="language-label" for="language1-2">
            EN<span class="hidden"> English</span>
        </label>
    </div>
</div>

<style lang="scss">
    $language-width: 100%;
    $language-height: 100%;
    $language-focus: var(--pg-primary);
    $language-border: var(--pg-input-normal);
    $language-hover: var(--pg-soft-background);
    $language-checked: var(--pg-strong-background);
    $white: var(--pg-general-background);

    // hide radio buttons language and theme switcher
    input.language-control {
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

    .language {
        display: flex;
        width: 6rem;
        height: auto;
        font-size: var(--pg-font-size-base);
        line-height: 1;
        margin: 1rem 0;
        align-content: center;
        align-items: center;
    }

    .language-container-left,
    .language-container-right {
        position: relative;
        float: left;
        width: $language-width;
        height: 30px;
        padding: 0;
    }

    .language-label {
        position: absolute;
        top: 0;
        left: 0;
        width: $language-width;
        height: $language-height;
        border: 1px solid $language-border;
        padding: 6px 0 2px 0;
        background-color: transparent;
        text-align: center;
        text-transform: uppercase;
        cursor: pointer;
    }

    .language-container-left .language-label {
        border-radius: 4px 0 0 4px;
        border-right: 1px solid $language-border;
    }

    .language-container-right .language-label {
        border-left: 1px solid $language-border;
        border-radius: 0 4px 4px 0;
    }

    .language-label:hover {
        background-color: $language-hover;
    }

    .selected .language-label {
        text-decoration: 2px underline;
        text-decoration-color: var(--pg-text);
        text-underline-offset: 4px;
    }

    .language-control:focus-visible + .language-label {
        outline: 2px solid $language-focus;
        outline-offset: 2px;
    }
</style>
