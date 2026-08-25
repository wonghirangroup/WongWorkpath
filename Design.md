# Design.md

Design system reference for **Wong Workpath**, extracted from what's actually implemented in `src/`. This documents current usage — it isn't a spec to enforce, it's a reference to stay consistent with when adding new UI.

## Brand & Color Palette

### Primary (orange)
| Hex | Use |
|---|---|
| `#FF6537` | Primary brand orange — buttons, active nav pill, focus borders, links, accents |
| `#E04D1D` | Primary hover (Login submit button) |
| `#e6572c` | Primary hover, alt (modal submit buttons) |
| `#F68C6C` | Disabled/inactive state of the primary button (form invalid) |
| `#f4622f` | Orange variant — logout text, mobile active nav background |
| `#FF9776` | Toast action-link color (light orange on a dark toast) |
| `#FFF1EC` | Selected dropdown-option tint / fallback badge background |
| `#FFF8F5` | Drag-and-drop dropzone background |
| `#FEFAF9` | Dropdown option hover tint |

### Text
| Hex | Use |
|---|---|
| `#000000` | Page title (h1) |
| `#272220` | Primary body text / headings |
| `#515151` | Subtitle / breadcrumb muted text |
| `#6F6F6F` | Secondary/muted text (meta, labels, inactive nav) |
| `#A0A0A0` | Tertiary muted text (role line) |
| `#B0B0B0` | Input placeholder text |

### Surfaces & borders
| Hex | Use |
|---|---|
| `#FFFFFF` | Page/app background |
| `#F6F6F8` | Search input background |
| `#F4F4F5` | Grid/list view-toggle pill background |
| `#F9F9F9` | Table header background |
| `#EDEEEF` | Card/table hairline borders |
| `#E5E5E5` | Modal form-input border |
| `#BAB7B7` | Dropdown trigger border |
| `#666666` | Divider lines |
| `#1c1c1e` | Mobile nav drawer background |
| `#FF4E4E` | Sidebar logout icon |

### Avatar fallback palette
Hashed per-label (not semantic) for initials avatars:
```
['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6']
```

## Department / Team Tag Colors

Defined identically in `CredentialVault.tsx` and `DocVault.tsx` as `DEPARTMENT_TAG_COLORS`:

| Department | Classes |
|---|---|
| IT | `text-blue-700 bg-blue-100` |
| HR | `text-fuchsia-700 bg-fuchsia-100` |
| Marketing | `text-orange-700 bg-orange-100` |
| Sales | `text-emerald-700 bg-emerald-100` |
| Design | `text-purple-700 bg-purple-100` |
| Finance | `text-slate-700 bg-slate-200` |

Fallback (scope is "ทีม" but no department chosen, DocVault only): `text-[#FF6537] bg-[#FFF1EC]`.

## Typography

Font: `Kanit` (`--font-sans` in `src/index.css`), applied via `font-sans` on the app root. Falls back to `ui-sans-serif, system-ui, sans-serif`.

| Role | Classes |
|---|---|
| Page title (h1) | `text-[32px] font-bold text-[#000000]` |
| Section subtitle | `text-[20px] font-normal text-[#515151]` |
| Login brand heading | `text-4xl font-semibold` |
| Login card heading | `text-3xl font-extrabold text-[#FF6537]` |
| Card title (grid card) | `text-[15px] font-bold text-[#272220]` |
| Modal title | `text-sm font-bold text-slate-800` |
| Form field label | `text-[11px] font-bold text-[#272220]` |
| Form input text | `text-sm` |
| Body / table cell text | `text-[12px] font-medium` – `text-[13px]` |
| Helper / meta text (created-by, date) | `text-[11px] font-normal text-[#6F6F6F]` |
| Result count text | `text-[16px] font-normal text-[#6F6F6F]` |
| Badge / tag text | `text-[9px] font-semibold` |

## Spacing & Radius

| Element | Radius |
|---|---|
| Cards (grid item) | `rounded-2xl` |
| Modals | `rounded-2xl` |
| Buttons, inputs, dropdown trigger | `rounded-xl` |
| Small inline elements (dropdown option, menu item) | `rounded-lg` |
| Badges, pills, avatars | `rounded-full` |
| Sidebar shell | `rounded-3xl` |

Common padding: `p-4` (card), `p-2.5` (input), `px-4 py-3` (Login input), `px-5 pt-5 pb-2` (modal header), `px-3.5 py-2` (dropdown option), `px-4 py-3` (table cell).

## Components

**Dropdown** (`components/Dropdown.tsx`) — the one shared filter/select control, used by both vault pages.
- Two sizes: `compact` (`h-10`, `text-[13px]`) for toolbar filter rows, `cozy` (`h-11`, `text-base`) for modal form fields.
- Border `#BAB7B7`, focus border `#FF6537`.
- Open state: trigger flattens to `rounded-t-xl rounded-b-none`; the floating panel is `rounded-t-none rounded-b-2xl shadow-xl`.
- Highlighted (keyboard-navigated) row: `bg-[#FF6537] text-white font-semibold`. Selected-but-not-highlighted: `bg-[#FFF1EC]`.

**Modals**
- `fixed inset-0 z-50 flex items-center justify-center`.
- Backdrop: `bg-black/15 backdrop-blur-sm` for create/edit forms, `bg-black/40 backdrop-blur-sm` for the larger doc-preview modal.
- Box: `rounded-2xl shadow-2xl`, `max-w-md` or `max-w-sm`, `max-h-[85vh]`.
- Header row: title + `X` close icon (lucide, size 18), `border-b border-slate-100`.
- Entrance animation via `motion/react` (spring, `stiffness: 300, damping: 24`).

**Toolbar / filter row** (both vault pages use this exact shape)
- Search input: `h-10 pl-9 pr-9 bg-[#F6F6F8]`, custom PNG search icon absolute-positioned left, clear `X` button right.
- Grid/list view toggle: `bg-[#F4F4F5] rounded-xl p-1`, active state `bg-white shadow-sm`.
- Filter `Dropdown`s (kind/scope/team) follow the search input.
- Primary `+` action button (`bg-[#FF6537] rounded-xl`) is right-aligned via `lg:ml-auto`.

**Empty states**
Centered PNG illustration (`w-62.5 h-62.5`) + muted text (`text-sm text-[#6F6F6F]`) + primary orange `+` button.

**Cards**
- Shadow: `shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]`.
- Hover: `hover:-translate-y-1 hover:shadow-lg`, `transition-all duration-200`.
- DocVault grid cards are a fixed `h-64` so every card (folder/file/image/link) is the same size regardless of content. CredentialVault grid cards are auto-height.

**Pagination**
`w-9 h-9 lg:w-8 lg:h-8 rounded-lg`; active page `bg-[#FF6537] text-white shadow-sm`; inactive `bg-white border border-slate-200 hover:bg-slate-50`; disabled prev/next `text-slate-300`.

**Toasts** (create/edit success, undo-delete)
`fixed bottom-6 right-6`, `bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5`; action link colored `#FF9776`.

## Icons

- **lucide-react** covers generic UI icons: `Bell, LogOut, ChevronDown, Menu, X, Eye, EyeOff, Copy, Plus, Check, Folder, FolderPlus, Upload, FileText, FileSpreadsheet, Image, Monitor, Archive, Printer, Download, ZoomIn, ZoomOut, ExternalLink, Link2, Home`, etc.
- **Custom PNGs** under `images/`: search icon (`images/icon/Search pass.png`), empty-state illustrations (`images/frist create pass icon.png`, `images/frist create doc icon.png`), row action icons (`images/icon menu/edit.png`, `delete.png`), the header/mobile logo (`images/pp.png`), and the user avatar (`images/profiles.png`).
- **Sidebar nav icons** (`images/new side bar/*.png`) use a 3-state swap per item — default / hover / active PNG, cross-faded by opacity depending on route and hover state — rather than a single recolored icon.

## Interaction Conventions

- Standard hover backgrounds: `hover:bg-slate-50`, `hover:bg-orange-50`, `hover:bg-slate-100`.
- Sidebar active item: an animated pill (`motion.div layoutId="sidebar-active-pill"`, spring transition) in `#FF6537`; inactive-hover shows `rgba(255,91,38,0.1)`.
- **Double-click to open** (Docs Drive): single click does nothing; double-click on a card/row opens it — folders navigate in, links open in a new tab, files/other kinds open the preview modal. Menu buttons (`...`) stop click/double-click propagation so they don't trigger the row's open action.
- **Drag-and-drop**: the dragged item gets `opacity-40`; a valid drop-target folder gets `bg-orange-50 outline outline-2 outline-[#FF6537] -outline-offset-2`. Dragging OS files over the page shows a full-screen dashed dropzone overlay (`border-2 border-dashed border-[#FF6537]`, `bg-white/80 backdrop-blur-[1px]`).

## Layout Structure

- Shell: `Sidebar` + a column of `Header` + `<main>`, inside `h-dvh overflow-hidden bg-[#FFFFFF] flex gap-1`.
- Header: `h-16 sm:h-20`, padding `px-4 sm:px-6 lg:px-8`.
- Sidebar (desktop): floating rounded panel, `w-60` expanded / `w-21.25` collapsed, `bg-[#000000] rounded-3xl shadow-[3px_0px_20px_rgba(0,0,0,0.5)] my-4 ml-4`.
- Main content padding: `p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-4`.
