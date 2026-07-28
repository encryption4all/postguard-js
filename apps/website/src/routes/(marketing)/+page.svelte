<script lang="ts">
    import { onMount } from 'svelte'
    import { _ } from 'svelte-i18n'
    import { resolve } from '$app/paths'
    import SEO from '$lib/components/SEO.svelte'
    import HowItWorks from '$lib/components/HowItWorks.svelte'
    import { BUSINESS_URL, SITE_URL } from '$lib/env'

    onMount(() => {
        localStorage.setItem('pg_visited', 'true')
    })

    const homepageJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'PostGuard',
                description:
                    'Free, open-source end-to-end encryption for emails and files.',
                publisher: {
                    '@id': `${SITE_URL}/#organization`,
                },
            },
            {
                '@type': 'SoftwareApplication',
                name: 'PostGuard',
                description:
                    'Free, open-source identity-based encryption for emails and files using Yivi identity attributes.',
                applicationCategory: 'SecurityApplication',
                operatingSystem: 'Any',
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'EUR',
                },
                url: SITE_URL,
                license: 'https://opensource.org/licenses/MIT',
                softwareRequirements: 'Yivi (IRMA) app',
                author: {
                    '@id': `${SITE_URL}/#organization`,
                },
            },
            {
                '@type': 'Organization',
                '@id': `${SITE_URL}/#organization`,
                name: 'PostGuard',
                url: SITE_URL,
                description:
                    'Free, open-source identity-based encryption for emails and files.',
                logo: {
                    '@type': 'ImageObject',
                    url: `${SITE_URL}/pg_logo.png`,
                    width: 512,
                    height: 512,
                },
                sameAs: ['https://github.com/encryption4all'],
                parentOrganization: {
                    '@type': 'Organization',
                    name: 'Yivi',
                    url: 'https://yivi.app',
                },
                contactPoint: {
                    '@type': 'ContactPoint',
                    email: 'info@postguard.eu',
                    contactType: 'customer support',
                },
            },
        ],
    }
</script>

<SEO
    title="Secure File Sharing & Email Encryption"
    description="PostGuard offers free, easy-to-use end-to-end encryption for emails and files. Your data never leaves your browser unencrypted."
    jsonLd={homepageJsonLd}
/>

<section class="intro">
    <div class="hero-content">
        <h1>{$_('landing.heroHeadline')}</h1>
        <p class="hero-text">{$_('landing.heroSubtext')}</p>
    </div>

    <HowItWorks />

    <div class="cta-buttons">
        <a href={resolve('/fileshare')} class="primary-btn"
            >{$_('landing.cta')}</a
        >
    </div>
</section>

<section class="limits">
    <div class="limits-inner">
        <h2>{$_('landing.limits.sectionTitle')}</h2>
        <p class="limits-intro">{$_('landing.limits.intro')}</p>

        <div class="limits-grid">
            <div class="limit-stat">
                <div class="limit-number">
                    <span class="limit-value">5</span>
                    <span class="limit-unit">GB</span>
                </div>
                <div class="limit-suffix">
                    {$_('landing.limits.uploadSuffix')}
                </div>
                <p class="limit-desc">{$_('landing.limits.uploadDesc')}</p>
            </div>
            <div class="limit-stat">
                <div class="limit-number">
                    <span class="limit-value">5</span>
                    <span class="limit-unit">GB</span>
                </div>
                <div class="limit-suffix">
                    {$_('landing.limits.rollingSuffix')}
                </div>
                <p class="limit-desc">{$_('landing.limits.rollingDesc')}</p>
            </div>
        </div>

        <p class="limits-footnote">{$_('landing.limits.footnote')}</p>
    </div>
</section>

<div class="landing">
    <section class="features">
        <h2>{$_('home.subtitle1')}</h2>
        <p>{$_('home.subpar1')}</p>

        <div class="feature-grid">
            <div class="feature-card">
                <h3>{$_('landing.feature1Title')}</h3>
                <p>{$_('landing.feature1Desc')}</p>
            </div>
            <div class="feature-card">
                <h3>{$_('landing.feature2Title')}</h3>
                <p>{$_('landing.feature2Desc')}</p>
            </div>
            <div class="feature-card">
                <h3>{$_('landing.feature3Title')}</h3>
                <p>{$_('landing.feature3Desc')}</p>
            </div>
        </div>

        <a
            class="business-callout"
            href={BUSINESS_URL}
            target="_blank"
            rel="external noopener noreferrer"
        >
            <div class="business-callout-text">
                <span class="business-callout-title"
                    >{$_('landing.businessTitle')}</span
                >
                <span class="business-callout-desc"
                    >{$_('landing.businessCardDesc')}</span
                >
            </div>
            <span class="business-callout-cta"
                >{$_('landing.businessCardCta')}</span
            >
        </a>
    </section>
</div>

<section class="final-cta">
    <h2>{$_('landing.finalCta.heading')}</h2>
    <a href={resolve('/fileshare')} class="primary-btn">{$_('landing.cta')}</a>
</section>

<style lang="scss">
    /* Hero + "How it works" share the first screen so a new visitor sees
       what PostGuard does without scrolling (desktop). */
    .intro {
        min-height: calc(100vh - 86px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2.5rem;
        padding: 2rem 1rem 3rem;
    }

    .hero-content {
        max-width: 700px;
        margin: 0 auto;
        text-align: center;

        h1 {
            font-size: var(--pg-font-size-2xl);
            font-weight: var(--pg-font-weight-extrabold);
            margin-bottom: 1.5rem;
        }
    }

    .hero-text {
        font-size: var(--pg-font-size-lg);
        line-height: 1.6;
        margin: 0 auto;
        color: var(--pg-text-secondary);
    }

    .cta-buttons {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
    }

    .limits {
        background: var(--pg-soft-background);
        border-top: 1px solid var(--pg-strong-background);
        border-bottom: 1px solid var(--pg-strong-background);
        padding: 4rem 1rem;
    }

    .limits-inner {
        max-width: 1100px;
        margin: 0 auto;
        text-align: center;

        h2 {
            margin: 0 0 1rem;
            font-size: var(--pg-font-size-xl);
            font-weight: var(--pg-font-weight-extrabold);
        }
    }

    .limits-intro {
        max-width: 700px;
        margin: 0 auto 3rem;
        line-height: 1.6;
        color: var(--pg-text-secondary);
    }

    .limits-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
        margin-bottom: 2.5rem;
    }

    .limit-stat {
        padding: 2rem 1.5rem;
        background: var(--pg-general-background);
        border-radius: var(--pg-border-radius-md);
        border: 1px solid var(--pg-strong-background);
    }

    .limit-number {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 0.5rem;
        color: var(--pg-primary);
        line-height: 1;
        margin-bottom: 0.25rem;
    }

    .limit-value {
        font-size: 4.5rem;
        font-weight: var(--pg-font-weight-extrabold);
    }

    .limit-unit {
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
    }

    .limit-suffix {
        font-size: var(--pg-font-size-base);
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-text);
        margin-bottom: 1rem;
    }

    .limit-desc {
        margin: 0;
        line-height: 1.5;
        color: var(--pg-text-secondary);
    }

    .limits-footnote {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        font-style: italic;
    }

    .landing {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .features {
        padding: 1.5rem 0 3rem;

        h2 {
            text-align: center;
            margin-bottom: 1rem;
        }

        > p {
            text-align: center;
            max-width: 700px;
            margin: 0 auto 2.5rem;
            line-height: 1.6;
            color: var(--pg-text-secondary);
        }
    }

    .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
    }

    .feature-card {
        padding: 1.5rem;
        background: var(--pg-soft-background);
        border-radius: var(--pg-border-radius-md);
        border: 1px solid var(--pg-strong-background);

        h3 {
            margin: 0 0 0.75rem;
            font-size: var(--pg-font-size-base);
            font-weight: var(--pg-font-weight-medium);
        }

        p {
            margin: 0;
            font-size: var(--pg-font-size-sm);
            line-height: 1.5;
            color: var(--pg-text-secondary);
        }
    }

    /* "PostGuard for Business" demoted to one callout within "Why PostGuard",
       linking out to the dedicated business site. */
    .business-callout {
        margin-top: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 1.5rem;
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.2s ease;

        &:hover {
            border-color: var(--pg-primary);
        }
    }

    .business-callout-text {
        text-align: left;
    }

    .business-callout-title {
        display: block;
        font-size: var(--pg-font-size-base);
        font-weight: var(--pg-font-weight-medium);
        margin-bottom: 0.35rem;
    }

    .business-callout-desc {
        display: block;
        font-size: var(--pg-font-size-sm);
        line-height: 1.5;
        color: var(--pg-text-secondary);
    }

    .business-callout-cta {
        flex-shrink: 0;
        white-space: nowrap;
        font-weight: var(--pg-font-weight-medium);
        color: var(--pg-primary-contrast);

        &::after {
            content: ' \2192';
        }
    }

    .final-cta {
        text-align: center;
        padding: 4rem 1rem;
        background: var(--pg-soft-background);
        border-top: 1px solid var(--pg-strong-background);

        h2 {
            margin: 0 0 1.5rem;
            font-size: var(--pg-font-size-xl);
            font-weight: var(--pg-font-weight-extrabold);
        }
    }

    @media only screen and (max-width: 768px) {
        .feature-grid,
        .limits-grid {
            grid-template-columns: 1fr;
        }

        .limits {
            padding: 3rem 1rem;
        }

        .limit-value {
            font-size: 3.5rem;
        }

        .business-callout {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
