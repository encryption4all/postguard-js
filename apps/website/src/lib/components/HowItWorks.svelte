<script lang="ts">
    import { _ } from 'svelte-i18n'

    // Static, simplified illustrations so the flow can be scanned at a glance:
    //   1. add files  2. set recipient identity  3. sign with the Yivi app.
    // Per-step entrance animations (sequentially highlighting 1 → 2 → 3, the
    // file-drop / field-fill / QR-scan micro-animations) are a deferred
    // follow-up. Each step carries a `data-step` index so that work can hook
    // in an IntersectionObserver/timer without restructuring the markup.
</script>

<section class="how-it-works" aria-labelledby="hiw-heading">
    <h2 id="hiw-heading" class="hiw-eyebrow">
        {$_('landing.howItWorks.eyebrow')}
    </h2>

    <ol class="hiw-steps">
        <li class="hiw-step" data-step="1">
            <span class="hiw-badge">1</span>
            <div class="hiw-body">
                <div class="hiw-illustration">
                    <svg
                        class="hiw-svg"
                        viewBox="0 0 120 96"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <rect
                            x="6"
                            y="14"
                            width="108"
                            height="68"
                            rx="8"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-dasharray="7 6"
                        />
                        <path
                            d="M60 34v24"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <path
                            d="M50 44l10-10 10 10"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M42 64h36"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <circle class="hiw-check-bg" cx="99" cy="23" r="12" />
                        <path
                            class="hiw-check-light"
                            d="M93 23l4.5 4.5 8-9"
                            fill="none"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <h3 class="hiw-title">
                    {$_('landing.howItWorks.step1Title')}
                </h3>
                <p class="hiw-desc">{$_('landing.howItWorks.step1Desc')}</p>
            </div>
        </li>

        <li class="hiw-step" data-step="2">
            <span class="hiw-badge">2</span>
            <div class="hiw-body">
                <div class="hiw-illustration">
                    <svg
                        class="hiw-svg"
                        viewBox="0 0 120 96"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <rect
                            x="8"
                            y="12"
                            width="104"
                            height="20"
                            rx="5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <path
                            class="hiw-placeholder"
                            d="M18 22h40"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <path
                            class="hiw-check"
                            d="M90 22l4 4 8-8"
                            fill="none"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <rect
                            x="8"
                            y="40"
                            width="104"
                            height="20"
                            rx="5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <path
                            class="hiw-placeholder"
                            d="M18 50h30"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <path
                            class="hiw-check"
                            d="M90 50l4 4 8-8"
                            fill="none"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <rect
                            x="8"
                            y="68"
                            width="104"
                            height="20"
                            rx="5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <path
                            class="hiw-placeholder"
                            d="M18 78h36"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <path
                            class="hiw-check"
                            d="M90 78l4 4 8-8"
                            fill="none"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <h3 class="hiw-title">
                    {$_('landing.howItWorks.step2Title')}
                </h3>
                <p class="hiw-desc">{$_('landing.howItWorks.step2Desc')}</p>
            </div>
        </li>

        <li class="hiw-step" data-step="3">
            <span class="hiw-badge">3</span>
            <div class="hiw-body">
                <div class="hiw-illustration">
                    <svg
                        class="hiw-svg"
                        viewBox="0 0 120 96"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <rect
                            x="34"
                            y="6"
                            width="52"
                            height="84"
                            rx="9"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <path
                            class="hiw-placeholder"
                            d="M51 13h18"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <rect
                            x="45"
                            y="22"
                            width="12"
                            height="12"
                            rx="1"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <rect
                            x="63"
                            y="22"
                            width="12"
                            height="12"
                            rx="1"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <rect
                            x="45"
                            y="40"
                            width="12"
                            height="12"
                            rx="1"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <rect
                            x="64"
                            y="41"
                            width="4"
                            height="4"
                            fill="currentColor"
                        />
                        <rect
                            x="71"
                            y="45"
                            width="4"
                            height="4"
                            fill="currentColor"
                        />
                        <rect
                            x="64"
                            y="49"
                            width="4"
                            height="4"
                            fill="currentColor"
                        />
                        <circle class="hiw-check-bg" cx="84" cy="72" r="13" />
                        <path
                            class="hiw-check-light"
                            d="M77 72l5 5 9-10"
                            fill="none"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <h3 class="hiw-title">
                    {$_('landing.howItWorks.step3Title')}
                </h3>
                <p class="hiw-desc">{$_('landing.howItWorks.step3Desc')}</p>
            </div>
        </li>
    </ol>
</section>

<style lang="scss">
    .how-it-works {
        max-width: 1000px;
        margin: 0 auto;
        text-align: center;
    }

    .hiw-eyebrow {
        margin: 0 0 1.75rem;
        font-size: var(--pg-font-size-sm);
        font-weight: var(--pg-font-weight-extrabold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--pg-primary-contrast);
    }

    .hiw-steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2.75rem;
    }

    .hiw-step {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* Desktop: a horizontal rail connecting adjacent number circles. It runs
       from this badge's centre to the next one's; the badges sit on top. */
    .hiw-step:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 1.125rem;
        left: 50%;
        width: calc(100% + 2.75rem);
        height: 2px;
        background: var(--pg-strong-background);
        transform: translateY(-50%);
    }

    .hiw-badge {
        position: relative;
        z-index: 1;
        flex-shrink: 0;
        width: 2.25rem;
        height: 2.25rem;
        margin-bottom: 1rem;
        border-radius: 50%;
        background: var(--pg-primary);
        color: var(--pg-on-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--pg-font-size-base);
        font-weight: var(--pg-font-weight-extrabold);
    }

    .hiw-illustration {
        margin-bottom: 1rem;
        color: var(--pg-primary);
    }

    .hiw-svg {
        width: 100%;
        max-width: 118px;
        height: auto;
    }

    .hiw-check-bg {
        fill: var(--pg-success);
    }

    .hiw-check-light {
        stroke: var(--pg-on-primary);
    }

    .hiw-check {
        stroke: var(--pg-success);
    }

    .hiw-placeholder {
        opacity: 0.4;
    }

    .hiw-title {
        margin: 0 0 0.4rem;
        font-size: var(--pg-font-size-base);
        font-weight: var(--pg-font-weight-medium);
    }

    .hiw-desc {
        margin: 0;
        font-size: var(--pg-font-size-sm);
        line-height: 1.5;
        color: var(--pg-text-secondary);
    }

    /* Mobile: stack the steps and join the numbered badges with a vertical
       connecting line; the desktop chevron is repurposed into that line. */
    @media only screen and (max-width: 768px) {
        .hiw-steps {
            grid-template-columns: 1fr;
            gap: 0;
            max-width: 22rem;
            margin: 0 auto;
            text-align: left;
        }

        .hiw-step {
            flex-direction: row;
            align-items: flex-start;
            gap: 1rem;
            padding-bottom: 2rem;
        }

        .hiw-step:last-child {
            padding-bottom: 0;
        }

        .hiw-step:not(:last-child)::after {
            top: 2.25rem;
            left: 1.125rem;
            bottom: 0;
            width: 2px;
            height: auto;
            transform: translateX(-50%);
        }

        .hiw-badge {
            margin-bottom: 0;
        }

        .hiw-body {
            flex: 1;
        }

        .hiw-illustration {
            margin-bottom: 0.75rem;
        }
    }
</style>
