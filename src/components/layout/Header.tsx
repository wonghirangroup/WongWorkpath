import { Bell, LogOut, ChevronDown, Menu, X, Pencil } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAppData } from '../../context/AppDataContext';
import { ApiError } from '../../lib/api';
import logo from '../../../images/pp.png';
import profileImage from '../../../images/profiles.png';

// Intl's 'short' weekday for th-TH falls back to the full name (e.g. "พุธ"), not the
// period-abbreviated form ("พ.") used elsewhere in the app, so it's mapped by hand here.
const THAI_WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function getThaiDateString() {
  const now = new Date();
  const weekday = THAI_WEEKDAY_SHORT[now.getDay()];
  const rest = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(now);
  return `${weekday} ${rest}`;
}

const ROLE_MAX_CHARS = 13;

interface HeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export default function Header({ title, subtitle, isMobileMenuOpen, onToggleMobileMenu }: HeaderProps) {
  const { currentUser, notifications, unreadCount, handleLogout, handleMarkAllNotificationsRead, handleUpdateEmployee } = useAppData();
  const [showNotificationPane, setShowNotificationPane] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [profileFormError, setProfileFormError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  if (!currentUser) return null;

  const openEditProfile = () => {
    setEditName(currentUser.name);
    setEditRole(currentUser.role);
    setEditAvatar(currentUser.avatar || '');
    setProfileFormError('');
    setShowEditProfile(true);
    setShowUserMenu(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editRole.trim() || isSavingProfile) return;
    setProfileFormError('');
    setIsSavingProfile(true);
    try {
      await handleUpdateEmployee(currentUser.id, { name: editName.trim(), role: editRole.trim(), avatar: editAvatar.trim() || undefined });
      setShowEditProfile(false);
    } catch (err) {
      setProfileFormError(err instanceof ApiError ? err.message : 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const displayName = currentUser.name;
  const displayRoleFull = currentUser.role;
  const displayRole = displayRoleFull.length > ROLE_MAX_CHARS
    ? `${displayRoleFull.slice(0, ROLE_MAX_CHARS)}...`
    : displayRoleFull;

  return (
    <header className="bg-white text-[#272220] h-16 sm:h-20 px-4 sm:px-6 lg:px-8 flex items-center lg:items-start lg:pt-7 justify-between shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1 hover:bg-orange-50 rounded-lg lg:hidden cursor-pointer shrink-0"
          id="mobile-menu-toggle"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0 lg:hidden">
          <img src={logo} alt="Wong Workpath" className="w-9 h-9 rounded-xl shrink-0" />
          <span className="font-semibold text-base tracking-wider block truncate">
            <span className="text-[#FF6537]">Wong</span> <span className="text-[#272220]">Workpath</span>
          </span>
        </div>

        <div className="hidden lg:block min-w-0">
          <h1 className="text-[32px] font-bold text-[#000000] leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className={`text-[20px] font-normal text-[#515151] ${typeof subtitle === 'string' ? 'truncate' : ''}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Action icons & Notifications pane */}
      <div className="flex items-center gap-2 sm:gap-5 relative shrink-0 ml-auto">

        {/* Current Date in Thai */}
        <div className="hidden lg:block text-right text-sm">
          <p className="font-normal text-[#272220] text-[16px]">{getThaiDateString()}</p>
        </div>

        <div className="hidden lg:block w-px h-10 bg-[#666666]" />

        {/* Unread count badge */}
        <button
          onClick={() => { setShowNotificationPane(!showNotificationPane); setShowUserMenu(false); }}
          className="p-1.5 hover:bg-orange-50 rounded-xl relative cursor-pointer"
          id="btn-bell-toggle"
        >
          <Bell size={24} className="text-[#272220]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-xs font-bold text-white w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Current User & Logout */}
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotificationPane(false); }}
          className="flex items-center gap-2.5 cursor-pointer"
          id="btn-user-menu"
        >
          <img
            src={currentUser.avatar || profileImage}
            alt={currentUser.name}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover"
          />
          <div className="hidden sm:block text-sm text-left">
            <p className="font-bold text-[#272220] text-[18px] whitespace-nowrap">{displayName}</p>
            <p className="text-[13px] text-[#A0A0A0] whitespace-nowrap">{displayRole}</p>
          </div>
          <ChevronDown size={20} className="text-slate-500 hidden sm:block" />
        </button>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 top-16 bg-white border border-slate-200 w-56 rounded-2xl shadow-xl py-2 text-sm text-slate-800 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{displayRoleFull}</p>
            </div>
            <button
              onClick={openEditProfile}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
              id="btn-edit-profile"
            >
              <Pencil size={16} />
              <span>แก้ไขโปรไฟล์</span>
            </button>
            <button
              onClick={() => { setShowUserMenu(false); handleLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[#f4622f] font-semibold hover:bg-orange-50 cursor-pointer"
              id="btn-logout-header"
            >
              <LogOut size={16} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}

        {/* Notifications Dropdown Panel */}
        {showNotificationPane && (
          <div className="absolute right-0 top-16 bg-white border border-slate-200 w-80 rounded-2xl shadow-xl p-4 text-xs text-slate-800 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-3">
              <h4 className="font-bold text-slate-900">🔔 การแจ้งเตือนล่าสุด ({unreadCount})</h4>
              <button
                onClick={handleMarkAllNotificationsRead}
                className="text-[10px] text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                ทำเครื่องหมายอ่านแล้ว
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <p className="text-center py-6 text-slate-400 italic">ไม่มีการแจ้งเตือนค้างอยู่</p>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      notif.read ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-indigo-50/40 border-indigo-100 font-medium'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800 text-[11px]">{notif.title}</span>
                      <span className="text-[9px] text-slate-400">{notif.timestamp.split(' ')[1]}</span>
                    </div>
                    <p className="text-[10px] mt-0.5 text-slate-600">{notif.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-center mt-3">
              <button
                onClick={() => setShowNotificationPane(false)}
                className="text-[10px] text-slate-400 font-semibold cursor-pointer"
              >
                ปิดแผงแจ้งเตือน
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Edit Profile modal */}
      {createPortal(
        <AnimatePresence>
          {showEditProfile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={() => setShowEditProfile(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">แก้ไขโปรไฟล์</h3>
                  <button type="button" onClick={() => setShowEditProfile(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                  {profileFormError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                      {profileFormError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ตำแหน่ง *</label>
                    <input
                      type="text"
                      required
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ลิงก์รูปโปรไฟล์ <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowEditProfile(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                    <button
                      type="submit"
                      disabled={!editName.trim() || !editRole.trim() || isSavingProfile}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                        editName.trim() && editRole.trim() && !isSavingProfile ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
                      }`}
                    >
                      {isSavingProfile ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </header>
  );
}
