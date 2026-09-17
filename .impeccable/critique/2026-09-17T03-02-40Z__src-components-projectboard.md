---
target: src/components/projectBoard (project/task management + approval + status flow)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-09-17T03-02-40Z
slug: src-components-projectboard
---
Method: dual-agent (A: general-purpose design-review agent · B: general-purpose detector/browser-evidence agent)

## Design Health Score — 22/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | ReviewTaskModal failures surface only a generic error; separately, the same project now shows 3 different completion percentages simultaneously (ProjectCard/MyWorkspace still read the raw `progress` field, ProjectDetail was updated to compute done/total) |
| 2 | Match System/Real World | 3 | Thai office vocabulary (ตีกลับ, ส่งงาน, ตรวจงาน, ติดปัญหา) fits real workflow well; "ทีม" label reused for two different concepts (department vs. actual team tab) |
| 3 | User Control and Freedom | 2 | No way to withdraw a filed change request; no undo after submit/review |
| 4 | Consistency and Standards | 2 | PeopleCell pattern reimplemented differently in 2+ places; grid view's whole-card hover affordance doesn't match its actual (button-only) click target, unlike list view |
| 5 | Error Prevention | 2 | Clearing all project owners silently reverts to "anyone can edit/delete" with no warning |
| 6 | Recognition Rather Than Recall | 3 | Status color/icon/legend solid; blocked-task reason is nowhere, forcing recall |
| 7 | Flexibility and Efficiency | 2 | No bulk approve/reject, no keyboard shortcuts beyond Escape |
| 8 | Aesthetic/Minimalist Design | 3 | Generally clean; ProjectDetail stacks 4 sections before task content |
| 9 | Error Recovery | 1 | Reviewer/assignee gate bug gives no actionable recovery path, ever |
| 10 | Help and Documentation | 2 | Ownership-gate rule itself is never explained in-UI |
| **Total** | | **22/40** | **Acceptable — real gaps in error recovery and cross-screen consistency** |

## Design Specificity Verdict

**LLM assessment (Assessment A)**: the interaction/workflow logic is genuinely product-specific — the equal-authority multi-owner model, the "unowned = open to everyone" gate cascading consistently through 3 people-pickers, the Buddhist-era project code scheme, and the change-request loop are considered decisions, not boilerplate. The visual skin (rounded-2xl white cards, one orange accent, status-pill+dot+icon triads) is a competent but generic "modern SaaS dashboard" look that would fit any unrelated internal tool.

**Deterministic scan (Assessment B)**: `detect.mjs` found exactly 2 findings, both the same `gray-on-color` rule, both on the same two lines of `ProjectBoard.tsx` (385, 410 — the pagination buttons' `disabled:text-slate-300` next to `hover:bg-orange-50`). Assessed as a false positive: the regex has no Tailwind variant-modifier awareness, and `disabled:hover:bg-white` has higher specificity than `hover:bg-orange-50`, so the two colors never actually co-occur on screen. `MyWorkspace.tsx` scanned clean (0 findings). No other rule fired across ~1,000 lines of dense Tailwind usage in either file — read as genuine true negatives, not detector blindness.

**Browser evidence**: Assessment B stood up a throwaway employee/project/task via the REST API, walked the project list (list+grid), a project detail page, AddTaskModal's edit form, and all 4 MyWorkspace tabs, then fully deleted every fixture and verified the DB matched its pre-existing state. No visual overlay tool was available; findings below come from direct screenshot + source cross-reference instead.

## Overall Impression

The underlying permission/workflow model (ownership gating, task-status-follows-process, project-scoped people pickers) is well thought through and consistently applied everywhere it was deliberately touched. But the surface area is evolving faster than the codebase's cross-screen consistency can keep up: today's own fix to ProjectDetail's progress calculation (switching to done/total) was never propagated to the two other screens showing the same number, and the review flow's core "reviewer decides" action is blocked by a gate that only checks assignees. The single biggest opportunity is a consistency pass across the 3-4 places that each independently render "the same piece of data" (progress %, people, status) — several were clearly built at different times by copy-pasting rather than reusing the one shared component that already exists for the purpose.

## What's Working

1. **ReviewTaskModal's reject flow** — requires a reason, and that reason is faithfully carried through to the assignee via TaskDetailModal/MyWorkspace. Constructive, not punitive.
2. **The "unowned = open" gate convention** — reused verbatim across `isOwner` call sites (AddTaskModal, SubmitTaskModal, ScheduleMeetingModal, ProjectTable, EditProjectModal). A new project/task is immediately usable by anyone; the restriction only appears once someone deliberately assigns ownership.
3. **InlineDeleteConfirm's reason-required variant** — morphs the same trash icon into an inline reason input in place, instead of forcing a second modal just to explain a delete request.
4. **AddTaskModal's status auto-derivation + live preview badge** — a genuinely clean instance of removing free-choice UI once it stopped making sense, with the resulting state shown back to the user before they save.

## Priority Issues

**[P0] Reviewers who aren't also assignees cannot actually complete a review**
- What: `ReviewTaskModal`'s pass/reject both go through `PUT /api/project-tasks/:id`, which the server gates on `isOwner(currentAssigneeIds, actorEmployeeId)` — checking only the assignee list, never `reviewerEmployeeIds`. A reviewer who isn't also an assignee (the expected, common case) gets a 409, surfaced only as a generic "บันทึกผลตรวจไม่สำเร็จ" with no explanation and no retry that works.
- Why it matters: breaks the verb the whole review system exists for.
- Fix: extend the update gate for a review-decision update to accept the actor being in `reviewerEmployeeIds` OR `assigneeEmployeeIds` (or a dedicated review-decision endpoint gated on reviewer identity), plus an honest error message.
- Command: /impeccable harden

**[P0] The same project shows 3 different completion percentages at once**
- What: `ProjectDetail.tsx`'s overview card was recently changed to compute `overallProgress` as done-tasks ÷ total-tasks, but `ProjectCard.tsx` (grid view) and `MyWorkspace.tsx` ("โครงการของฉัน" tab) both still render the project's raw stored `progress` field directly. Verified live: a test project with `progress: 40` stored and 1 not-yet-done task showed 40% on the card/MyWorkspace and 0% on its own detail page, simultaneously.
- Why it matters: an owner sees contradictory numbers for the same project depending which screen they're on — undermines the very fix meant to make progress trustworthy.
- Fix: propagate the same done/total calculation to ProjectCard and MyWorkspace, or move it server-side onto the project row so every reader gets one number.
- Command: /impeccable harden

**[P1] No way to see or record why a task is "ติดปัญหา" (blocked)**
- What: the blocked checkbox has no accompanying reason field, and none exists on `ProjectTaskItem`. Contrast with `reviewNote`, which IS surfaced everywhere a rejection matters.
- Why it matters: the more alarming status ("blocked") carries less information than the milder one ("bounced back for revision").
- Fix: add a required short reason alongside the checkbox, persist it, surface it identically to `reviewNote`.
- Command: /impeccable clarify

**[P1] Submit/review actions are entirely missing from ProjectDetail**
- What: ProjectDetail's task tables only offer view/edit/delete — no ส่งงาน/ตรวจงาน anywhere. Those only exist in MyWorkspace.
- Why it matters: breaks ProjectDetail's own "one-stop shop for this project" model; forces a full page/context switch to submit or review work on a task you're already looking at.
- Fix: add ส่งงาน/ตรวจงาน actions to ProjectDetail's task rows, reusing the same modals + gating MyWorkspace already applies.
- Command: /impeccable layout

**[P2] Grid view's click affordance doesn't match its actual behavior**
- What: list view makes the project title clickable to open detail; grid view's `ProjectCard` gives the whole card a `hover:-translate-y-1 hover:shadow-lg` treatment (signaling "click anywhere") but only the small "ดูรายละเอียด" button actually opens it — confirmed by a live click-target test that timed out on the title/description text.
- Why it matters: trains a habit in one view that fails in the other.
- Fix: make the whole card clickable (matching its own hover signal), or drop the whole-card hover effect in favor of one that scopes to the actual clickable button.
- Command: /impeccable clarify

**[P2] "ทีม" label is reused for two different concepts on the same page**
- What: ProjectDetail's overview grid labels a field "ทีม" and shows `row.department` (e.g. "แผนกเทคโนโลยีและไอที") under it, while a separate real "ทีม" tab exists showing actual member data.
- Why it matters: same word, two different meanings, on the same screen.
- Fix: relabel the overview field "แผนก" (department) to match what it actually shows.
- Command: /impeccable clarify

## Persona Red Flags

**Alex (Power User)**
- No bulk approve/reject for change requests, no keyboard shortcuts beyond Escape-to-close.
- ProjectDetail's "ขยายพื้นที่ทำงาน" only escapes the Sidebar/Header chrome — no density toggle or column customization for a large task table.

**Sam (Accessibility-Dependent User)**
- InlineDeleteConfirm's armed/reason state swaps content with no ARIA live-region announcement.
- Meeting-row edit/cancel icon buttons lack `aria-label` (task-row equivalents have it).
- PendingRequestCard's reject textarea has a placeholder but no associated `<label>`.

**Riley (Deliberate Stress Tester)**
- Confirmed, reproducible: a reviewer who isn't an assignee can never pass/reject a review (see P0 above).
- Clearing every owner from EditProjectModal and saving silently reverts to "anyone can edit/delete" — no warning.
- If a task's only assignee changes after a change request is filed, nobody may remain able to decide it — no admin override found.
- "ระยะโครงการ" (project duration), collected in CreateProjectModal step 1 and shown in its step-3 summary, is never actually sent in the create payload or stored on `ProjectRow` — silently discarded, confirmation screen implies otherwise.

## Minor Observations

- The dead "ระยะโครงการ" field deserves its own follow-up regardless of severity — either wire it in or remove the UI.
- Blocked-checkbox subtext singles out "ผู้ตรวจ" but the actual notification fan-out treats owners/members/assignees/reviewers equally.
- PeopleCell (shared avatar+name+"+N" component) is correctly reused in ProjectDetail/Dashboard's ProjectSummaryTable but hand-reimplemented differently in ProjectTable.tsx and ProjectCard.tsx, plus a third "+N คน" vs "+N สมาชิก" wording variant in CreateProjectModal's step-3 summary.
- No centralized "pending requests waiting on me" view across projects — only the per-project panel. A "รออนุมัติจากฉัน" MyWorkspace tab (mirroring "งานที่ต้องตรวจ") would close this gap.
- The reviewer-selection helper text in AddTaskModal renders at `text-[10px]`, noted as a fact (below common minimum body-text size) without a stance on whether it should change.
- The pending-request panel is visible (read-only) to anyone who can open the project at all — worth confirming that's the intended transparency level, since it exposes a requester's stated reason to unrelated project members.

## Questions to Consider

1. What if "ตีกลับ" (review rejection), "ติดปัญหา" (blocked), and change-request rejection were unified into one "needs attention, with a reason" pattern instead of three mechanisms that each surface completely differently?
2. What if reviewers had their own first-class gate (checked against `reviewerEmployeeIds`) instead of borrowing the assignee-ownership check?
3. What if MyWorkspace, not ProjectDetail, were the one place every submit/review/approve action lives, with ProjectDetail deep-linking into it?
4. What if removing the last owner from a project/task triggered the same seriousness of confirmation as deleting it outright, given the practical effect is comparable?
5. What if pending change requests got their own MyWorkspace tab, mirroring "งานที่ต้องตรวจ"?
