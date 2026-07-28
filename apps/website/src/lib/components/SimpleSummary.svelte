<script lang="ts">
    import type { Snippet } from 'svelte'

    interface Props {
        /** Heading shown on the card, e.g. "In short" / "In het kort". */
        title: string
        /** Unique id so the section can be labelled by its heading. */
        id?: string
        /** Card body. Rendered as-is, so it may contain a short intro and a list. */
        children?: Snippet
    }

    let { title, id = 'simple-summary', children }: Props = $props()
</script>

<section class="simple-summary" aria-labelledby="{id}-label">
    <h3 id="{id}-label" class="simple-summary__label">{title}</h3>
    <div class="simple-summary__body">
        {@render children?.()}
    </div>
</section>

<style lang="scss">
    .simple-summary {
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        padding: 1.25rem 1.5rem;
        margin-bottom: 2rem;
    }

    .simple-summary__label {
        margin: 0 0 0.75rem;
        font-size: var(--pg-font-size-lg);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        /* Balance the heading so it never breaks to a lone trailing word. */
        text-wrap: balance;
    }

    .simple-summary__body {
        /* Cap the line length so the plain-language text stays easy to read
           even when the card spans a wide container. */
        max-width: var(--pg-reading-width);
        color: var(--pg-text);
        font-size: var(--pg-font-size-base);
        line-height: 1.6;
        /* Knuth-Plass-style breaking: avoids orphans and evens out the rag. */
        text-wrap: pretty;
        /* Let quotes/bullets hang into the margin (optical alignment). */
        hanging-punctuation: first last;

        /* Body is injected via {@html} in the parent, so it carries no scope
           class — target it with :global (same approach as the privacy page). */
        :global(p) {
            margin: 0 0 0.75rem;
        }

        :global(ul) {
            margin: 0;
            padding-left: 1.25rem;
            list-style: disc;
        }

        :global(li) {
            margin-bottom: 0.4rem;
        }

        :global(li:last-child) {
            margin-bottom: 0;
        }

        :global(a) {
            color: var(--pg-primary);
            font-weight: var(--pg-font-weight-medium);
        }
    }
</style>
