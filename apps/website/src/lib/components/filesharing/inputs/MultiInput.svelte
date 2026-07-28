<script lang="ts">
    import { _ } from 'svelte-i18n'
    import {
        getCountryCallingCode,
        parsePhoneNumberFromString,
        type CountryCode,
    } from 'libphonenumber-js/mobile'
    import closeIcon from '$lib/assets/images/google-icons/close.svg'

    interface props {
        translation_key: string
        value?: string
        deleteAction?: () => void
        isConfirming?: boolean
    }

    let {
        translation_key,
        value = $bindable(''),
        deleteAction,
        isConfirming = false,
    }: props = $props()

    // So we have a unique id for the label-input pair so we can handle multiple inputs correctly in a list even with multiple recipients
    const randomId = Math.random().toString(36).substring(2, 15)
    let showingValue = $state('')
    let selectedCountry: CountryCode = $state('NL')
    let phoneInputEl: HTMLInputElement | null = $state(null)
    let phoneTouched = $state(false)
    // Parse via libphonenumber so local-format inputs (e.g. "0612345678") are
    // normalised to E.164 ("+31612345678"). Yivi stores mobile numbers in
    // E.164, so anything we send that isn't canonical fails the identity
    // match at decrypt time (tracked in cryptify#39).
    let parsedPhone = $derived(
        showingValue.length === 0
            ? null
            : parsePhoneNumberFromString(showingValue, selectedCountry)
    )
    let phoneValid = $derived(
        showingValue.length === 0 || (parsedPhone?.isValid() ?? false)
    )

    $effect(() => {
        if (phoneInputEl) {
            phoneInputEl.setCustomValidity(
                phoneValid ? '' : 'Invalid phone number'
            )
        }
    })

    // Yivi discloses dates as DD-MM-YYYY, but <input type="date"> uses YYYY-MM-DD.
    // These two helpers keep the stored `value` in Yivi's format so the IBE
    // identity derived during decryption matches the one used during encryption.
    function dateToHtml(ddmmyyyy: string): string {
        if (!ddmmyyyy) return ''
        const p = ddmmyyyy.split('-')
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ddmmyyyy
    }
    function dateFromHtml(yyyymmdd: string): string {
        if (!yyyymmdd) return ''
        const p = yyyymmdd.split('-')
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : yyyymmdd
    }

    const allowedCountries = [
        'at',
        'be',
        'bg',
        'cy',
        'dk',
        'de',
        'ee',
        'fi',
        'fr',
        'gr',
        'hu',
        'ie',
        'is',
        'it',
        'hr',
        'lv',
        'lt',
        'li',
        'lu',
        'mt',
        'mc',
        'nl',
        'no',
        'pl',
        'pt',
        'ro',
        'si',
        'sk',
        'es',
        'cz',
        'gb',
        'se',
        'ch',
    ]

    function getCountryPrefix(countryCode: string): string {
        const country = countryCode.toUpperCase() as CountryCode
        return '+' + getCountryCallingCode(country)
    }

    $effect(() => {
        if (
            translation_key ===
            'filesharing.attributes.pbdf.sidn-pbdf.mobilenumber.mobilenumber'
        ) {
            // Always emit canonical E.164 so the encrypted policy matches what
            // Yivi discloses at decrypt time. If the input is not yet parseable
            // (partial typing, invalid number) emit an empty string so the
            // downstream form stays in the "no recipient attribute" state
            // rather than committing a malformed value.
            value = parsedPhone?.isValid() ? parsedPhone.number : ''
        }
    })
</script>

<div class="input-wrapper">
    <label for={randomId}>
        {$_(translation_key)}
        <span class="optional-text"
            >({$_('filesharing.attributes.optional')})</span
        >
    </label>
    <div class="optional-value" class:removed-del-border={isConfirming}>
        {#if translation_key === 'filesharing.attributes.pbdf.sidn-pbdf.mobilenumber.mobilenumber'}
            <select
                bind:value={selectedCountry}
                class="pg-input phone-select"
                class:is-confirming-bg={isConfirming}
                disabled={isConfirming}
            >
                {#each allowedCountries as country (country)}
                    <option value={country.toUpperCase() as CountryCode}>
                        {country.toUpperCase()}
                        {getCountryPrefix(country)}
                    </option>
                {/each}
            </select>
            <input
                bind:this={phoneInputEl}
                id={randomId}
                class="pg-input"
                class:is-confirming-bg={isConfirming}
                class:phone-invalid={!phoneValid && phoneTouched}
                disabled={isConfirming}
                type="tel"
                placeholder={$_(translation_key + '.placeholder')}
                bind:value={showingValue}
                onblur={() => {
                    phoneTouched = true
                }}
            />
        {:else if translation_key === 'filesharing.attributes.pbdf.gemeente.personalData.dateofbirth'}
            <input
                id={randomId}
                class="pg-input"
                class:is-confirming-bg={isConfirming}
                disabled={isConfirming}
                type="date"
                value={dateToHtml(value)}
                oninput={(e) => {
                    value = dateFromHtml((e.target as HTMLInputElement).value)
                }}
            />
        {:else}
            <input
                id={randomId}
                class="pg-input"
                class:is-confirming-bg={isConfirming}
                disabled={isConfirming}
                type="text"
                placeholder={$_(translation_key + '.placeholder')}
                bind:value
            />
        {/if}
        {#if deleteAction}
            <button
                class:hidden={isConfirming}
                class="btn-delete invert"
                onclick={deleteAction}
            >
                <img
                    style="width: 14px; height: 14px;"
                    src={closeIcon}
                    alt="remove optional attribute"
                />
            </button>
        {/if}
    </div>
    {#if !phoneValid && phoneTouched && translation_key === 'filesharing.attributes.pbdf.sidn-pbdf.mobilenumber.mobilenumber'}
        <p class="phone-error">{$_('filesharing.attributes.phoneInvalid')}</p>
    {/if}
</div>

<style>
    .input-wrapper:last-child {
        margin-bottom: 0;
    }

    select {
        font-family: var(--pg-font-family);
    }

    .phone-select {
        width: auto;
        min-width: 6.5rem;
    }

    label {
        font-family: var(--pg-font-family);
        font-size: var(--pg-font-size-xs);
        font-weight: var(--pg-font-weight-extrabold);
        color: var(--pg-text);
        display: block;
    }

    .optional-text {
        font-weight: var(--pg-font-weight-regular);
        color: var(--pg-text-secondary);
    }

    .btn-delete {
        all: unset;
        aspect-ratio: 1 / 1;
        border-radius: var(--pg-border-radius-md);
        margin: 4px;
        margin-left: 0px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        background-color: transparent;
        height: 80%;
        cursor: pointer;
    }

    .btn-delete:hover {
        background-color: var(--pg-soft-background);
    }

    .btn-delete:focus-visible {
        outline: 2px solid var(--pg-primary);
        outline-offset: 2px;
    }

    .removed-del-border {
        border-radius: var(--pg-border-radius-md);
    }

    .optional-value {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 40px;
    }

    .phone-invalid {
        border-color: var(--pg-error, #e53e3e) !important;
    }

    .phone-error {
        font-size: var(--pg-font-size-xs);
        color: var(--pg-error, #e53e3e);
        margin: 0.25rem 0 0 0;
        font-family: var(--pg-font-family);
    }
</style>
