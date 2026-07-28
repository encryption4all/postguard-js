import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import scss from 'postcss-scss'

// Catch references to CSS custom properties (`var(--…)`) that point at a token
// which is never defined — e.g. a typo'd design token. Such references silently
// fall back to `currentColor`/invalid values instead of erroring, so they slip
// through code review (see PR #259).
//
// The `--pg-*` design tokens are declared in global.scss, but the plugin's own
// `importFrom` loader can only parse plain CSS/JSON and chokes on this file's
// SCSS syntax (`@use`, `@include`, nesting). So we parse it ourselves with
// postcss-scss and hand the resolved token set to the plugin inline. Reading the
// file at config-load time keeps the allow-list automatically in sync.
const globalScss = fileURLToPath(
    new URL('./src/lib/global.scss', import.meta.url)
)
const knownCustomProperties = {}
scss.parse(fs.readFileSync(globalScss, 'utf8')).walkDecls((decl) => {
    if (decl.prop.startsWith('--'))
        knownCustomProperties[decl.prop] = decl.value
})

export default {
    // Intentionally no shared config: this only runs the unknown-custom-property
    // rule. Adding a base config (e.g. stylelint-config-standard) would surface a
    // flood of unrelated stylistic findings across the codebase.
    plugins: ['stylelint-value-no-unknown-custom-properties'],
    rules: {
        'csstools/value-no-unknown-custom-properties': [
            true,
            { importFrom: [{ customProperties: knownCustomProperties }] },
        ],
    },
    overrides: [
        { files: ['**/*.scss'], customSyntax: 'postcss-scss' },
        { files: ['**/*.svelte'], customSyntax: 'postcss-html' },
    ],
    ignoreFiles: [
        'build/**',
        '.svelte-kit/**',
        'node_modules/**',
        'cryptify/**',
        'postguard/**',
        'static/**',
    ],
}
