---
target: Login.tsx
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-27T08-27-15Z
slug: src-components-login-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `LoadingDots` + "รอสักครู่..." (L628) gives honest feedback on final submit; but OTP resend/verify give no pending state between click and view swap. |
| 2 | Match Between System / Real World | 2 | Thai copy reads naturally, but the 5-country flag/phone picker (L8-96, L410-459) doesn't match reality for an internal Thai-company tool with a fixed employee roster. |
| 3 | User Control and Freedom | 3 | Back chevrons on forgot/OTP (L394-400, L484-490) work well; `tabIndex={-1}` on the reset-view eye-toggle buttons (L577, L602) silently removes them from keyboard tab order — inconsistent with the login-view eye-toggle (L350-358), which has no such restriction. |
| 4 | Consistency and Standards | 1 | Login uses `#FF6537` orange on a `#272220` dark background; the rest of the app (Dashboard, TaskModal, TaskListView, CalendarView) runs on `indigo-600`. Two unrelated design systems in one product's first and most frequent screen. |
| 5 | Error Prevention | 2 | Only email-shape is validated pre-submit (L164); password-length/match checks fire only on submit (L254, L259), not inline; no live confirm-password match indicator. |
| 6 | Recognition Rather Than Recall | 3 | OTP auto-advance/backspace (L216-232) removes recall burden well; collapsed country code (`+66`) requires a click to recall which flag maps to which country. |
| 7 | Flexibility and Efficiency of Use | 1 | No "remember me", no bulk/paste affordance for the 6 single-char OTP boxes, no shortcuts. Nothing rewards a returning employee over a first-timer. |
| 8 | Aesthetic and Minimalist Design | 3 | Card layout is clean with generous whitespace; the ~90-line hand-drawn 5-flag SVG set (L39-96) is disproportionate code/visual weight for a near-certain "Thailand" answer. |
| 9 | Help Recognize/Diagnose/Recover from Errors | 2 | `ErrorBanner` (L98-105) is visually clear, but L165 and L172 fire the identical vague message for a malformed email vs. an unrecognized one — no differentiation despite this being a closed internal roster, not a public signup form. |
| 10 | Help and Documentation | 1 | Only help available is the one-line hint "ใช้อีเมลพนักงานที่มีอยู่ในระบบ..." (L636); no IT-support link, no indication that the forgot-password flow doesn't reach a real backend. |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment**: This reads as a generic SaaS login template with Thai copy and two brand colors (`#FF6537` / `#272220`) painted over it, not a screen authored for Wong Workpath's actual context: an internal tool with a known, fixed Thai employee directory and no public signup. The 5-country phone/flag picker, hand-drawn SVG flags, and full OTP+reset flow are boilerplate patterns lifted from consumer-app templates. Swap the logo and the orange hex and this exact file drops into any unrelated product unchanged.

**Deterministic scan**: `detect.mjs` returned exit code 2 with exactly one finding: `bounce-easing` (category: slop, severity: warning) at **Login.tsx:122**, flagging the `animate-bounce` Tailwind class on the three loading dots as a "dated and tacky" easing choice — the LLM design pass didn't independently flag this, so the detector is adding real signal here, not duplicating it. Supplementary objective grep found: all 6 inputs have proper label/aria-label association (no a11y-label gap); all 6 inputs carry a custom peach (`#F9AD97`) focus ring, but **none of the 13 buttons in the file define their own focus style** — they fall back to default browser focus outline, which is a real Heuristic-4 (consistency) gap between input and button focus treatment, not a broken/missing focus indicator outright. 3 inline `style={{}}` usages (L80, L91, L123) back up the "disproportionate flag code" observation from the LLM pass. No false positives to report — the one detector hit is legitimate and the objective grep found nothing that reads as a Thai-text or brand-color false flag.

**Visual overlays**: Not available this run — no browser automation tool was exposed in this session, so no live in-browser overlay could be injected. This is a fallback signal, not a finding: a dev server is running on port 3000, but the harness has no screenshot/navigate capability to use it for critique purposes.

## Overall Impression

The four-state login flow (login → forgot → otp → reset) is competently built at the interaction-pattern level — OTP auto-advance, disabled-button states, and back navigation are all correctly implemented. The real problem is trust and coherence, not craft: the forgot-password flow simulates sending and verifying an OTP that never touches any backend (`isOtpValid` at L214 accepts any 6 digits), so an employee who genuinely forgets their password gets a confident, convincing dead end. Layered on top, this screen visually belongs to a different product than the app it leads into (orange/dark vs. the indigo/light system used everywhere else). Fix the honesty problem first; the visual-system split is the second-biggest lever.

## What's Working

- OTP input auto-advance and backspace-to-previous (L216-232) is correctly implemented, including guarding against multi-character paste-into-single-box via `.slice(-1)` (L217).
- Disabled vs. enabled button states use a consistent, wordless visual language (`bg-[#F68C6C]` vs `bg-[#FF6537]`, e.g. L376-378) across all four forms — a user always knows when a form isn't ready to submit.
- Icon-only buttons carry real `aria-label`s (L355, L397, L487, L514, L581) — accessibility intent is present, not an afterthought, even where execution has gaps (see P2 below).

## Priority Issues

**[P0] The forgot-password flow is confident security theater.**
Why it matters: Line 496 tells the employee a code was sent to their phone; nothing sends it, and `isOtpValid` (L214) accepts any 6 digits, so the flow always "succeeds." An employee who genuinely forgets their password is walked through a convincing, multi-screen dead end and told at the end "เปลี่ยนรหัสผ่านสำเร็จ" (password changed successfully, L266) — a false success on a security-adjacent action.
Fix: Either wire it to a real reset mechanism, or replace it with an honest "contact IT to reset your password" screen. Don't simulate verification on the one flow whose entire job is establishing trust.
Suggested command: `/impeccable clarify` (if kept as a redirect to IT) or treat as a product/backend decision outside Impeccable's scope.

**[P1] Two incompatible design systems in one product.**
Why it matters: Login runs orange-on-dark (`#FF6537` / `#272220`); Dashboard, TaskModal, TaskListView, and CalendarView all run on `indigo-600`. The first (and most frequent, since this is a daily-use internal tool) screen an employee sees doesn't match the product they then spend 8 hours in.
Fix: Pick one accent — indigo is already dominant across the rest of the app — and unify.
Suggested command: `/impeccable document` (capture the real system first, since none exists yet), then `/impeccable polish`.

**[P1] Identical error copy for two different failure causes.**
Why it matters: L165 (malformed email) and L172 (unrecognized email) fire the exact same message. Vagueness is defensible against a hostile actor probing a public form, but this is a closed internal roster with no signup — an employee who fat-fingers their own email address gets no better signal than someone testing random addresses.
Fix: Validate email shape inline (client-only, zero security cost) and reserve the vague "invalid username or password" message solely for the genuine auth mismatch.
Suggested command: `/impeccable clarify`.

**[P2] Reset-view password-reveal buttons are silently removed from tab order.**
Why it matters: `tabIndex={-1}` on L577 and L602 means a keyboard-only user tabbing through the "set new password" form cannot reach the show/hide toggle at all — inconsistent with the same control on the login view (L350-358), which has no such restriction. A screen-reader/keyboard user (persona "Sam") hits an invisible wall exactly where visibility of what they're typing matters most.
Fix: Remove the `tabIndex={-1}` unless there's a deliberate reason to exclude these two specific buttons from the tab sequence.
Suggested command: `/impeccable audit` (accessibility pass).

**[P2] Country-code picker is disproportionate build for near-zero payoff.**
Why it matters: ~90 lines of hand-drawn flag SVGs (L39-96) and a 5-country dropdown (L413-445) exist for a workforce that is presumably Thai-only, per the product context. This is also where Heuristic 2 (match real world) and Heuristic 8 (minimalism) both take a hit.
Fix: Default silently to `+66` and drop the picker, or fold it behind a low-visibility "other country" link.
Suggested command: `/impeccable distill`.

## Persona Red Flags

**Jordan (Confused First-Timer)**: Clicks "ลืมรหัสผ่าน?" (L367) expecting real help, and immediately hits a mismatch: login is by email (L138), but reset is by phone number (L143) — nothing explains why the identifier changes. Jordan completes the flow, is told it succeeded, and has no way to know the phone-to-account linkage was never real. High risk of a genuinely locked-out employee walking away believing they fixed it, then contacting IT confused about why their "new" password doesn't work.

**Sam (Accessibility-Dependent, keyboard/screen-reader only)**: Cannot reach the password-reveal toggle on the reset screen at all (`tabIndex={-1}`, L577/L602) — the one screen where confirming what was typed matters most. The custom country-code dropdown (L413-444) is a plain `<button>`-driven popover with no `role="listbox"` / `aria-expanded` semantics, so a screen reader gives no indication it's a dropdown with 5 selectable options; Sam has to discover its behavior by trial.

## Minor Observations

- `animate-bounce` on the loading dots (L122) is flagged by the detector as a dated/tacky easing choice — an exponential ease-out would read as more deliberate and "engineered."
- `resendCooldown = 59` (L149, L194, L271) has no evident rationale — one below a round 60 with no stated reasoning; use 30 or 60 with intent, or drop the magic number.
- `min-h-[414px]` is repeated across all four form variants (L313, L389, L479, L552) — worth a shared constant if the four forms are meant to stay visually interchangeable in height.
- 3 inline `style={{}}` usages (L80, L91 for flag clip-paths, L123 for dot stagger) are a minor design-token bypass, consistent with the "hand-built, one-off" character of the flag component.
- The success-banner slot (L323) can only ever be populated by the reset flow's callback — a dead code path if the reset flow is ever removed or replaced per the P0 fix above.

## Questions to Consider

- Is real SMS OTP delivery actually planned, or should the entire forgot-password flow be replaced today with a "contact IT" message, given there's no backend to ever back it?
- Given login is by email but reset is by phone, how is that phone-to-account mapping meant to exist — does IT maintain it anywhere today?
- Should the app standardize on indigo (already dominant elsewhere) or orange (used only here) — and is there a reason Login was deliberately built as a separate visual moment?
