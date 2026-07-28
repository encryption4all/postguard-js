<script lang="ts">
    import SEO from '$lib/components/SEO.svelte'
    import { resolve } from '$app/paths'
    import { SITE_URL } from '$lib/env'

    let { data } = $props()

    const blogJsonLd = $derived({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                url: `${SITE_URL}/blog`,
                name: 'PostGuard Blog',
                description:
                    'News, updates, and insights about PostGuard — secure end-to-end encryption for email and files.',
                isPartOf: {
                    '@id': `${SITE_URL}/#website`,
                },
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: data.posts.map((post, i) => ({
                        '@type': 'ListItem',
                        position: i + 1,
                        name: post.title,
                        url: `${SITE_URL}/blog/${post.slug}`,
                    })),
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
                        name: 'Blog',
                        item: `${SITE_URL}/blog`,
                    },
                ],
            },
        ],
    })
</script>

<SEO
    title="Blog"
    description="News, updates, and insights about PostGuard — secure end-to-end encryption for email and files."
    jsonLd={blogJsonLd}
/>

<div class="blog-index">
    <div class="header">
        <h1>Blog</h1>
        <a
            class="rss-link"
            href={resolve('/(marketing)/blog/rss.xml')}
            aria-label="RSS feed"
            data-sveltekit-reload
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
            >
                <path
                    d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A19.56 19.56 0 0 1 19.56 20h-2.83A16.73 16.73 0 0 0 4 7.27V4.44zm0 5.66a13.9 13.9 0 0 1 9.9 9.9h-2.83A11.07 11.07 0 0 0 4 12.93V10.1z"
                />
            </svg>
            <span>RSS</span>
        </a>
    </div>
    <div class="posts">
        {#each data.posts as post (post.slug)}
            <a
                href={resolve('/(marketing)/blog/[slug]', { slug: post.slug })}
                class="post-card"
            >
                {#if post.image}
                    <img src={post.image} alt={post.title} class="post-image" />
                {/if}
                <div class="post-content">
                    <time datetime={post.date}>
                        {new Date(post.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </time>
                    <h2>{post.title}</h2>
                    <p>{post.description}</p>
                </div>
            </a>
        {/each}
    </div>
</div>

<style lang="scss">
    .blog-index {
        max-width: var(--pg-reading-width);
        margin: 0 auto;
        padding: 2rem 1rem;

        h1 {
            margin: 0;
        }
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .rss-link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--pg-text-secondary);
        text-decoration: none;
        font-size: var(--pg-font-size-sm);
        padding: 0.4rem 0.75rem;
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-md);
        transition:
            color 0.2s ease,
            border-color 0.2s ease;

        &:hover {
            color: #f26522;
            border-color: #f26522;
        }
    }

    .posts {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .post-card {
        display: block;
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-md);
        text-decoration: none;
        color: inherit;
        overflow: hidden;
        transition: box-shadow 0.2s ease;

        &:hover {
            box-shadow: 0 2px 12px rgba(48, 149, 222, 0.12);
        }
    }

    .post-image {
        width: 100%;
        height: auto;
        display: block;
        border-bottom: 1px solid var(--pg-strong-background);
    }

    .post-content {
        padding: 1.5rem;

        time {
            font-size: var(--pg-font-size-sm);
            color: var(--pg-text-secondary);
        }

        h2 {
            margin: 0.5rem 0;
            font-size: var(--pg-font-size-lg);
        }

        p {
            margin: 0;
            color: var(--pg-text-secondary);
            line-height: 1.5;
        }
    }
</style>
