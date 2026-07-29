<script lang="ts">
	interface Props {
		files: File[];
		onfileschange: (files: File[]) => void;
	}

	let { files, onfileschange }: Props = $props();

	let dragover = $state(false);
	let inputRef: HTMLInputElement | undefined = $state();

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			addFiles(Array.from(target.files));
			target.value = '';
		}
	}

	function addFiles(newFiles: File[]) {
		const existing = new Set(files.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
		const unique = newFiles.filter((f) => !existing.has(`${f.name}-${f.size}-${f.lastModified}`));
		onfileschange([...files, ...unique]);
	}

	function removeFile(index: number) {
		onfileschange(files.filter((_, i) => i !== index));
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div
	class="dropzone"
	class:dragover
	role="button"
	tabindex="0"
	ondragover={(e) => {
		e.preventDefault();
		dragover = true;
	}}
	ondragleave={() => (dragover = false)}
	ondrop={handleDrop}
	onclick={() => inputRef?.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') inputRef?.click();
	}}
>
	<input type="file" multiple bind:this={inputRef} onchange={handleInput} hidden />
	<p>Drop files here or click to select</p>
</div>

{#if files.length > 0}
	<ul class="file-list">
		{#each files as file, i (file.name + file.size + file.lastModified)}
			<li>
				<span class="file-name">{file.name}</span>
				<span class="file-size">{formatSize(file.size)}</span>
				<button class="remove-btn" onclick={() => removeFile(i)} title="Remove file">&times;</button
				>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.dropzone {
		border: 2px dashed #ccc;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.dropzone:hover,
	.dropzone.dragover {
		border-color: #666;
	}
	.dropzone p {
		margin: 0;
		color: #666;
	}
	.file-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
	}
	.file-list li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid #eee;
	}
	.file-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-size {
		color: #888;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.remove-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		cursor: pointer;
		color: #999;
		padding: 0 0.25rem;
		line-height: 1;
	}
	.remove-btn:hover {
		color: #c00;
	}
</style>
