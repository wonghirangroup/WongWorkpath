import crypto from 'node:crypto';

// `PREFIX_<time in base36><6 random hex chars>` — e.g. PTASK_mgx3k2a1f3c9d2. The old ids were the
// bare millisecond timestamp, so two rows created in the same millisecond (a burst of attachments,
// two people saving at once) collided on the primary key. The random tail makes that practically
// impossible while keeping the id readable and well under the 30-char column width.
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}
