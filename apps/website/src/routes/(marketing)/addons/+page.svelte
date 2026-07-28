<script>
    import { _, locale } from 'svelte-i18n'
    import Tabs from '$lib/components/Tabs.svelte'
    import SEO from '$lib/components/SEO.svelte'
    // import { fade } from 'svelte/transition'
    import { Tween } from 'svelte/motion'
    import { cubicOut } from 'svelte/easing'
    import { SITE_URL } from '$lib/env'

    import tbLogo from '$lib/assets/images/tb_logo.svg'
    import olLogo from '$lib/assets/images/ol_logo.svg'
    import composeImg from '$lib/assets/images/compose.svg'

    let tabItems = [
        { item: 'Thunderbird', logo: tbLogo },
        { item: 'Outlook', logo: olLogo },
    ]

    const addonsJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
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
                        name: 'Addons',
                        item: `${SITE_URL}/addons`,
                    },
                ],
            },
            {
                '@type': 'SoftwareApplication',
                name: 'PostGuard for Thunderbird',
                description:
                    'End-to-end encrypted email directly from Thunderbird using identity-based encryption and Yivi.',
                applicationCategory: 'CommunicationApplication',
                operatingSystem: 'Windows, macOS, Linux',
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'EUR',
                },
                url: `${SITE_URL}/addons`,
                softwareRequirements: 'Mozilla Thunderbird, Yivi app',
                author: {
                    '@type': 'Organization',
                    name: 'PostGuard',
                    url: SITE_URL,
                },
            },
            {
                '@type': 'SoftwareApplication',
                name: 'PostGuard for Outlook',
                description:
                    'End-to-end encrypted email directly from Microsoft Outlook using identity-based encryption and Yivi.',
                applicationCategory: 'CommunicationApplication',
                operatingSystem: 'Windows',
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'EUR',
                },
                url: `${SITE_URL}/addons`,
                softwareRequirements: 'Microsoft Outlook, Yivi app',
                author: {
                    '@type': 'Organization',
                    name: 'PostGuard',
                    url: SITE_URL,
                },
            },
        ],
    }

    let activeItem = $state('Thunderbird')
    let containerWidth = $state()

    const tween = new Tween(0, { delay: 150, duration: 500, easing: cubicOut })

    let height = $derived(
        (containerWidth > 800 ? 400 : 500) +
            tween.current * (containerWidth > 800 ? 150 : 200)
    )

    const triggerTabChange = (event) => {
        activeItem = event.detail
        tween.set(activeItem === 'Thunderbird' ? 0 : 1)
    }
</script>

<SEO
    title="PostGuard Addons"
    description="Install PostGuard for Thunderbird or Outlook to send and receive end-to-end encrypted emails directly from your mail client."
    jsonLd={addonsJsonLd}
/>

<div class="page-wrapper">
    <div class="grid-container" bind:clientWidth={containerWidth}>
        <div class="grid-item header">
            <h2><span>{$_('addons.title')}</span></h2>
            <p>{$_('addons.par')}</p>
            <img
                src={composeImg}
                class="image invert"
                alt=""
                aria-hidden="true"
            />
        </div>
        <div class="grid-item instruction" style="min-height: {height}px">
            <h2>{$_('addons.instruction.header')}</h2>
            <p>{$_('addons.instruction.download')}</p>
            <Tabs {tabItems} {activeItem} on:tabChange={triggerTabChange} />
            {#if activeItem}
                {#key `${activeItem}-${$locale}`}
                    {#if activeItem === 'Outlook'}
                        <div class="callout" role="note">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html $_('addons.outlookWarning')}
                        </div>
                    {/if}
                    <div id="client-instruction">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html $_(`addons.${activeItem}`)}
                    </div>
                {/key}
            {/if}
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

    img {
        width: 90%;
        margin-top: auto;
    }

    .grid-item {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .grid-container {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 550px));
        height: fit-content;
        align-items: start;
        margin: auto;
    }

    @media only screen and (max-width: 800px) {
        .grid-container {
            grid-template-columns: 1fr;
        }
    }

    .instruction {
        height: 100%;
        border: 1px dashed black;
        border-radius: 8px;
        padding: 20px;

        h2 {
            margin-top: 0;
        }
    }

    .callout {
        background: #fff7e0;
        border: 1px solid #e8d28f;
        padding: 0.75rem 1rem;
        margin: 0.75rem 0 1rem;
        border-radius: 4px;
        font-size: 0.95em;
        line-height: 1.4;
        color: #5a3f00;
    }
</style>
