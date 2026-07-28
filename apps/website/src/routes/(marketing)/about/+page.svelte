<script>
    import { _ } from 'svelte-i18n'
    import aboutImg from '$lib/assets/images/about.svg'
    import SEO from '$lib/components/SEO.svelte'
    import SimpleSummary from '$lib/components/SimpleSummary.svelte'
    import { SITE_URL } from '$lib/env'

    const aboutJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'AboutPage',
                url: `${SITE_URL}/about`,
                name: 'About PostGuard',
                description:
                    'Learn how PostGuard uses identity-based encryption and the Yivi app to provide free, easy-to-use end-to-end encryption for emails and files.',
                isPartOf: {
                    '@id': `${SITE_URL}/#website`,
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
                        name: 'About PostGuard',
                        item: `${SITE_URL}/about`,
                    },
                ],
            },
        ],
    }
</script>

<SEO
    title="About PostGuard"
    description="Learn how PostGuard uses identity-based encryption and the Yivi app to provide free, easy-to-use end-to-end encryption for emails and files."
    jsonLd={aboutJsonLd}
/>

<div class="page-wrapper">
    <div class="about-layout">
        <div class="grid-item header intro">
            <h2><span>{$_('about.title')}</span></h2>
            <SimpleSummary id="about-summary" title={$_('about.simple.title')}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $_('about.simple.body')}
            </SimpleSummary>
        </div>

        <img
            class="about-separator invert"
            src={aboutImg}
            alt=""
            aria-hidden="true"
        />

        <div class="grid-container">
            <div class="grid-item">
                <div class="text-content">
                    <h3>{$_('about.subtitle1')}</h3>
                    <p>
                        {$_('about.subpar1')}
                    </p>
                    <h3>{$_('about.subtitle2')}</h3>
                    <p>
                        {$_('about.subpar2')}
                    </p>
                    <h3>{$_('about.subtitle3')}</h3>
                    <p>
                        {$_('about.subpar3')}
                    </p>
                </div>
            </div>
            <div class="grid-item">
                <div id="team">
                    <h3>{$_('about.team.header')}</h3>
                    <p>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html $_('about.team.par')}
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    .page-wrapper {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        justify-content: center;
        padding: 1.5rem 1rem;
    }

    .about-layout {
        max-width: var(--pg-reading-width);
        width: 100%;
        height: fit-content;
        margin: auto;
        display: flex;
        flex-direction: column;
        /* Enable kerning + ligatures for the whole page (inherited). */
        text-rendering: optimizeLegibility;
    }

    .grid-item {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .intro {
        height: auto;
        gap: 1rem;

        h2 {
            text-wrap: balance;
        }
    }

    .about-separator {
        display: block;
        width: 60%;
        max-width: 400px;
        margin: 0 auto 2rem;
    }

    .grid-container {
        display: grid;
        grid-template-columns: 1fr;
        height: fit-content;
        align-items: start;
        justify-content: center;
        row-gap: 2rem;
        margin: auto;
    }

    .grid-container .grid-item {
        height: auto;
    }

    .text-content {
        /* Let quotes/bullets hang into the margin (optical alignment). */
        hanging-punctuation: first last;

        h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            text-wrap: balance;
        }

        h3:first-child {
            margin-top: 0;
        }

        p {
            font-size: var(--pg-font-size-base);
            line-height: 1.6;
            margin-bottom: 0.5rem;
            /* Knuth-Plass-style breaking: avoids orphans, evens the rag. */
            text-wrap: pretty;
            /* Justified, hyphenated setting for a typeset LaTeX-like look.
               Hyphenation keys off the page `lang` (set per locale in the
               root layout), so it breaks correctly in both en and nl. */
            text-align: justify;
            -webkit-hyphens: auto;
            hyphens: auto;
        }
    }

    #team {
        border: 1px dashed black;
        border-radius: 8px;
        padding: 20px;
        /* Let quotes/bullets hang into the margin (optical alignment). */
        hanging-punctuation: first last;

        h3 {
            margin-top: 0;
            margin-bottom: 0.75rem;
            text-wrap: balance;
        }

        p {
            font-size: var(--pg-font-size-base);
            line-height: 1.6;
            margin: 0;
            /* Knuth-Plass-style breaking: avoids orphans, evens the rag. */
            text-wrap: pretty;
            /* Justified, hyphenated setting to match the rest of the page. */
            text-align: justify;
            -webkit-hyphens: auto;
            hyphens: auto;
        }
    }

    @media only screen and (max-width: 800px) {
        .about-separator {
            width: 75%;
        }
    }
</style>
