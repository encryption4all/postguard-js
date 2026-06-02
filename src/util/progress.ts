/** Mutable-callback progress tracker for streaming downloads.
 *  Created before the download stream starts; callback and total can be
 *  attached later (e.g. when decrypt() is called).
 *
 *  When `total` is known (server sent Content-Length), the callback
 *  receives 0–100. When `total` is unknown, it still fires on every
 *  chunk with `undefined` so consumers can detect "stream has started,
 *  show indeterminate progress" — otherwise the UI would have no way
 *  to leave its pre-download state. */
export class ProgressPipe {
  private cb?: (pct: number | undefined) => void;
  private total?: number;

  setTotal(total: number | undefined): void {
    this.total = total;
  }

  setCallback(cb: (pct: number | undefined) => void): void {
    this.cb = cb;
  }

  report(received: number): void {
    if (!this.cb) return;
    if (this.total) {
      this.cb(Math.min(100, Math.round((received / this.total) * 100)));
    } else {
      this.cb(undefined);
    }
  }
}
