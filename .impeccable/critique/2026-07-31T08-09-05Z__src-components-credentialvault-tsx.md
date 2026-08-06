---
target: src/components/CredentialVault.tsx
total_score: 14
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-07-31T08-09-05Z
slug: src-components-credentialvault-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No indication data is plaintext/decrypted; no "last viewed," no lock timeout; `auditLogs` prop accepted but never rendered |
| 2 | Match System / Real World | 1 | `CredentialItem.type` has 4 real categories (API Key, Bank Account, Access Token, Username&Password) but form only ever produces "Username & Password" — model promises categories the UI can't create |
| 3 | User Control and Freedom | 1 | No Escape-to-close on create/edit or delete modals; failed PIN unlock doesn't refocus digit 1 |
| 4 | Consistency and Standards | 1 | Two different floating-dropdown implementations (`Dropdown` component vs. service-suggestion popup) with different radii, colors, and only one supports arrow keys; vault's PIN-reject has no shake even though `Login.tsx` already has `.shake-login` for the identical scenario |
| 5 | Error Prevention | 2 | Solid disabled-until-valid submit buttons; but delete has no typed confirmation for high-value records, and duplicate-name auto-rename happens silently with no toast |
| 6 | Recognition Rather Than Recall | 2 | Favicon autocomplete helps, but `item.team` is captured and stored yet never shown on the card — no visual ownership cue |
| 7 | Flexibility and Efficiency of Use | 1 | PIN requires an extra "ยืนยัน" click after the 4th digit instead of auto-submit, for a gate re-entered every tab mount; scope filter is binary with no "all" view |
| 8 | Aesthetic and Minimalist Design | 2 | Cards are clean, but 6 icon imports (ShieldAlert, Lock, Unlock, Clock, FileSpreadsheet, AlertTriangle) are dead code, never rendered |
| 9 | Error Recovery | 2 | PIN-mismatch message is clear; but decryption failures are swallowed silently with zero user-facing feedback |
| 10 | Help and Documentation | 1 | Minimal help expected for an internal tool; PIN-hygiene bullets are a nice scoped touch, but no recovery-path guidance before setting the PIN |
| **Total** | | **14/40** | **Poor — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment**: Mostly a generic CRUD admin panel wearing a "vault" costume. The Thai copy, Kanit font, and the favicon-fallback avatar system (`getAvatarCandidates`) give it real localized polish, and the fuzzy-match service autocomplete is genuinely above-average engineering. But the substance is stock cards+modal+pagination with no vault-specific behavior: no auto-relock/reveal-timeout on secrets, no distinction in the card template between a login, an API key, and a bank account (all three render through identical "Username/Password" labels), and `auditLogs` is threaded in as a prop and never surfaced anywhere. The biggest specificity gap: the interface borrows every visual signal of "this is a secure system" (lock icons, PIN gate, "ห้ามเปิดเผยรหัส PIN" copy) without the underlying behavior — see the P0 below.

**Deterministic scan**: `detect.mjs` found **0 findings** in CredentialVault.tsx itself (and 0 in VaultPage.tsx, AppLayout.tsx, Sidebar.tsx, index.css). The only hit across the whole page's file tree was 1 pre-existing `gray-on-color` warning in Header.tsx:125 — flagged in an earlier turn of this same session and left as-is, and the detector agent independently re-confirmed it's very likely a false positive (the two flagged classes belong to mutually exclusive ternary branches in a notification-read/unread className that never render together). Net: the component-level Tailwind hygiene is clean; every issue below is a UX/behavior problem, not a CSS antipattern one.

**Visual overlays**: Not available — no browser automation tool is exposed in this session, and the target was a source file rather than a live URL, so no injected overlay exists to view.

## Overall Impression

The page *looks* trustworthy and the polish work across this session (dropdowns, autocomplete, avatars, animations) is genuinely good craft — but the trust it visually signals isn't backed by the data layer underneath. The single biggest opportunity is closing the gap between "PIN-gated vault with lock icons" and what the code actually does with the secrets once you're past the gate.

## What's Working

- **Favicon fallback chain** (`getAvatarCandidates`): manual logo → site favicon.ico → Google's favicon cache → colored initial. Resilient, makes the list scannable, and most CRUD-panel builds skip this entirely.
- **Service-name autocomplete** (`fuzzyMatchScore` + full arrow-key/Enter/Escape handling): subsequence fuzzy matching with a sane earliest-tightest-match tiebreak is more sophisticated than a naive `.includes()` filter, and the keyboard nav is fully wired.
- **Silent auto-dedup of duplicate labels** (`getUniqueLabel` on blur): quietly prevents a real data-integrity problem without forcing an error dialog — appropriately low-friction for an internal tool.

## Priority Issues

**[P0] Fake encryption framing on a real-secrets vault**
- **Why it matters**: `encryptValue`/`decryptValue` from `crypto.ts` are imported into CredentialVault.tsx but never invoked anywhere. Every stored secret — including a real bank account number in the seed data — is plaintext behind a client-side PIN gate whose own hash lives in the same unencrypted localStorage. A user who trusts the lock icon and PIN prompt is being misled about the actual protection on their data.
- **Fix**: Either wire the existing (simulated) cipher into `handleCreateCredential`/`handleViewCredential` consistently, or — better — drop the "encryption" language/comments entirely and add an explicit "PIN = access control, not encryption" disclosure so expectations match reality.
- **Suggested command**: `/impeccable harden`

**[P0] `type` field is unreachable from the UI**
- **Why it matters**: `CredentialItem.type` supports 4 categories and the seed data ships real API Key and Bank Account records, but the create/edit form has no control bound to `setNewType` — every credential created through the UI is silently forced to "Username & Password," and the secret field is always labeled "รหัสผ่าน" even for what's actually an API key.
- **Fix**: Add the missing type selector (reuse the existing `Dropdown` component) and make the secret-field label react to `newType`.
- **Suggested command**: `/impeccable clarify`

**[P1] `team` is captured but never shown or filterable**
- **Why it matters**: `newTeam`/`item.team` round-trips through create, edit, and storage but is never rendered on the card, and the scope filter only distinguishes ส่วนตัว/ทีม — not which team. In a shared vault, one department has no visible ownership cue for another's items and no way to filter to "my team only."
- **Fix**: Render `item.team` as a small pill on team-scoped cards; extend the scope filter to allow filtering by specific team.
- **Suggested command**: `/impeccable layout`

**[P1] Two inconsistent dropdown implementations**
- **Why it matters**: The shared `Dropdown` component (orange highlight, split radius when open) and the service-suggestion popup (gray highlight, uniform radius, separately-implemented keyboard handling) are the same UI pattern implemented twice, three lines of code apart conceptually — a direct consequence of piecemeal editing.
- **Fix**: Extend `Dropdown` to support a typeahead variant, or restyle the suggestion popup to visually match.
- **Suggested command**: `/impeccable polish`

**[P2] No Escape-to-close, no PIN-retry refocus**
- **Why it matters**: Neither the create/edit modal nor delete modal closes on Escape (only the autocomplete popup does); a failed PIN attempt clears digits but never refocuses digit 1, forcing a manual click before retrying.
- **Fix**: Add a shared Escape handler to both modals; call `.focus()` on the first PIN input after a failed attempt.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Alex (Power User)**: Unlocking requires typing 4 digits then still clicking "ยืนยัน" — no auto-submit on the 4th digit, for a gate re-entered every tab mount per the project's own docs. Can't view ส่วนตัว and ทีม items together (binary scope filter, no "all"). Delete is immediately terminal with no undo.

**Sam (Accessibility-Dependent)**: The reusable `Dropdown` component is a `<button>` + conditional `<div>` with no `role="listbox"`/`role="option"`, no `aria-expanded`, and no arrow-key support at all — while the service-suggestion list three lines away in the same file *does* support Arrow Up/Down. Same form, materially worse keyboard experience on one control than another. Edit/delete icon buttons have only generic `title="แก้ไข"`/`"ลบ"` — a screen reader hears "แก้ไข, ลบ, แก้ไข, ลบ..." down the whole list with no way to tell which card each button belongs to.

**Riley (Stress Tester)**: Editing a credential doesn't clear its own `visibleStates`/`decryptedValues` entry — a secret revealed before an edit can remain visibly decrypted in the list underneath the open modal. Auto-rename-on-blur (`getUniqueLabel`) is silent and untracked — the audit log only records the final label, not that a rename happened, so a "why did my label change" report has no trail to explain it.

## Minor Observations

- Pagination renders a single active page-1 button even when there's only one page — harmless but slightly redundant chrome for the common (few-credentials) case.
- The "📌" emoji prefix on notes is the only emoji in an otherwise fully lucide-icon-driven component — a small visual-language inconsistency.
- `formatThaiShortDate` assumes a well-formed `YYYY-MM-DD` prefix with no guard, fine today since `createdAt` is always self-generated, but fragile if this component is ever fed external data.
- Delete-confirmation and create/edit modals both hard-code the same `max-w-lg p-10`, even though the delete modal's content is roughly a third of the height — a small copy-paste polish gap, not a bug.
