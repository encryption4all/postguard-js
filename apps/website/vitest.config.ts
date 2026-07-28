import { defineConfig } from 'vitest/config'

// The current unit tests cover pure TypeScript helpers with no Svelte
// imports, so no SvelteKit Vite plugin is needed and the config stays
// minimal. The root tsconfig still extends the generated
// `.svelte-kit/tsconfig.json`, so `test:unit` runs `svelte-kit sync`
// first (see package.json) to generate it before vitest loads.
export default defineConfig({
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'node',
    },
})
