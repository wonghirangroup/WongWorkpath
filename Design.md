# Design.md

Design system reference for **Wong Workpath**, extracted from what's actually implemented in `src/`. This documents current usage — it isn't a spec to enforce, it's a reference to stay consistent with when adding new UI.

Scope: every module that has gone through a real design pass — Login, the app shell (Sidebar/Header), Employee Management (list + org chart + audit log), Task & Project Management (the Project Board), Doc Vault, Credential Vault, the Reports placeholder, แดชบอร์ด (Dashboard), ปฏิทินและตารางเวลา (Calendar), and งานของฉัน (`/gantt`, MyWorkspace — the page previously hosted a separate flat Gantt/workload view; it's since been replaced by MyWorkspace, which now shares this same design pass).

## Brand & Color Palette

### Primary (orange)
| Hex | Use |
|---|---|
| `#FF6537` | Primary brand orange — buttons, active nav pill, active toggle/tab, focus borders, links, accents |
| `#E04D1D` | Primary hover (Login submit button) |
| `#e6572c` | Primary hover, alt (modal submit buttons) |
| `#F68C6C` | Disabled/inactive state of the primary button (form invalid) |
| `#f4622f` | Mobile drawer's active nav background |
| `#FF4E4E` | Sidebar/header logout text and icon |
| `#FFF1EC` | Selected dropdown-option tint, priority "กลาง" pill, code/folder chip backgrounds |
| `#FEFAF9` | Dropdown/list option hover tint |
| `#FF9776` | Toast action-link color (light orange on a dark toast) |

### Text
| Hex | Use |
|---|---|
| `#000000` | Page title (h1), breadcrumb's current (non-clickable) segment |
| `#272220` | Primary body text / headings / form labels |
| `#515151` | Subtitle / breadcrumb muted/clickable text |
| `#6F6F6F` | Secondary/muted text (meta, captions, inactive nav/tab) |
| `#A0A0A0` | Tertiary muted text (role line, empty-value placeholders) |
| `#B0B0B0` | Input placeholder text |

### Surfaces & borders
| Hex | Use |
|---|---|
| `#F6F6F6` | App/page background (`AppLayout`'s outer shell and `<main>`) — **not white** |
| `#FFFFFF` | Card/panel/modal/header surfaces sitting on top of the page background |
| `#F4F4F5` | Grid/list view-toggle track background, section-box fill in the org chart |
| `#F9F9F9` | Table header background, member-chip background in the org chart |
| `#FAFAFA` | Org chart's pan/zoom canvas background |
| `#EDEEEF` | Card/table hairline borders |
| `#E5E5E5` | Modal form-input border |
| `#BAB7B7` | `Dropdown` trigger border |
| `#666666` | Sidebar section divider |
| `#000000` | Sidebar background (floating panel, not the page) |

Search inputs and view-mode toggles across every list page (Project Board, Doc Vault, Credential Vault, Employee Management) now use `bg-white border border-slate-200`, not a tinted gray fill — that reads clearly against the `#F6F6F6` page background, whereas a gray-on-gray input used to blend in.

### Avatar fallback palette
Hashed per-label (not semantic) for initials avatars, via `lib/avatarColor.ts`:
```
['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6']
```

## Department / Section Tag Colors (`lib/departmentColors.ts`)

The company's real org-chart sections replaced the old placeholder IT/HR/Marketing/Sales/Design/Finance categories everywhere in the app (Employee, Task, Document, Credential team-scope, Audit Log). The **structure itself is admin-editable** (see Employee Management → โครงสร้างองค์กร below), so this file can't hardcode a closed set — it ships a color for each of the ten seed sections, then hashes any other name into a second, larger fallback palette so a renamed or newly-added section still gets a distinct, consistent color instead of always falling back to plain gray.

| Section (seed) | Tag classes | Bar class |
|---|---|---|
| แผนกบุคคล | `text-fuchsia-700 bg-fuchsia-100` | `bg-fuchsia-600` |
| แผนกการเงินและการบัญชี | `text-slate-700 bg-slate-200` | `bg-slate-600` |
| แผนกจัดซื้อ | `text-amber-700 bg-amber-100` | `bg-amber-600` |
| แผนกควบคุมสินค้าและสต็อก | `text-orange-700 bg-orange-100` | `bg-orange-600` |
| แผนกขายและดูแลลูกค้า | `text-emerald-700 bg-emerald-100` | `bg-emerald-600` |
| แผนกปฏิบัติการคลังและขนส่ง | `text-teal-700 bg-teal-100` | `bg-teal-600` |
| แผนกธุรการการตลาด | `text-pink-700 bg-pink-100` | `bg-pink-600` |
| แผนกออนไลน์ | `text-cyan-700 bg-cyan-100` | `bg-cyan-600` |
| แผนกพัฒนาธุรกิจและองค์กร | `text-indigo-700 bg-indigo-100` | `bg-indigo-600` |
| แผนกเทคโนโลยีและไอที | `text-blue-700 bg-blue-100` | `bg-blue-600` |

`getDepartmentTagClass(name)` / `getDepartmentBarClass(name)` are the only entry points — never index the color maps directly, since any name outside the seed list must fall through to the hash palette (`text-red-700 bg-red-100`, `text-lime-700 bg-lime-100`, etc. — 12 tag colors / 12 bar colors total).

DocVault's own "ทีม"-scope tag (when scope is "ทีม" but no team chosen) still falls back to `text-[#FF6537] bg-[#FFF1EC]` rather than the department palette.

## Typography

Font: `Kanit` (`--font-sans` in `src/index.css`), applied via `font-sans` on the app root. Falls back to `ui-sans-serif, system-ui, sans-serif`.

| Role | Classes |
|---|---|
| Page title (h1) | `text-[32px] font-bold text-[#000000]` |
| Section subtitle | `text-[20px] font-normal text-[#515151]` |
| Breadcrumb-as-subtitle (no title above it) | `text-[28px]` |
| Login brand heading | `text-4xl font-semibold tracking-wider` |
| Login card heading | `text-3xl font-extrabold text-[#FF6537]` |
| Card title (grid card) | `text-[15px] font-bold text-[#272220]` |
| Modal title | `text-sm font-bold text-slate-800` |
| Form field label | `text-[11px] font-bold text-[#272220]` |
| Form input text | `text-sm` |
| Body / table cell text | `text-[12px] font-medium` – `text-[13px]` |
| Helper / meta text (created-by, date, role line) | `text-[11px] font-normal text-[#6F6F6F]` |
| Result count text | `text-[16px] font-normal text-[#6F6F6F]` |
| Badge / tag text | `text-[9px]`–`text-[11px] font-semibold` |

## Spacing & Radius

| Element | Radius |
|---|---|
| Cards (grid item), modals | `rounded-2xl` |
| Buttons, inputs, dropdown trigger | `rounded-xl` |
| Small inline elements (dropdown option, menu item) | `rounded-lg` |
| Badges, pills, avatars | `rounded-full` |
| Sidebar shell | `rounded-3xl` |

Common padding: `p-4` (card), `p-2.5` (modal input), `px-4 py-3` (Login input), `px-5 pt-5 pb-2` (modal header), `px-3.5 py-2` (dropdown option), `px-4 py-3` (table cell).

## Shared Components

**Dropdown** (`components/Dropdown.tsx`) — the one shared filter/select control, used across Employee Management, the Project Board, Doc Vault, and Credential Vault.
- Two sizes: `compact` (`h-10`, `text-[13px]`) for toolbar filter rows, `cozy` (`h-11`, `text-base`) for modal form fields.
- Border `#BAB7B7`, focus border `#FF6537`.
- Open state: trigger flattens to `rounded-t-xl rounded-b-none`; the floating panel is `rounded-t-none rounded-b-2xl shadow-xl`.
- Highlighted (keyboard-navigated) row: `bg-[#FF6537] text-white font-semibold`. Selected-but-not-highlighted: `bg-[#FFF1EC]`.

**Modals**
- `fixed inset-0 z-50 flex items-center justify-center`, rendered via `createPortal(..., document.body)`.
- Backdrop: `bg-black/15 backdrop-blur-sm` for every create/edit form (a heavier `bg-black/40` shows up only for the Doc Vault's full-size preview modal).
- Box: `rounded-2xl`, `max-w-md` or `max-w-sm`, `max-h-[85vh]`.
- Header row: title (+ optional code/id chip) + `X` close icon (lucide, size 18).
- Entrance animation via `motion/react` spring (`stiffness: 300, damping: 24, mass: 0.9`) is the current default for new modals (Project Board's Create/AddTask/TaskDetail); a plain `duration: 0.2` fade+scale is still used by the older Employee Management add/edit modals.
- **Multi-step wizard** (`CreateProjectModal`): a `StepIndicator` row (numbered circles connected by a bar, done = `bg-[#FF6537] text-white`, current label bold orange, pending gray) above the form body; the final step renders a read-only `SummarySection`/`SummaryRow` review (colored dot + title + "แก้ไข" link back to that step) instead of more inputs, ending in a `สร้าง... →` submit button.

**Toolbar / filter row** (Project Board, Doc Vault, Credential Vault, Employee Management's employee list all use this exact shape)
- Search input: `h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl`, a leading icon absolute-positioned left, clear `X` button right.
- Grid/list view toggle: `flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1`; active state `bg-[#FF6537] text-white`, inactive `text-[#6F6F6F] hover:text-[#272220]`.
- Filter `Dropdown`s (department/status/scope/team) follow the search input.
- Primary `+` action button (`bg-[#FF6537] rounded-xl`) is right-aligned via `lg:ml-auto`.
- Result count + sort: `ทั้งหมด N รายการ` (`text-[16px] text-[#6F6F6F]`) followed by a `• เรียงตาม: <label> ⌄` menu button — same small dropdown pattern in the Project Board's `SortMenu` and both vault pages.

**Segmented pill tabs** (Employee Management's รายชื่อพนักงาน / โครงสร้างองค์กร / บันทึกกิจกรรม switcher, reused as-is by the Project Board's status filter tabs) — same shape as the grid/list toggle, generalized to any small set of mutually-exclusive tabs:
- Track: `flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit`.
- Tab button: `px-3.5 h-8 rounded-lg text-xs font-semibold`; active `bg-[#F4F4F5] text-[#272220]`, inactive `text-[#6F6F6F] hover:text-[#272220]`.
- A tab needing attention (e.g. "ใกล้ครบกำหนด") gets a small notification dot after its label: a solid `w-1.5 h-1.5 rounded-full bg-[#F50C0C]` with an `animate-ping` ring of the same color stacked behind it.

**Status badges & progress** (`components/projectBoard/statusMeta.ts`) — one color and one label per status, shared identically across every place that status appears (summary cards, table pill, grid card, progress fill):

| Status | Dot / icon / pill text | Pill background | Icon |
|---|---|---|---|
| กำลังดำเนินการ (in progress) | `#0017C1` | `#DBEAFE` | `Clock` |
| เสร็จสิ้น (completed) | `#197A4B` | `#DCFCE7` | `CheckCircle2` |
| พัก (on hold) | `#FFB03D` | `#FEF3C7` | `PauseCircle` |
| ยกเลิก (cancelled) | `#FF2A04` | `#FEE2E2` | `Ban` |
| ร่าง (draft) | `#7B818A` | `#F1F5F9` | `FileText` |

Pill text reuses the dot color verbatim — a deliberate brand-consistency call for small badge text (trades away some WCAG AA contrast on the lighter hues), not something to copy for body copy.

A separate 5-way scale (`TASK_STATUS_LABEL`/`TASK_STATUS_COLOR`) covers task-level status inside a project's detail view — ยังไม่เริ่ม `#94A3B8`, กำลังทำ `#FF6537`, รอตรวจ `#0EA5E9`, ติดปัญหา `#F50C0C`, เสร็จแล้ว `#197A4B`.

- Status pill: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium`, the status's icon (`size={12}`) leading the label.
- Summary card (`StatusSummaryCards.tsx`): `p-5 rounded-2xl border shadow flex items-center gap-4` — a tinted icon square left, label/count stacked right.
- Left-edge accent bar (table rows only): reserved for urgency alone — solid `#F50C0C`, `w-1.5 h-9 rounded-full`, shown only when a row is due within 2 days or overdue.

**Project card** (`ProjectCard.tsx`, grid view) — title + one-line description, an SVG donut `ProgressRing` (not a bar) colored by the status dot, a `Calendar`-icon due-date row paired with budget, and a footer row: an initials avatar on the left, a bordered "ดูรายละเอียด" button on the right. Status shows only as a small dot top-right of the title here — no pill/label, unlike the table.

**Org-chart tree connectors** (`OrgChart.tsx`'s `ForkRow`) — a reusable "one parent, N children" branch: a horizontal bar forks into one vertical drop per child, trimmed so it never overhangs past the outermost child (each half-border extends exactly half the gap past its own child's edge to meet its neighbor's — precise for fixed-width boxes via a computed pixel/fraction inset, and for the variable-width member chips via a fixed `6px` extension into the `gap-3` between them). Every connector segment in the whole chart is the same `h-6` (24px) length, whether it's company→division, division→section, or box→member-chips, so the hierarchy reads as visually uniform regardless of level.

**Empty states**
Centered PNG illustration (`w-62.5 h-62.5`) + muted text (`text-sm text-[#6F6F6F]`) + primary orange `+` button. The Reports page placeholder uses a simpler lucide-icon variant of the same idea: `FileOutput` at 40px/`opacity-40`, centered, with `ระบบออกรายงานอยู่ระหว่างการพัฒนา` underneath — a "not built yet" state, not a true empty state.

**Cards**
- Shadow: `shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]`.
- Hover (interactive cards): `hover:-translate-y-1 hover:shadow-lg`, `transition-all duration-200`.

**Pagination**
`w-9 h-9 lg:w-8 lg:h-8 rounded-lg`; active page `bg-[#FF6537] text-white shadow-sm`; inactive `bg-white border border-slate-200 hover:bg-slate-50`; disabled prev/next `text-slate-300`.

**Toasts** (create/edit success, undo-delete)
`fixed bottom-6 right-6`, `bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5`; action link colored `#FF9776`.

## Icons

- **lucide-react** covers generic UI icons throughout: `Bell, LogOut, ChevronDown, ChevronRight, Menu, X, Eye, EyeOff, Copy, Plus, Check, Pencil, Trash2, Folder, FolderPlus, Filter, Users2, Crown`, etc.
- **Status icons** (Project Board): `Clock, CheckCircle2, PauseCircle, Ban, FileText` — see Status badges above.
- **Org chart edit-mode icons**: `Pencil` (rename, small circular button top-left of a box), `Trash2` (delete, top-right — click once arms a small inline "ลบ?" confirm instead of opening a modal), `Plus` (add division/section, dashed-border button), `ZoomIn/ZoomOut/Maximize2` (the pan/zoom canvas's floating controls, bottom-right).
- **Custom PNGs** under `images/`: search icon (`images/icon/Search pass.png`), empty-state illustrations, row action icons (`images/icon menu/edit.png`, `delete.png`), the header/mobile logo (`images/pp.png`), Login's logo (`src/assets/logo.png`).
- **Sidebar nav icons** (`images/new side bar/*.png`) use a 3-state swap per item — default / hover / active PNG, cross-faded by opacity depending on route and hover state. The one nav item without a matching PNG set (จัดการพนักงาน) falls back to a plain lucide `Users` icon colored via the parent `Link`'s text color, same as every other item.

## Interaction Conventions

- Standard hover backgrounds: `hover:bg-slate-50`, `hover:bg-orange-50`, `hover:bg-slate-100`.
- Sidebar active item: an animated pill (`motion.div layoutId="sidebar-active-pill"`, spring transition) in `#FF6537`; inactive-hover shows `rgba(255,91,38,0.1)`.
- **Double-click to open** (Doc Vault): single click does nothing; double-click on a card/row opens it — folders navigate in, links open in a new tab, files/other kinds open the preview modal. Menu buttons (`...`) stop click/double-click propagation.
- **Drag-and-drop** (Doc Vault): the dragged item gets `opacity-40`; a valid drop-target folder gets `bg-orange-50 outline outline-2 outline-[#FF6537] -outline-offset-2`. Dragging OS files over the page shows a full-screen dashed dropzone overlay.
- **Two-step inline delete confirm** (org chart's division/section delete): clicking the trash icon once "arms" it — the icon swaps for a small `ลบ?` / `✕` pair in place, no modal; clicking `ลบ?` commits, `✕` or anything else cancels. Used instead of a confirmation modal because these deletes happen from many small, repeated icon buttons scattered across the chart.
- **Pan & zoom canvas** (org chart): drag anywhere on the canvas background to pan; mouse-wheel (or the floating `+`/`−`/fit-to-view buttons, bottom-right) to zoom, centered on the cursor. The wheel listener is attached natively via `useEffect` + `addEventListener(..., { passive: false })` rather than React's JSX `onWheel` — React treats `onWheel` as passive by default, which makes `preventDefault()` inside it silently do nothing, so without the native listener the browser's own page-scroll fires *at the same time* as the zoom; enough accumulated scroll lands the page on blank space with nothing rendered there, which reads exactly like a white-screen crash even though nothing actually broke. Pan is additionally clamped to ±3000px per axis as a second safety net against getting lost far off-canvas.

## Layout Structure

- Shell: `Sidebar` + a column of `Header` + `<main>`, inside `h-dvh overflow-hidden bg-[#F6F6F6] flex gap-1`.
- Header: `h-16 sm:h-20`, `bg-[#F6F6F6]`, sticky (`sticky top-0 z-40`), padding `px-4 sm:px-6 lg:px-8`. Title/subtitle sit `lg:items-start lg:pt-7` against the header's own vertical center — this stays unconditional even on pages that swap the subtitle for a breadcrumb.
- Sidebar (desktop): floating rounded panel, `w-60` expanded / `w-21.25` collapsed (collapsed state persisted to `localStorage`, default collapsed only on 1024–1279px viewports), `bg-[#000000] rounded-3xl shadow-[3px_0px_20px_rgba(0,0,0,0.5)] my-4 ml-4`.
- Main content padding: `p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-4`.
- **Breadcrumb-as-subtitle**: on the Tasks page (inside a project's detail view) and the Docs page (inside a folder), the Header's subtitle line is replaced by a clickable breadcrumb (`จัดการงานและโครงการ > Grow store`, `เอกสาร Drive > Grow Store`) instead of the page's normal static subtitle — the title itself stays put (or, for Tasks specifically, is cleared so the breadcrumb renders at the larger `text-[28px]` "no title" size). A trail deeper than 2 folders collapses to `••• > secondToLast > last`, with `•••` opening a small dropdown to the root and the one hidden folder just before the shown segments.
- A single `TaskModal` (the older, non-Project-Board quick-add-task form) is mounted globally in `AppLayout`, controlled by `AppDataContext`'s `isTaskModalOpen`/`openAddTaskModal` — currently only triggered from the (undocumented-here) Dashboard page.

## Login (`components/Login.tsx`)

Full-bleed `bg-black` screen — the only page in the app that isn't inside the Sidebar/Header shell.

**First-visit splash choreography** (skipped on every subsequent visit within the same browser tab, gated by `sessionStorage.unityspace_intro_seen`, and skipped entirely under `prefers-reduced-motion`):
1. **Logo** (`logo` phase, ~1.3s) — the mark fades/scales in centered, with a soft breathing `blur-2xl` orange glow behind it (`opacity`/`scale` looping).
2. **Brand** (`brand` phase, ~1.3s more) — "**Wong** Workpath" (orange/white split) plus the Thai subtitle stagger in underneath the logo; the logo+brand group is always mounted (never unmounted) so its height is reserved from frame one and the two never visibly jump when the text arrives.
3. **Form** (`form` phase) — the logo+brand group scales down slightly (`scale: 0.9`, spring) and the white card (previously height-collapsed to `0` so it reserved no layout space) grows to its real height, pushing the group up into its final position via ordinary browser reflow — not a hand-tuned position/transform, so it can't drift out of sync with the card's real size on any viewport.

**Login card**: white `rounded-2xl shadow-xl min-h-90`, fields stagger in (`FIELD_STAGGER`/`FIELD_ITEM`, 0.08s apart) once the form phase starts. "ยินดีต้อนรับ" (`text-3xl font-extrabold text-[#FF6537]`) + subtitle, username + password (with an animated eye-icon toggle that cross-fades/tilts between states rather than a hard swap), "จดจำรหัสผ่าน" checkbox + "ลืมรหัสผ่าน?" link, full-width submit button (`bg-[#FF6537]`, disabled state `bg-[#F68C6C]`) that also gets an imperative `scale` pop the instant the form becomes fillable (separate from its own mount animation, driven by `useAnimate` so it doesn't fight the declarative entrance). A shake animation (`shake-login` class, 300ms) plays on a rejected login.

**Forgot-password flow** (`forgot` → `otp` → `reset` views, same card shell, all UI-only/mocked): email entry → 6-digit OTP (auto-advancing inputs, 59s resend cooldown) → new password + confirm → success banner back on the login view. Each view has its own `ChevronLeft` back button and its own `useAnimate` scope for Enter-key submit feedback (since `whileTap` only fires for an actual pointer press).

**Loading view**: a brief `รอสักครู่...` + three-dot bounce (`LoadingDots`) between a successful credential check and actually calling `onLogin`.

Footer: `© 2026 Wong Workpath · Version 1.0.0`, same height-collapse-during-intro treatment as the card.

## Employee Management (`/employees`, admin-only)

Three segmented tabs: **รายชื่อพนักงาน** / **โครงสร้างองค์กร** / **บันทึกกิจกรรม (Log)**.

### รายชื่อพนักงาน (employee list)
Standard toolbar (search + department filter + grid/list toggle + "+ เพิ่มพนักงานใหม่"). Grid view: cards with avatar, name/nickname, Admin crown badge, department tag, role/username/email rows. List view: a table with the same columns, `max-height` measured live off the DOM (`getBoundingClientRect` + `resize` listener) rather than a hardcoded `calc()`, so its bottom edge always lines up with the sidebar's regardless of how tall the sticky toolbar above it happens to wrap at a given viewport width.

**Add/Edit modal** fields, in order: ชื่อ-นามสกุล, ชื่อเล่น, อีเมล, Username + รหัสผ่านเริ่มต้น, ตำแหน่ง (a picker built from every role already in use, plus a "+ เพิ่มตำแหน่งใหม่" free-text escape hatch), **ฝ่าย** (division — ordered exactly as the org chart), **แผนก** (section — cascades to only that division's sections, resetting to its first section whenever ฝ่าย changes), ตั้งเป็น Admin. Department/division are required; an employee's stale pre-migration department value (e.g. a legacy "IT") that no longer matches any real section falls back to that division's first section on next edit rather than showing a broken value.

### โครงสร้างองค์กร (org chart)
A `bg-[#272220]` company-name box at the root, forking (`ForkRow`) into one box per division (`w-56 h-16`, `border-2 border-[#FF6537]`, text `line-clamp-2`), each forking again into that division's sections (`w-40 h-16`, `bg-[#F4F4F5]`). Real employees attach as small avatar+name+role chips (`MemberChip`) below whichever box `resolveOrgPlacement` places them at — division-level ("general") or a specific section — each with its own connecting line rather than one shared line feeding a row of chips (`MemberFork`, using the same half-border-extension trick as `ForkRow` but sized to each chip's actual rendered width). An "IT-role" rule (`isItSectionRole` — role text containing dev/ui/ux/admin/programmer) always resolves to whichever section's name contains "เทคโนโลยี" + "ไอที", found by live lookup rather than a hardcoded reference, so it keeps working even if that section gets renamed. Employees who don't resolve to any live division land in a "ยังไม่ระบุฝ่าย" bucket below the whole chart.

**Structure editing** — the whole โครงสร้างองค์กร dataset (`AppDataContext`'s `orgDivisions`, persisted to `localStorage`, seeded from `data/orgStructure.ts`'s `DEFAULT_ORG_DIVISIONS`) is admin-editable in place:
- A **"แก้ไขโครงสร้าง"** toggle (top-right) reveals small `Pencil`/`Trash2` icon buttons on every division/section box, plus dashed "+ เพิ่มแผนก" buttons per division and a "+ เพิ่มฝ่าย" button in the toolbar.
- Rename/add both use one small reusable `NamePromptModal` (single text field).
- Delete uses the two-step inline confirm described under Interaction Conventions, and warns in its tooltip when a division still has employees attached (`มีพนักงาน N คนในฝ่ายนี้`) — deleting doesn't touch those employee records, they just fall into the unassigned bucket.
- Renaming cascades: every employee currently pointing at the old division/section name gets updated to the new one automatically, so a rename never silently orphans anyone.
- A **"ทุกฝ่าย" filter dropdown** (top-left) narrows the chart to a single division.
- The whole chart sits in a **pan/zoom canvas** (see Interaction Conventions) — a fixed `h-140` viewport (`bg-[#FAFAFA]`) with `+`/`−`/fit-to-view controls floating bottom-right, letting a wide multi-division chart be navigated like a diagram (draw.io-style) instead of only scrolling.
- Since the structure is now dynamic, the server no longer validates `division`/`department` against a fixed whitelist (`server/routes/employees.ts`) — any non-empty string is accepted, and every department/team picker elsewhere in the app (Task, Doc Vault, Credential Vault, Employee filters) reads the live list via `useAppData().orgSections` rather than a static import, so a renamed/added section shows up everywhere immediately.

### บันทึกกิจกรรม (Log)
A filterable table (date, department, action) of every `AuditLog` entry — same table/sticky-header/measured-height treatment as the employee list.

## Task & Project Management — "จัดการงานและโครงการ" (`/tasks`, `components/projectBoard/`)

The Project Board (`ProjectBoard.tsx`), not the older flat `TaskListView`. Toolbar (search + list/grid toggle + "+ สร้างโครงการใหม่") → result count + sort menu → `StatusSummaryCards` → `ProjectFilterTabs` (all / per-status / ใกล้ครบกำหนด with the attention-dot) → `ProjectTable` or a `ProjectCard` grid, animated per-filter-change (`AnimatePresence mode="wait"`, fade+slide).

Project rows are real, DB-backed data (`project` table via `server/routes/projects.ts`, loaded into `AppDataContext.projects` and created through `handleAddProject`) — creating a project persists a real row with a server-generated id and sequential "PRJ-NNN" code. The owner field is a real `ownerEmployeeId` FK resolved against the live employee roster (name/role/avatar), not free text. Project-tasks and meetings remain local/mock for now (later phases of the same migration).

**CreateProjectModal** — 3-step wizard (กำหนดชื่อ → ขอบเขตงาน → สำเร็จ), see the wizard pattern under Shared Components. Step 1: ชื่อ, ระยะโครงการ (short/long/special pill toggle), รายละเอียด. Step 2 (skippable): ผู้รับผิดชอบหลัก (searchable single-select with avatar+role rows), ระดับความสำคัญ, สถานะ, ผู้รับผิดชอบร่วม (searchable multi-select, removable avatar chips), start/end dates, optional folder-creation checkbox. Step 3: read-only summary grouped into two `SummarySection` cards, each with a "แก้ไข" link back to its step.

**ProjectDetail** (opened via "ดูรายละเอียด"; replaces the board in place, with the Header showing a `จัดการงานและโครงการ > {title}` breadcrumb):
- Progress overview card with an overall completion bar and a "ผู้รับผิดชอบหลัก" meta grid (this label — not "หัวหน้าโครงการ" — matches the org chart's own wording for the same concept).
- Four tabs — ภาพรวม / งาน / ทีม / Timeline — sharing one status filter (`Filter` icon + `<select>`) so the same "which tasks am I looking at" choice applies everywhere:
  - **ภาพรวม**: a single full-width "งานทั้งหมดของโครงการ" table (all filtered tasks, no slice/limit).
  - **งาน**: only the current user's own tasks, columns สถานะ/ชื่องาน/ระยะเวลา/ความคืบหน้า/ความสำคัญ/การกระทำ (an `Eye`-icon "ดูรายละเอียด" opens `TaskDetailModal`).
  - **ทีม**: an org-chart-style view of who's assigned to what in *this project* (avatar, role, their task list with dates) — a smaller, project-scoped cousin of the Employee Management org chart, not the same component.
  - **Timeline**: `ProjectGantt` — a real Gantt bar chart (parses the mock tasks' pre-formatted Thai dates back into real `Date`s, draws a 5-tick date-axis header, one row per task with a positioned/sized colored bar + progress-fill overlay + assignee avatar under the task title).
- **AddTaskModal** ("+ เพิ่มงาน"): ชื่องาน, รายละเอียด, ใครเป็นคนสร้าง (read-only, = current user), ใครรับผิดชอบ (searchable select), ระดับความสำคัญ (optional), ระยะเวลา (start+due), and an optional "สร้างโฟลเดอร์เอกสารใน 'เอกสาร Drive'" checkbox that — like the project wizard's — genuinely creates a folder in the shared Doc Vault even though the task itself is still local/mock state.
- **TaskDetailModal**: read-only — status/urgency pills, full description, progress bar, assignee/creator rows, ระยะเวลา, priority pill, legacy checklist items if present.

## Doc Vault ("เอกสาร Drive", `/docs`)

Toolbar (search + kind filter + scope filter + grid/list toggle + "สร้าง / อัปโหลด" dropdown: สร้างโฟลเดอร์ / อัปโหลดไฟล์ / แนบลิงก์) → result count + sort → folder/file/link grid or table. Grid cards are a fixed `h-64` so every card is the same size regardless of content; a "ทีม"-scoped item shows its department tag (see Department/Section Tag Colors) or, once you're inside a folder, that folder's own scope/team is inherited silently rather than asked again. Preview modal (bigger `bg-black/40` backdrop) renders PDFs/images inline with a download/open fallback for anything else; double-click opens, single click does nothing (see Interaction Conventions).

## Credential Vault ("คลังรหัสผ่าน", `/vault`)

Same toolbar/list shape as Doc Vault (search + type/scope filter + grid/list toggle + "+" add). Scope is ส่วนตัว or ทีม; a ทีม-scoped credential is auto-tagged with the creator's own department and only visible to others in that same department (`item.team === currentUserDepartment`). No separate PIN/master-password gate exists in the current code — access is gated by the normal app login only (an earlier local-encryption design is documented in git history/CLAUDE.md but isn't present in `src/` anymore).

## Reports ("การออกรายงาน", `/reports`)

Not yet built — a single centered placeholder card (`FileOutput` icon + "ระบบออกรายงานอยู่ระหว่างการพัฒนา").

## Dashboard ("แดชบอร์ด", `/dashboard`)

Sticky toolbar (project picker +, for executive accounts only, a department filter) → a 4-up `StatCard` row (`components/dashboard/StatCard.tsx` — `bg-white p-5 rounded-2xl border border-slate-100` + the standard card shadow, label/value/detail stacked left, a plain solid-colored icon at `size={32}` right, no tinted background square) → a summary table + status donut sharing one row (table two-thirds, donut one-third) → "งานของฉันที่ใกล้ครบกำหนด" (my upcoming tasks) list. Switches from project-scoped to task-scoped the moment the toolbar filters down to one project (`ProjectSummaryTable`/`StatusDistributionChart` swap for `TaskSummaryTable`/`TaskStatusDistributionChart`). Non-executive roles default to `isResponsibleForProject` scoping; executives see the whole company by default. `StatCard` is the shared component MyWorkspace's own stat row also reuses — never fork a local variant of it.

## ปฏิทินและตารางเวลา (Calendar, `/calendar`)

Left rail (นัดประชุม button, เฉพาะของฉัน/ภาพรวมทั้งบริษัท segmented toggle, ตัวกรองปฏิทิน filter list, department dropdown, upcoming list) + a month-grid calendar card on the right. Both the scope toggle and the filter list use the standard segmented-tab treatment (`bg-white border border-slate-200 rounded-xl p-1` track, `h-8` buttons, active `bg-[#FF6537] text-white`) — same pattern as `ProjectFilterTabs`/`MyWorkspace`'s own `TABS` row, not a one-off. Day cells show up to 2 event chips (`rounded-lg`, `text-[9px]`, colored via each item's own hex token — `TASK_STATUS_COLOR` for tasks, purple for meetings [a real, consistently-used app convention though not a formally named token], `STATUS_DOT` for project deadlines) plus a combined "+N" overflow indicator; clicking a day with anything on it opens a `rounded-2xl` popover (title + `X size={18}` close, matching the standard Modal header row) listing every item in full, grouped งาน / การประชุม / ครบกำหนดโครงการ, each with a `rounded-lg` icon-square avatar. A status legend along the bottom uses `rounded-full` dots. Meeting cancel is reason-required (`CancelMeetingModal`); a past meeting has no cancel affordance.

## งานของฉัน (MyWorkspace, `/gantt`)

A 4-up `StatCard` row (reusing `components/dashboard/StatCard.tsx` — do not fork a local copy) → a 5-tab segmented row (งานของฉัน / งานที่ต้องตรวจ / รออนุมัติจากฉัน / โครงการของฉัน / Gantt ของฉัน, standard `bg-white border border-slate-200 rounded-xl p-1` track) → the active tab's table or panel. Tables (งานของฉัน, โครงการของฉัน) match `ProjectTable.tsx`'s exact styling byte-for-byte (`bg-[#F9F9F9]` header, `hover:bg-slate-50` rows, `h-2 rounded-full bg-[#F0F0F0]` progress bars). "Gantt ของฉัน" embeds `ProjectGantt.tsx` (the same Timeline component `ProjectDetail.tsx` uses for a single project, here fed every project the user is responsible for, with a project-name sub-label under each task's title when tasks span more than one project) — its วัน/เดือน/ปี zoom toggle is the same standard segmented-tab treatment as everywhere else in the app (`bg-white border border-slate-200 rounded-xl p-1`, `h-8` buttons), not a scaled-down variant.
