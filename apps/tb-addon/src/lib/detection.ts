/// <reference path="../types/thunderbird.d.ts" />

import { detectPostGuard } from "@e4a/pg-js";
import { findHtmlBody } from "./utils";

/**
 * Detect whether a message looks like a current PostGuard ciphertext that
 * the user can still decrypt.
 *
 * What counts as PostGuard is `detectPostGuard` in the SDK, not this file:
 * the tiers do not look alike (tier 3 ships no attachment at all), and while
 * each add-in carried its own copy of that rule they were free to disagree
 * about it — which is the drift encryption4all/postguard-js#129 exists to
 * remove. Everything left here is Thunderbird's WebExtension API, which the
 * SDK cannot and should not reach.
 *
 * This function only answers "looks like PostGuard" so the banner can offer
 * the Decrypt button instead of falling back to the wasEncrypted info banner.
 */
export async function isPGEncrypted(msgId: number): Promise<boolean> {
  // Attachments first, and the body only if they settle nothing: `getFull`
  // pulls the whole message, and a tier-1/2 envelope is already decided by the
  // cheap call. Folding both into one detectPostGuard call would fetch the body
  // every time, and would turn a getFull failure on a message that DOES carry
  // the attachment into "not encrypted".
  const attachments = await browser.messages.listAttachments(msgId);
  if (detectPostGuard({ attachmentNames: attachments.map((att) => att.name) })) return true;

  try {
    const full = await browser.messages.getFull(msgId);
    return detectPostGuard({ htmlBody: findHtmlBody(full) ?? undefined });
  } catch {
    // Malformed messages / API errors mean "not detectable as encrypted",
    // not "throw". The caller falls back to the wasEncrypted check.
    return false;
  }
}

/**
 * Detect whether a message *was* a PostGuard ciphertext at some point,
 * based on the `x-postguard` header that the addon writes on outgoing mail.
 *
 * Used after decryption to label messages whose ciphertext has been
 * unwrapped but whose plaintext should still show a "was encrypted" badge.
 */
export async function wasPGEncrypted(msgId: number): Promise<boolean> {
  const full = await browser.messages.getFull(msgId);
  return "x-postguard" in full.headers;
}
