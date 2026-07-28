<script>
    import { onMount } from 'svelte'
    import { PKG_URL } from '$lib/env'

    const OUTLOOK_PKG = 'https://postguard-main.cs.ru.nl/pkg'

    let status = $state('Loading...')
    /** @type {any} */
    let hashInfo = $state(null)
    /** @type {any} */
    let wasmInfo = $state(null)
    /** @type {any[]} */
    let unsealerResults = $state([])
    /** @type {any} */
    let bodyCompare = $state(null)
    let pastedArmor = $state('')

    function fromUrlSafeBase64(urlSafe) {
        let base64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/')
        const pad = base64.length % 4
        if (pad === 2) base64 += '=='
        else if (pad === 3) base64 += '='
        return base64
    }

    /** @type {string | null} */
    let decodedBase64 = $state(null)
    /** @type {any} */
    let mod = $state(null)

    function compareWithArmor() {
        if (!pastedArmor.trim() || !decodedBase64) {
            bodyCompare = { error: 'Paste the armor block content first' }
            return
        }
        // Extract base64 from armor block
        const beginMarker = '-----BEGIN POSTGUARD MESSAGE-----'
        const endMarker = '-----END POSTGUARD MESSAGE-----'
        let armorContent = pastedArmor.trim()

        // Strip markers if present
        const beginIdx = armorContent.indexOf(beginMarker)
        const endIdx = armorContent.indexOf(endMarker)
        if (beginIdx !== -1 && endIdx !== -1) {
            armorContent = armorContent.substring(
                beginIdx + beginMarker.length,
                endIdx
            )
        }
        const armorBase64 = armorContent.replace(/\s/g, '')

        const match = armorBase64 === decodedBase64
        bodyCompare = {
            armorBase64Length: armorBase64.length,
            urlBase64Length: decodedBase64.length,
            match,
            armorPreview: armorBase64.substring(0, 60) + '...',
            urlPreview: decodedBase64.substring(0, 60) + '...',
        }
        if (!match) {
            // Find first difference
            for (
                let i = 0;
                i < Math.max(armorBase64.length, decodedBase64.length);
                i++
            ) {
                if (armorBase64[i] !== decodedBase64[i]) {
                    bodyCompare.firstDiffAt = i
                    bodyCompare.armorAt = armorBase64.substring(
                        Math.max(0, i - 5),
                        i + 10
                    )
                    bodyCompare.urlAt = decodedBase64.substring(
                        Math.max(0, i - 5),
                        i + 10
                    )
                    break
                }
            }
        }
    }

    async function tryUnsealer(label, pkgUrl, bytes, pgMod) {
        const result = { label, pkgUrl }
        try {
            const vkResp = await fetch(`${pkgUrl}/v2/sign/parameters`)
            if (!vkResp.ok) {
                result.error = `VK fetch failed: ${vkResp.status} ${vkResp.statusText}`
                return result
            }
            const { publicKey: vk } = await vkResp.json()
            result.vkPreview =
                typeof vk === 'string'
                    ? vk.substring(0, 40) + '...'
                    : JSON.stringify(vk).substring(0, 40) + '...'

            const readable = new ReadableStream({
                start(c) {
                    c.enqueue(bytes)
                    c.close()
                },
            })
            const unsealer = await pgMod.StreamUnsealer.new(readable, vk)
            const policies = unsealer.inspect_header()
            result.success = true
            result.recipients = [...policies.keys()]
        } catch (e) {
            result.error =
                e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        }
        return result
    }

    onMount(async () => {
        // Step 1: Read URL hash
        const hash = window.location.hash
        if (!hash || hash.length <= 1) {
            status = 'No URL hash found. Navigate to /debug/url#<base64data>'
            return
        }

        const urlSafeBase64 = hash.substring(1)
        const base64 = fromUrlSafeBase64(urlSafeBase64)
        decodedBase64 = base64
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }

        hashInfo = {
            hashLength: hash.length,
            urlSafeBase64Length: urlSafeBase64.length,
            base64Length: base64.length,
            bytesLength: bytes.length,
            first16Hex: Array.from(bytes.slice(0, 16))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' '),
            base64Preview: base64.substring(0, 80) + '...',
            roundtrip: `URL-safe → standard base64 → ${bytes.length} bytes → re-encode base64 match: ${btoa(binaryString) === base64}`,
        }

        // Step 2: Load WASM
        status = 'Loading pg-js...'
        try {
            mod = await import('@e4a/pg-js')
            wasmInfo = {
                hasStreamUnsealer: !!mod.StreamUnsealer,
                hasSealStream: !!mod.sealStream,
                hasDefault: typeof mod.default,
            }
        } catch (e) {
            status = `Failed to load pg-js: ${e instanceof Error ? e.message : String(e)}`
            return
        }

        // Step 3: Try both PKGs
        status = 'Testing PKG endpoints...'
        const websitePkg = await tryUnsealer(
            `Website (${PKG_URL})`,
            PKG_URL,
            new Uint8Array(bytes),
            mod
        )
        const outlookPkg = await tryUnsealer(
            `Outlook (${OUTLOOK_PKG})`,
            OUTLOOK_PKG,
            new Uint8Array(bytes),
            mod
        )
        unsealerResults = [websitePkg, outlookPkg]

        if (websitePkg.success || outlookPkg.success) {
            status = 'At least one PKG succeeded'
        } else {
            status = 'Both PKGs failed'
        }
    })
</script>

<h1>PostGuard URL Debug</h1>
<h2>Status: {status}</h2>

{#if hashInfo}
    <h3>1. URL Hash Decode</h3>
    <pre>{JSON.stringify(hashInfo, null, 2)}</pre>
{/if}

{#if wasmInfo}
    <h3>2. pg-js Module</h3>
    <pre>{JSON.stringify(wasmInfo, null, 2)}</pre>
{/if}

{#if unsealerResults.length > 0}
    <h3>3. StreamUnsealer — per PKG</h3>
    {#each unsealerResults as result, idx (idx)}
        <pre
            class:success={result.success}
            class:fail={!result.success}>{JSON.stringify(result, null, 2)}</pre>
    {/each}
{/if}

<h3>4. Compare with email body armor</h3>
<p>
    Paste the content of the hidden <code>postguard-armor</code> div from the email
    source (including or excluding the BEGIN/END markers):
</p>
<textarea
    bind:value={pastedArmor}
    rows="6"
    style="width:100%;font-family:monospace;font-size:12px"
    placeholder="-----BEGIN POSTGUARD MESSAGE-----&#10;FIqOpwACAA...&#10;-----END POSTGUARD MESSAGE-----"
></textarea>
<button onclick={compareWithArmor}>Compare</button>
{#if bodyCompare}
    <pre
        class:success={bodyCompare.match}
        class:fail={!bodyCompare.match && !bodyCompare.error}>{JSON.stringify(
            bodyCompare,
            null,
            2
        )}</pre>
{/if}

<style>
    pre {
        background: #f4f4f4;
        padding: 1rem;
        overflow-x: auto;
        border-radius: 4px;
        font-size: 13px;
    }
    pre.success {
        background: #e6ffe6;
        border-left: 4px solid green;
    }
    pre.fail {
        background: #ffe6e6;
        border-left: 4px solid red;
    }
    h1,
    h2,
    h3,
    p {
        font-family: sans-serif;
    }
    h2 {
        color: #555;
    }
    button {
        padding: 0.5rem 1rem;
        margin-top: 0.5rem;
        cursor: pointer;
    }
    textarea {
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 0.5rem;
    }
</style>
