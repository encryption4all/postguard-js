<script lang="ts">
    import { onMount } from 'svelte'
    import YiviQRCode from '$lib/components/filesharing/YiviQRCode.svelte'
    import { pg } from '$lib/postguard'

    onMount(async () => {
        // Initialize Yivi session for testing
        // Note: this page just displays a QR code component for visual testing.
        // The actual Yivi session is handled by pg-js when sign.yivi() is called.
        console.log('QR test page loaded. PostGuard instance:', pg)
    })
</script>

<div class="test-container">
    <h1>Yivi QR Code Test Page</h1>

    <YiviQRCode />
    <br />
    <div class="debug-info">
        <h2>Debug Info:</h2>
        <ul>
            <li>QR Wrapper: 240px × 240px with rounded corners</li>
            <li>QR Inner: 230px × 230px</li>
            <li>QR Code: max 220px × 220px</li>
        </ul>
    </div>
</div>

<style>
    .test-container {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
    }

    h1 {
        color: var(--pg-text);
        margin-bottom: 2rem;
    }

    .debug-info {
        background: var(--pg-strong-background);
        padding: 1.5rem;
        border-radius: 8px;
        border-left: 4px solid var(--pg-primary);
    }

    .debug-info h2 {
        margin-top: 0;
        color: var(--pg-primary-contrast);
    }

    .debug-info ul {
        margin: 0;
        padding-left: 1.5rem;
    }

    .debug-info li {
        margin-bottom: 0.5rem;
        color: var(--pg-text-secondary);
    }
</style>
