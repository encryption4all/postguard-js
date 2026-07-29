<script lang="ts">
	interface Props {
		percentage: number;
		label?: string;
	}

	let { percentage, label = '' }: Props = $props();
</script>

<div class="progress-container">
	{#if label}
		<div class="progress-label">{label}</div>
	{/if}
	<div class="progress-track">
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
