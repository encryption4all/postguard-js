<script lang="ts">
    import { _ } from 'svelte-i18n'
    import YiviQRCode from '$lib/components/filesharing/YiviQRCode.svelte'
    import HelpToggle from '$lib/components/HelpToggle.svelte'

    const mockSenderIdentity = {
        con: [
            { t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' },
            {
                t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                v: '+31612345678',
            },
            { t: 'pbdf.nijmegen.personalData.fullname', v: 'Alice Jansen' },
        ],
    }

    type Attribute = { t?: string; v?: string }
    type Identity = { con?: Attribute[] }

    function getSenderEmail(identity: Identity): string {
        if (!identity?.con?.length) return ''
        return (
            identity.con.find((a) => a.t?.includes('email') && a.v)?.v ??
            identity.con.find((a) => a.v)?.v ??
            ''
        )
    }

    function getSenderExtras(identity: Identity): string[] {
        if (!identity?.con?.length) return []
        return identity.con
            .filter((a) => !a.t?.includes('email') && a.v)
            .map((a) => a.v as string)
    }
</script>

<div class="test-header">
    <h1>Test: Download Page States</h1>
    <p>Downloading · Ready (Yivi) · Error / Expired</p>
</div>

<div class="states-grid">
    <!-- Downloading -->
    <div class="state-col">
        <div class="state-label">Downloading</div>
        <div class="page-wrapper">
            <div class="content">
                <h2>{$_('filesharing.decryptpanel.header')}</h2>
                <div class="spinner-wrapper">
                    <svg
                        class="spinner"
                        viewBox="0 0 24 24"
                        width="36"
                        height="36"
                    >
                        <circle
                            class="spinner-circle"
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                        ></circle>
                    </svg>
                </div>
            </div>
        </div>
    </div>

    <!-- Ready -->
    <div class="state-col">
        <div class="state-label">Ready</div>
        <div class="page-wrapper">
            <div class="content">
                <h2>{$_('filesharing.decryptpanel.header')}</h2>
                <p class="description">
                    {$_('filesharing.decryptpanel.pageDescription')}
                </p>
                <div class="decrypt-card">
                    <h3>
                        {$_('filesharing.decryptpanel.irmaInstructionHeaderQr')}
                    </h3>
                    <p class="card-subtitle">
                        {$_('filesharing.decryptpanel.irmaInstructionQr')}
                    </p>
                    <YiviQRCode id="yivi-test-ready" responsive mode="qr" />
                </div>
                <HelpToggle
                    title={$_('filesharing.encryptPanel.yiviInfo')}
                    content={$_('filesharing.encryptPanel.yiviInfoText')}
                    linkText={$_('filesharing.encryptPanel.yiviInfoLink')}
                    linkUrl="https://yivi.app"
                    bordered
                />
                <div class="sender-section">
                    <svg
                        class="checkmark"
                        viewBox="0 0 12 10"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M1 5L4.5 8.5L11 1"
                            stroke="currentColor"
                            stroke-width="1.75"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    <p class="sender-label">
                        {$_('filesharing.decryptpanel.verifiedEmail')}
                    </p>
                    <strong class="sender-email"
                        >{getSenderEmail(mockSenderIdentity)}</strong
                    >
                    {#if getSenderExtras(mockSenderIdentity).length > 0}
                        <div class="attr-chips">
                            {#each getSenderExtras(mockSenderIdentity) as extra (extra)}
                                <span class="attr-chip">{extra}</span>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Fail / Expired -->
    <div class="state-col">
        <div class="state-label">Error / Expired</div>
        <div class="page-wrapper">
            <div class="content">
                <h2>{$_('filesharing.decryptpanel.notFoundTitle')}</h2>
                <p class="error-description">
                    {$_('filesharing.decryptpanel.notFoundSubtitle')}
                </p>
                <p class="error-description">
                    <!-- eslint-disable svelte/no-at-html-tags -->
                    {@html $_('filesharing.decryptpanel.notFoundMessage')}
                    <!-- eslint-enable svelte/no-at-html-tags -->
                </p>
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    .test-header {
        padding: 0.75rem 1rem;
        background-color: var(--pg-strong-background);
        border-bottom: 2px solid var(--pg-primary-contrast);
        text-align: center;

        h1 {
            margin: 0 0 0.25rem;
            font-size: var(--pg-font-size-lg);
            color: var(--pg-primary-contrast);
        }

        p {
            margin: 0;
            font-size: var(--pg-font-size-sm);
            color: var(--pg-primary-contrast);
            opacity: 0.8;
        }
    }

    .states-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        min-height: calc(
            100vh - 52px - 52px
        ); /* minus navbar and test header */
        border-top: 1px solid var(--pg-strong-background);
    }

    .state-col {
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--pg-strong-background);

        &:last-child {
            border-right: none;
        }
    }

    .state-label {
        padding: 0.4rem 1rem;
        font-size: var(--pg-font-size-xs);
        font-weight: var(--pg-font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--pg-text-secondary);
        background: var(--pg-soft-background);
        border-bottom: 1px solid var(--pg-strong-background);
        font-family: var(--pg-font-family);
    }

    /* ---- Styles mirrored from download/+page.svelte ---- */

    .page-wrapper {
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 3rem 1rem 2rem;
    }

    .content {
        width: calc(250px + 3rem);
        max-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    h2 {
        text-align: center;
        font-size: var(--pg-font-size-xl);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        margin: 0 0 0.25rem;
    }

    .description {
        margin: 0;
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
    }

    .decrypt-card {
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;

        h3 {
            font-weight: var(--pg-font-weight-bold);
            font-size: var(--pg-font-size-lg);
            margin: 0;
            color: var(--pg-text);
        }
    }

    .card-subtitle {
        margin: 0;
        color: var(--pg-text);
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
    }

    .spinner-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem 0;
    }

    .spinner {
        animation: spin 1s linear infinite;
        color: var(--pg-text-secondary);
    }

    .spinner-circle {
        stroke-dasharray: 60;
        stroke-dashoffset: 0;
        animation: dash 1.5s ease-in-out infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dashoffset: 60;
        }
        50% {
            stroke-dashoffset: 15;
        }
        100% {
            stroke-dashoffset: 60;
        }
    }

    .sender-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.5rem 0;
        text-align: center;
    }

    .checkmark {
        width: 14px;
        height: 14px;
        color: var(--pg-text-secondary);
        flex-shrink: 0;
    }

    .sender-label {
        margin: 0;
        font-size: var(--pg-font-size-md);
        color: var(--pg-text-secondary);
        font-family: var(--pg-font-family);
    }

    .sender-email {
        font-size: var(--pg-font-size-md);
        font-weight: var(--pg-font-weight-bold);
        color: var(--pg-text);
        font-family: var(--pg-font-family);
    }

    .attr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        justify-content: center;
    }

    .attr-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.6rem;
        border: 1px solid var(--pg-strong-background);
        border-radius: 4px;
        font-size: var(--pg-font-size-xs);
        font-family: var(--pg-font-family);
        color: var(--pg-text-secondary);
        background: var(--pg-soft-background);
    }

    .error-description {
        margin: 0;
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-md);
        line-height: 1.5;
        text-align: center;
        color: var(--pg-text);
    }
</style>
