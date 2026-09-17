import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Clock, MapPin, Link2, Ban } from 'lucide-react';
import { Employee, Meeting } from '../../types';
import { displayName, formatThaiDateShort } from './CreateProjectModal';
import { getAvatarColor } from '../../lib/avatarColor';
import { isUrl } from '../../lib/url';
import { useEscapeToClose } from '../../lib/useEscapeToClose';

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  employees: Employee[];
  onClose: () => void;
}

// Read-only detail view for a meeting that isn't tied to any project — those only ever showed up
// as an inert (non-clickable, disabled) row on the Calendar page before, since project-linked
// meetings already had somewhere to navigate to (the project itself) and standalone ones had
// nowhere to go. This gives them a real destination: time, description, and location/link spelled
// out in full, mirroring TaskDetailModal's own read-only pattern.
export default function MeetingDetailModal({ meeting, employees, onClose }: MeetingDetailModalProps) {
  useEscapeToClose(Boolean(meeting), onClose);
  const attendees = meeting ? employees.filter((e) => meeting.attendeeIds.includes(e.id)) : [];
  const creator = meeting?.createdBy ? employees.find((e) => e.id === meeting.createdBy) : undefined;
  const isCancelled = meeting?.status === 'cancelled';
  // Pre-existing meetings from before location/meetingLink were split may still have a URL sitting
  // in `location` alone — still link-ify that case so older data doesn't regress to plain text.
  const legacyLocationIsLink = meeting?.location && !meeting.meetingLink ? isUrl(meeting.location) : false;

  return createPortal(
    <AnimatePresence>
      {meeting && (
        <motion.div key="meeting-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center">
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
            className="relative bg-white rounded-2xl shadow-[0px_12px_36px_-8px_rgba(0,0,0,0.12)] w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 mb-1.5">
                    <Ban size={11} /> ยกเลิกแล้ว
                  </span>
                )}
                <h3 className={`text-base font-bold text-slate-800 break-words ${isCancelled ? 'line-through' : ''}`}>{meeting.title}</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" type="button">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">วัน-เวลา</p>
                <p className="text-sm text-[#272220] flex items-center gap-1.5">
                  <Clock size={14} className="text-[#A0A0A0] shrink-0" />
                  {formatThaiDateShort(meeting.date)} · {meeting.startTime}{meeting.endTime ? ` - ${meeting.endTime}` : ''}
                </p>
              </div>

              {meeting.description && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">รายละเอียด</p>
                  <p className="text-sm text-[#272220] whitespace-pre-wrap break-words">{meeting.description}</p>
                </div>
              )}

              {meeting.location && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">สถานที่</p>
                  {legacyLocationIsLink ? (
                    <a
                      href={meeting.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#FF6537] hover:underline break-all flex items-center gap-1.5"
                    >
                      <Link2 size={14} className="shrink-0" />
                      {meeting.location}
                    </a>
                  ) : (
                    <p className="text-sm text-[#272220] flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#A0A0A0] shrink-0" />
                      {meeting.location}
                    </p>
                  )}
                </div>
              )}

              {meeting.meetingLink && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">ลิงก์ประชุมออนไลน์</p>
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#FF6537] hover:underline break-all flex items-center gap-1.5"
                  >
                    <Link2 size={14} className="shrink-0" />
                    {meeting.meetingLink}
                  </a>
                </div>
              )}

              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">ผู้สร้าง</p>
                {creator ? (
                  <span className="flex items-center gap-2">
                    {creator.avatar ? (
                      <img src={creator.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: getAvatarColor(displayName(creator)) }}
                      >
                        {displayName(creator).trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-[#272220]">{displayName(creator)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-[#A0A0A0]">ไม่ทราบผู้สร้าง</span>
                )}
              </div>

              <div>
                <p className="text-[#A0A0A0] text-[11px] mb-1">ผู้เข้าร่วม</p>
                {attendees.length > 0 ? (
                  <div className="space-y-1.5">
                    {attendees.map((employee) => (
                      <span key={employee.id} className="flex items-center gap-2">
                        {employee.avatar ? (
                          <img src={employee.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: getAvatarColor(displayName(employee)) }}
                          >
                            {displayName(employee).trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm text-[#272220]">{displayName(employee)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-[#A0A0A0]">ยังไม่มี</span>
                )}
              </div>

              {isCancelled && meeting.cancellationReason && (
                <div>
                  <p className="text-[#A0A0A0] text-[11px] mb-1">เหตุผลที่ยกเลิก</p>
                  <p className="text-sm text-red-600 whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded-lg px-3 py-2">{meeting.cancellationReason}</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
