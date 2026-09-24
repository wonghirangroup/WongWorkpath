import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Paperclip, Link2, Trash2 } from 'lucide-react';
import { Employee, LinkedDoc } from '../../types';
import { ProjectTaskItem } from './types';
import { EmployeeMultiSelect } from './CreateProjectModal';
import { readFileAsDataUrl, MAX_FILE_BYTES, formatFileSize, getItemVisual, suggestLinkName } from '../DocVault';
import { nowTimestamp } from '../../lib/datetime';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

interface SubmitTaskModalProps {
  task: ProjectTaskItem | null;
  employees: Employee[];
  documents: LinkedDoc[];
  projectDocFolderId?: string | null;
  // Restricts the reviewer picker to people already on this task's project (its owners +
  // members) instead of every employee in the company — an empty list (no owners/members set
  // yet) leaves it open to everyone, same "unowned = open" convention used elsewhere.
  projectMemberIds?: string[];
  currentUserId: string;
  currentUserName: string;
  onAddDocument: (doc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>;
  onSubmit: (taskId: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  onClose: () => void;
}

// Single-step "ส่งงาน" — the assignee picks/confirms a reviewer, writes a note, and optionally
// attaches files (each becomes a real Doc Vault file tagged with this task's LinkedDoc.taskId, so
// it shows up in "เอกสาร Drive" too, filed alongside the task's own folder when it has one). This
// moves the task to 'review'; ReviewTaskModal is the other half of the loop.
export default function SubmitTaskModal({ task, employees, documents, projectDocFolderId, projectMemberIds, currentUserId, currentUserName, onAddDocument, onSubmit, onClose }: SubmitTaskModalProps) {
  useEscapeToClose(Boolean(task), onClose);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [pickedFiles, setPickedFiles] = useState<globalThis.File[]>([]);
  const [pickedLinks, setPickedLinks] = useState<{ name: string; url: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!task) return;
    setReviewerIds(task.reviewerEmployeeIds ?? []);
    setNote('');
    setPickedFiles([]);
    setPickedLinks([]);
    setLinkUrl('');
    setFileError('');
    setFormError('');
  }, [task]);

  if (!task) return null;

  const existingFiles = (task.submissionFileIds ?? [])
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is LinkedDoc => Boolean(d));

  const handleFilesPicked = (fileList: FileList | null) => {
    setFileError('');
    if (!fileList) return;
    const oversized: string[] = [];
    const accepted: globalThis.File[] = [];
    Array.from(fileList).forEach((f) => {
      if (f.size > MAX_FILE_BYTES) oversized.push(f.name);
      else accepted.push(f);
    });
    if (oversized.length > 0) setFileError(`ไฟล์ใหญ่เกิน ${formatFileSize(MAX_FILE_BYTES)} ถูกข้าม: ${oversized.join(', ')}`);
    setPickedFiles((prev) => [...prev, ...accepted]);
  };

  const removePickedFile = (idx: number) => {
    setPickedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPickedLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    setPickedLinks((prev) => [...prev, { name: suggestLinkName(url) || url, url }]);
    setLinkUrl('');
  };

  const removePickedLink = (idx: number) => {
    setPickedLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  // An empty roster (no owners/members set on the project yet) leaves the picker open to
  // everyone, same "unowned = open" convention used elsewhere — already-selected reviewers stay
  // visible even if they've since left the project, so a chip never silently disappears.
  const projectMemberIdSet = new Set(projectMemberIds ?? []);
  const selectableEmployees = projectMemberIdSet.size === 0
    ? employees
    : employees.filter((e) => projectMemberIdSet.has(e.id) || reviewerIds.includes(e.id));

  const isFormValid = reviewerIds.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      // A task's own folder (created via AddTaskModal's checkbox) is where a submission's files
      // land when one exists — otherwise they fall back to the project's root Drive folder, same
      // as any other task-tagged document.
      const taskFolder = documents.find((d) => d.kind === 'folder' && d.taskId === task.id);
      const parentId = taskFolder?.id ?? projectDocFolderId ?? null;
      const date = nowTimestamp();

      // Scoped 'โครงการ' (not 'ส่วนตัว') so the task's reviewer — and the rest of the project team
      // — can actually see/open what was attached, not just the assignee who submitted it.
      const newFileIds: string[] = [];
      for (const file of pickedFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const newDoc: Omit<LinkedDoc, 'id'> = {
          name: file.name,
          kind: 'file',
          parentId,
          taskId: task.id,
          fileDataUrl: dataUrl,
          fileMimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          scope: 'โครงการ',
          projectId: task.projectId,
          creatorEmployeeId: currentUserId,
          version: 1,
          lastUpdated: date,
          updatedBy: currentUserName,
          history: [{ version: 1, updatedBy: currentUserName, date, note: 'แนบไฟล์ตอนส่งงาน' }],
        };
        const created = await onAddDocument(newDoc);
        newFileIds.push(created.id);
      }

      // A link attaches the same way a file does — both are just Doc Vault LinkedDoc ids in
      // submissionFileIds, which is schema-agnostic about kind — so reviewers/the Doc Vault see
      // it identically to a real file, no separate "links" field needed on ProjectTaskItem.
      for (const link of pickedLinks) {
        const newDoc: Omit<LinkedDoc, 'id'> = {
          name: link.name,
          kind: 'link',
          parentId,
          taskId: task.id,
          url: link.url,
          scope: 'โครงการ',
          projectId: task.projectId,
          creatorEmployeeId: currentUserId,
          version: 1,
          lastUpdated: date,
          updatedBy: currentUserName,
          history: [{ version: 1, updatedBy: currentUserName, date, note: 'แนบลิงก์ตอนส่งงาน' }],
        };
        const created = await onAddDocument(newDoc);
        newFileIds.push(created.id);
      }

      await onSubmit(task.id, {
        status: 'review',
        reviewerEmployeeIds: reviewerIds,
        submissionNote: note.trim() || undefined,
        submissionFileIds: [...(task.submissionFileIds ?? []), ...newFileIds],
        reviewNote: '',
      });
      onClose();
    } catch {
      setFormError('ส่งงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {task && (
        <motion.div key="submit-task-modal" className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/15 backdrop-blur-sm"
            onClick={onClose}
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
            role="dialog" aria-modal="true" aria-label="ส่งงาน" className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">ส่งงาน</h3>
                <p className="text-[11px] text-[#6F6F6F] mt-0.5 truncate">{task.title}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-1 space-y-3">
                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    ผู้ตรวจงาน <span className="text-[#FF6537]">*</span> <span className="font-normal text-[#767676]">(เลือกได้มากกว่า 1)</span>
                  </label>
                  <EmployeeMultiSelect
                    employees={selectableEmployees}
                    valueIds={reviewerIds}
                    onChange={setReviewerIds}
                    placeholder="ค้นหาหรือเลือกพนักงาน..."
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">บันทึกถึงผู้ตรวจ (ไม่บังคับ)</label>
                  <textarea
                    rows={3}
                    placeholder="สรุปสิ่งที่ทำเสร็จแล้ว หรือสิ่งที่อยากให้ตรวจเป็นพิเศษ..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                  />
                </div>

                <div>
                  <label className="block text-[#272220] font-bold text-[11px] mb-1">
                    ไฟล์แนบ (ไม่บังคับ) <span className="font-normal text-[#767676]">— ไม่เกิน {formatFileSize(MAX_FILE_BYTES)} ต่อไฟล์</span>
                  </label>

                  {existingFiles.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {existingFiles.map((doc) => {
                        const { Icon, color } = getItemVisual(doc);
                        return (
                          <div key={doc.id} className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-xl bg-white">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                              <Icon size={16} className={color} />
                            </div>
                            <span className="truncate flex-1 text-xs font-medium text-[#272220]">{doc.name}</span>
                            <span className="text-[11px] text-[#767676] shrink-0">ส่งไปแล้ว</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 justify-center p-3 border border-dashed border-[#E5E5E5] rounded-lg cursor-pointer hover:bg-slate-50 text-xs text-[#6F6F6F]">
                      <Paperclip size={14} />
                      แนบไฟล์
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleFilesPicked(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {fileError && <p className="text-xs text-red-600 mt-1.5">{fileError}</p>}

                  <div className="flex gap-2 mt-2">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPickedLink(); } }}
                      placeholder="แปะลิงก์ที่นี่แล้วกด + เพื่อแนบ..."
                      className="flex-1 min-w-0 p-2.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                    />
                    <button
                      type="button"
                      onClick={addPickedLink}
                      disabled={!linkUrl.trim()}
                      className="w-10 h-10 shrink-0 rounded-lg border border-[#E5E5E5] text-[#6F6F6F] hover:bg-slate-50 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Link2 size={15} />
                    </button>
                  </div>

                  {(pickedFiles.length > 0 || pickedLinks.length > 0) && (
                    <div className="space-y-1.5 mt-2">
                      {pickedFiles.map((f, idx) => {
                        const { Icon, color } = getItemVisual({ kind: 'file', name: f.name, fileMimeType: f.type });
                        return (
                          <div key={`file-${idx}`} className="flex items-center gap-2.5 p-2.5 border border-[#FFD9C7] rounded-xl bg-[#FFF1EC]">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                              <Icon size={16} className={color} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[#272220]">{f.name}</p>
                              <p className="text-[11px] text-[#767676]">{formatFileSize(f.size)}</p>
                            </div>
                            <button type="button" onClick={() => removePickedFile(idx)} className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                      {pickedLinks.map((link, idx) => {
                        const { Icon, color } = getItemVisual({ kind: 'link', name: link.name });
                        return (
                          <div key={`link-${idx}`} className="flex items-center gap-2.5 p-2.5 border border-[#FFD9C7] rounded-xl bg-[#FFF1EC]">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                              <Icon size={16} className={color} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[#272220]">{link.name}</p>
                              <p className="truncate text-[11px] text-[#767676]">{link.url}</p>
                            </div>
                            <button type="button" onClick={() => removePickedLink(idx)} className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
                )}
              </div>

              <div className="shrink-0 px-5 pt-4 pb-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-10 text-sm font-semibold text-[#6F6F6F] hover:bg-slate-50 rounded-lg border border-[#E5E5E5] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={`flex-1 h-10 text-white font-bold text-sm rounded-lg transition-colors ${
                    isFormValid && !isSubmitting ? 'bg-[#FF6537] hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'กำลังส่งงาน...' : 'ส่งงาน'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
