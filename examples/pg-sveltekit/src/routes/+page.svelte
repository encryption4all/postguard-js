<script lang="ts">
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { CRYPTIFY_URL, DOWNLOAD_URL, IS_CRYPTIFY_STAGING } from '$lib/config';
	import { encryptAndSend, encryptAndUpload } from '$lib/postguard/encryption';

	type SendState = 'idle' | 'encrypting' | 'done' | 'error';
	type DeliveryMode = 'send-email' | 'upload-only';

	function createDummyFile(name: string, content: string): File {
		return new File([content], name, { type: 'text/plain', lastModified: Date.now() });
	}

	let deliveryMode: DeliveryMode = $state('send-email');
	let files: File[] = $state([
		createDummyFile('report.txt', 'This is a sample report for PostGuard encryption testing.'),
		createDummyFile(
			'notes.txt',
			'These are confidential notes.\nOnly the intended recipient should be able to read this.'
		)
	]);
	let citizenEmail = $state('');
	let citizenName = $state('');
	let orgEmail = $state('');
	let orgName = $state('');
	let apiKey = $state('');
	let message = $state('');
	let sendState: SendState = $state('idle');
	let progress = $state(0);
	let errorMessage = $state('');
	let resultUuid = $state('');
	let abortController: AbortController | undefined = $state();

	const canSend = $derived(
		files.length > 0 && citizenEmail.includes('@') && orgEmail.includes('@') && apiKey.length > 0
	);

	async function handleSubmit() {
		if (!canSend) return;

		sendState = 'encrypting';
		progress = 0;
		errorMessage = '';
		abortController = new AbortController();

		try {
			const commonOpts = {
				files,
				citizen: { email: citizenEmail, name: citizenName },
				organisation: { email: orgEmail, name: orgName },
				apiKey,
				onProgress: (pct: number) => (progress = pct),
				abortController
			};

			if (deliveryMode === 'send-email') {
				resultUuid = await encryptAndSend({
					...commonOpts,
					message: message || null
				});
			} else {
				resultUuid = await encryptAndUpload(commonOpts);
			}
			sendState = 'done';
		} catch (e) {
			if (abortController.signal.aborted) {
				sendState = 'idle';
				progress = 0;
			} else {
				sendState = 'error';
				errorMessage = e instanceof Error ? e.message : String(e);
				console.error('Encryption error:', e);
			}
		}
	}

	function handleCancel() {
		abortController?.abort();
		sendState = 'idle';
		progress = 0;
	}

	function handleReset() {
		files = [];
		citizenEmail = '';
		citizenName = '';
		orgEmail = '';
		orgName = '';
		apiKey = '';
		message = '';
		sendState = 'idle';
		progress = 0;
		errorMessage = '';
		resultUuid = '';
	}
</script>

<h1>Encrypt & Send via Cryptify</h1>
<p class="intro">
	Encrypt files with PostGuard and deliver them via Cryptify. Choose how recipients receive the
	encrypted file.
</p>

{#if sendState === 'done'}
	<div class="success-box">
		{#if deliveryMode === 'send-email'}
			{#if IS_CRYPTIFY_STAGING}
				<h2>Upload complete (no email sent — staging)</h2>
				<p>
					You're pointed at the staging Cryptify (<code>{CRYPTIFY_URL}</code>), which
					<strong>does not deliver notification emails</strong> — that keeps real inboxes clean while
					you're integrating. The upload itself worked.
				</p>
				<p>Intended recipients (would have been emailed in production):</p>
			{:else}
				<h2>Email sent</h2>
				<p>
					Cryptify sent an email from <code>noreply@postguard.eu</code> to the following recipients:
				</p>
			{/if}
			<ul class="recipient-list">
				<li>
					<strong>{citizenName || citizenEmail}</strong> ({citizenEmail})
					<span class="attr">must prove: exact email address</span>
				</li>
				<li>
					<strong>{orgName || orgEmail}</strong> ({orgEmail})
					<span class="attr">must prove: email at domain <code>{orgEmail.split('@')[1]}</code></span
					>
				</li>
			</ul>
			<p class="uuid-line">File UUID: <code>{resultUuid}</code></p>
			{#if IS_CRYPTIFY_STAGING}
				<div class="info-box">
					<p>
						Open this link yourself to verify the decrypt flow end-to-end (the recipient won't get
						it via email on staging):
					</p>
					<code class="download-url">{DOWNLOAD_URL}/download?uuid={resultUuid}</code>
				</div>
			{/if}
		{:else}
			<h2>Upload complete</h2>
			<p>The encrypted file has been uploaded to Cryptify.</p>
			<p class="uuid-line">
				File UUID: <code>{resultUuid}</code>
			</p>
			<p>Recipients need to prove the following attributes to decrypt:</p>
			<ul class="recipient-list">
				<li>
					<strong>{citizenName || citizenEmail}</strong> ({citizenEmail})
					<span class="attr">must prove: exact email address</span>
				</li>
				<li>
					<strong>{orgName || orgEmail}</strong> ({orgEmail})
					<span class="attr">must prove: email at domain <code>{orgEmail.split('@')[1]}</code></span
					>
				</li>
			</ul>
			<div class="info-box">
				<p>
					Use this UUID to build your own download link and send it however you like (your own email
					system, chat, etc). Recipients can decrypt at:
				</p>
				<code class="download-url">{DOWNLOAD_URL}/download?uuid={resultUuid}</code>
			</div>
		{/if}
		<button class="primary-btn" onclick={handleReset}>Start over</button>
	</div>
{:else}
	<!-- Delivery mode toggle -->
	<section>
		<div class="mode-toggle">
			<button
				class="mode-btn"
				class:active={deliveryMode === 'send-email'}
				onclick={() => (deliveryMode = 'send-email')}
			>
				<span class="mode-title">Send email</span>
				<span class="mode-desc">Cryptify emails recipients a download link</span>
			</button>
			<button
				class="mode-btn"
				class:active={deliveryMode === 'upload-only'}
				onclick={() => (deliveryMode = 'upload-only')}
			>
				<span class="mode-title">Upload only</span>
				<span class="mode-desc">Get a UUID back, send the link yourself</span>
			</button>
		</div>
	</section>

	<section>
		<h2>1. Files</h2>
		<FileDropzone {files} onfileschange={(f) => (files = f)} />
	</section>

	<section>
		<h2>2. Citizen recipient</h2>
		<p class="hint">Must prove their exact email address to decrypt.</p>
		<div class="field-group">
			<input type="text" bind:value={citizenName} placeholder="Name" />
			<input type="email" bind:value={citizenEmail} placeholder="citizen@example.com" />
		</div>
	</section>

	<section>
		<h2>3. Organisation recipient</h2>
		<p class="hint">
			Can decrypt by proving an email at the domain
			{#if orgEmail.includes('@')}
				<strong>{orgEmail.split('@')[1]}</strong>
			{/if}.
		</p>
		<div class="field-group">
			<input type="text" bind:value={orgName} placeholder="Organisation name" />
			<input type="email" bind:value={orgEmail} placeholder="info@organisation.nl" />
		</div>
	</section>

	<section>
		<h2>4. API key</h2>
		<p class="hint">PostGuard API key for sender authentication.</p>
		<input
			type="password"
			bind:value={apiKey}
			placeholder="PG-1a2b3c4d5e6f7g8h"
			autocomplete="off"
		/>
	</section>

	{#if deliveryMode === 'send-email'}
		<section>
			<h2>5. Message (optional)</h2>
			<textarea bind:value={message} placeholder="Add a message for the recipients..." rows="3"
			></textarea>
		</section>
	{/if}

	{#if sendState === 'error'}
		<div class="error-box">
			<p>Error: {errorMessage}</p>
		</div>
	{/if}

	{#if sendState === 'encrypting'}
		<section>
			<ProgressBar percentage={progress} label="Encrypting & uploading..." />
			<button class="cancel-btn" onclick={handleCancel}>Cancel</button>
		</section>
	{:else}
		<button class="primary-btn" disabled={!canSend} onclick={handleSubmit}>
			{deliveryMode === 'send-email' ? 'Encrypt & Send' : 'Encrypt & Upload'}
		</button>
	{/if}
{/if}

<style>
	h1 {
		margin-bottom: 0.25rem;
	}
	h2 {
		font-size: 1rem;
		margin-bottom: 0.25rem;
		color: #555;
	}
	.intro {
		color: #666;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
	section {
		margin-bottom: 1.5rem;
	}
	.hint {
		font-size: 0.85rem;
		color: #888;
		margin: 0 0 0.5rem;
	}

	/* Mode toggle */
	.mode-toggle {
		display: flex;
		gap: 0.5rem;
	}
	.mode-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.75rem 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		transition: all 0.15s;
	}
	.mode-btn:hover {
		border-color: #cbd5e1;
	}
	.mode-btn.active {
		border-color: #2563eb;
		background: #eff6ff;
	}
	.mode-title {
		font-weight: 600;
		font-size: 0.95rem;
		color: #333;
	}
	.mode-desc {
		font-size: 0.8rem;
		color: #888;
		margin-top: 0.15rem;
	}
	.mode-btn.active .mode-desc {
		color: #6b7280;
	}

	/* Form fields */
	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.field-group input,
	section > input {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
		width: 100%;
		box-sizing: border-box;
	}
	textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.9rem;
		resize: vertical;
		box-sizing: border-box;
	}

	/* Buttons */
	.primary-btn {
		background: #2563eb;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-size: 1rem;
		cursor: pointer;
	}
	.primary-btn:disabled {
		background: #93b4f5;
		cursor: not-allowed;
	}
	.primary-btn:not(:disabled):hover {
		background: #1d4ed8;
	}
	.cancel-btn {
		margin-top: 0.5rem;
		background: none;
		border: 1px solid #ccc;
		padding: 0.4rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
	}

	/* Success box */
	.success-box {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		padding: 1.5rem;
	}
	.success-box h2 {
		color: #16a34a;
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
	}
	.success-box p {
		margin: 0 0 0.5rem;
		line-height: 1.5;
	}
	.recipient-list {
		margin: 0.5rem 0 1rem;
		padding-left: 1.25rem;
	}
	.recipient-list li {
		margin-bottom: 0.4rem;
		line-height: 1.4;
	}
	.attr {
		display: block;
		font-size: 0.8rem;
		color: #666;
	}
	.uuid-line {
		font-size: 0.85rem;
		color: #666;
	}
	.uuid-line code,
	.attr code {
		background: #e0f2e9;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.9em;
	}

	/* Info box (upload-only explanation) */
	.info-box {
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin: 0.75rem 0;
	}
	.info-box p {
		font-size: 0.85rem;
		color: #555;
		margin: 0 0 0.4rem;
	}
	.download-url {
		display: block;
		background: #e0f2fe;
		padding: 0.4rem 0.6rem;
		border-radius: 4px;
		font-size: 0.85rem;
		word-break: break-all;
	}

	/* Error box */
	.error-box {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.error-box p {
		margin: 0;
		color: #dc2626;
	}

	code {
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
</style>
