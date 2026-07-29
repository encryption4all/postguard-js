<script lang="ts">
	let { children } = $props();
</script>

<nav>
	<span class="brand">PostGuard for Business</span>
</nav>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: #333;
		background: #fafafa;
	}
	nav {
		display: flex;
		align-items: center;
		padding: 0.75rem 1.5rem;
		background: #fff;
		border-bottom: 1px solid #eee;
	}
	.brand {
		font-weight: 600;
		font-size: 1.1rem;
		color: #333;
	}
	main {
		max-width: 640px;
		margin: 2rem auto;
		padding: 0 1rem;
	}
</style>
