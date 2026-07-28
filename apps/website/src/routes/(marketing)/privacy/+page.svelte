<script>
    import { _ } from 'svelte-i18n'
    import SEO from '$lib/components/SEO.svelte'
    import SimpleSummary from '$lib/components/SimpleSummary.svelte'
    import { SITE_URL } from '$lib/env'

    const privacyJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebPage',
                name: 'Privacy Policy',
                url: `${SITE_URL}/privacy`,
                description:
                    "PostGuard's privacy policy. Learn how we handle your data when you use our end-to-end encryption services.",
                dateModified: '2026-07-13',
                isPartOf: {
                    '@id': `${SITE_URL}/#website`,
                },
                about: {
                    '@id': `${SITE_URL}/#organization`,
                },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: SITE_URL,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'Privacy Policy',
                        item: `${SITE_URL}/privacy`,
                    },
                ],
            },
        ],
    }
</script>

<SEO
    title="Privacy Policy"
    description="PostGuard's privacy policy. Learn how we handle your data when you use our end-to-end encryption services for email and file sharing."
    jsonLd={privacyJsonLd}
/>

<div class="privacy-container">
    <div class="privacy-content">
        <h2><span>{$_('privacypolicy.title')}</span></h2>
        <p class="last-updated">{$_('privacypolicy.lastUpdated')}</p>
        <SimpleSummary
            id="privacy-summary"
            title={$_('privacypolicy.simple.title')}
        >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html $_('privacypolicy.simple.body')}
        </SimpleSummary>
        <div class="privacy-text">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html $_('privacypolicy.full')}
        </div>
    </div>
</div>

<style lang="scss">
    .privacy-container {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        padding: 2rem 1rem;
    }

    .privacy-content {
        max-width: var(--pg-reading-width);
        width: 100%;
        /* Enable kerning + ligatures for the whole page (inherited). */
        text-rendering: optimizeLegibility;
    }

    h2 {
        margin-bottom: 0.5rem;
        text-wrap: balance;
    }

    .last-updated {
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        margin-bottom: 2rem;
    }

    .privacy-text {
        text-align: left;
        /* Let quotes/bullets hang into the margin (optical alignment). */
        hanging-punctuation: first last;

        :global(p) {
            line-height: 1.6;
            font-size: var(--pg-font-size-base);
            /* Knuth-Plass-style breaking: avoids orphans, evens the rag. */
            text-wrap: pretty;
            /* Justified, hyphenated setting for a typeset LaTeX-like look.
               Hyphenation keys off the page `lang` (set per locale in the
               root layout), so it breaks correctly in both en and nl. */
            text-align: justify;
            -webkit-hyphens: auto;
            hyphens: auto;
        }

        :global(h2),
        :global(h3),
        :global(h4) {
            text-wrap: balance;
        }
    }

    @media only screen and (max-width: 800px) {
        .privacy-container {
            padding: 1rem 0.5rem;
        }

        .privacy-content {
            width: 96%;
        }
    }
</style>
