import React, { useState } from 'react';
import { LinkedDoc } from '../types';
import {
  FileText,
  History,
  Plus,
  Copy,
  ExternalLink,
  Search,
  ArrowUpCircle,
  FileSpreadsheet,
  Monitor,
  Link2,
  Check,
  Folder,
  ArrowUpRight,
  X
} from 'lucide-react';

interface DocVaultProps {
  documents: LinkedDoc[];
  currentUserName: string;
  onAddDocument: (doc: LinkedDoc) => void;
  onUpdateDocumentVersion: (docId: string, updatedBy: string, note: string) => void;
  initialSelectedDocId?: string;
}

const DOC_TYPE_OPTIONS: { value: LinkedDoc['type']; label: string }[] = [
  { value: 'document', label: 'Google Docs' },
  { value: 'spreadsheet', label: 'Google Sheets' },
  { value: 'presentation', label: 'Figma / Presentations' },
  { value: 'pdf', label: 'PDF File' },
  { value: 'link', label: 'ลิงก์เว็บภายนอก' }
];

function getDocIconMeta(type: LinkedDoc['type']) {
  switch (type) {
    case 'spreadsheet':
      return { icon: FileSpreadsheet, badgeLabel: 'Sheet', badgeClass: 'bg-emerald-50 text-emerald-700', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' };
    case 'presentation':
      return { icon: Monitor, badgeLabel: 'Figma', badgeClass: 'bg-fuchsia-50 text-fuchsia-700', iconBg: 'bg-fuchsia-50', iconColor: 'text-fuchsia-600' };
    case 'pdf':
      return { icon: FileText, badgeLabel: 'PDF', badgeClass: 'bg-red-50 text-red-700', iconBg: 'bg-red-50', iconColor: 'text-red-600' };
    case 'link':
      return { icon: Link2, badgeLabel: 'ลิงก์', badgeClass: 'bg-slate-100 text-slate-700', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' };
    default:
      return { icon: FileText, badgeLabel: 'Docs', badgeClass: 'bg-blue-50 text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' };
  }
}

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
function getAvatarColor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Guesses the doc type from the pasted URL, the way Drive's "Add a link" dialog would —
// one less manual dropdown decision for the common case, still editable if it guesses wrong.
function detectDocTypeFromUrl(url: string): LinkedDoc['type'] {
  const lower = url.toLowerCase();
  if (lower.includes('docs.google.com/spreadsheets') || lower.includes('sheets.google.com')) return 'spreadsheet';
  if (lower.includes('docs.google.com/presentation') || lower.includes('slides.google.com') || lower.includes('figma.com')) return 'presentation';
  if (lower.includes('docs.google.com/document') || lower.includes('docs.google.com/forms')) return 'document';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'link';
}

// Suggests a starting name from the URL/type so the field isn't blank — the user can still edit it.
function suggestDocName(url: string, type: LinkedDoc['type']): string {
  try {
    const { hostname } = new URL(url);
    switch (type) {
      case 'document': return 'เอกสาร Google Docs';
      case 'spreadsheet': return 'ชีตข้อมูล Google Sheets';
      case 'presentation': return hostname.includes('figma.com') ? 'ไฟล์ Figma' : 'งานนำเสนอ';
      case 'pdf': {
        const lastSegment = decodeURIComponent(url.split('/').pop() || '').split('?')[0];
        return lastSegment.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim() || 'ไฟล์ PDF';
      }
      default: return hostname.replace(/^www\./, '');
    }
  } catch {
    return '';
  }
}

export default function DocVault({
  documents,
  currentUserName,
  onAddDocument,
  onUpdateDocumentVersion,
  initialSelectedDocId
}: DocVaultProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<LinkedDoc['type'] | 'All'>('All');

  // Selected doc for the detail panel — starts empty unless a specific doc was deep-linked in
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initialSelectedDocId || null);

  // Quick state to notify link copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Doc Form — paste a link and the name/type auto-fill (still editable), like Drive's "Add a link"
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'link'>('document');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocNote, setNewDocNote] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [typeTouched, setTypeTouched] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState(false);

  const handleUrlChange = (value: string) => {
    setNewDocUrl(value);
    const detectedType = detectDocTypeFromUrl(value);
    if (!typeTouched) setNewDocType(detectedType);
    if (!nameTouched) setNewDocName(value.trim() ? suggestDocName(value, detectedType) : '');
  };

  const resetAddForm = () => {
    setNewDocName('');
    setNewDocType('document');
    setNewDocUrl('');
    setNewDocNote('');
    setNameTouched(false);
    setTypeTouched(false);
    setShowAddForm(false);
  };

  // New Version Form for Selected Doc — the updater is always the logged-in user, no manual entry
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [versionSuccessNotice, setVersionSuccessNotice] = useState(false);

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  // Folders — one bucket per document type, doubles as a filter for the list below
  const docFolders = DOC_TYPE_OPTIONS
    .map((opt) => ({ type: opt.value, label: opt.label, items: documents.filter((d) => d.type === opt.value) }))
    .filter((folder) => folder.items.length > 0);

  const selectedFolderSummary = selectedType !== 'All' ? docFolders.find((f) => f.type === selectedType) || null : null;

  // Filters — most recently updated first, to match the "recent documents" framing
  const filteredDocs = documents
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'All' || doc.type === selectedType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => (a.lastUpdated < b.lastUpdated ? 1 : -1));

  const isAddDocFormValid = !!(newDocName.trim() && newDocUrl.trim());

  const handleAddDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddDocFormValid) return;

    const newDoc: LinkedDoc = {
      id: 'DOC' + Date.now(),
      name: newDocName,
      type: newDocType,
      url: newDocUrl,
      version: 1,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedBy: currentUserName,
      history: [
        {
          version: 1,
          updatedBy: currentUserName,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          note: newDocNote.trim() || 'อัปโหลดนำเข้าโครงสร้างไฟล์ครั้งแรก'
        }
      ]
    };

    onAddDocument(newDoc);
    setSelectedDocId(newDoc.id);
    resetAddForm();
    setAddSuccessNotice(true);
    setTimeout(() => setAddSuccessNotice(false), 3000);
  };

  const handleAddNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) return;

    onUpdateDocumentVersion(selectedDocId, currentUserName, versionNote.trim() || 'อัปเดตเนื้อหาเอกสาร');
    setVersionNote('');
    setShowVersionForm(false);
    setVersionSuccessNotice(true);
    setTimeout(() => setVersionSuccessNotice(false), 3000);
  };

  const copyToClipboard = (url: string, docId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6" id="doc-vault-tab">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[40px] font-medium text-[#272220]">คลังเก็บเอกสาร</h1>
          <p className="text-xl font-light text-[#6F6F6F] -mt-2">จัดการและจัดเก็บเอกสารสำหรับใช้งานในองค์กรอย่างปลอดภัย</p>
        </div>

        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="bg-[#FF6537] hover:opacity-90 text-white text-[18px] font-bold w-[220px] h-[50px] rounded-[15px] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus size={20} /> เพิ่มเอกสารใหม่
        </button>
      </div>

      {/* Add New Document Form Drawer — paste a link first, name/type auto-fill like Drive's "Add a link" */}
      {showAddForm && (
        <form onSubmit={handleAddDoc} className="bg-white p-5 rounded-2xl border border-[#EDEEEF] shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">วางลิงก์เอกสาร Google Workspace, Figma หรือไฟล์อื่นๆ</h3>
            <button type="button" onClick={resetAddForm} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">ลิงก์ URL *</label>
            <input
              type="url"
              required
              autoFocus
              placeholder="https://docs.google.com/... หรือวางลิงก์ไฟล์ใดๆ"
              value={newDocUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อเรียกเอกสาร * <span className="font-normal text-slate-400">(เติมให้อัตโนมัติ แก้ไขได้)</span></label>
              <input
                type="text"
                required
                placeholder="เช่น ข้อมูลแผนงบการตลาด Q3"
                value={newDocName}
                onChange={(e) => { setNewDocName(e.target.value); setNameTouched(true); }}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6537]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภท</label>
              <select
                value={newDocType}
                onChange={(e) => { setNewDocType(e.target.value as any); setTypeTouched(true); }}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#FF6537] cursor-pointer"
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">บันทึกเพิ่มเติม <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
            <input
              type="text"
              placeholder="เขียนบันทึกว่าเอกสารใช้ทำอะไร ประสานงานกลุ่มใด..."
              value={newDocNote}
              onChange={(e) => setNewDocNote(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6537]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetAddForm}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!isAddDocFormValid}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                isAddDocFormValid ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
              }`}
            >
              เชื่อมโยงเอกสาร
            </button>
          </div>
        </form>
      )}

      {/* Search & type filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเอกสาร ค้นหา URL ลิงก์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-[44px] pl-12 pr-4 bg-white border border-[#BAB7B7] rounded-xl text-base font-normal focus:outline-none focus:border-[#FF6537]"
          />
        </div>

        <div className="sm:w-[200px] h-[44px]">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as LinkedDoc['type'] | 'All')}
            className="w-full h-[44px] px-4 bg-white border border-[#BAB7B7] rounded-xl text-base focus:outline-none focus:border-[#FF6537] cursor-pointer"
          >
            <option value="All">ทั้งหมด</option>
            {DOC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Folders — grouped by document type, doubles as a filter for the list below */}
      {docFolders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#272220]">โฟลเดอร์</h2>
            {selectedType !== 'All' && (
              <button
                onClick={() => setSelectedType('All')}
                className="text-sm font-semibold text-[#FF6537] hover:underline cursor-pointer"
              >
                ล้างตัวกรองโฟลเดอร์
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {docFolders.map((folder) => {
              const isSelected = selectedType === folder.type;
              return (
                <button
                  key={folder.type}
                  onClick={() => setSelectedType((prev) => (prev === folder.type ? 'All' : folder.type))}
                  className={`text-left bg-white rounded-2xl p-4 space-y-3 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-[#FF6537]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#FF6537]' : 'bg-[#FFF1EC]'}`}>
                      <Folder size={20} className={isSelected ? 'text-white' : 'text-[#FF6537]'} />
                    </span>
                    <ArrowUpRight size={16} className="text-slate-300 shrink-0" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[#272220] truncate">{folder.label}</h4>
                    <p className="text-[13px] text-[#6F6F6F]">{folder.items.length} ไฟล์</p>
                  </div>
                  <div className="flex items-center -space-x-2">
                    {folder.items.slice(0, 3).map((doc) => (
                      <span
                        key={doc.id}
                        className="w-6 h-6 rounded-full ring-2 ring-white flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: getAvatarColor(doc.name) }}
                        title={doc.name}
                      >
                        {doc.name.trim().charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {folder.items.length > 3 && (
                      <span className="w-6 h-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[#6F6F6F] text-[10px] font-bold shrink-0">
                        +{folder.items.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content: recent-documents list on the left, detail panel on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#272220]">เอกสารล่าสุด</h2>
            <span className="text-sm text-[#6F6F6F]">ทั้งหมด {filteredDocs.length} รายการ</span>
          </div>

          <div className="bg-white rounded-2xl border border-[#EDEEEF] overflow-hidden divide-y divide-[#EDEEEF] shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)]">
            {filteredDocs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                {documents.length === 0 ? 'ยังไม่มีเอกสารที่เชื่อมโยงไว้' : 'ไม่มีเอกสารที่ตรงกับการค้นหาของคุณ'}
              </div>
            ) : (
              filteredDocs.map(doc => {
                const isSelected = doc.id === selectedDocId;
                const meta = getDocIconMeta(doc.type);
                const Icon = meta.icon;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId((prev) => (prev === doc.id ? null : doc.id))}
                    className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#FFF6F3]' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                        <Icon size={20} className={meta.iconColor} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${meta.badgeClass}`}>
                            {meta.badgeLabel}
                          </span>
                          <span className="text-[10px] font-bold text-[#FF6537] bg-[#FFF1EC] px-1.5 py-0.5 rounded">
                            v{doc.version}
                          </span>
                        </div>
                        <h4 className="text-[15px] font-bold text-slate-800 mt-1 truncate max-w-[220px] sm:max-w-md">
                          {doc.name}
                        </h4>
                        <p className="text-[12px] text-slate-400 mt-0.5 truncate">
                          อัปเดตล่าสุด: {doc.lastUpdated} โดย {doc.updatedBy}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(doc.url, doc.id);
                        }}
                        className={`p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer ${
                          copiedId === doc.id ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-slate-400'
                        }`}
                        title="คัดลอกลิงก์"
                      >
                        {copiedId === doc.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>

                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:text-[#FF6537] hover:bg-slate-50"
                        title="เปิดลิงก์ในแท็บใหม่"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selectedDoc ? (
            <div className="bg-white p-5 rounded-2xl border border-[#EDEEEF] shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] space-y-5 sticky top-5">

              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EDEEEF]">
                <div className="min-w-0">
                  <span className="text-[11px] bg-[#FFF1EC] text-[#FF6537] font-bold px-2 py-0.5 rounded">
                    Version v{selectedDoc.version}
                  </span>
                  <h3 className="text-[15px] font-bold text-slate-900 mt-2 leading-relaxed">
                    {selectedDoc.name}
                  </h3>
                  <a
                    href={selectedDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-slate-500 mt-1 break-all hover:underline hover:text-[#FF6537] flex items-start gap-1"
                    title="ที่อยู่อ้างอิงเอกสาร"
                  >
                    <Link2 size={12} className="shrink-0 mt-0.5" />
                    <span>{selectedDoc.url}</span>
                  </a>
                </div>
                <button
                  onClick={() => setSelectedDocId(null)}
                  className="text-slate-300 hover:text-slate-500 cursor-pointer shrink-0"
                  title="ปิดแผงรายละเอียด"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Version History Logs */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History size={14} /> ประวัติและบันทึกการปรับปรุง ({selectedDoc.history.length})
                </h4>

                <div className="relative border-l-2 border-slate-100 pl-4 space-y-4 ml-2">
                  {selectedDoc.history.map((hist, idx) => (
                    <div key={idx} className="relative text-xs">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white border border-slate-400"></span>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[#FF6537] bg-[#FFF1EC] px-1.5 rounded text-[10px]">
                            v{hist.version}
                          </span>
                          <span className="text-[10px] text-slate-400">{hist.date}</span>
                        </div>
                        <p className="font-medium text-slate-800 italic">"{hist.note}"</p>
                        <p className="text-[10px] text-slate-400">ผู้แก้ไข: <span className="text-slate-600 font-semibold">{hist.updatedBy}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action to Upgrade version on selected doc */}
              <div className="pt-4 border-t border-[#EDEEEF]">
                {showVersionForm ? (
                  <form onSubmit={handleAddNewVersion} className="space-y-3 text-xs">
                    <p className="text-[10px] text-slate-400">ปรับปรุงโดย: <span className="text-slate-600 font-semibold">{currentUserName}</span></p>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">มีอะไรเปลี่ยนแปลงบ้าง <span className="font-normal">(ไม่บังคับ)</span></label>
                      <input
                        type="text"
                        placeholder="เช่น เพิ่มช่องสถิติ, แก้ไขแผนงานตามคอมเมนท์หัวหน้า"
                        autoFocus
                        value={versionNote}
                        onChange={(e) => setVersionNote(e.target.value)}
                        className="w-full p-2.5 border border-[#EDEEEF] rounded bg-white focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowVersionForm(false)}
                        className="p-1 px-2.5 border rounded hover:bg-slate-50 cursor-pointer text-slate-500"
                      >
                        ปิด
                      </button>
                      <button
                        type="submit"
                        className="p-1 px-3 bg-[#FF6537] text-white rounded font-bold hover:bg-[#e6572c] cursor-pointer"
                      >
                        ยืนยันการบันทึกรุ่นใหม่
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowVersionForm(true)}
                    className="w-full bg-[#F9F9F9] hover:bg-[#FFF1EC] text-slate-700 hover:text-[#FF6537] border border-slate-200 hover:border-[#FFD9C7] p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowUpCircle size={14} className="text-[#FF6537]" />
                    อัปเกรดส่งรุ่นใหม่ (Upload New Version v{selectedDoc.version + 1})
                  </button>
                )}
              </div>

            </div>
          ) : selectedFolderSummary ? (
            <div className="bg-white rounded-2xl border border-[#EDEEEF] shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-5 space-y-3 sticky top-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#EDEEEF]">
                <span className="w-9 h-9 rounded-lg bg-[#FFF1EC] flex items-center justify-center shrink-0">
                  <Folder size={16} className="text-[#FF6537]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-800 truncate">{selectedFolderSummary.label}</h3>
                  <p className="text-[12px] text-[#6F6F6F]">{selectedFolderSummary.items.length} ไฟล์ในโฟลเดอร์นี้</p>
                </div>
              </div>
              <div className="space-y-0.5">
                {selectedFolderSummary.items.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className="w-full text-left text-[13px] font-medium text-slate-700 hover:text-[#FF6537] px-2.5 py-2 rounded-lg hover:bg-slate-50 cursor-pointer truncate"
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#EDEEEF] p-10 text-center text-slate-400 text-sm h-full min-h-[220px] flex items-center justify-center">
              คลิกที่โฟลเดอร์หรือเอกสารเพื่อดูรายละเอียด
            </div>
          )}
        </div>

      </div>

      {/* Action toast (add document / new version) */}
      {(addSuccessNotice || versionSuccessNotice) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center gap-4">
            <span className="text-sm">{addSuccessNotice ? 'บันทึกเอกสารสำเร็จแล้ว' : 'อัปเดตเวอร์ชันสำเร็จแล้ว'}</span>
            <button
              onClick={() => { setAddSuccessNotice(false); setVersionSuccessNotice(false); }}
              className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
