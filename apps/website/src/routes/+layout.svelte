<script lang="ts">
    import { onMount } from 'svelte'
    import { locale } from 'svelte-i18n'

    let { children } = $props()

    // Mark that the app has hydrated so subsequent navigations
    // to / don't trigger the returning visitor redirect.
    onMount(() => {
        ;(window as unknown as { __pg_client_nav: boolean }).__pg_client_nav =
            true
    })

    $effect(() => {
        if ($locale) {
            document.documentElement.lang = $locale.substring(0, 2)
        }
    })
</script>

{@render children()}

<style>
    :global(html),
    :global(body),
    :global(#app) {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
</style>
