import React, { useState } from 'react';
import { LinkedDoc, DocHistory } from '../types';
import { 
  FileText, 
  FolderOpen, 
  History, 
  Plus, 
  Copy, 
  ExternalLink, 
  Search, 
  ArrowUpCircle,
  FileSpreadsheet,
  Monitor,
  Link2,
  Clock,
  Check
} from 'lucide-react';

interface DocVaultProps {
  documents: LinkedDoc[];
  onAddDocument: (doc: LinkedDoc) => void;
  onUpdateDocumentVersion: (docId: string, updatedBy: string, note: string) => void;
  initialSelectedDocId?: string;
}

export default function DocVault({
  documents,
  onAddDocument,
  onUpdateDocumentVersion,
  initialSelectedDocId
}: DocVaultProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  // Selected Document for Version History sidebar
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    initialSelectedDocId || documents[0]?.id || null
  );

  // Quick state to notify link copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Doc Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'link'>('document');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocNote, setNewDocNote] = useState('');

  // New Version Form for Selected Doc
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionUpdater, setVersionUpdater] = useState('สมศักดิ์ รักดี');
  const [versionNote, setVersionNote] = useState('');

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  // Filters
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'All' || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleAddDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim() || !newDocUrl.trim()) {
      alert('กรุณากรอกชื่อเอกสารและลิ้งค์ URL');
      return;
    }

    const newDoc: LinkedDoc = {
      id: 'DOC' + Date.now(),
      name: newDocName,
      type: newDocType,
      url: newDocUrl,
      version: 1,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedBy: 'ผู้ใช้งานระบบ',
      history: [
        {
          version: 1,
          updatedBy: 'ผู้ใช้งานระบบ',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          note: newDocNote.trim() || 'อัปโหลดนำเข้าโครงสร้างไฟล์ครั้งแรก'
        }
      ]
    };

    onAddDocument(newDoc);
    setSelectedDocId(newDoc.id);
    
    // reset form
    setNewDocName('');
    setNewDocUrl('');
    setNewDocNote('');
    setShowAddForm(false);
    alert('บันทึกเอกสารลงห้องเอกสารส่วนกลางสำเร็จ');
  };

  const handleAddNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !versionNote.trim()) {
      alert('กรุณากรอกบันทึกการแก้ไข');
      return;
    }

    onUpdateDocumentVersion(selectedDocId, versionUpdater, versionNote);
    setVersionNote('');
    setShowVersionForm(false);
    alert('อัปเดตเวอร์ชันเอกสารเรียบร้อย (Version Upgraded)');
  };

  const copyToClipboard = (url: string, docId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'spreadsheet':
        return <FileSpreadsheet className="text-emerald-600" size={24} />;
      case 'document':
        return <FileText className="text-blue-600" size={24} />;
      case 'presentation':
        return <Monitor className="text-fuchsia-600" size={24} />;
      default:
        return <Link2 className="text-slate-600" size={24} />;
    }
  };

  return (
    <div className="space-y-6" id="doc-vault-tab">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-2xl shadow-xs border border-slate-800">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <FolderOpen size={20} /> ห้องเก็บเอกสารรวมศูนย์ (Centralized Document Vault)
          </h1>
          <p className="text-indigo-200 text-xs mt-1">เก็บบันทึกไฟล์ ลิงก์ Google Drive, Docs, Sheets และติดตามระบบจัดเรียงเวอร์ชัน (Version Control)</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mt-3 md:mt-0 bg-white text-indigo-900 hover:bg-slate-50 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={16} /> นำเข้าและเชื่อมไฟล์ใหม่
        </button>
      </div>

      {/* Add New Document Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleAddDoc} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">🔗 แนบลิงก์เอกสาร Google Workspace และโปรแกรมอื่นๆ</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 font-bold">ปิด</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อเรียกเอกสาร *</label>
              <input 
                type="text" 
                required
                placeholder="เช่น Google Sheets: ข้อมูลแผนงบการตลาด Q3"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทเอกสาร</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as any)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white"
              >
                <option value="document">Google Docs</option>
                <option value="spreadsheet">Google Sheets</option>
                <option value="presentation">Figma / Presentations</option>
                <option value="pdf">PDF File</option>
                <option value="link">ลิงก์เว็บภายนอก (Link)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ลิงก์ URL ปลายทาง *</label>
              <input 
                type="url" 
                required
                placeholder="https://docs.google.com/..."
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">คำบันทึกข้อมูลเพิ่มเติมแรกเริ่ม</label>
            <input 
              type="text" 
              placeholder="เขียนบันทึกว่าเอกสารใช้ทำอะไร ประสานงานกลุ่มใด..."
              value={newDocNote}
              onChange={(e) => setNewDocNote(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
            >
              ยกเลิก
            </button>
            <button 
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 cursor-pointer"
            >
              💾 ยืนยันเชื่อมโยงเอกสาร
            </button>
          </div>
        </form>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Document List */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อเอกสาร ค้นหา URL ลิงก์..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:w-48">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="All">ทุกรูปแบบไฟล์</option>
                <option value="document">Google Docs</option>
                <option value="spreadsheet">Google Sheets</option>
                <option value="presentation">Figma / Slides</option>
                <option value="pdf">PDF File</option>
                <option value="link">ลิงก์ภายนอก</option>
              </select>
            </div>
          </div>

          {/* List Box */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-2xs">
            {filteredDocs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                ไม่มีเอกสารที่ตรงกับการค้นหาของคุณ
              </div>
            ) : (
              filteredDocs.map(doc => {
                const isSelected = doc.id === selectedDocId;

                return (
                  <div 
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors ${
                      isSelected ? 'bg-indigo-50/30 border-l-4 border-l-indigo-600 pl-3' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        {getDocIcon(doc.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">
                            {doc.type}
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded">
                            v{doc.version}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 mt-1 truncate max-w-[280px] sm:max-w-md">
                          {doc.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
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
                        {copiedId === doc.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>

                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                        title="เปิดดูลิ้งค์ในแถบใหม่"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Right Side: Version Control and Log Details */}
        <div className="lg:col-span-1">
          {selectedDoc ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-5">
              
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                    Version v{selectedDoc.version}
                  </span>
                  <span className="text-[10px] text-slate-400">ควบคุมเวอร์ชันรวม</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2 leading-relaxed">
                  {selectedDoc.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 break-all select-all hover:underline" title="ที่อยู่อ้างอิงเอกสาร">
                  🔗 {selectedDoc.url}
                </p>
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
                          <span className="font-extrabold text-indigo-700 bg-indigo-50 px-1.5 rounded text-[10px]">
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
              <div className="pt-4 border-t border-slate-100">
                {showVersionForm ? (
                  <form onSubmit={handleAddNewVersion} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">ผู้ปรับปรุงเวอร์ชันล่าสุด</label>
                      <input 
                        type="text"
                        value={versionUpdater}
                        onChange={(e) => setVersionUpdater(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded bg-slate-50 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">ระบุบันทึกรายละเอียดแก้ไข (เพื่ออัปเกรดรุ่น) *</label>
                      <input 
                        type="text"
                        placeholder="เช่น เพิ่มช่องสถิติ, แก้ไขแผนงานตามคอมเมนท์หัวหน้า"
                        required
                        value={versionNote}
                        onChange={(e) => setVersionNote(e.target.value)}
                        className="w-full p-2.5 border border-indigo-100 rounded bg-white"
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
                        className="p-1 px-3 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-500 cursor-pointer"
                      >
                        ยืนยันการบันทึกรุ่นใหม่
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowVersionForm(true)}
                    className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowUpCircle size={14} className="text-indigo-600" />
                    อัปเกรดส่งรุ่นใหม่ (Upload New Version v{selectedDoc.version + 1})
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs">
              กรุณาเลือกเอกสารเพื่อดูข้อมูลประวัติเวอร์ชันอย่างละเอียด
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
