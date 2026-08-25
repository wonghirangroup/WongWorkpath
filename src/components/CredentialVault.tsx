import React, { useState, useRef, useEffect, useId, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CredentialItem, AuditLog, Department } from '../types';
import Dropdown from './Dropdown';
import {
  Eye,
  EyeOff,
  Copy,
  Plus,
  Check,
  StickyNote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LayoutGrid,
  List,
  X
} from 'lucide-react';
import searchIcon from '../../images/icon/Search pass.png';
import firstCreatePassIcon from '../../images/frist create pass icon.png';
import linkIcon from '../../images/icon menu/linkki.png';
import linkActiveIcon from '../../images/icon menu/linkki active.png';
import editIcon from '../../images/icon menu/edit.png';
import deleteIcon from '../../images/icon menu/delete.png';

// Common services suggested while typing the "ชื่อบริการ" field, auto-filling their site URL
const KNOWN_SERVICES: { name: string; url: string }[] = [
  { name: 'Figma', url: 'https://www.figma.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'GitLab', url: 'https://gitlab.com' },
  { name: 'Google Workspace', url: 'https://workspace.google.com' },
  { name: 'Gmail', url: 'https://mail.google.com' },
  { name: 'Google Drive', url: 'https://drive.google.com' },
  { name: 'Slack', url: 'https://slack.com' },
  { name: 'Notion', url: 'https://www.notion.so' },
  { name: 'Canva', url: 'https://www.canva.com' },
  { name: 'Trello', url: 'https://trello.com' },
  { name: 'Asana', url: 'https://asana.com' },
  { name: 'Jira', url: 'https://www.atlassian.com/software/jira' },
  { name: 'Confluence', url: 'https://www.atlassian.com/software/confluence' },
  { name: 'Zoom', url: 'https://zoom.us' },
  { name: 'Dropbox', url: 'https://www.dropbox.com' },
  { name: 'Microsoft 365', url: 'https://www.microsoft365.com' },
  { name: 'Outlook', url: 'https://outlook.com' },
  { name: 'OneDrive', url: 'https://onedrive.live.com' },
  { name: 'AWS', url: 'https://aws.amazon.com' },
  { name: 'Azure', url: 'https://azure.microsoft.com' },
  { name: 'Vercel', url: 'https://vercel.com' },
  { name: 'Netlify', url: 'https://www.netlify.com' },
  { name: 'Shopify', url: 'https://www.shopify.com' },
  { name: 'WordPress', url: 'https://wordpress.com' },
  { name: 'Cloudflare', url: 'https://www.cloudflare.com' },
  { name: 'DigitalOcean', url: 'https://www.digitalocean.com' },
  { name: 'PayPal', url: 'https://www.paypal.com' },
  { name: 'Stripe', url: 'https://stripe.com' },
  { name: 'LINE', url: 'https://line.me' },
  { name: 'Facebook', url: 'https://www.facebook.com' },
  { name: 'Instagram', url: 'https://www.instagram.com' },
  { name: 'X (Twitter)', url: 'https://x.com' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Discord', url: 'https://discord.com' },
  { name: 'Telegram', url: 'https://telegram.org' },
  { name: 'WhatsApp', url: 'https://www.whatsapp.com' },
  { name: 'Adobe Photoshop', url: 'https://www.adobe.com/products/photoshop.html' },
  { name: 'Adobe Illustrator', url: 'https://www.adobe.com/products/illustrator.html' },
  { name: 'Mailchimp', url: 'https://mailchimp.com' },
  { name: 'HubSpot', url: 'https://www.hubspot.com' },
  { name: 'Salesforce', url: 'https://www.salesforce.com' },
  { name: 'Grow Store', url: 'https://pos.smartjigsaw.net/'},
  { name: 'Netflix', url: 'https://www.netflix.com/th/'}
];

const SCOPE_FILTER_OPTIONS: { value: CredentialItem['scope'] | '__all__'; label: string }[] = [
  { value: '__all__', label: 'รายการทั้งหมด' },
  { value: 'ส่วนตัว', label: 'ส่วนตัว' },
  { value: 'ทีม', label: 'ทีม' }
];

const SORT_OPTIONS: { value: 'latest' | 'oldest' | 'az'; label: string }[] = [
  { value: 'latest', label: 'ล่าสุด' },
  { value: 'oldest', label: 'เก่าสุด' },
  { value: 'az', label: 'ชื่อ A-Z' }
];

const DEPARTMENT_TAG_COLORS: Record<Department, string> = {
  IT: 'text-blue-700 bg-blue-100',
  HR: 'text-fuchsia-700 bg-fuchsia-100',
  Marketing: 'text-orange-700 bg-orange-100',
  Sales: 'text-emerald-700 bg-emerald-100',
  Design: 'text-purple-700 bg-purple-100',
  Finance: 'text-slate-700 bg-slate-200'
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
function getAvatarColor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Matches query characters against target in sequence (not necessarily adjacent), e.g. "fig" matches "Figma".
// Returns a score where lower = better (earlier match start, tighter character span); null = no match.
function fuzzyMatchScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let firstIndex = -1;
  let lastIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstIndex === -1) firstIndex = ti;
      lastIndex = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
  const span = lastIndex - firstIndex + 1;
  return firstIndex * 100 + span;
}

// Appends the next available number (e.g. "Grow Store" -> "Grow Store2") when the desired label
// already matches an existing credential name (case-insensitive), so labels stay unique.
function getUniqueLabel(desiredLabel: string, existingLabels: string[]): string {
  const trimmed = desiredLabel.trim();
  if (!trimmed) return trimmed;

  const lowerExisting = existingLabels.map((l) => l.trim().toLowerCase());
  if (!lowerExisting.includes(trimmed.toLowerCase())) return trimmed;

  let suffix = 2;
  while (lowerExisting.includes(`${trimmed}${suffix}`.toLowerCase())) {
    suffix++;
  }
  return `${trimmed}${suffix}`;
}

function getGoogleFaviconUrl(hostname: string) {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}

// Falls back to Google's favicon cache, then the site's own /favicon.ico, when no manual logo
// is set, so credentials without a logoUrl still show a recognizable icon. `faviconValidByHost`
// is undefined for a host until the background probe (below) resolves — while pending, the
// auto-favicon candidates are deliberately left out entirely (caller falls back to the initials
// avatar) rather than guessing and correcting later, so a real logo only ever appears once,
// already the right one, instead of popping in then getting swapped for a different image.
function getAvatarCandidates(item: CredentialItem, faviconValidByHost: Record<string, boolean>): string[] {
  const candidates: string[] = [];
  if (item.logoUrl) candidates.push(item.logoUrl);
  if (item.url) {
    try {
      const hostname = new URL(item.url).hostname;
      const validity = faviconValidByHost[hostname];
      if (validity === true) candidates.push(getGoogleFaviconUrl(hostname));
      if (validity !== undefined) candidates.push(`https://${hostname}/favicon.ico`);
    } catch {
      // invalid URL — skip the favicon fallbacks
    }
  }
  return candidates;
}

// Formats "2026-06-22 11:15" as the Thai short date "22/6/2569" (Buddhist Era year)
function formatThaiShortDate(dateStr: string) {
  const [datePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  return `${day}/${month}/${year + 543}`;
}

// Per-card "..." menu that drops down to reveal the edit/delete actions, replacing the old
// hover-to-reveal icon pair so the actions are reachable with a single click on touch devices too.
// Portals the dropdown to document.body (positioned from the trigger button's own rect) instead
// of a plain `absolute` child, so it floats above the page instead of getting clipped or scrolled
// by an `overflow: auto` ancestor — e.g. the list-view table's horizontal-scroll wrapper, which
// (per the CSS spec) forces overflow-y to auto too, the same way it did for the Sidebar's own
// scroll container before that got `scrollbar-none`.
function CredentialCardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className="p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
        title="ตัวเลือกเพิ่มเติม"
      >
        <MoreHorizontal size={20} className="text-slate-500" />
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && menuPos && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
              className="w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50"
            >
              <button
                onClick={() => { setIsOpen(false); onEdit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <img src={editIcon} alt="" className="w-4.5 h-4.5" />
                แก้ไข
              </button>
              <button
                onClick={() => { setIsOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <img src={deleteIcon} alt="" className="w-4.5 h-4.5" />
                ลบ
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

interface CredentialVaultProps {
  credentials: CredentialItem[];
  auditLogs: AuditLog[];
  currentUserName: string;
  currentUserDepartment?: Department;
  onAddCredential: (item: CredentialItem) => void;
  onUpdateCredential: (id: string, updates: Partial<CredentialItem>) => void;
  onDeleteCredential: (id: string) => void;
  onLogAudit: (action: string, details: string) => void;
}

export default function CredentialVault({
  credentials,
  auditLogs,
  currentUserName,
  currentUserDepartment,
  onAddCredential,
  onUpdateCredential,
  onDeleteCredential,
  onLogAudit
}: CredentialVaultProps) {

  // Visible Decrypted Credentials State (id -> decrypted value)
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [visibleStates, setVisibleStates] = useState<Record<string, boolean>>({});

  // Search & scope filter for the credential list
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scopeFilter, setScopeFilter] = useState<CredentialItem['scope'] | '__all__'>('__all__');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'az'>('latest');
  const [isResultFilterOpen, setIsResultFilterOpen] = useState(false);
  const resultFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResultFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (resultFilterRef.current && !resultFilterRef.current.contains(e.target as Node)) setIsResultFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isResultFilterOpen]);

  // "/" focuses the search box for power users, unless already typing in a field
  useEffect(() => {
    const handleSlashShortcut = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', handleSlashShortcut);
    return () => document.removeEventListener('keydown', handleSlashShortcut);
  }, []);

  // Pagination — list view fits more rows per page than the taller grid cards do
  const PAGE_SIZE = viewMode === 'list' ? 10 : 4;
  const [currentPage, setCurrentPage] = useState(1);

  // New / Edit Credential Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CredentialItem['type']>('Username & Password');
  const [newScope, setNewScope] = useState<CredentialItem['scope']>('ส่วนตัว');
  const [newUsername, setNewUsername] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isServiceSuggestOpen, setIsServiceSuggestOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [renameNotice, setRenameNotice] = useState('');
  const [createSuccessNotice, setCreateSuccessNotice] = useState(false);
  const [editSuccessNotice, setEditSuccessNotice] = useState(false);
  const serviceSuggestRef = useRef<HTMLDivElement>(null);
  const serviceSuggestListboxId = useId();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serviceSuggestRef.current && !serviceSuggestRef.current.contains(e.target as Node)) {
        setIsServiceSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const serviceSuggestions = (() => {
    const query = newLabel.trim();
    if (!query) return [];

    return KNOWN_SERVICES
      .map((service) => ({ service, score: fuzzyMatchScore(query, service.name) }))
      .filter((entry): entry is { service: typeof KNOWN_SERVICES[number]; score: number } => entry.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map((entry) => entry.service);
  })();

  // Renames to the next available "Name2" when candidateLabel already matches an existing
  // credential, and surfaces the rename notice. Shared by the input's onBlur (manual typing)
  // and selectServiceSuggestion — the latter needs its own call because clicking a suggestion
  // blurs the input (with the old, pre-selection text) before the click handler updates newLabel,
  // so onBlur alone would validate a stale value and silently miss the rename.
  const applyUniqueLabel = (candidateLabel: string) => {
    const existingLabels = credentials
      .filter((c) => c.id !== editingId)
      .map((c) => c.label);
    const uniqueLabel = getUniqueLabel(candidateLabel, existingLabels);
    setNewLabel(uniqueLabel);
    if (uniqueLabel !== candidateLabel.trim()) {
      setRenameNotice(`ชื่อนี้ถูกใช้แล้ว เปลี่ยนเป็น "${uniqueLabel}" ให้อัตโนมัติ`);
      setTimeout(() => setRenameNotice(''), 4000);
    }
  };

  const selectServiceSuggestion = (service: { name: string; url: string }) => {
    setNewUrl(service.url);
    setIsServiceSuggestOpen(false);
    setActiveSuggestionIndex(-1);
    applyUniqueLabel(service.name);
  };

  const handleServiceInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isServiceSuggestOpen || serviceSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % serviceSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev - 1 + serviceSuggestions.length) % serviceSuggestions.length);
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0) {
        e.preventDefault();
        selectServiceSuggestion(serviceSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsServiceSuggestOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };

  // Alert State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tracks progress through each credential's avatar fallback chain (logoUrl -> favicon.ico -> Google cache -> initials)
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState<Record<string, number>>({});

  // Pre-checks each credential's domain against Google's favicon cache (hostname -> has a real
  // favicon indexed) *before* any auto-favicon is shown, so the avatar goes straight from the
  // initials placeholder to the correct final image — never from one logo to a different one.
  // Needed because that endpoint 404s for unindexed domains but still serves a generic
  // placeholder image in the body, so <img onError> alone can't detect a "fake" result — and
  // fetch() can't tell either, since the endpoint sends no CORS headers (every request would
  // come back opaque/rejected, marking even valid domains as invalid). Real favicons come back
  // at the requested 64x64; the generic placeholder is always a fixed 16x16 regardless of the
  // requested size, so loading it as an <img> (no CORS needed just to read dimensions) and
  // checking naturalWidth is a reliable, CORS-safe way to tell them apart.
  const [faviconValidByHost, setFaviconValidByHost] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const hosts = new Set<string>();
    credentials.forEach((item) => {
      if (!item.url) return;
      try {
        hosts.add(new URL(item.url).hostname);
      } catch {
        // invalid URL — nothing to check
      }
    });

    hosts.forEach((hostname) => {
      if (hostname in faviconValidByHost) return;
      const probe = new Image();
      probe.onload = () => {
        setFaviconValidByHost((prev) => (hostname in prev ? prev : { ...prev, [hostname]: probe.naturalWidth >= 32 }));
      };
      probe.onerror = () => {
        setFaviconValidByHost((prev) => (hostname in prev ? prev : { ...prev, [hostname]: false }));
      };
      probe.src = getGoogleFaviconUrl(hostname);
    });
  }, [credentials]);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [undoNotice, setUndoNotice] = useState<{ ids: string[]; label: string } | null>(null);
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleViewCredential = (item: CredentialItem) => {
    if (visibleStates[item.id]) {
      // Toggle off
      setVisibleStates({ ...visibleStates, [item.id]: false });
    } else {
      const rawValue = item.password || item.keyValue || '';

      // Log access audit trail
      onLogAudit('VIEW_SECURE_DATA', `ดูรหัสผ่าน/คีย์ของ "${item.label}" [จัดเป็นความลับระดับแผนก]`);

      setDecryptedValues({
        ...decryptedValues,
        [item.id]: rawValue
      });
      setVisibleStates({ ...visibleStates, [item.id]: true });
    }
  };

  const resetCredentialForm = () => {
    setNewLabel('');
    setNewType('Username & Password');
    setNewScope('ส่วนตัว');
    setNewUsername('');
    setNewKeyValue('');
    setNewNotes('');
    setNewUrl('');
    setNewLogoUrl('');
    setShowFormPassword(false);
    setRenameNotice('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleCreateCredential = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newUsername.trim() || !newKeyValue.trim()) return;

    if (editingId) {
      onUpdateCredential(editingId, {
        label: newLabel,
        type: newType,
        scope: newScope,
        team: newScope === 'ทีม' ? currentUserDepartment : undefined,
        username: newUsername,
        password: newType === 'Username & Password' ? newKeyValue : undefined,
        keyValue: newType !== 'Username & Password' ? newKeyValue : undefined,
        notes: newNotes,
        url: newUrl.trim() || undefined,
        logoUrl: newLogoUrl.trim() || undefined
      });
      onLogAudit('UPDATE_SECURE_CREDENTIAL', `แก้ไขข้อมูลความปลอดภัย: "${newLabel}" (ประเภท ${newType})`);
      setEditSuccessNotice(true);
      setTimeout(() => setEditSuccessNotice(false), 3000);
    } else {
      const newItem: CredentialItem = {
        id: 'CRED' + Date.now(),
        label: newLabel,
        type: newType,
        scope: newScope,
        team: newScope === 'ทีม' ? currentUserDepartment : undefined,
        username: newUsername,
        password: newType === 'Username & Password' ? newKeyValue : undefined,
        keyValue: newType !== 'Username & Password' ? newKeyValue : undefined,
        notes: newNotes,
        url: newUrl.trim() || undefined,
        logoUrl: newLogoUrl.trim() || undefined,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        createdBy: currentUserName
      };

      onAddCredential(newItem);
      onLogAudit('ADD_SECURE_CREDENTIAL', `เพิ่มข้อมูลความปลอดภัยใหม่: "${newLabel}" (ประเภท ${newType})`);
      setCurrentPage(1);
      setCreateSuccessNotice(true);
      setTimeout(() => setCreateSuccessNotice(false), 3000);
    }

    resetCredentialForm();
  };

  const handleStartEdit = (item: CredentialItem) => {
    setEditingId(item.id);
    setNewLabel(item.label);
    setNewType(item.type);
    setNewScope(item.scope);
    setNewUsername(item.username);
    setNewKeyValue(item.password || item.keyValue || '');
    setNewNotes(item.notes || '');
    setNewUrl(item.url || '');
    setNewLogoUrl(item.logoUrl || '');
    setShowAddForm(true);
  };

  const handleDeleteItem = (id: string, label: string) => {
    setDeleteTarget({ id, label });
    setDeleteConfirmInput('');
  };

  const DELETE_UNDO_GRACE_MS = 5000;

  // Soft-delete a batch of ids: hide them immediately, but leave a grace window to undo
  // before each one is actually removed. Powers both the single-item and bulk delete flows.
  const softDeleteItems = (ids: string[], noticeLabel: string) => {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setUndoNotice({ ids, label: noticeLabel });

    ids.forEach((id) => {
      const itemLabel = credentials.find((c) => c.id === id)?.label ?? id;
      pendingDeleteTimers.current[id] = setTimeout(() => {
        onDeleteCredential(id);
        onLogAudit('DELETE_SECURE_CREDENTIAL', `ลบรายการข้อมูลความปลอดภัย: "${itemLabel}" ออกถาวร`);
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setUndoNotice((current) => {
          if (!current) return current;
          const remainingIds = current.ids.filter((cid) => cid !== id);
          return remainingIds.length > 0 ? { ...current, ids: remainingIds } : null;
        });
        delete pendingDeleteTimers.current[id];
      }, DELETE_UNDO_GRACE_MS);
    });
  };

  const undoDeleteItems = (ids: string[]) => {
    ids.forEach((id) => {
      const timer = pendingDeleteTimers.current[id];
      if (timer) clearTimeout(timer);
      delete pendingDeleteTimers.current[id];
    });
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setUndoNotice((current) => {
      if (!current) return current;
      const remainingIds = current.ids.filter((cid) => !ids.includes(cid));
      return remainingIds.length > 0 ? { ...current, ids: remainingIds } : null;
    });
  };

  const confirmDeleteItem = () => {
    if (!deleteTarget) return;
    softDeleteItems([deleteTarget.id], deleteTarget.label);
    setDeleteTarget(null);
    setDeleteConfirmInput('');
  };

  // Escape closes whichever modal (create/edit form or delete confirmation) is open
  useEffect(() => {
    if (!showAddForm && !deleteTarget) return;
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showAddForm) resetCredentialForm();
      if (deleteTarget) { setDeleteTarget(null); setDeleteConfirmInput(''); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAddForm, deleteTarget]);

  // Lock the page's own scroll while a modal is open, so its scrollbar doesn't show/scroll behind the overlay
  useEffect(() => {
    if (!showAddForm && !deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showAddForm, deleteTarget]);

  const isCredentialFormValid = !!(newLabel.trim() && newUsername.trim() && newKeyValue.trim());

  const copySecret = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    onLogAudit('COPY_SECURE_SECRET', `คัดลอกรหัสผ่านลับลงคลิปบอร์ดสำหรับรายการดึงระบบ`);
  };

  const copySecretForItem = (item: CredentialItem) => {
    const value = decryptedValues[item.id] ?? item.password ?? item.keyValue ?? '';
    copySecret(value, item.id);
  };

  // Access control: a personal item is visible only to whoever created it; a team item is
  // visible only to people in that same department. This runs before any of the search/scope
  // filters below — it's not just narrowing what's shown, it's what this account can see at all.
  const visibleCredentials = credentials.filter((item) =>
    item.scope === 'ทีม' ? item.team === currentUserDepartment : item.createdBy === currentUserName
  );

  const filteredCredentials = visibleCredentials.filter((item) => {
    if (pendingDeleteIds.has(item.id)) return false;
    const matchesScope = scopeFilter === '__all__' || item.scope === scopeFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || item.label.toLowerCase().includes(query) || item.username.toLowerCase().includes(query);
    return matchesScope && matchesQuery;
  });

  const sortedCredentials = [...filteredCredentials].sort((a, b) => {
    if (sortBy === 'az') return a.label.localeCompare(b.label, 'th');
    const diff = new Date(b.createdAt.replace(' ', 'T')).getTime() - new Date(a.createdAt.replace(' ', 'T')).getTime();
    return sortBy === 'latest' ? diff : -diff;
  });

  const totalPages = Math.max(1, Math.ceil(sortedCredentials.length / PAGE_SIZE));
  const paginatedCredentials = sortedCredentials.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Snap back to the last page that still has items once deletions (or a filter change) empty out the current page
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 h-full" id="credential-vault-tab">

      <div className="flex flex-col h-full" id="vault-workspace">
          <div className="flex flex-col gap-4 flex-1 min-h-0">

          {visibleCredentials.length - pendingDeleteIds.size === 0 ? (
            /* Nothing created yet (or everything just got soft-deleted) — big centered empty state, no search/filter controls */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <img src={firstCreatePassIcon} alt="" className="w-62.5 h-62.5 object-contain" />
              <p className="text-sm text-[#6F6F6F] -mt-12 mb-6">ยังไม่มีรหัสผ่านในระบบ เริ่มต้นสร้างรายการแรกได้เลย</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-6 h-11 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> สร้างรหัสผ่าน
              </button>
            </div>
          ) : (
          <>
          {/* Search, view toggle, scope filter & create — single controls row */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative w-full lg:w-137.5 lg:flex-none">
              <img src={searchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 mt-px w-3.5 h-5 object-contain" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหารหัสผ่าน (กด / เพื่อโฟกัส)"
                className="w-full h-10 pl-9 pr-9 bg-[#F6F6F8] border border-transparent rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); searchInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="ล้างคำค้นหา"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Grid / list view toggle */}
              <div className="flex items-center gap-0.5 bg-[#F4F4F5] rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                  title="มุมมองตาราง"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => { setViewMode('list'); setCurrentPage(1); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                  title="มุมมองรายการ"
                >
                  <List size={15} />
                </button>
              </div>

              <div className="w-36 h-10">
                <Dropdown<CredentialItem['scope'] | '__all__'>
                  value={scopeFilter}
                  onChange={(value) => {
                    setScopeFilter(value);
                    setCurrentPage(1);
                  }}
                  options={SCOPE_FILTER_OPTIONS}
                />
              </div>

              <button
                onClick={() => (showAddForm ? resetCredentialForm() : setShowAddForm(true))}
                className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap lg:ml-auto"
              >
                <Plus size={16} /> สร้างรหัสผ่านใหม่
              </button>
            </div>
          </div>

          {/* Result count + sort */}
          <div className="flex items-center gap-2">
            <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredCredentials.length} รายการ</p>
            <div className="relative" ref={resultFilterRef}>
              <button
                type="button"
                onClick={() => setIsResultFilterOpen((prev) => !prev)}
                className="flex items-center gap-2 cursor-pointer"
                title="เรียงตาม"
              >
                <span className="text-sm text-[#6F6F6F] leading-none mt-1">•</span>
                <span className="text-sm text-[#6F6F6F] leading-none mt-0.5">
                  เรียงตาม: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#272220] transition-transform duration-150 ease-out ${isResultFilterOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isResultFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSortBy(option.value);
                          setCurrentPage(1);
                          setIsResultFilterOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-sm cursor-pointer ${
                          option.value === sortBy
                            ? 'bg-[#FF6537] text-white font-semibold'
                            : 'text-slate-800 hover:bg-[#FEFAF9]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          </>
          )}

          {/* Create / edit credential modal — morphs out of the "+ สร้างรหัสผ่านใหม่" button via a shared layoutId.
              createPortal is always called so AnimatePresence's direct child stays a real element (a Portal
              object isn't a valid element and gets silently dropped by AnimatePresence otherwise); the
              showAddForm condition lives inside it instead. */}
          {createPortal(
            <AnimatePresence>
              {showAddForm && (
              <motion.div
                key="create-credential-modal"
                className="fixed inset-0 z-50 flex items-center justify-center"
              >
                <motion.div
                  className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                  onClick={resetCredentialForm}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
                  className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
                >
                  {/* Content fades in slightly after the box, so text doesn't smear mid-scale */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.2 } }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="flex flex-col h-full min-h-0"
                  >
                <div className="flex justify-between items-center px-5 pt-5 pb-2 border-b border-slate-100 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingId ? 'แก้ไขรหัสผ่าน' : 'สร้างรหัสใหม่'}
                  </h3>
                  <button
                    onClick={resetCredentialForm}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Fields scroll independently; the title above and the submit button below stay put */}
                <form onSubmit={handleCreateCredential} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 space-y-3">
                  <div className="relative" ref={serviceSuggestRef}>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      ชื่อบริการ <span className="text-[#FF6537]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      autoComplete="off"
                      role="combobox"
                      aria-haspopup="listbox"
                      aria-expanded={isServiceSuggestOpen && serviceSuggestions.length > 0}
                      aria-controls={serviceSuggestListboxId}
                      placeholder="กรุณาใส่ชื่อเรียก"
                      value={newLabel}
                      onChange={(e) => {
                        setNewLabel(e.target.value);
                        setIsServiceSuggestOpen(true);
                        setActiveSuggestionIndex(-1);
                      }}
                      onFocus={() => setIsServiceSuggestOpen(true)}
                      onKeyDown={handleServiceInputKeyDown}
                      onBlur={() => { setIsServiceSuggestOpen(false); applyUniqueLabel(newLabel); }}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                    {renameNotice && (
                      <p className="text-xs font-semibold text-[#FF6537] mt-1.5">ℹ️ {renameNotice}</p>
                    )}

                    {isServiceSuggestOpen && serviceSuggestions.length > 0 && (
                      <div id={serviceSuggestListboxId} role="listbox" className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1">
                        {serviceSuggestions.map((service, index) => (
                          <button
                            key={service.name}
                            type="button"
                            role="option"
                            aria-selected={index === activeSuggestionIndex}
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectServiceSuggestion(service)}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer ${
                              index === activeSuggestionIndex ? 'bg-[#FF6537] text-white font-semibold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {service.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      ชื่อผู้ใช้/อีเมล <span className="text-[#FF6537]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="กรุณาใส่ชื่อผู้ใช้"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">
                      รหัสผ่าน <span className="text-[#FF6537]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        required
                        placeholder="กรุณาใส่รหัสผ่าน"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="w-full p-2.5 pr-11 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowFormPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showFormPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ประเภทสิทธิ์</label>
                    <Dropdown<CredentialItem['scope']>
                      value={newScope}
                      onChange={setNewScope}
                      size="compact"
                      options={[
                        { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                        { value: 'ทีม', label: 'ทีม' }
                      ]}
                    />
                  </div>

                  {newScope === 'ทีม' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                      <span>ทีม:</span>
                      {currentUserDepartment ? (
                        <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${DEPARTMENT_TAG_COLORS[currentUserDepartment]}`}>
                          {currentUserDepartment}
                        </span>
                      ) : (
                        <span className="text-slate-400">ไม่ทราบแผนกของบัญชีนี้</span>
                      )}
                      <span className="text-slate-400">(เห็นได้เฉพาะแผนกเดียวกัน)</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ลิงก์ URL</label>
                    <input
                      type="url"
                      placeholder="กรุณาแนบลิงก์ URL"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>
                </div>

                <div className="shrink-0 px-5 pt-4 pb-5">
                    <button
                      type="submit"
                      disabled={!isCredentialFormValid}
                      className={`w-full h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                        isCredentialFormValid ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                      }`}
                    >
                      {editingId ? 'บันทึกการแก้ไข' : 'สร้าง'}
                    </button>
                  </div>
                </form>
                  </motion.div>
                </motion.div>
              </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* List elements */}
          {visibleCredentials.length - pendingDeleteIds.size > 0 && (
          <>
          {viewMode === 'list' ? (
            filteredCredentials.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
                ไม่พบรายการที่ตรงกับการค้นหา
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                      <th className="px-4 py-3 whitespace-nowrap">ชื่อระบบ</th>
                      <th className="px-4 py-3 whitespace-nowrap">ชื่อผู้ใช้ (Username)</th>
                      <th className="px-4 py-3 whitespace-nowrap">รหัสผ่าน (Password)</th>
                      <th className="px-4 py-3 whitespace-nowrap">สร้างโดย</th>
                      <th className="px-4 py-3 whitespace-nowrap">สร้างเมื่อ</th>
                      <th className="px-4 py-3 whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCredentials.map((item) => {
                      const isSecretVisible = !!visibleStates[item.id];
                      const decryptedText = decryptedValues[item.id] || '';
                      const usernameCopyId = `${item.id}_user`;
                      const avatarCandidates = getAvatarCandidates(item, faviconValidByHost);
                      const currentCandidateIndex = avatarCandidateIndex[item.id] || 0;
                      const currentAvatarSrc = avatarCandidates[currentCandidateIndex];

                      return (
                        <tr key={item.id} className="bg-white border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              {currentAvatarSrc ? (
                                <img
                                  src={currentAvatarSrc}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100"
                                  onError={() =>
                                    setAvatarCandidateIndex((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                                  }
                                />
                              ) : (
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0"
                                  style={{ backgroundColor: getAvatarColor(item.label) }}
                                >
                                  {item.label.trim().charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="space-y-0">
                                <p className="text-[13px] font-bold text-slate-900 leading-tight">{item.label}</p>
                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-medium text-[#6F6F6F] leading-tight hover:text-[#FF6537] hover:underline block"
                                  >
                                    {(() => {
                                      try {
                                        return new URL(item.url).hostname;
                                      } catch {
                                        return item.url;
                                      }
                                    })()}
                                  </a>
                                ) : (
                                  <span className="text-[11px] font-medium text-[#6F6F6F] leading-tight block">ยังไม่ได้แนบลิงค์</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-medium text-[#272220] select-all">{item.username}</span>
                              <button
                                onClick={() => copySecret(item.username, usernameCopyId)}
                                className="p-1 rounded text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                                title="คัดลอกชื่อผู้ใช้"
                              >
                                {copiedId === usernameCopyId ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[12px] font-medium text-[#272220] ${isSecretVisible ? 'select-all' : ''}`}>
                                {isSecretVisible ? decryptedText : '**********'}
                              </span>
                              <button
                                onClick={() => handleViewCredential(item)}
                                className="p-1 rounded text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                                title={isSecretVisible ? 'ปิดการแสดงผลรหัสผ่าน' : 'เปิดดูรหัสผ่านพนักงาน'}
                              >
                                {isSecretVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                              <button
                                onClick={() => copySecretForItem(item)}
                                className="p-1 rounded text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                                title="คัดลอกรหัสผ่านลับ"
                              >
                                {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">
                            {item.createdBy === currentUserName ? 'คุณ' : item.createdBy}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">
                            {formatThaiShortDate(item.createdAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <CredentialCardMenu
                              onEdit={() => handleStartEdit(item)}
                              onDelete={() => handleDeleteItem(item.id, item.label)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {filteredCredentials.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm lg:col-span-2">
                {visibleCredentials.length === 0 ? 'ยังไม่ได้สร้างรหัสผ่าน' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
              </div>
            ) : (
              paginatedCredentials.map(item => {
                const isSecretVisible = !!visibleStates[item.id];
                const decryptedText = decryptedValues[item.id] || '';
                const usernameCopyId = `${item.id}_user`;
                const avatarCandidates = getAvatarCandidates(item, faviconValidByHost);
                const currentCandidateIndex = avatarCandidateIndex[item.id] || 0;
                const currentAvatarSrc = avatarCandidates[currentCandidateIndex];

                return (
                  <div key={item.id} className="bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        {currentAvatarSrc ? (
                          <img
                            src={currentAvatarSrc}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100"
                            onError={() =>
                              setAvatarCandidateIndex((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                            }
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: getAvatarColor(item.label) }}
                          >
                            {item.label.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0">
                          <h4 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                            {item.label}
                            {item.scope === 'ทีม' && item.team && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${DEPARTMENT_TAG_COLORS[item.team]}`}>
                                {item.team}
                              </span>
                            )}
                          </h4>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group text-[11px] font-medium text-[#6F6F6F] leading-tight flex items-center gap-1 hover:text-[#FF6537] hover:underline"
                            >
                              <span className="truncate max-w-[160px]">
                                {(() => {
                                  try {
                                    return new URL(item.url).hostname;
                                  } catch {
                                    return item.url;
                                  }
                                })()}
                              </span>
                              <img src={linkIcon} alt="" className="w-2.5 h-2.5 shrink-0 group-hover:hidden group-active:hidden" />
                              <img src={linkActiveIcon} alt="" className="w-2.5 h-2.5 shrink-0 hidden group-hover:block group-active:block" />
                            </a>
                          ) : (
                            <span className="text-[11px] font-medium text-[#6F6F6F] leading-tight block">ยังไม่ได้แนบลิงค์</span>
                          )}
                        </div>
                      </div>

                      <CredentialCardMenu
                        onEdit={() => handleStartEdit(item)}
                        onDelete={() => handleDeleteItem(item.id, item.label)}
                      />
                    </div>

                    {/* Data contents */}
                    <div className="bg-[#F9F9F9] p-2.5 rounded-xl border border-[#EDEEEF] space-y-1.5 text-xs">
                      <div className="flex justify-between items-center gap-2 text-[#272220]">
                        <span className="text-[12px] font-semibold shrink-0">ชื่อผู้ใช้/Username:</span>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                          <span className="text-[12px] font-medium text-[#272220] select-all truncate">{item.username}</span>
                          <span className="w-5 h-5 shrink-0" aria-hidden="true" />
                          <button
                            onClick={() => copySecret(item.username, usernameCopyId)}
                            className="p-1 rounded shrink-0 text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                            title="คัดลอกชื่อผู้ใช้"
                          >
                            {copiedId === usernameCopyId ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-[#EDEEEF]">
                        <span className="text-[12px] font-semibold text-[#272220] shrink-0">รหัสผ่าน/Password:</span>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                          <span className={`text-[12px] font-medium truncate ${isSecretVisible ? 'text-[#272220] select-all' : 'text-[#272220]'}`}>
                            {isSecretVisible ? decryptedText : '**********'}
                          </span>

                          <button onClick={() => handleViewCredential(item)}
                            className="p-1 rounded text-[#6F6F6F] hover:bg-slate-100 shrink-0 cursor-pointer"
                            title={isSecretVisible ? 'ปิดการแสดงผลรหัสผ่าน' : 'เปิดดูรหัสผ่านพนักงาน'}
                          >
                            {isSecretVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>

                          <button
                            onClick={() => copySecretForItem(item)}
                            className="p-1 rounded shrink-0 text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                            title="คัดลอกรหัสผ่านลับ"
                          >
                            {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="text-[12px] font-medium text-slate-400 italic pt-1.5 border-t border-slate-100/70 flex items-start gap-1.5">
                          <StickyNote size={11} className="shrink-0 mt-0.5" />
                          <span>{item.notes}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-normal text-[#6F6F6F] pt-2 border-t border-[#EDEEEF]">
                      <span>สร้างโดย: {item.createdBy === currentUserName ? 'คุณ' : item.createdBy}</span>
                      <span>สร้างเมื่อ: {formatThaiShortDate(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}
          </>
          )}
          </div>

          {/* Action toast (create / edit / delete-undo) — same position/style for all three */}
          {(undoNotice || editSuccessNotice || createSuccessNotice) && (
            <div className="fixed bottom-6 right-6 z-50">
              <div className="bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center gap-4">
                {undoNotice ? (
                  <>
                    <span className="text-sm">ลบ "{undoNotice.label}" แล้ว</span>
                    <button
                      onClick={() => undoDeleteItems(undoNotice.ids)}
                      className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
                    >
                      เลิกทำ
                    </button>
                  </>
                ) : editSuccessNotice ? (
                  <>
                    <span className="text-sm">แก้ไขรายการสำเร็จแล้ว</span>
                    <button
                      onClick={() => setEditSuccessNotice(false)}
                      className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
                    >
                      ปิด
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm">"สร้างรายการสำเร็จ" แล้ว</span>
                    <button
                      onClick={() => setCreateSuccessNotice(false)}
                      className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
                    >
                      ปิด
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pagination — 4 per page in grid view, 10 per page in list view */}
          {filteredCredentials.length > 0 && (
            <div className="flex justify-center items-center gap-1.5 pt-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#FF6537] hover:bg-orange-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 lg:w-8 lg:h-8 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
                    pageNum === currentPage
                      ? 'bg-[#FF6537] text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#FF6537] hover:bg-orange-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>

      {/* Delete confirmation modal — same fade + scale-in as the create/edit modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 bg-black/15 backdrop-blur-sm"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">ลบรายการนี้?</h3>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              คุณต้องการลบ "{deleteTarget.label}" หรือไม่ การลบจะมีผลถาวรหลังผ่านไป 5 วินาที (กด "เลิกทำ" เพื่อยกเลิกได้ในช่วงเวลานั้น)
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                พิมพ์ <span className="font-bold text-slate-900">{deleteTarget.label}</span> เพื่อยืนยันการลบ
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmInput.trim() === deleteTarget.label) {
                    confirmDeleteItem();
                  }
                }}
                placeholder={deleteTarget.label}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteItem}
                disabled={deleteConfirmInput.trim() !== deleteTarget.label}
                className="px-4 py-2 bg-[#FF6537] text-white rounded-lg text-sm font-bold hover:bg-[#e6572c] cursor-pointer disabled:bg-[#F68C6C] disabled:cursor-not-allowed"
              >
                ยืนยัน
              </button>
            </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
