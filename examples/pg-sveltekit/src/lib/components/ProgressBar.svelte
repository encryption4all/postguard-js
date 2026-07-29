<script lang="ts">
	interface Props {
		percentage: number;
		label?: string;
	}

	let { percentage, label = '' }: Props = $props();
</script>

<!--
	The track carries role="progressbar" and its value, so assistive tech reports
	progress rather than seeing three unlabelled divs. aria-valuetext gives the
	rounded percentage the visible text shows, instead of a long float.

	aria-live="polite" on the container announces changes; without it the value
	updates silently. It sits on the container rather than the track so the label
	is part of the announcement.
-->
<div class="progress-container" aria-live="polite">
	{#if label}
		<div class="progress-label" id="progress-label">{label}</div>
	{/if}
	<div
		class="progress-track"
		role="progressbar"
		aria-valuenow={Math.round(percentage)}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuetext="{Math.round(percentage)}%"
		aria-label={label ? undefined : 'Progress'}
		aria-labelledby={label ? 'progress-label' : undefined}
	>
		<div class="progress-fill" style="width: {Math.min(100, percentage)}%"></div>
	</div>
	<div class="progress-text">{Math.round(percentage)}%</div>
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
