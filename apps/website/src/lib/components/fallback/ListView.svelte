<script>
    import { emails, currSelected } from './../fallback/stores.js'
    import { _, locale } from 'svelte-i18n'

    /** @type {{rightMode: any, searchTerm: any}} */
    // eslint-disable-next-line no-useless-assignment
    let { rightMode = $bindable(), searchTerm = $bindable() } = $props()

    let sorted = $derived(
        $emails &&
            $emails.length > 0 &&
            $emails.sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
            )
    )
    let sortedFiltered = $derived(
        searchTerm
            ? sorted.filter(
                  (email) =>
                      email.raw
                          .toLowerCase()
                          .indexOf(searchTerm.toLowerCase()) > 0
              )
            : sorted
    )
</script>

{#if sortedFiltered.length > 0}
    <div class="email-list">
        {#each sortedFiltered as email (email.id)}
            <button
                class="email-item"
                class:selected={$currSelected === email.id}
                onclick={(e) => {
                    e.preventDefault()
                    currSelected.set(email.id)
                    rightMode = 'MailView'
                }}
                type="button"
            >
                <span class="email-subject">{email.subject}</span>
                <span class="email-sender">
                    {#if email.from.name}
                        {email.from.name}
                    {:else}
                        {email.from.address}
                    {/if}
                </span>
                <span class="email-date">
                    {new Date(email.date).toLocaleString($locale ?? undefined)}
                </span>
            </button>
        {/each}
    </div>
{:else}
    <div class="empty-state">
        <h4>{$_('fallback.list.nothing')}</h4>
        <p>{$_('fallback.list.nothing2')}</p>
    </div>
{/if}

<style lang="scss">
    .email-list {
        width: 100%;
        display: flex;
        flex-direction: column;
    }

    .email-item {
        all: unset;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--pg-input-normal);
        text-align: left;
        transition:
            background 0.15s ease,
            color 0.15s ease;

        &:hover {
            background: var(--pg-soft-background);
        }

        &.selected {
            background: var(--pg-primary);
            color: white;

            .email-sender,
            .email-date {
                color: rgba(255, 255, 255, 0.85);
            }
        }

        &:focus-visible {
            outline: 2px solid var(--pg-primary);
            outline-offset: -2px;
            border-radius: var(--pg-border-radius-sm);
        }
    }

    .email-subject {
        font-weight: var(--pg-font-weight-bold);
        font-size: var(--pg-font-size-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .email-sender {
        font-size: var(--pg-font-size-sm);
        color: var(--pg-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .email-date {
        font-size: var(--pg-font-size-xs);
        color: var(--pg-text-secondary);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem 1.5rem;
        text-align: center;
        flex: 1;

        h4 {
            margin: 0 0 0.5rem;
            font-size: var(--pg-font-size-md);
            font-weight: var(--pg-font-weight-bold);
        }

        p {
            margin: 0;
            font-size: var(--pg-font-size-sm);
            color: var(--pg-text-secondary);
        }
    }
</style>
