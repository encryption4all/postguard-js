#!/usr/bin/env node
// Sync PostGuard addon release artifacts into static/downloads/.
//
// For each target:
//   1. Query the GitHub API for recent releases and pick the most recent
//      published one that actually has the expected asset attached.
//   2. Locate the matching asset and read its sha256 digest from the API response.
//   3. Compare against the cached digest in the sibling .json file.
//   4. If unchanged, skip with no file changes.
//   5. Otherwise download, verify the sha256 matches, and write the asset + metadata.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// DOWNLOADS_DIR lets the container point at the live nginx htdocs dir at
// runtime instead of the in-repo static/ tree.
const downloadsDir = process.env.DOWNLOADS_DIR
    ? resolve(process.env.DOWNLOADS_DIR)
    : resolve(projectRoot, 'static/downloads')

const TARGETS = [
    {
        name: 'thunderbird',
        repo: 'encryption4all/postguard-tb-addon',
        assetPattern: /\.xpi$/i,
        outputFile: 'postguard-tb-addon.xpi',
        metaFile: 'postguard-tb-addon.json',
    },
    {
        name: 'outlook',
        repo: 'encryption4all/postguard-outlook-addon',
        assetPattern: /^manifest\.xml$/i,
        outputFile: 'postguard-outlook-manifest.xml',
        metaFile: 'postguard-outlook-manifest.json',
    },
]

// At the 6h container interval we make 2 unauthenticated calls / 6h — far under
// GitHub's 60/h unauthenticated cap. No token plumbing needed; downloads from
// browser_download_url aren't API-rate-limited at all.
async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'postguard-website-sync',
        },
    })
    if (!res.ok) {
        throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`)
    }
    return res.json()
}

async function readCached(metaPath) {
    try {
        return JSON.parse(await readFile(metaPath, 'utf8'))
    } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
    }
}

function parseSha256(digest) {
    if (typeof digest !== 'string' || !digest.startsWith('sha256:')) return null
    return digest.slice('sha256:'.length).toLowerCase()
}

// We scan a window of recent releases instead of hitting /releases/latest so a
// release that's tagged before its asset finishes uploading (or one that's
// genuinely missing the asset) doesn't break the sync — we fall back to the
// most recent release that does have it and warn loudly.
const RELEASE_LOOKBACK = 10

async function findReleaseWithAsset(target) {
    const releases = await fetchJson(
        `https://api.github.com/repos/${target.repo}/releases?per_page=${RELEASE_LOOKBACK}`
    )
    const eligible = releases.filter((r) => !r.draft && !r.prerelease)
    if (eligible.length === 0) {
        throw new Error(`[${target.name}] no published releases found`)
    }
    for (let i = 0; i < eligible.length; i++) {
        const release = eligible[i]
        const asset = release.assets?.find((a) =>
            target.assetPattern.test(a.name)
        )
        if (asset) {
            if (i > 0) {
                console.warn(
                    `[${target.name}] WARNING: latest release ${eligible[0].tag_name} has no asset matching ${target.assetPattern}; falling back to ${release.tag_name}`
                )
            }
            return { release, asset }
        }
    }
    throw new Error(
        `[${target.name}] no asset matching ${target.assetPattern} in last ${eligible.length} published releases`
    )
}

// writeAtomic writes to <path>.tmp and then renames into place so concurrent
// readers (e.g. nginx serving live download requests) never observe a
// partially-written file. POSIX rename(2) is atomic within a single filesystem.
async function writeAtomic(path, data) {
    const tmp = `${path}.tmp`
    await writeFile(tmp, data)
    await rename(tmp, path)
}

async function writeMeta(metaPath, { release, asset, sha256, size }) {
    await writeAtomic(
        metaPath,
        JSON.stringify(
            {
                tag: release.tag_name,
                assetName: asset.name,
                sha256,
                size,
                publishedAt: release.published_at,
                sourceUrl: asset.browser_download_url,
                releaseUrl: release.html_url,
            },
            null,
            2
        ) + '\n'
    )
}

async function syncTarget(target) {
    const outputPath = resolve(downloadsDir, target.outputFile)
    const metaPath = resolve(downloadsDir, target.metaFile)

    const { release, asset } = await findReleaseWithAsset(target)
    const remoteSha = parseSha256(asset.digest)
    if (!remoteSha) {
        throw new Error(
            `[${target.name}] asset ${asset.name} has no sha256 digest in API response`
        )
    }

    const cached = await readCached(metaPath)
    if (cached?.sha256 === remoteSha) {
        if (cached.tag === release.tag_name) {
            console.log(
                `[${target.name}] up-to-date: ${release.tag_name} (sha256 ${remoteSha})`
            )
            return
        }
        // Upstream re-tagged with byte-identical content (e.g. v0.1.3 → v0.1.5
        // with the same manifest.xml). Refresh the metadata so tag/releaseUrl/
        // publishedAt stay current without a redundant re-download.
        console.log(
            `[${target.name}] re-tagged: ${cached.tag} -> ${release.tag_name} (content unchanged)`
        )
        await writeMeta(metaPath, {
            release,
            asset,
            sha256: remoteSha,
            size: asset.size ?? cached.size,
        })
        console.log(`[${target.name}] wrote ${metaPath}`)
        return
    }
    console.log(
        `[${target.name}] updating: ${cached?.tag ?? '(none)'} -> ${release.tag_name}`
    )

    const dl = await fetch(asset.browser_download_url, {
        headers: { 'User-Agent': 'postguard-website-sync' },
        redirect: 'follow',
    })
    if (!dl.ok) {
        throw new Error(
            `[${target.name}] download failed: ${dl.status} ${dl.statusText}`
        )
    }
    const buf = Buffer.from(await dl.arrayBuffer())

    const localSha = createHash('sha256').update(buf).digest('hex')
    if (localSha !== remoteSha) {
        throw new Error(
            `[${target.name}] sha256 mismatch for ${asset.name}: api=${remoteSha} downloaded=${localSha}`
        )
    }

    await mkdir(downloadsDir, { recursive: true })
    await writeAtomic(outputPath, buf)
    await writeMeta(metaPath, {
        release,
        asset,
        sha256: localSha,
        size: buf.length,
    })
    console.log(`[${target.name}] wrote ${outputPath} (${buf.length} bytes)`)
    console.log(`[${target.name}] wrote ${metaPath}`)
}

async function main() {
    let failed = false
    for (const target of TARGETS) {
        try {
            await syncTarget(target)
        } catch (err) {
            failed = true
            console.error(err)
        }
    }
    if (failed) process.exit(1)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
