<script lang="ts">
    import { _ } from 'svelte-i18n'
    import Chip from '$lib/components/Chip.svelte'

    interface props {
        clickAction?: () => void
        translation_key: string
        type: 'add' | 'added'
    }

    let { clickAction, translation_key, type }: props = $props()

    // Explanatory hover text for the attribute chip (issue #265): users didn't
    // understand what requiring an extra attribute like phone number or date of
    // birth actually does. svelte-i18n returns the key itself when a message is
    // missing, so only surface a title when a real `.tooltip` string exists.
    let tooltipKey = $derived(translation_key + '.tooltip')
    let tooltip = $derived.by(() => {
        const resolved = $_(tooltipKey)
        return resolved === tooltipKey ? undefined : resolved
    })
</script>

<Chip
    text={$_(translation_key)}
    onclick={clickAction}
    icon={type === 'add' ? '+' : null}
    size="md"
    variant={type === 'add' ? 'default' : 'filled'}
    title={tooltip}
/>
