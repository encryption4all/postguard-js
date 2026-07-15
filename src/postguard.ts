import type { EncryptInput, OpenInput, PrepareSignOptions, PreparedSign } from './types.js';
import { PostGuardBase } from './postguard-base.js';
import { Sealed } from './sealed.js';
import { Opened } from './opened.js';
import { resolveSigningKeysFromYivi } from './signing/yivi.js';

export class PostGuard extends PostGuardBase {
  /** Prepare an encryption operation. Returns a lazy Sealed builder —
   *  nothing executes until you call .toBytes() or .upload(). */
  encrypt(options: EncryptInput): Sealed {
    return new Sealed(this.config, options);
  }

  /** Start a Yivi signing session ahead of time and hand back the app
   *  deep-link URL as soon as it is known, plus a promise for the resolved
   *  signing keys.
   *
   *  Why: on iOS a Yivi Universal Link only opens the app when the navigation
   *  happens inside a genuine user gesture. If you wait until the user taps
   *  "send" to start the session, the URL doesn't exist yet, so you can't
   *  navigate synchronously and the tap falls back to Safari. Pre-warming the
   *  session (e.g. once the compose form is valid) means the URL is ready at
   *  tap time: render "send" as an `<a href={await mobileUrl}>` and one tap
   *  opens the app. Then feed `await keys` into `encrypt({ signingKeys })`,
   *  which reuses the disclosure instead of starting a second session.
   *
   *  The disclosure is identity-bound (sender email + optional attributes) and
   *  independent of the files/recipients, so the keys are valid for whatever
   *  you ultimately encrypt. Requires a DOM. */
  prepareSign(opts: PrepareSignOptions): PreparedSign {
    const abort = new AbortController();
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, abort.signal])
      : abort.signal;

    let resolveUrl!: (url: string) => void;
    let rejectUrl!: (err: unknown) => void;
    const mobileUrl = new Promise<string>((resolve, reject) => {
      resolveUrl = resolve;
      rejectUrl = reject;
    });
    // If nobody awaits mobileUrl (e.g. desktop), keep a failed session from
    // surfacing as an unhandled rejection — the caller still sees it via keys.
    mobileUrl.catch(() => {});

    const keys = resolveSigningKeysFromYivi(
      this.config.pkgUrl,
      {
        element: opts.element,
        senderEmail: opts.senderEmail,
        attributes: opts.attributes,
        includeSender: opts.includeSender,
      },
      this.config.headers,
      { onMobileUrl: resolveUrl, signal },
    ).catch((err) => {
      // Surface an early failure (cancel/timeout before the button showed) to
      // anyone awaiting the URL, then propagate to `keys`.
      rejectUrl(err);
      throw err;
    });

    return { mobileUrl, keys, cancel: () => abort.abort() };
  }

  /** Open encrypted data for inspection or decryption. Returns a lazy Opened builder —
   *  nothing executes until you call .inspect() or .decrypt(). */
  open(options: OpenInput): Opened {
    return new Opened(this.config, options);
  }
}
