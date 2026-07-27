import type { SenderIdentity } from '../types.js';

/** User-friendly sender identity with extracted email */
export interface FriendlySender {
  /** The sender's email address, extracted from identity attributes */
  email: string | null;
  /** All identity attributes */
  attributes: { type: string; value?: string }[];
  /** Raw identity for power users */
  raw: SenderIdentity;
}

/** Parse raw SenderIdentity into a user-friendly format */
export function parseSender(raw: SenderIdentity | null): FriendlySender | null {
  if (!raw) return null;

  const allCon = [...(raw.public?.con ?? []), ...(raw.private?.con ?? [])];

  const emailAttr = allCon.find((a) => a.t?.includes('email') && a.v);

  return {
    email: emailAttr?.v ?? null,
    attributes: allCon.map((a) => ({ type: a.t, value: a.v })),
    raw,
  };
}
