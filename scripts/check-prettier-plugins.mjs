// Assert that every prettier plugin a workspace member declares can be resolved
// from the repository root.
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
// Fail-closed throughout: a config this script cannot read is an error rather
// than a skip, because a silent skip is the exact failure it exists to catch.
//
// Run from the repository root: `node scripts/check-prettier-plugins.mjs`

import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const problems = []
const notes = []

// Single exit for unrecoverable setup errors, so a wrong working directory reads
// as an instruction rather than a stack trace — this runs ahead of
// `changeset version`, where a stack trace looks like a broken script.
function fail(message) {
    console.error(`prettier plugin check could not run: ${message}`)
    process.exit(1)
}

// --- which directories hold workspace members -------------------------------
//
// Derived from pnpm-workspace.yaml rather than hardcoded: a hand-kept list would
// silently narrow this guard's coverage the day a new top-level workspace
// directory is added, while it kept reporting ok.
function workspaceDirs() {
    let src
    try {
        src = readFileSync('pnpm-workspace.yaml', 'utf8')
    } catch (err) {
        fail(
            err.code === 'ENOENT'
                ? 'pnpm-workspace.yaml not found. Run this from the repository root.'
                : `pnpm-workspace.yaml could not be read: ${err.message}`
        )
    }
    const header = /^packages:[ \t]*$/m.exec(src)
    if (!header) {
        fail(
            'pnpm-workspace.yaml has no top-level `packages:` list; this script cannot tell ' +
                'which directories hold workspace members.'
        )
    }
    const dirs = []
    for (const line of src.slice(header.index + header[0].length).split('\n')) {
        if (line.trim() === '' || /^\s*#/.test(line)) continue
        const entry = /^\s+-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(line)
        if (!entry) break // first line that is neither a comment nor a list item
        const pattern = entry[1]
        // Only `<dir>/*` is understood. Anything else (a deeper glob, a bare
        // path) is reported rather than quietly ignored.
        const single = /^([^/*]+)\/\*$/.exec(pattern)
        if (single) dirs.push(single[1])
        else notes.push(`workspace pattern '${pattern}' is not of the form <dir>/*; not scanned`)
    }
    if (dirs.length === 0) {
        fail('parsed pnpm-workspace.yaml but found no <dir>/* patterns to scan')
    }
    return dirs
}

// --- prettier config discovery ----------------------------------------------
//
// prettier reads more filenames than this script can parse. The ones it can are
// listed here; the ones it cannot are detected and reported, because a config
// that silently falls outside the guard is how the original bug survived.
const PARSEABLE = ['.prettierrc', '.prettierrc.json', '.prettierrc.json5']
const UNPARSEABLE = [
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.ts',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
]

function readJsonIfPresent(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'))
    } catch (err) {
        if (err.code === 'ENOENT') return undefined
        problems.push(`${path} exists but could not be parsed as JSON: ${err.message}`)
        return undefined
    }
}

// A `prettier` key holding a string names a shared config package, whose own
// `plugins` are in scope here — prettier loads those from the process cwd like
// any others, so an earlier version of this script was wrong to skip the string
// form on the premise that they resolve relative to the config.
//
// The config *package* is a different matter: it resolves relative to the
// declaring package.json, not the cwd. apps/outlook-addon's
// office-addin-prettier-config is a devDependency of that app alone and is not
// resolvable from the root, yet its CHANGELOG is written correctly — so
// resolving it from the root here reported a failure that does not exist.
async function pluginsFromSharedConfig(pkgName, declaringFile) {
    let resolved
    try {
        resolved = createRequire(resolve(declaringFile)).resolve(pkgName)
    } catch {
        problems.push(
            `${declaringFile} sets "prettier": "${pkgName}", which cannot be resolved from that ` +
                'package, so its plugins cannot be checked'
        )
        return []
    }
    try {
        const mod = await import(pathToFileURL(resolved).href)
        const config = mod.default ?? mod
        return Array.isArray(config?.plugins) ? config.plugins : []
    } catch (err) {
        problems.push(
            `${declaringFile} sets "prettier": "${pkgName}" but importing it failed ` +
                `(${err.message}), so its plugins cannot be checked`
        )
        return []
    }
}

const dirs = workspaceDirs()
const declared = new Map() // plugin specifier -> [declaring file, ...]
let configsRead = 0

function record(plugin, file) {
    if (typeof plugin !== 'string') {
        problems.push(`${file} declares a non-string plugin entry; not checked`)
        return
    }
    if (!declared.has(plugin)) declared.set(plugin, [])
    declared.get(plugin).push(file)
}

for (const dir of dirs) {
    let members
    try {
        members = readdirSync(dir, { withFileTypes: true })
    } catch {
        problems.push(`workspace directory '${dir}' from pnpm-workspace.yaml could not be read`)
        continue
    }
    for (const member of members) {
        if (!member.isDirectory()) continue
        const base = `${dir}/${member.name}`

        for (const name of UNPARSEABLE) {
            try {
                readFileSync(`${base}/${name}`)
                problems.push(
                    `${base}/${name} is a prettier config this script cannot parse, so its ` +
                        'plugins are unchecked. Convert it to JSON, or declare its plugins in ' +
                        'the root package.json and handle the filename here.'
                )
            } catch {
                /* absent, which is the normal case */
            }
        }

        for (const name of PARSEABLE) {
            const config = readJsonIfPresent(`${base}/${name}`)
            if (!config) continue
            configsRead++
            if (Array.isArray(config.plugins)) {
                for (const plugin of config.plugins) record(plugin, `${base}/${name}`)
            }
        }

        const pkg = readJsonIfPresent(`${base}/package.json`)
        if (!pkg) continue
        configsRead++
        if (typeof pkg.prettier === 'string') {
            const plugins = await pluginsFromSharedConfig(pkg.prettier, `${base}/package.json`)
            for (const plugin of plugins) {
                record(plugin, `${base}/package.json (via ${pkg.prettier})`)
            }
        } else if (pkg.prettier && Array.isArray(pkg.prettier.plugins)) {
            for (const plugin of pkg.prettier.plugins) record(plugin, `${base}/package.json`)
        }
    }
}

// Distinguish "read nothing" from "read everything, found no plugins". An
// earlier version conflated them and told you to run from the repository root
// even when it had read every config successfully — which, now that this gates
// `changeset version`, would have misdirected the first release after a plugin
// was legitimately dropped.
if (configsRead === 0) {
    fail(
        `read no prettier or package configs under ${dirs.map((d) => `${d}/`).join(', ')} — ` +
            'nothing was inspected.'
    )
}

for (const [plugin, files] of [...declared].sort()) {
    // A relative specifier is resolved by prettier against the config file, not
    // the cwd, so the root has no bearing on it.
    if (plugin.startsWith('.') || plugin.startsWith('/')) {
        console.log(`  skip     ${plugin}  (relative path, resolved against ${files[0]})`)
        continue
    }
    try {
        // import.meta.resolve, not require.resolve: prettier imports plugins as
        // ESM, so the `import` export condition is what applies. A plugin whose
        // exports map is import-only resolves here but throws
        // ERR_PACKAGE_PATH_NOT_EXPORTED under require.resolve, which would have
        // failed the release claiming a correctly installed plugin was missing.
        import.meta.resolve(plugin)
        console.log(`  ok       ${plugin}  (declared by ${files.join(', ')})`)
    } catch {
        problems.push(
            `${plugin} is declared by ${files.join(', ')} but cannot be resolved from the ` +
                'repository root. Add it to the ROOT package.json devDependencies — without ' +
                'it, `changeset version` silently fails to write the CHANGELOG.md of every ' +
                'package declaring it, and still exits 0.'
        )
    }
}

for (const note of notes) console.warn(`  note     ${note}`)

if (problems.length > 0) {
    console.error('\nprettier plugin check failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
}

console.log(
    `\n${configsRead} configs inspected under ${dirs.map((d) => `${d}/`).join(', ')}; ` +
        `${declared.size} distinct plugin(s), all resolvable from the root.`
)
