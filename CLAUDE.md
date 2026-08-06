# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev       # Vite dev server on port 3000 (host 0.0.0.0)
npm run build     # production build via Vite
npm run preview   # preview the production build
npm run lint      # tsc --noEmit (type-check only, no separate linter)
npm run clean     # rm -rf dist server.js
```

There is no test runner configured in this project (no Jest/Vitest/Playwright test suite, no `test` script). Treat `npm run lint` (`tsc --noEmit`) as the primary automated correctness check after changes.

## Architecture

This is a React 19 + TypeScript + Vite + Tailwind CSS v4 SPA ("Wong Workpath" — internal `unityspace_*` localStorage key prefixes and audit-log strings still reference the original "UnitySpace" name), an internal project/task management + credential-vault tool. Tailwind v4 is wired via `@tailwindcss/vite` with no `tailwind.config.*` — theme tokens live in `src/index.css` under `@theme`.

**Routing is `react-router-dom` v7**, mounted via `<BrowserRouter>` in `src/main.tsx`. `src/App.tsx` defines all routes: `/login` (public), and `/dashboard`, `/tasks`, `/gantt`, `/calendar`, `/docs`, `/reports`, `/vault` behind a `ProtectedLayoutRoute` that redirects to `/login` when `currentUser` is null. Each route renders a thin page component in `src/pages/*.tsx` that pulls data/handlers from `useAppData()` and passes them as props into the matching presentational component in `src/components/`.

**All app state lives in `src/context/AppDataContext.tsx`**, exposed via the `useAppData()` hook (`AppDataProvider` wraps the router in `App.tsx`). There is no other state library. It owns: auth (`currentUser`), every domain slice (employees, tasks, documents, credentials, leave requests, notifications, audit logs), and the task-modal open/edit state — plus all the mutation handlers (`handleSaveTask`, `handleAddCredential`, etc.).

**Persistence is localStorage, not a backend.** On mount, `AppDataContext` reads each domain slice from `localStorage` (keys prefixed `unityspace_*`, e.g. `unityspace_tasks`, `unityspace_employees`) and falls back to seed data in `src/data/mockData.ts` if nothing is stored yet. Every mutation goes through a `saveX` helper (`saveTasks`, `saveDocs`, `saveCredentials`, `saveLeaves`, `saveNotifications`) that updates state and writes straight back to the same `localStorage` key in one step — there is no server/API layer despite `express` and `@google/genai` appearing in `package.json` (leftovers from the original AI Studio template scaffold; neither is actually imported anywhere in `src/`).

**Auth is a mock login, not real authentication.** `src/components/Login.tsx` matches the entered email against the `employees` array from mock data (any password is accepted) and drives a UI-only forgot-password/OTP flow. The logged-in user id is persisted to `localStorage` (`unityspace_current_user_id`) and restored by `AppDataContext` on reload (gated by `isRestoringSession` so routes don't flash the login page).

**`CredentialVault` (คลังรหัสพนักงาน, the `/vault` route) has a second, independent auth gate on top of the main login**: a 4-digit PIN, hashed client-side and stored in `localStorage` (`master_password_hash`), that must be set up once and re-entered to unlock the credential list each time the tab is (re)mounted. Secrets are encrypted with the PIN itself as the key via `src/utils/crypto.ts` (`encryptValue`/`decryptValue`/`getSimpleHash`) — this is a simulated/cosmetic XOR-with-hashed-key cipher, not real AES-256; don't treat it as a real security boundary. Because the PIN doubles as the encryption key, resetting a forgotten PIN does not recover previously-encrypted secrets. `decryptValue` throws on anything that isn't valid ciphertext, so callers fall back to the raw stored value for legacy/never-encrypted records.

**Two different icon sources are mixed in the nav.** Most icons come from `lucide-react`, but the 7 sidebar menu items (`NAV_ITEMS` in `src/components/layout/Sidebar.tsx`) use paired active/inactive PNGs from `images/icon menu/` at the repo root, swapped based on the current route and hover state. Brand assets (logo, favicon) also live in the root `images/` directory, not `src/assets/`.

**Path alias**: `@/*` resolves to the project root (not `src/`), configured in both `tsconfig.json` and `vite.config.ts`.

**`vite.config.ts` has AI-Studio-specific HMR handling** (`DISABLE_HMR` env var toggles `server.hmr`/`server.watch` off) to avoid flicker while an agent is editing files in that environment — don't remove this without checking the deployment context.

### Code layout

- `src/pages/*.tsx` — one thin route-level wrapper per tab; connects `useAppData()` to the corresponding component in `src/components/`.
- `src/components/layout/` — `AppLayout` (Header + Sidebar + `<Outlet>` + the global `TaskModal`), `Header`, `Sidebar`.
- `src/components/*.tsx` — one presentational component per top-level tab (`Dashboard`, `TaskListView`, `GanttChart`, `CalendarView`, `DocVault`, `CredentialVault`), plus `Login` and `TaskModal`.
- `src/components/dashboard/*.tsx` — smaller presentational pieces composed inside `Dashboard.tsx` only.
- `src/context/AppDataContext.tsx` — all app state, localStorage sync, and audit logging (see Architecture above).
- `src/data/mockData.ts` — seed data for every domain type in `src/types.ts` (Employee, Task, LinkedDoc, CredentialItem, LeaveRequest, Notification).
- `src/types.ts` — the shared domain model; all components consume these types rather than defining their own.
