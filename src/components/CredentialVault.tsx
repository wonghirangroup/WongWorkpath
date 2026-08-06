import React, { useState, useRef, useEffect, useId, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CredentialItem, AuditLog, Department } from '../types';
import {
  Eye,
  EyeOff,
  Copy,
  Plus,
  Check,
  StickyNote,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import searchIcon from '../../images/icon/Search pass.png';
import linkIcon from '../../images/icon menu/linkki.png';
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
  { name: 'Grow Store', url: 'https://pos.smartjigsaw.net/'}
];

const SCOPE_FILTER_OPTIONS: { value: CredentialItem['scope']; label: string }[] = [
  { value: 'ส่วนตัว', label: 'ส่วนตัว' },
  { value: 'ทีม', label: 'ทีม' }
];

const TEAM_OPTIONS: Department[] = ['IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance'];

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

// Ordered fallback chain: manual logo override -> the site's own favicon.ico -> Google's favicon cache
function getAvatarCandidates(item: CredentialItem): string[] {
  const candidates: string[] = [];
  if (item.logoUrl) candidates.push(item.logoUrl);

  if (item.url) {
    try {
      const { origin, hostname } = new URL(item.url);
      candidates.push(`${origin}/favicon.ico`);
      candidates.push(`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`);
    } catch {
      // invalid URL, no site-derived candidates
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

interface DropdownProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
}

// Reusable button + floating list dropdown (rounded card, subtle tinted highlight on the selected row)
// Full keyboard support (Arrow Up/Down, Enter, Escape) + ARIA combobox/listbox roles, matching the
// service-name autocomplete's interaction quality so every dropdown on the page behaves the same way.
function Dropdown<T extends string>({ value, options, onChange, placeholder }: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const selectedIndex = options.findIndex((o) => o.value === value);

  const openDropdown = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full h-[44px] flex items-center justify-between pl-4 pr-4 bg-white border border-[#BAB7B7] text-base font-normal cursor-pointer focus:outline-none focus:border-[#FF6537] ${
          isOpen ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'
        }`}
      >
        <span className={selectedLabel ? '' : 'text-slate-400'}>{selectedLabel || placeholder}</span>
        <ChevronDown size={16} className={`text-[#FF6537] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div id={listboxId} role="listbox" className="absolute z-10 mt-0.5 w-full bg-white rounded-t-none rounded-b-2xl shadow-xl overflow-hidden">
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full text-left px-4 py-2.5 text-base cursor-pointer ${
                index === highlightedIndex
                  ? 'bg-[#FF6537] text-white font-semibold'
                  : option.value === value
                    ? 'bg-[#FFF1EC] text-slate-900'
                    : 'text-slate-800 hover:bg-[#FEFAF9]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CredentialVaultProps {
  credentials: CredentialItem[];
  auditLogs: AuditLog[];
  currentUserName: string;
  onAddCredential: (item: CredentialItem) => void;
  onUpdateCredential: (id: string, updates: Partial<CredentialItem>) => void;
  onDeleteCredential: (id: string) => void;
  onLogAudit: (action: string, details: string) => void;
}

export default function CredentialVault({
  credentials,
  auditLogs,
  currentUserName,
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
  const [scopeFilter, setScopeFilter] = useState<CredentialItem['scope']>(() => {
    const saved = localStorage.getItem('vault_scope_filter');
    return saved === 'ส่วนตัว' || saved === 'ทีม' ? saved : 'ส่วนตัว';
  });
  const [teamFilter, setTeamFilter] = useState<Department | '__all__'>('__all__');

  useEffect(() => {
    localStorage.setItem('vault_scope_filter', scopeFilter);
  }, [scopeFilter]);

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

  // Pagination
  const PAGE_SIZE = 4;
  const [currentPage, setCurrentPage] = useState(1);

  // New / Edit Credential Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CredentialItem['type']>('Username & Password');
  const [newScope, setNewScope] = useState<CredentialItem['scope']>('ส่วนตัว');
  const [newTeam, setNewTeam] = useState<Department | ''>('');
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

  const selectServiceSuggestion = (service: { name: string; url: string }) => {
    setNewLabel(service.name);
    setNewUrl(service.url);
    setIsServiceSuggestOpen(false);
    setActiveSuggestionIndex(-1);
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
    setNewTeam('');
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
        team: newScope === 'ทีม' ? (newTeam || undefined) : undefined,
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
        team: newScope === 'ทีม' ? (newTeam || undefined) : undefined,
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
    setNewTeam(item.team || '');
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

  const filteredCredentials = credentials.filter((item) => {
    if (pendingDeleteIds.has(item.id)) return false;
    const matchesScope = item.scope === scopeFilter;
    const matchesTeam = scopeFilter !== 'ทีม' || teamFilter === '__all__' || item.team === teamFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || item.label.toLowerCase().includes(query) || item.username.toLowerCase().includes(query);
    return matchesScope && matchesTeam && matchesQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCredentials.length / PAGE_SIZE));
  const paginatedCredentials = filteredCredentials.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6 h-full" id="credential-vault-tab">

      <div className="flex flex-col min-h-full" id="vault-workspace">
          <div className="space-y-5 flex-1">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 -mt-5">
            <div>
              <h1 className="text-[40px] font-medium text-[#FF6537]">คลังรหัสผ่าน</h1>
              <p className="text-xl font-light text-slate-500 -mt-2">จัดการและจัดเก็บรหัสผ่านสำหรับใช้งานในองค์กร</p>
            </div>

            <button
              onClick={() => (showAddForm ? resetCredentialForm() : setShowAddForm(true))}
              className="bg-[#FF6537] hover:opacity-90 text-white text-[18px] font-bold w-[200px] h-[50px] rounded-[15px] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={20} /> สร้างรหัสผ่านใหม่
            </button>
          </div>

          {/* Search & scope filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <img src={searchIcon} alt="" className="absolute left-4 top-1/2 -translate-y-1/2 mt-[1px] w-5 h-5 object-contain" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหารหัสผ่าน (กด / เพื่อโฟกัส)"
                className="w-full h-[44px] pl-12 pr-4 bg-white border border-[#BAB7B7] rounded-xl text-base font-normal focus:outline-none focus:border-[#FF6537]"
              />
            </div>

            <div className="w-[135px] h-[44px]">
              <Dropdown<CredentialItem['scope']>
                value={scopeFilter}
                onChange={(value) => {
                  setScopeFilter(value);
                  setTeamFilter('__all__');
                  setCurrentPage(1);
                }}
                options={SCOPE_FILTER_OPTIONS}
              />
            </div>

            {scopeFilter === 'ทีม' && (
              <div className="w-[160px] h-[44px]">
                <Dropdown<Department | '__all__'>
                  value={teamFilter}
                  onChange={(value) => {
                    setTeamFilter(value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: '__all__', label: 'ทุกทีม' },
                    ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                  ]}
                />
              </div>
            )}
          </div>

          {/* Result count */}
          <p className="text-base text-slate-500">ทั้งหมด {filteredCredentials.length} รายการ</p>

          {/* Create / edit credential modal */}
          {showAddForm && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={resetCredentialForm}
              />
              <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg mx-4 p-10 max-h-[90vh] overflow-y-auto">
                <button
                  onClick={resetCredentialForm}
                  className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={24} />
                </button>

                <h3 className="text-2xl font-bold text-[#FF6537] text-center mb-6">
                  {editingId ? 'แก้ไขรหัสผ่าน' : 'สร้างรหัสใหม่'}
                </h3>

                <form onSubmit={handleCreateCredential} className="space-y-5">
                  <div className="relative" ref={serviceSuggestRef}>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      ชื่อบริการ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
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
                      onBlur={() => {
                        const existingLabels = credentials
                          .filter((c) => c.id !== editingId)
                          .map((c) => c.label);
                        const uniqueLabel = getUniqueLabel(newLabel, existingLabels);
                        if (uniqueLabel !== newLabel.trim()) {
                          setNewLabel(uniqueLabel);
                          setRenameNotice(`ชื่อนี้ถูกใช้แล้ว เปลี่ยนเป็น "${uniqueLabel}" ให้อัตโนมัติ`);
                          setTimeout(() => setRenameNotice(''), 4000);
                        }
                      }}
                      className="w-full h-[44px] px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
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
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      ชื่อผู้ใช้/อีเมล <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="กรุณาใส่ชื่อผู้ใช้"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full h-[44px] px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      รหัสผ่าน <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        required
                        placeholder="กรุณาใส่รหัสผ่าน"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="w-full h-[44px] pl-3 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showFormPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">ประเภทสิทธิ์</label>
                    <Dropdown<CredentialItem['scope']>
                      value={newScope}
                      onChange={setNewScope}
                      options={[
                        { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                        { value: 'ทีม', label: 'ทีม' }
                      ]}
                    />
                  </div>

                  {newScope === 'ทีม' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1.5">เลือกทีม</label>
                      <Dropdown<Department | '__unset__'>
                        value={newTeam || '__unset__'}
                        onChange={(value) => setNewTeam(value === '__unset__' ? '' : value)}
                        placeholder="ไม่ระบุทีม"
                        options={[
                          { value: '__unset__', label: 'ไม่ระบุทีม' },
                          ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">ลิงค์ URL</label>
                    <input
                      type="url"
                      placeholder="กรุณาแนบลิงค์ URL"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full h-[44px] px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!isCredentialFormValid}
                    className={`w-full text-white font-semibold py-3.5 rounded-xl transition-colors ${
                      isCredentialFormValid ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                    }`}
                  >
                    {editingId ? 'บันทึกการแก้ไข' : 'สร้าง'}
                  </button>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* List elements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCredentials.length === 0 ? (
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
                {credentials.length === 0 ? 'ยังไม่ได้สร้างรหัสผ่าน' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
              </div>
            ) : (
              paginatedCredentials.map(item => {
                const isSecretVisible = !!visibleStates[item.id];
                const decryptedText = decryptedValues[item.id] || '';
                const usernameCopyId = `${item.id}_user`;
                const avatarCandidates = getAvatarCandidates(item);
                const currentCandidateIndex = avatarCandidateIndex[item.id] || 0;
                const currentAvatarSrc = avatarCandidates[currentCandidateIndex];

                return (
                  <div key={item.id} className="group bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 rounded-2xl space-y-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        {currentAvatarSrc ? (
                          <img
                            src={currentAvatarSrc}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100"
                            onError={() =>
                              setAvatarCandidateIndex((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                            }
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: getAvatarColor(item.label) }}
                          >
                            {item.label.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0">
                          <h4 className="text-[18px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                            {item.label}
                            {item.scope === 'ทีม' && item.team && (
                              <span className="text-[11px] font-semibold text-[#FF6537] bg-[#FFF1EC] px-2 py-0.5 rounded-full leading-none">
                                {item.team}
                              </span>
                            )}
                          </h4>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[14px] font-medium text-[#6F6F6F] leading-tight flex items-center gap-1 hover:text-[#FF6537] hover:underline"
                            >
                              <span className="truncate max-w-[200px]">
                                {(() => {
                                  try {
                                    return new URL(item.url).hostname;
                                  } catch {
                                    return item.url;
                                  }
                                })()}
                              </span>
                              <img src={linkIcon} alt="" className="w-[13px] h-[13px] shrink-0" />
                            </a>
                          ) : (
                            <span className="text-[14px] font-medium text-[#6F6F6F] leading-tight block">ยังไม่ได้แนบลิงค์</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                          title={`แก้ไข ${item.label}`}
                          onClick={() => handleStartEdit(item)}
                        >
                          <img src={editIcon} alt={`แก้ไข ${item.label}`} className="w-[20px] h-[20px]" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                          title={`ลบ ${item.label}`}
                          onClick={() => handleDeleteItem(item.id, item.label)}
                        >
                          <img src={deleteIcon} alt={`ลบ ${item.label}`} className="w-[20px] h-[20px]" />
                        </button>
                      </div>
                    </div>

                    {/* Data contents */}
                    <div className="bg-[#F9F9F9] p-3.5 rounded-xl border border-[#EDEEEF] space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-[#272220]">
                        <span className="text-[14px] font-semibold">ชื่อผู้ใช้/Username:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-[#272220] select-all">{item.username}</span>
                          <span className="w-[28px] h-[28px] shrink-0" aria-hidden="true" />
                          <button
                            onClick={() => copySecret(item.username, usernameCopyId)}
                            className="p-1 rounded shrink-0 text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                            title="คัดลอกชื่อผู้ใช้"
                          >
                            {copiedId === usernameCopyId ? <Check size={20} /> : <Copy size={20} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-[#EDEEEF]">
                        <span className="text-[14px] font-semibold text-[#272220] shrink-0">รหัสผ่าน/Password:</span>
                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          <span className={`text-[14px] font-medium truncate ${isSecretVisible ? 'text-[#272220] select-all' : 'text-[#272220]'}`}>
                            {isSecretVisible ? decryptedText : '**********'}
                          </span>

                          <button onClick={() => handleViewCredential(item)}
                            className="p-1 rounded text-[#6F6F6F] hover:bg-slate-100 shrink-0 cursor-pointer"
                            title={isSecretVisible ? 'ปิดการแสดงผลรหัสผ่าน' : 'เปิดดูรหัสผ่านพนักงาน'}
                          >
                            {isSecretVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                          </button>

                          <button
                            onClick={() => copySecretForItem(item)}
                            className="p-1 rounded shrink-0 text-[#6F6F6F] hover:bg-slate-100 cursor-pointer"
                            title="คัดลอกรหัสผ่านลับ"
                          >
                            {copiedId === item.id ? <Check size={20} /> : <Copy size={20} />}
                          </button>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="text-[14px] font-medium text-slate-400 italic pt-1.5 border-t border-slate-100/70 flex items-start gap-1.5">
                          <StickyNote size={13} className="shrink-0 mt-0.5" />
                          <span>{item.notes}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[14px] font-normal text-[#6F6F6F] pt-3 border-t border-[#EDEEEF]">
                      <span>สร้างโดย: {item.createdBy === currentUserName ? 'คุณ' : item.createdBy}</span>
                      <span>สร้างเมื่อ: {formatThaiShortDate(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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

          {/* Pagination */}
          {filteredCredentials.length > 0 && (
            <div className="flex justify-center items-center gap-2 pt-5">
              <span className="font-light text-[20px] text-slate-700 mr-1">หน้า</span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold cursor-pointer ${
                    pageNum === currentPage
                      ? 'bg-[#FF6537] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>

      {/* Delete confirmation modal */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
          />
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg mx-4 p-8 text-center">
            <button
              onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-[#FF6537] px-6">
              คุณต้องการลบ "{deleteTarget.label}" หรือไม่?
            </h3>
            <p className="text-sm text-slate-500 mt-3">
              การลบจะมีผลถาวรหลังผ่านไป 5 วินาที (สามารถกด "เลิกทำ" เพื่อยกเลิกได้ในช่วงเวลานั้น)
            </p>
            <div className="text-left mt-5">
              <label className="block text-sm text-slate-600 mb-1.5">
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
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#FF6537]"
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={confirmDeleteItem}
                disabled={deleteConfirmInput.trim() !== deleteTarget.label}
                className="bg-[#FF6537] text-white font-semibold px-10 py-3 rounded-xl hover:bg-[#e6572c] cursor-pointer disabled:bg-[#F68C6C] disabled:cursor-not-allowed"
              >
                ยืนยัน
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmInput(''); }}
                className="border border-slate-300 text-slate-700 font-semibold px-10 py-3 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
