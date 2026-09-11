---
target: จัดการงานและโครงงาน / ProjectBoard
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 1
timestamp: 2026-09-02T03-29-11Z
slug: src-components-projectboard-projectboard-tsx
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | "สร้างโครงการใหม่" and "ดูรายละเอียด" have no `onClick` at all — no feedback loop on the two primary actions |
| 2 | Match System / Real World | 3/4 | Good Thai/พ.ศ. date + ฿ currency formatting; "ยังไม่มี" reused generically blurs distinct meanings (no budget vs. no owner vs. no date) |
| 3 | User Control and Freedom | 2/4 | Search has a clear button; no way to reset filter+sort together, no detail/back flow yet |
| 4 | Consistency and Standards | 1/4 | `statusMeta.ts` / `ProjectTable.tsx` hardcode raw hex via inline `style={{}}` instead of the Tailwind class-pair convention (`text-blue-700 bg-blue-100`) DESIGN.md documents for this exact kind of tag |
| 5 | Error Prevention | 3/4 | No destructive actions on this page currently |
| 6 | Recognition Rather Than Recall | 3/4 | Status pills always pair color with text — good; accent-bar and progress-bar colors carry meaning with no label |
| 7 | Flexibility and Efficiency | 3/4 | Search + sort + tabs + grid/list give multiple paths to the same data; no bulk actions |
| 8 | Aesthetic and Minimalist Design | 1/4 | A single row carries 4-5 simultaneous color signals for two underlying facts (status + urgency) |
| 9 | Error Recovery | 2/4 | No feedback when an action silently does nothing |
| 10 | Help and Documentation | 2/4 | Icon buttons have `title` tooltips; acceptable for an internal Operate-mode tool |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

#### Design Specificity Verdict

**LLM assessment**: The toolbar (search, view toggle, orange "+" button), the pulsing red dot on "ใกล้ครบกำหนด," and Buddhist-calendar Thai date formatting show real product-specific craft and correctly reuse the shared shape DESIGN.md documents for CredentialVault/DocVault. But past the toolbar, the status/progress/urgency color system (`statusMeta.ts`, `progressColor`, `rowAccentColor`) is a separate palette of raw hex pasted in from a Figma export — `#F7630C`, `#16C60C`, `#FFF100`, `#F50C0C`, `#FFB800`, `#ACACAC` — sharing nothing with DESIGN.md's documented palette. It reads as two products stitched together: a branded shell around a generic, Figma-default data table.

**Deterministic scan**: `detect.mjs --json src/components/projectBoard` returned **zero findings** (exit 0). This was verified as a genuine clean result, not a broken tool or a hidden config ignore — the same detector run against `CredentialVault.tsx` (which the project's `.impeccable/config.json` has ignore-rules for) correctly still surfaced 5 real findings with `--no-config`. The regex-based detector simply doesn't have a rule for "hardcoded hex duplicating an undocumented palette" or "redundant multi-channel color signaling" — both of the P0s below were caught by human review, not the scanner.

**Visual overlays**: No live-server/`detect.js` injection was run for this target, so no user-visible overlay exists in a browser tab. Evidence instead came from direct Playwright screenshots and DOM measurements (see Priority Issues below) — real observed rendering, not a live overlay.

#### Overall Impression

The page's bones (toolbar, tab animation, empty states, Thai formatting) are genuinely well-crafted and consistent with the rest of the app. The problem is almost entirely the color layer laid on top of the data table: a whole second, undocumented palette that duplicates and overloads the same two facts (status, urgency) through five different visual channels at once, and two status colors sit close enough to be misread in a quick scan — which defeats the table's actual job of fast triage. Layout is solid on desktop but genuinely breaks down at mobile width, with almost no room for the filter tabs and no scroll affordance to reveal it.

#### What's Working

- The toolbar in `ProjectBoard.tsx` (search `bg-[#F6F6F8]`, `bg-[#F4F4F5] rounded-xl p-1` view toggle, `lg:ml-auto` orange "+" button) exactly reuses CredentialVault/DocVault's shared shape — instant visual kinship with the rest of the app.
- `ProjectFilterTabs.tsx`'s animated underline (`motion.span layoutId="projectTabsActiveIndicator"`) plus the `animate-ping` dot on "ใกล้ครบกำหนด" is a restrained, purposeful micro-interaction on genuinely time-sensitive data.
- `formatThaiDate` (พ.ศ. +543, Thai month abbreviations) and `formatBudget`'s `toLocaleString('th-TH')` + ฿ symbol are real locale-specific craft.

#### Priority Issues

**[P0] Color: an entire second, undocumented color system**
- Why it matters: `statusMeta.ts` and `ProjectTable.tsx`'s `progressColor`/`rowAccentColor` hardcode raw hex via inline `style={{}}` that appears nowhere in DESIGN.md's brand/text/surface tables — the file's own comment admits these are "exact hex values from the supplied Figma export." It will drift the instant the brand theme changes and reads as pasted-in rather than native.
- Fix: convert to Tailwind theme tokens following the `DEPARTMENT_TAG_COLORS` class-pair convention already used in CredentialVault/DocVault, or formally add a status-color section to DESIGN.md.
- Suggested command: `/impeccable colorize`

**[P0] Color: two statuses are nearly indistinguishable at a glance**
- Why it matters: `in_progress` pill bg `#F8D2BC` and `cancelled` pill bg `#FBD5D5` are a few RGB steps apart (both light warm peach/pink); `on_hold`'s `#FFF9BC` is low-contrast against white. This table's whole job is fast visual triage — misreading cancelled as in-progress in a quick scan is a real, costly error, worse for colorblind users.
- Fix: push the 5 status hues further apart on hue and lightness; verify each pill's text/bg pair against WCAG contrast.
- Suggested command: `/impeccable colorize`

**[P0] Layout/Color: redundant, competing signals per row**
- Why it matters: a near-deadline row shows a colored left accent bar, a colored progress fill, a colored status pill, red "อีก 1 วัน" text, and (elsewhere) a pulsing red tab dot — five color channels for two facts (status + urgency). Directly violates minimalist design and actively fights the fast-scan job of the table.
- Fix: reserve pill color strictly for status and the accent bar strictly for urgency; stop recoloring the progress fill for urgency.
- Suggested command: `/impeccable colorize`, then `/impeccable distill`

**[P1] Layout: breaks down at mobile width**
- Why it matters (browser-measured, not assumed): at 390px, the filter-tabs row (`overflow-x-auto scrollbar-none`) has `scrollWidth: 484` vs `clientWidth: 73` — only ~73px visible for 7 tabs, cutting the second tab off mid-character with `scrollbar-none` hiding any scroll affordance entirely. Separately, `StatusSummaryCards`' `grid-cols-2` at this width strands the 5th card alone on its own row. Both read as layout bugs, not intentional design, on the very first screen a mobile user sees.
- Fix: add a visible scroll cue (fade edge or small chevron) to the tabs row instead of `scrollbar-none`, and make the 5-card grid wrap evenly (e.g. horizontally scrollable like the tabs, or an equal-width flex-wrap).
- Suggested command: `/impeccable adapt`

**[P2] Layout: count shown twice per summary card**
- Why it matters: each card shows the count both inline next to the label ("กำลังดำเนินการ 1") and again as the giant `text-5xl` number — wastes visual weight on repetition and briefly reads as if the two numbers might differ.
- Fix: drop the count from the label line; let the large number carry it alone.
- Suggested command: `/impeccable layout`

#### Persona Red Flags

**Alex (Power User)**: No visible `focus-visible` styling anywhere in the filter tabs, sort menu, or "ดูรายละเอียด" button — a keyboard-driven user managing many projects daily loses focus tracking entirely. No row selection or bulk actions either.

**Sam (Accessibility-Dependent)**: Draft-status pill text `#ACACAC` on bg `#EFF2EF`, reused for every "ยังไม่มี" placeholder, computes to roughly 2.3:1 contrast — well under WCAG AA's 4.5:1 — for exactly the fields telling Sam whether a draft project has an owner or dates yet.

**Riley (Stress-Tester)**: Search only filters by title (`ProjectBoard.tsx`); searching by project code "PRJ-001" silently returns "ไม่พบรายการที่ตรงกับการค้นหา" with no hint that code isn't searchable. The all-`null` draft row renders "ยังไม่มี" four times, nearly camouflaging against the empty-state convention.

#### Minor Observations

- The leading spacer `<th className="w-4 py-3">` for the accent-bar column is an unlabeled header cell a screen reader announces as empty.
- Grid/card view drops code, budget, dates, and the due-date warning entirely — a grid-view user never sees which projects are overdue.
- Table row hover `hover:bg-[#FAFAFA]` is a one-off hex, not DESIGN.md's documented `hover:bg-slate-50` / `hover:bg-orange-50` / `hover:bg-slate-100` set.
- `progressColor`'s `#FFB800` (progress <50%) and `STATUS_DOT.on_hold`'s `#FFF100` are both yellows for unrelated meanings.
- Table body text defaults to `text-sm` (14px), not DESIGN.md's documented `text-[12px]`–`text-[13px]` table-cell convention.

#### Questions to Consider

- Is the Figma-exported color system meant to be reconciled into DESIGN.md's real palette before ship, or will this page permanently run a second, undocumented brand?
- With five status colors and three redundant urgency signals per row, is this table optimized for fast triage, or for looking visually busy?
- What would this table look like if urgency and status each got exactly one color channel, and nothing else?
