import adapter from '@sveltejs/adapter-static'
import { sveltePreprocess } from 'svelte-preprocess'
import { mdsvex } from 'mdsvex'

/** @type {import('@sveltejs/kit').Config} */
const config = {
    extensions: ['.svelte', '.svx'],

    preprocess: [sveltePreprocess(), mdsvex({ extensions: ['.svx'] })],

    kit: {
        adapter: adapter({ fallback: '200.html', precompress: false }),
        prerender: {
            entries: [
                '/',
                '/about',
                '/addons',
                '/privacy',
                '/blog',
                '/sitemap.xml',
                '/robots.txt',
            ],
        },
    },
}

export default config
