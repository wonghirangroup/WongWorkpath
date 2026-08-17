---
target: หน้าคลังรหัสผ่าน (CredentialVault)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-15T08-06-20Z
slug: src-components-credentialvault-tsx
---
Method: dual-agent (A: general-purpose design-review agent · B: general-purpose detector/browser-evidence agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Copy/create/edit/undo all give feedback, but view/copy audit logging happens silently — user never sees "this was tracked" |
| 2 | Match System / Real World | 2/4 | Every credential is force-labeled "รหัสผ่าน/Password" even when it's really an API key, bank account, or token — the `type` selector doesn't exist in the form |
| 3 | User Control and Freedom | 3/4 | Escape/backdrop-click cancel, 5s undo on delete; no recovery once the undo window lapses (acceptable for an internal tool) |
| 4 | Consistency and Standards | 3/4 | Dropdowns/menus/autocomplete share consistent patterns |
| 5 | Error Prevention | 2/4 | Delete requires exact-label retyping (strong), but nothing prevents the standing `type` mislabeling on every create |
| 6 | Recognition Rather Than Recall | 3/4 | Autocomplete, always-visible search/filter; no type badge on cards |
| 7 | Flexibility and Efficiency | 3/4 | "/" shortcut, full keyboard nav; no bulk actions despite soft-delete already supporting id arrays |
| 8 | Aesthetic and Minimalist Design | 2/4 | Clean cards, but detector measured real WCAG failures: white text on the primary orange button and active pagination button both come in at **2.9:1** contrast (need 4.5:1) |
| 9 | Error Recovery | 1/4 | No error copy anywhere in the file — no failed-save state, no inline validation beyond native `required` |
| 10 | Help and Documentation | 1/4 | No tooltips/help explaining scope vs. team visibility; the audit history that exists in data has no UI, so users can't "check their work" |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

*(Heuristic 8 was revised from the design-review agent's initial 3/4 to 2/4 after weighing the detector's measured contrast numbers — see Design Specificity Verdict.)*

## Design Specificity Verdict

**LLM assessment**: This reads as a generic CRUD contact-card list wearing vault styling, not an interface designed around secret-handling risk. The clearest tell: `getAvatarCandidates` (CredentialVault.tsx:126–141) fires unauthenticated requests to `${origin}/favicon.ico` and `https://www.google.com/s2/favicons?domain=...` for every credential with a URL, on render, with zero user action — broadcasting which services the org holds secrets for to Google and to the target servers themselves. Real vault-specific craft does exist (type-to-confirm delete + 5s undo, audit logging on view/copy, service autocomplete), but it sits next to a dead `type` field that mislabels every API key/bank account/token as "Username & Password," and a fully-tracked audit trail that's never surfaced in the UI. Net: polish on CRUD mechanics, not on vault-specific trust or risk differentiation.

**Deterministic scan**: `detect.mjs` found 2 findings in CredentialVault.tsx (both `gray-on-color`, lines 1122/1142) and 1 in Header.tsx (`gray-on-color`, line 134) — all three confirmed **false positives** on inspection: they're mutually-exclusive Tailwind state modifiers (`disabled:`/ternary branches) that never render simultaneously, matching false positives already accepted earlier this session. The browser-injected detector (live page scan) caught 14 additional anti-patterns the source-level scan didn't, including real, actionable findings scoped specifically to this page's own markup:
- **`nested-cards`** ×3 — the "ชื่อผู้ใช้/รหัสผ่าน" data box (`bg-[#F9F9F9] ... rounded-xl border`) sits inside the outer card (`bg-white ... rounded-2xl`) on every one of the 3 rendered credentials — a literal instance of the craft-floor's "nested cards are always wrong" anti-pattern.
- **`skipped-heading`** — the page's `<h1>` "คลังรหัสผ่าน" is followed directly by `<h4>` (each credential's name), skipping `<h2>`/`<h3>` entirely — a real semantic-HTML/screen-reader navigation gap.
- **`low-contrast`** ×5 — measured contrast ratios of 2.9:1, 2.5:1, and 3.7:1 (all fail WCAG AA's 4.5:1) on: the primary "สร้างรหัสผ่านใหม่" button, the active pagination number, and two avatar-initial badges (`#14b8a6` teal, `#3b82f6` blue). This is hard numeric evidence the LLM review didn't have — it independently confirms and sharpens the LLM's "aesthetic polish over substance" read into something WCAG-measurable.
- **`tiny-text`** ×4 — 11px body text (matches the LLM review's separate note about the 9px team badge — the page runs multiple text sizes below common readable-text minimums).
- A few other flags (`gradient-text`, `bounce-easing`, one `layout-transition` instance) were attributed to page-`body` scope rather than a CredentialVault-specific selector — since the browser scan covers the whole `/vault` page (Header, Sidebar, this component, and anything else AppLayout mounts), these likely originate from shared chrome rather than this file; worth a follow-up scan in isolation if you want certainty, but I'm not asserting them as this component's fault. The one `layout-transition` finding that **is** attributable here (`transition-[width]` on the Sidebar) is the sidebar-collapse animation you already iterated on and approved for smoothness earlier this session — flagging it as known/intentional, not a fresh issue.

**Visual overlays**: The detector's overlay was injected successfully in Assessment B's isolated browser session and is not currently live in your own browser (that session closed after evidence-gathering) — the findings above are the full list it reported, not a partial summary.

## Overall Impression

The page is competently built CRUD with a few genuinely thoughtful touches (delete confirmation, autocomplete), but it hasn't been designed *as a vault* — the single biggest opportunity is closing the gap between what the interface visually promises (masked secrets, "จัดเป็นความลับระดับแผนก" audit copy, a lock icon in the nav) and what it actually does (plaintext localStorage, metadata-leaking favicon fetches, an audit trail nobody can see, secrets that unmask with zero friction regardless of how sensitive they are).

## What's Working

1. **Delete confirmation flow** — type-to-confirm the exact label plus a 5-second undo-toast grace window. This is the one moment on the page that feels deliberately calibrated to the stakes of destroying a shared credential.
2. **Service-name autocomplete** — fuzzy matching, full `combobox`/`listbox` ARIA, arrow/Enter/Escape keyboard nav, and a visible rename notice when `getUniqueLabel` auto-dedupes a name. More engineering care than most CRUD forms bother with, and it degrades gracefully instead of surprising the user.
3. **Power-user details** — the "/" search shortcut, select-all-on-click username text, and the 1.5s copy-confirmation checkmark are small but real signs of intent for a repeat-use internal tool.

## Priority Issues

**[P0] Credential metadata leaks to third parties via automatic favicon fetching**
- **Why it matters**: `getAvatarCandidates` (CredentialVault.tsx:126–141) fires unauthenticated requests to the credential's own origin (`/favicon.ico`) and to Google's favicon cache for every card with a URL, on render, with no user action. A page whose entire premise is "confidential org credentials" is broadcasting which services it holds secrets for to Google and to the target servers themselves.
- **Fix**: Drop remote favicon fetching; use `logoUrl` only when manually set, otherwise the colored-initial avatar (already implemented as the fallback).
- **Suggested command**: `/impeccable harden`

**[P0] The credential `type` field is dead — every credential is silently mislabeled**
- **Why it matters**: `newType` defaults to `'Username & Password'` and `setNewType` is never called from any form control (confirmed by grep) — only at declaration, form-reset, and edit-populate. Every API key, bank account, and access token created through the UI is forced into type "Username & Password" and shown under the literal label "รหัสผ่าน/Password:" regardless of what it actually is.
- **Fix**: Add the existing `Dropdown` component to the create/edit form for `type`; make the card's field label react to `item.type`.
- **Suggested command**: `/impeccable clarify`

**[P1] Primary action color fails WCAG contrast — confirmed by measurement, not just judgment**
- **Why it matters**: White text on `#FF6537` measures **2.9:1** (need 4.5:1) on both the primary "สร้างรหัสผ่านใหม่" button and the active pagination number — this is the app's core brand/CTA color, used the same way across other pages built this session. It's not a one-off; it's systemic.
- **Fix**: Either darken the orange for text-bearing surfaces, or keep `#FF6537` as a fill and switch to a near-black text color on top of it; test the specific shade against 4.5:1 before locking it in.
- **Suggested command**: `/impeccable audit`

**[P1] Tracked audit trail is fully built and completely invisible**
- **Why it matters**: `auditLogs` is accepted as a prop and every view/copy/create/edit/delete is logged via `onLogAudit`, but there is no UI anywhere on this page to see who accessed what and when. For team-shared secrets, this is precisely the feature that would earn trust in reveal/copy actions — and it's fully wired on the data side, unused on the UI side.
- **Fix**: Add a per-card "ดูประวัติการเข้าถึง" expandable access-history list sourced from the existing `auditLogs` prop.
- **Suggested command**: `/impeccable layout`

**[P2] Reveal/copy of a live secret has zero risk-differentiated friction**
- **Why it matters**: The eye-icon reveal behaves identically for a personal password and a "Production Database" credential — instant unmask, no confirmation — despite `scope`/`team` already modeling blast radius. Delete gets 5 seconds of ceremony; exposing a live secret gets none.
- **Fix**: Add a lightweight visual accent or confirm step for `scope === 'ทีม'` items.
- **Suggested command**: `/impeccable harden`

**[P2] Nested-card structure and skipped heading level**
- **Why it matters**: The username/password data box is a card-styled container nested inside the outer credential card on all 3 rendered items (confirmed by the live-page scan) — a recognized anti-pattern that also adds unnecessary visual noise. Separately, `<h1>` jumps straight to `<h4>` per credential, skipping `<h2>`/`<h3>`, which breaks screen-reader heading navigation.
- **Fix**: Flatten the data box to a plain bordered section instead of a second rounded/shadowed container; promote each credential's name to `<h2>` (or restructure the heading hierarchy consistently across the page).
- **Suggested command**: `/impeccable layout`

## Persona Red Flags

**Alex (Power User)**: The "/" shortcut and instant reveal/copy work well. But search only checks `label` and `username` (line 667) — searching by `notes` or `team` returns nothing. `PAGE_SIZE = 4` means any real-sized shared vault forces Alex through repeated pagination clicks with no density control. Creating an API key silently mislabels it as a password with zero warning, and there's no type filter later to find "his API keys" among generic entries.

**Sam (Accessibility-Dependent)**: Every icon-only action button (the "..." card menu, copy-username, copy-password, eye-toggle) uses only a `title` attribute — zero `aria-label` usage anywhere in the file — which many screen readers don't reliably announce. The copy-success checkmark swap has no `aria-live` region, so Sam gets no non-visual confirmation a copy succeeded. The service-autocomplete combobox is well-built ARIA-wise but has no `aria-activedescendant`, so arrowing through suggestions announces nothing. Most concretely: the password show/hide toggle has `tabIndex={-1}` explicitly set (line 874), deliberately removed from tab order — after typing a password, Sam has no keyboard-only way to verify what was typed without reaching for a mouse.

## Minor Observations

- Create-success toast renders literal stray quotes: `"สร้างรายการสำเร็จ" แล้ว`, inconsistent with the clean `แก้ไขรายการสำเร็จแล้ว` on edit.
- Search excludes `notes`, `team`, and `url` — only `label`/`username` match.
- Team badge on card header renders at 9px, under common minimum readable-text guidance (also flagged by the detector as `tiny-text` elsewhere on the page).
- Empty "no results" state has no recovery action (e.g. a "clear search" link).
- `formatThaiShortDate` doesn't zero-pad day/month — cosmetic, low priority.
- Broader honesty gap: the UI's tone (masking, "จัดเป็นความลับระดับแผนก" audit copy) implies stronger protection than exists — secrets are plaintext in localStorage behind only the main app login, no real encryption.

## Questions to Consider

1. The audit trail is fully implemented and fully hidden — was surfacing it to users ever the goal, or was it added purely for after-the-fact compliance with no intent to let users answer "who else has seen this"?
2. The `type` field exists in the schema, the create/edit logic, and even the audit-log text — but has no UI control anywhere. Was this a feature cut mid-build, or should `type` just be dropped from the model? Either way, it's currently lying about every credential created through the UI.
3. Delete gets 5 seconds of undo and forced retyping; reveal/copy of a production secret gets nothing. If the same design attention went into "expose a live secret" that clearly went into "destroy a record," what would that look like?
