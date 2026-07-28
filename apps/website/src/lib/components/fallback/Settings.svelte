<script>
    import {
        currSelected,
        emails,
        krCache,
        boolCacheYivi,
        boolCacheEmail,
    } from './stores.js'

    import { _, locale } from 'svelte-i18n'
    import Icon from '@iconify/svelte'
    import Chip from '$lib/components/Chip.svelte'

    // eslint-disable-next-line no-useless-assignment
    let { currMode = $bindable() } = $props()

    function deleteAllMails() {
        if (confirm($_('fallback.settings.delete.emails'))) {
            currSelected.set(-1)
            $emails = []
        }
    }

    function deleteAllYivi() {
        if (confirm($_('fallback.settings.delete.creds'))) {
            $krCache = []
        }
    }

    function deleteJwt(selected) {
        $krCache = $krCache.filter((x) => x.jwt != selected.jwt)
    }

    function parseKr(input) {
        let str = []
        for (const e of input) {
            switch (e['t']) {
                case 'pbdf.gemeente.personalData.surname':
                    str.push('Surname')
                    break
                case 'pbdf.pbdf.surfnet-2.id':
                    str.push('Student ID: ' + e['v'])
                    break
                case 'pbdf.sidn-pbdf.mobilenumber.mobilenumber':
                    str.push('Mobile number: ' + e['v'])
                    break
                case 'pbdf.nuts.agb.agbcode':
                    str.push('BSN')
                    break
            }
        }
        return str
    }
</script>

<div class="settings-container">
    <div class="settings-header">
        <button
            class="back-button"
            onclick={() => (currMode = 'List')}
            type="button"
        >
            <Icon icon="mdi:arrow-left" width="20px" />
            <span>{$_('fallback.settings.back')}</span>
        </button>
    </div>

    <div class="settings-card">
        <h4>{$_('fallback.settings.h4')}</h4>
        <label class="checkbox-row">
            <input type="checkbox" bind:checked={$boolCacheEmail} />
            <span>{$_('fallback.settings.storeEmails')}</span>
        </label>
        <label class="checkbox-row">
            <input type="checkbox" bind:checked={$boolCacheYivi} />
            <span>{$_('fallback.settings.storeCreds')}</span>
        </label>
    </div>

    {#if $krCache.length > 0}
        <div class="settings-card">
            <h4>{$_('fallback.settings.creds')}</h4>
            <div class="credential-list">
                {#each $krCache as kr (kr.key)}
                    <div class="credential-item">
                        <div class="credential-info">
                            <span class="credential-key">{kr.key}</span>
                            {#each parseKr(kr.krCon) as cred (cred)}
                                <span class="credential-detail">{cred}</span>
                            {/each}
                            <span class="credential-exp">
                                {$_('fallback.settings.exp')}: {new Date(
                                    kr.jwtValid * 1000
                                ).toLocaleDateString($locale ?? undefined)}
                            </span>
                        </div>
                        <button
                            class="delete-button"
                            onclick={(e) => {
                                e.preventDefault()
                                deleteJwt(kr)
                            }}
                            type="button"
                        >
                            <Icon icon="mdi:trash-can-outline" width="20px" />
                        </button>
                    </div>
                {/each}
            </div>
            <Chip
                text={$_('fallback.settings.delete.credsBtn')}
                onclick={deleteAllYivi}
                size="md"
                variant="filled"
            />
        </div>
    {/if}

    {#if $emails.length > 0}
        <div class="settings-card">
            <h4>Email History</h4>
            <Chip
                text={$_('fallback.settings.delete.emailBtn')}
                onclick={deleteAllMails}
                size="md"
                variant="filled"
            />
        </div>
    {/if}
</div>

<style lang="scss">
    .settings-container {
        padding: 1rem;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .settings-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .back-button {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        transition: color 0.2s ease;

        &:hover {
            color: var(--pg-primary);
        }

        &:focus-visible {
            outline: 2px solid var(--pg-primary);
            outline-offset: 2px;
            border-radius: var(--pg-border-radius-sm);
        }
    }

    .settings-card {
        background: var(--pg-soft-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-lg);
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;

        h4 {
            margin: 0;
            font-size: var(--pg-font-size-md);
            font-weight: var(--pg-font-weight-bold);
        }
    }

    .checkbox-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: var(--pg-font-size-sm);

        input[type='checkbox'] {
            accent-color: var(--pg-primary);
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
    }

    .credential-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .credential-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem;
        background: var(--pg-general-background);
        border: 1px solid var(--pg-strong-background);
        border-radius: var(--pg-border-radius-md);
    }

    .credential-info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
    }

    .credential-key {
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .credential-detail {
        font-size: var(--pg-font-size-xs);
        color: var(--pg-text-secondary);
    }

    .credential-exp {
        font-size: var(--pg-font-size-xs);
        color: var(--pg-text-secondary);
    }

    .delete-button {
        all: unset;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border-radius: var(--pg-border-radius-sm);
        color: var(--pg-text-secondary);
        transition: color 0.2s ease;

        &:hover {
            color: var(--pg-input-error);
        }

        &:focus-visible {
            outline: 2px solid var(--pg-primary);
            outline-offset: 2px;
        }
    }
</style>
