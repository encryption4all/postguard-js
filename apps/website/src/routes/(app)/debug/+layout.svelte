<script lang="ts">
    // The debug page components are stripped from the production bundle at build
    // time (see `excludeDebugRoutesInProduction` in `vite.config.ts`), so their
    // code never ships. This runtime redirect is kept as a second line of
    // defence: if a production user reaches `/debug/*`, send them back home
    // instead of rendering an empty stub page.
    import { dev } from '$app/environment'
    import { goto } from '$app/navigation'
    import { resolve } from '$app/paths'

    let { children } = $props()

    if (!dev) {
        goto(resolve('/'))
    }
</script>

{#if dev}
    {@render children()}
{/if}
