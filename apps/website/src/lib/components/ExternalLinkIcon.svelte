<script lang="ts">
    import { _ } from 'svelte-i18n'

    // External-link marker copied 1:1 from docs.postguard.eu (VitePress): the
    // Material "north-east" arrow glyph, 11px, nudged up 1px and 4px to the
    // right of the text, filled with the muted tertiary text colour regardless
    // of the link colour. The arrow is decorative (aria-hidden); the
    // visually-hidden hint is what assistive tech announces, so it becomes part
    // of the link's accessible name (e.g. "Documentation, opens in a new tab").
</script>

<svg
    class="external-link-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
>
    <path d="M0 0h24v24H0V0z" fill="none" />
    <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5H9z" />
</svg><span class="external-link-hint"
    >{$_('common.opensNewTab', { default: 'opens in a new tab' })}</span
>

<style>
    .external-link-icon {
        display: inline-block;
        width: 11px;
        height: 11px;
        margin-top: -1px;
        margin-left: 4px;
        flex-shrink: 0;
        /* Muted, like VitePress's --vp-c-text-3, independent of link colour. */
        fill: var(--pg-text-secondary);
    }

    .external-link-hint {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
    }
</style>
