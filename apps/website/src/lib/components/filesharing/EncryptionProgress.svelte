<script lang="ts">
    import { _ } from 'svelte-i18n'
    import type { AttributeCon } from '$lib/types/filesharing/attributes'
    import { EncryptionState } from '$lib/types/filesharing/attributes'
    import { browser } from '$app/environment'

    interface props {
        encryptStartTime: number
        files: File[]
        recipients: { email: string; extra: AttributeCon }[]
        percentages: number[]
        done: boolean[]
        stage: EncryptionState
        selfAborted: boolean
        abort: AbortController
    }

    /* eslint-disable no-useless-assignment */
    let {
        encryptStartTime,
        files,
        recipients,
        percentages = $bindable(),
        done = $bindable(),
        stage = $bindable(),
        selfAborted = $bindable(),
        abort,
    }: props = $props()
    /* eslint-enable no-useless-assignment */

    let to = $derived(recipients.map(({ email }) => email).join(', '))
    let timeEstimateRepr = $derived(() => {
        const deltaT = Date.now() - encryptStartTime
        const totalSize = files.map((f) => f.size).reduce((a, b) => a + b, 0)

        const totalProgress = files
            .map((f, i) => (percentages[i] * f.size) / totalSize)
            .reduce((a, b) => a + b, 0)

        if (deltaT > 1000 && totalProgress > 1) {
            const remainingProgress = 100 - totalProgress
            const estimatedT = remainingProgress * (deltaT / totalProgress)
            return getTranslationForTime(estimatedT)
        }
        return $_('filesharing.encryptPanel.timeremaining.estimate')
    })

    function getTranslationForTime(remaining: number): string {
        switch (true) {
            case remaining < 1000 * 60:
                return $_('filesharing.encryptPanel.timeremaining.seconds')
            case remaining < 1000 * 60 * 60: {
                const minutes = Math.ceil(remaining / (1000 * 60))
                return $_('filesharing.encryptPanel.timeremaining.minutes', {
                    values: { minutes: minutes },
                })
            }
            case remaining < 1000 * 60 * 60 * 24: {
                const hours = Math.ceil(remaining / (1000 * 60 * 60))
                return $_('filesharing.encryptPanel.timeremaining.hours', {
                    values: { hours: hours },
                })
            }
            default:
                return $_('filesharing.encryptPanel.timeremaining.unknown')
        }
    }

    async function onCancelDecrypt() {
        if (!browser) return
        abort.abort()
        window.setTimeout(() => {
            stage = EncryptionState.FileSelection
            percentages = []
            done = []
            selfAborted = false
        }, 500)

        selfAborted = true
    }
</script>

<div class="container">
    <h3>{$_('filesharing.encryptPanel.encrypting')}</h3>
    <p>
        {$_('filesharing.encryptPanel.encryptingInfo')}
        <a href={`mailto:${to}`}>{to}</a>
    </p>
    <p>{timeEstimateRepr()}</p>

    <button
        class="crypt-btn crypt-btn-secondary crypt-btn-cancel"
        onclick={onCancelDecrypt}
        type="button"
    >
        {$_('filesharing.cancel')}
    </button>
</div>

<style lang="scss">
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 1rem;
    }

    button {
        padding: 0.5rem 1rem;
        margin-top: 1rem;
    }
</style>
