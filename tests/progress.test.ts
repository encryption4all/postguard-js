import { describe, it, expect, vi } from 'vitest';
import { ProgressPipe } from '../src/util/progress.js';

describe('ProgressPipe', () => {
  it('does not call the callback before one is attached', () => {
    const pipe = new ProgressPipe();
    pipe.setTotal(1000);
    pipe.report(500);
    // No callback set yet — nothing to assert beyond "no throw"; the
    // crucial thing is the next test, which verifies the buffered state
    // surfaces when the callback is finally attached.
    expect(true).toBe(true);
  });

  it('emits 0–100 percentages when total is known', () => {
    const pipe = new ProgressPipe();
    const cb = vi.fn();
    pipe.setTotal(1000);
    pipe.setCallback(cb);

    pipe.report(0);
    pipe.report(250);
    pipe.report(1000);

    expect(cb.mock.calls).toEqual([[0], [25], [100]]);
  });

  it('clamps overshoot to 100', () => {
    // received > total can happen if the server lies about Content-Length
    // (or returns a Range whose total doesn't match) — clamp so consumers
    // don't see "147%".
    const pipe = new ProgressPipe();
    const cb = vi.fn();
    pipe.setTotal(100);
    pipe.setCallback(cb);

    pipe.report(147);
    expect(cb).toHaveBeenLastCalledWith(100);
  });

  it('emits undefined on every chunk when total is unknown', () => {
    // Content-Length absent → indeterminate. The callback still fires so
    // consumers can switch into "stream has started" UI.
    const pipe = new ProgressPipe();
    const cb = vi.fn();
    pipe.setCallback(cb);

    pipe.report(100);
    pipe.report(200);
    pipe.report(300);

    expect(cb.mock.calls).toEqual([[undefined], [undefined], [undefined]]);
  });

  it('replays the latest state when callback is attached after report', () => {
    // The small-payload case: inspect() drains the whole stream before
    // decrypt() gets a chance to attach the progress callback. Without
    // buffered replay, the consumer would never see a single event and
    // the UI would be stuck in its pre-download state.
    const pipe = new ProgressPipe();
    pipe.setTotal(200);
    pipe.report(50);
    pipe.report(200); // drained

    const cb = vi.fn();
    pipe.setCallback(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(100);
  });

  it('replays undefined when the callback is attached after reports but total is unknown', () => {
    const pipe = new ProgressPipe();
    pipe.report(50);

    const cb = vi.fn();
    pipe.setCallback(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it('does not replay when no bytes have flowed yet', () => {
    // Just setting total without any report() should not fire — there
    // is genuinely no state to report.
    const pipe = new ProgressPipe();
    pipe.setTotal(100);

    const cb = vi.fn();
    pipe.setCallback(cb);

    expect(cb).not.toHaveBeenCalled();
  });

  it('continues firing on later reports after a late-attach replay', () => {
    // The mid-payload case: some bytes flowed during inspect (replayed
    // on setCallback), and more flow during unsealAndCollect.
    const pipe = new ProgressPipe();
    pipe.setTotal(1000);
    pipe.report(100); // header read during inspect

    const cb = vi.fn();
    pipe.setCallback(cb); // replay → 10
    pipe.report(500); // → 50
    pipe.report(1000); // → 100

    expect(cb.mock.calls).toEqual([[10], [50], [100]]);
  });

  it('updating total mid-stream affects subsequent reports only', () => {
    // setTotal is exposed because the stream learns Content-Length
    // from the first response; if a retry surfaces a different total
    // we use the latest. Not a real-world case for the current API,
    // but the behavior should be sane.
    const pipe = new ProgressPipe();
    const cb = vi.fn();
    pipe.setCallback(cb);

    pipe.setTotal(undefined);
    pipe.report(100); // [undefined]

    pipe.setTotal(1000);
    pipe.report(250); // [25]

    expect(cb.mock.calls).toEqual([[undefined], [25]]);
  });
});
