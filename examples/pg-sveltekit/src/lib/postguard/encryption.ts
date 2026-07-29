import { PostGuard } from '@e4a/pg-js';
import type { CitizenRecipient, OrganisationRecipient } from '$lib/types';
import { PKG_URL, CRYPTIFY_URL } from '$lib/config';

const pg = new PostGuard({ pkgUrl: PKG_URL, cryptifyUrl: CRYPTIFY_URL });

export { pg };

export interface EncryptOptions {
	files: File[];
	citizen: CitizenRecipient;
	organisation: OrganisationRecipient;
	apiKey: string;
	onProgress?: (percentage: number) => void;
	abortController?: AbortController;
}

export interface EncryptAndSendOptions extends EncryptOptions {
	message: string | null;
}

/** Encrypt, upload to Cryptify, and have Cryptify send the download-link
 *  email to each recipient.
 *
 *  NOTE: the staging Cryptify (storage.staging.postguard.eu) does NOT
 *  actually deliver these emails — recipients won't receive anything on
 *  staging. The upload itself still succeeds. */
export async function encryptAndSend(options: EncryptAndSendOptions): Promise<string> {
	const { files, citizen, organisation, apiKey, message, onProgress, abortController } = options;

	const sealed = pg.encrypt({
		files,
		recipients: [pg.recipient.email(citizen.email), pg.recipient.emailDomain(organisation.email)],
		sign: pg.sign.apiKey(apiKey),
		onProgress,
		signal: abortController?.signal
	});

	const result = await sealed.upload({
		notify: {
			recipients: true,
			message: message ?? undefined,
			language: 'EN'
		}
	});

	return result.uuid;
}

/** Encrypt and upload to Cryptify silently (no Cryptify-sent emails).
 *  Returns the UUID for distribution through some other channel. */
export async function encryptAndUpload(options: EncryptOptions): Promise<string> {
	const { files, citizen, organisation, apiKey, onProgress, abortController } = options;

	const sealed = pg.encrypt({
		files,
		recipients: [pg.recipient.email(citizen.email), pg.recipient.emailDomain(organisation.email)],
		sign: pg.sign.apiKey(apiKey),
		onProgress,
		signal: abortController?.signal
	});

	const result = await sealed.upload();

	return result.uuid;
}
