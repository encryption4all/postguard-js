// Assert that every prettier plugin a workspace member declares resolves from
// the repository root.
//
// This exists because of a failure that shipped silently. `changeset version`
// formats each CHANGELOG.md through prettier, resolving the owning package's
// prettier config but loading plugins from the *process* cwd — the repo root.
// `apps/website` declares `prettier-plugin-svelte`, which was not installed
// there, so writing its changelog threw `Cannot find package
// 'prettier-plugin-svelte'`. changesets caught that, printed the stack, then
// exited 0 with "All files have been updated".
//
// The result: the website's version was bumped on every release while its
// CHANGELOG.md was never written, and nothing failed. A missing root plugin is
// invisible in normal use — each package's own `pnpm lint` resolves it fine from
// its own node_modules — so it needs asserting rather than observing.
//
// Run from the repository root: `node scripts/check-prettier-plugins.mjs`

import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

const WORKSPACE_DIRS = ['apps', 'packages', 'examples']

// readdirSync rather than fs.globSync: the latter is still experimental on Node
// 22, which integration.yml covers alongside 24.
function memberConfigFiles() {
    const files = []
    for (const dir of WORKSPACE_DIRS) {
        let members
        try {
            members = readdirSync(dir, { withFileTypes: true })
        } catch {
            continue
        }
        for (const member of members) {
            if (!member.isDirectory()) continue
            // Both places prettier looks for a config in this workspace.
            files.push(`${dir}/${member.name}/.prettierrc`)
            files.push(`${dir}/${member.name}/package.json`)
        }
    }
    return files
}

const declared = new Map() // plugin -> [declaring file, ...]

for (const file of memberConfigFiles()) {
    let parsed
    try {
        parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
        // Absent, or not JSON (a .prettierrc may be YAML or JS). Either way there
        // is nothing to read here.
        continue
    }
    // A package.json holds its prettier config under the `prettier` key; a
    // .prettierrc is the config itself. A string `prettier` value is a shared
    // config package, whose own plugins resolve relative to itself.
    const config = file.endsWith('package.json') ? parsed.prettier : parsed
    const plugins = config?.plugins
    if (!Array.isArray(plugins)) continue
    for (const plugin of plugins) {
        if (typeof plugin !== 'string') continue
        if (!declared.has(plugin)) declared.set(plugin, [])
        declared.get(plugin).push(file)
    }
}

if (declared.size === 0) {
    // Nothing found means the directories above matched nothing, not that the
    // workspace is clean — the same vacuous pass this script exists to prevent.
    console.error(
        `no prettier plugins declared under ${WORKSPACE_DIRS.join('/, ')}/ — nothing was ` +
            'read, so this check covers nothing. Run it from the repository root.'
    )
    process.exit(1)
}

let failed = false
for (const [plugin, files] of [...declared].sort()) {
    try {
        require.resolve(plugin)
        console.log(`  ok       ${plugin}  (declared by ${files.join(', ')})`)
    } catch {
        failed = true
        console.error(
            `  MISSING  ${plugin}  (declared by ${files.join(', ')})\n` +
                '           Add it to the root package.json devDependencies. Without it,\n' +
                '           `changeset version` silently fails to write the CHANGELOG.md of\n' +
                '           every package declaring it, and still exits 0.'
        )
    }
}

process.exit(failed ? 1 : 0)
