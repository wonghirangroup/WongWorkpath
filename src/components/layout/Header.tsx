import { Bell, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import logo from '../../../images/pp.png';
import profileImage from '../../../images/profile.png';

function getThaiDateString() {
  return new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

interface HeaderProps {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export default function Header({ isMobileMenuOpen, onToggleMobileMenu }: HeaderProps) {
  const { currentUser, notifications, unreadCount, handleLogout, handleMarkAllNotificationsRead } = useAppData();
  const [showNotificationPane, setShowNotificationPane] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!currentUser) return null;

  return (
    <header className="bg-[#272220] text-white h-[93px] px-8 flex items-center justify-between shrink-0 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-1 hover:bg-[#FF6537] rounded-lg md:hidden cursor-pointer"
          id="mobile-menu-toggle"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="flex items-center gap-3.5">
          <img src={logo} alt="Wong Workpath" className="w-16 h-16 rounded-xl shrink-0" />
          <div className="w-px h-15 bg-white/50" />
          <div>
            <span className="font-semibold text-2xl tracking-wider block">
              <span className="text-[#FF6537]">Wong</span> <span className="text-[#FFFFFF]">Workpath</span>
            </span>
            <span className="text-sm text-[#FFFFFF] -mt-0 block"> ระบบบริหารจัดการและติดตามสถานะการทำงาน</span>
          </div>
        </div>
      </div>

      {/* Action icons & Notifications pane */}
      <div className="flex items-center gap-6 relative">

        {/* Current Date in Thai */}
        <div className="hidden sm:block text-right text-sm">
          <p className="font-semibold text-white text-lg">{getThaiDateString()}</p>
          <p className="text-sm text-[#A0A0A0]">เวลาทำงาน 08:00 - 17:00 น.</p>
        </div>

        {/* Unread count badge */}
        <button
          onClick={() => { setShowNotificationPane(!showNotificationPane); setShowUserMenu(false); }}
          className="p-2 hover:bg-[#FF6537] rounded-xl relative cursor-pointer"
          id="btn-bell-toggle"
        >
          <Bell size={28} className="text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[#f4622f]">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Current User & Logout */}
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotificationPane(false); }}
          className="flex items-center gap-3 cursor-pointer"
          id="btn-user-menu"
        >
          <img
            src={profileImage}
            alt={currentUser.name}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-[#FF6537]"
          />
          <div className="hidden sm:block text-sm text-left">
            <p className="font-bold text-[#FFFFFF] text-base">{currentUser.name}</p>
            <p className="text-sm text-[#A0A0A0]">{currentUser.role}</p>
          </div>
          <ChevronDown size={22} className="text-white/80 hidden sm:block" />
        </button>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 top-16 bg-white border border-slate-200 w-56 rounded-2xl shadow-xl py-2 text-sm text-slate-800 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-800 truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser.role}</p>
            </div>
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
                      notif.read ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-indigo-50/40 border-indigo-100 font-medium'
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
    </header>
  );
}
