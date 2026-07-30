<script lang="ts">
	interface Props {
		percentage: number;
		label?: string;
	}

	let { percentage, label = '' }: Props = $props();

	// Per-instance, not a literal: a hardcoded id in a reusable component makes a
	// second <ProgressBar> on the same page resolve its accessible name to the
	// FIRST one's label, and duplicate ids are invalid HTML besides. Only one
	// instance exists today, but a wrong accessible name is the failure this
	// component was just fixed to avoid.
	const labelId = $props.id();

	// aria-valuenow has to sit inside min/max per ARIA, and the fill was already
	// clamped for the same reason — the prop is arbitrary even though the app's
	// own onProgress clamps before calling. One value feeds all three.
	const shown = $derived(Math.max(0, Math.min(100, Math.round(percentage))));
</script>

<!--
	The track carries role="progressbar" and its value, so assistive tech reports
	progress rather than seeing three unlabelled divs. aria-valuetext gives the
	rounded percentage the visible text shows, instead of a long float.

	aria-live="polite" on the container announces changes; without it the value
	updates silently. aria-atomic is left at its default of false, so what is
	announced is the changed node alone — a bare "42%" — rather than the label and
	percentage together. That is deliberate: the SDK uploads in 5 MB chunks, so a
	100 MB upload fires around 20 progress events, and re-announcing
	"Encrypting & uploading… 42%" each time is worse than the percentage alone.
	The label is still the track's accessible name via aria-labelledby, so it is
	there on focus.
-->
<div class="progress-container" aria-live="polite">
	{#if label}
		<div class="progress-label" id={labelId}>{label}</div>
	{/if}
	<div
		class="progress-track"
		role="progressbar"
		aria-valuenow={shown}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuetext="{shown}%"
		aria-label={label ? undefined : 'Progress'}
		aria-labelledby={label ? labelId : undefined}
	>
		<div class="progress-fill" style="width: {shown}%"></div>
	</div>
	<div class="progress-text">{shown}%</div>
</div>

<style>
	.progress-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.progress-label {
		font-size: 0.85rem;
		color: #666;
		white-space: nowrap;
	}
	.progress-track {
		flex: 1;
		height: 8px;
		background: #eee;
		border-radius: 4px;
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: #4a9;
		border-radius: 4px;
		transition: width 0.3s ease;
	}
	.progress-text {
		font-size: 0.85rem;
		color: #666;
		min-width: 3rem;
		text-align: right;
	}
</style>
