<script lang="ts">
    import { _ } from 'svelte-i18n'

    interface props {
        message: string
        readonly?: boolean
    }

    let { message = $bindable(), readonly = false }: props = $props()

    let textarea: HTMLTextAreaElement

    function autoResize() {
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = textarea.scrollHeight + 'px'
        }
    }

    $effect(() => {
        void message
        autoResize()
    })
</script>

<div class="crypt-select-protection-input-box">
    <h3>
        <!-- eslint-disable svelte/no-at-html-tags -->
        {@html $_('filesharing.encryptPanel.messageHeading').replace(
            /\s*\([^)]*\)/,
            (match) => ` <span class="optional-text">${match.trim()}</span>`
        )}
        <!-- eslint-enable svelte/no-at-html-tags -->
    </h3>
    <p>{$_('filesharing.encryptPanel.messageText')}</p>
    <textarea
        bind:this={textarea}
        class="pg-input"
        required={false}
        placeholder={$_('filesharing.encryptPanel.messagePlaceholder')}
        bind:value={message}
        disabled={readonly}
        oninput={autoResize}
    ></textarea>
</div>

<style>
    p {
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        margin: 0 0 0.5rem;
        font-family: var(--pg-font-family);
    }

    :global(.optional-text) {
        font-weight: var(--pg-font-weight-regular);
    }

    textarea {
        min-height: 5rem;
        margin-top: 0.25rem;
        width: 100%;
        resize: none;
        overflow: hidden;
    }

    @media only screen and (min-height: 768px) {
        textarea {
            min-height: 6rem;
        }
    }

    @media only screen and (min-height: 1024px) {
        textarea {
            min-height: 8rem;
        }
    }
</style>
