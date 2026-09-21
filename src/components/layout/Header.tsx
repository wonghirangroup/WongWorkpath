import { Bell, CheckCheck, ChevronDown, Menu, X, Settings, Crown } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAppData } from '../../context/AppDataContext';
import { getAvatarColor } from '../../lib/avatarColor';
import { getDepartmentTagClass } from '../../lib/departmentColors';
import { ACCOUNT_TYPE_LABELS } from '../../lib/permissions';
import LogoutConfirmModal from './LogoutConfirmModal';
import logo from '../../../images/pp.png';
import logoutIcon from '../../../images/new side bar/logout icon active.png';
import { formatRelativeTimeTh } from '../../lib/datetime';
import { getNotificationVisual } from './notificationVisual';
import { useOpenNotification } from './useOpenNotification';

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
  const { currentUser, notifications, unreadCount, handleLogout, handleMarkAllNotificationsRead } = useAppData();
  const navigate = useNavigate();
  const [showNotificationPane, setShowNotificationPane] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPaneRef = useRef<HTMLDivElement>(null);
  const openNotification = useOpenNotification();

  // Outside click / Escape closes the bell panel. The bell button itself is excluded so its own
  // toggle click doesn't close-then-reopen the panel in the same press.
  useEffect(() => {
    if (!showNotificationPane) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationPaneRef.current?.contains(target) || bellButtonRef.current?.contains(target)) return;
      setShowNotificationPane(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotificationPane(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotificationPane]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!currentUser) return null;

  const displayName = `คุณ${currentUser.nickname || currentUser.name}`;
  const displayRoleFull = currentUser.role;
  const displayRole = displayRoleFull.length > ROLE_MAX_CHARS
    ? `${displayRoleFull.slice(0, ROLE_MAX_CHARS)}...`
    : displayRoleFull;

  const visibleNotifications = notificationFilter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <header className="bg-[#F6F6F6] text-[#272220] h-16 sm:h-20 lg:h-auto px-4 sm:px-6 lg:px-8 flex items-center lg:items-start lg:pt-7 justify-between shrink-0 sticky top-0 z-40">
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
          {title ? (
            <>
              <h1 className="text-[32px] font-bold text-[#000000] leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className={`text-[20px] font-normal text-[#515151] ${typeof subtitle === 'string' ? 'truncate' : ''}`}>
                  {subtitle}
                </p>
              )}
            </>
          ) : (
            subtitle && (
              <div className={`text-[28px] leading-tight ${typeof subtitle === 'string' ? 'truncate' : ''}`}>
                {subtitle}
              </div>
            )
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
          ref={bellButtonRef}
          onClick={() => { setShowNotificationPane(!showNotificationPane); setShowUserMenu(false); }}
          className="p-1.5 hover:bg-orange-50 rounded-xl relative cursor-pointer"
          id="btn-bell-toggle"
          aria-label={unreadCount > 0 ? `การแจ้งเตือน (ยังไม่อ่าน ${unreadCount} รายการ)` : 'การแจ้งเตือน'}
        >
          <Bell size={24} className="text-[#272220]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-[#F50C0C] text-[10px] font-bold text-white rounded-full flex items-center justify-center ring-2 ring-[#F6F6F6]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Current User & Logout */}
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotificationPane(false); }}
          className="flex items-center gap-2.5 cursor-pointer"
          id="btn-user-menu"
        >
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
              style={{ backgroundColor: getAvatarColor(currentUser.name) }}
            >
              {currentUser.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="hidden sm:block text-sm text-left">
            <p className="font-bold text-[#272220] text-[18px] whitespace-nowrap">{displayName}</p>
            <p className="text-[13px] text-[#A0A0A0] whitespace-nowrap">{displayRole}</p>
          </div>
          <ChevronDown
            size={20}
            className={`text-slate-500 hidden sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
          />
        </button>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 top-16 bg-white border border-slate-200 w-56 rounded-2xl shadow-xl py-2 text-sm text-slate-800 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{displayRoleFull}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(currentUser.department)}`}>
                  {currentUser.department}
                </span>
                {currentUser.accountType !== 'employee' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full leading-none text-[#FF6537] bg-black border border-[#FF6537]">
                    <Crown size={9} className="fill-current" />
                    {ACCOUNT_TYPE_LABELS[currentUser.accountType]}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
              id="btn-settings"
            >
              <Settings size={16} />
              <span>การตั้งค่า</span>
            </button>
            <button
              onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[#FF4E4E] font-semibold hover:bg-orange-50 cursor-pointer"
              id="btn-logout-header"
            >
              <img src={logoutIcon} alt="" className="w-4 h-4 object-contain shrink-0" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}

        {/* Notifications Dropdown Panel */}
        {/* Brand-orange panel in the same popover shell as the app's other menus (white rounded-2xl,
            motion fade+slide). Each row: a type icon, title, 2-line message, relative time, and an
            orange unread dot; clicking opens the linked project (see useOpenNotification). */}
        <AnimatePresence>
          {showNotificationPane && (
            <motion.div
              ref={notificationPaneRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-16 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="px-4 pt-4 pb-3 border-b border-[#EDEEEF] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#272220]">การแจ้งเตือน</h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-semibold text-[#E04D1D] bg-[#FFF1EC] px-2 py-0.5 rounded-full">
                        ใหม่ {unreadCount}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    disabled={unreadCount === 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#E04D1D] hover:underline cursor-pointer disabled:text-[#A0A0A0] disabled:no-underline disabled:cursor-default"
                  >
                    <CheckCheck size={14} />
                    อ่านทั้งหมดแล้ว
                  </button>
                </div>
                <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit">
                  {([['all', 'ทั้งหมด'], ['unread', 'ยังไม่อ่าน']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNotificationFilter(value)}
                      className={`px-3.5 h-7 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        notificationFilter === value ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
                {visibleNotifications.length === 0 ? (
                  <div className="flex flex-col items-center text-center px-6 py-10">
                    <div className="w-12 h-12 rounded-full bg-[#F4F4F5] flex items-center justify-center mb-3">
                      <Bell size={20} className="text-[#6F6F6F]" />
                    </div>
                    <p className="text-sm font-semibold text-[#272220]">
                      {notificationFilter === 'unread' ? 'อ่านครบทุกรายการแล้ว' : 'ยังไม่มีการแจ้งเตือน'}
                    </p>
                    <p className="text-xs text-[#6F6F6F] mt-1">งานที่ได้รับมอบหมาย ผลตรวจงาน และนัดประชุม จะแสดงที่นี่</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#F4F4F4]">
                    {visibleNotifications.map((notif) => {
                      const { Icon, bg, fg } = getNotificationVisual(notif);
                      return (
                        <li key={notif.id}>
                          <button
                            type="button"
                            onClick={() => { openNotification(notif); setShowNotificationPane(false); }}
                            className={`w-full text-left flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              notif.read ? 'bg-white hover:bg-slate-50' : 'bg-[#FEFAF9] hover:bg-[#FFF1EC]'
                            }`}
                          >
                            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color: fg }}>
                              <Icon size={17} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-[13px] leading-snug ${notif.read ? 'font-medium text-[#515151]' : 'font-semibold text-[#272220]'}`}>
                                {notif.title}
                              </span>
                              <span className="block text-xs text-[#6F6F6F] mt-0.5 line-clamp-2">{notif.message}</span>
                              <span className="block text-[11px] text-[#6F6F6F] mt-1">{formatRelativeTimeTh(notif.timestamp)}</span>
                            </span>
                            {!notif.read && (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#FF6537] mt-1.5 shrink-0" aria-hidden="true" />
                                <span className="sr-only">ยังไม่อ่าน</span>
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout(); }}
      />
    </header>
  );
}
