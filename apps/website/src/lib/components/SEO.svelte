<script>
    import { page } from '$app/state'
    import { SITE_URL } from '$lib/env'

    let {
        title = '',
        description = '',
        ogImage = '',
        ogType = 'website',
        canonical = '',
        jsonLd = null,
    } = $props()

    const siteName = 'PostGuard'
    const defaultDescription =
        'PostGuard offers free and easy-to-use end-to-end encryption for emails and files.'
    const defaultImage = '/pg_logo.png'

    const canonicalUrl = $derived(
        canonical ||
            (page?.url?.pathname ? `${SITE_URL}${page.url.pathname}` : '')
    )
    const ogImageUrl = $derived(
        (ogImage || defaultImage).startsWith('http')
            ? ogImage || defaultImage
            : `${SITE_URL}${ogImage || defaultImage}`
    )
    const jsonLdString = $derived(jsonLd ? JSON.stringify(jsonLd) : '')
</script>

<svelte:head>
    <title>{title ? `${title} | ${siteName}` : siteName}</title>
    <meta name="description" content={description || defaultDescription} />
    <meta property="og:title" content={title || siteName} />
    <meta
        property="og:description"
        content={description || defaultDescription}
    />
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:type" content={ogType} />
    <meta property="og:site_name" content={siteName} />
    {#if canonicalUrl}
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hreflang="en" href={canonicalUrl} />
        <link rel="alternate" hreflang="x-default" href={canonicalUrl} />
    {/if}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title || siteName} />
    <meta
        name="twitter:description"
        content={description || defaultDescription}
    />
    <meta name="twitter:image" content={ogImageUrl} />
    {#if jsonLdString}
        <!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
        {@html `<script type="application/ld+json">${jsonLdString}<\/script>`}
    {/if}
</svelte:head>
