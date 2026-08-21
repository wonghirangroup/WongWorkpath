import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

import logo from '../../../images/new side bar/Logo.png';
import logoutIcon from '../../../images/new side bar/logout icon active.png';
import minimizeFull from '../../../images/new side bar/minimize  full icon.png';
import minimizeSmall from '../../../images/new side bar/minimize  small icon.png';
import dashboardActive from '../../../images/new side bar/dashboard icon active.png';
import dashboardInactive from '../../../images/new side bar/dashboard icon not active.png';
import projectActive from '../../../images/new side bar/project icon active.png';
import projectInactive from '../../../images/new side bar/project icon not active.png';
import projectHover from '../../../images/new side bar/project icon hover.png';
import calendarActive from '../../../images/new side bar/calendar icon active.png';
import calendarInactive from '../../../images/new side bar/calendar icon not active.png';
import calendarHover from '../../../images/new side bar/calendar icon  hover.png';
import employeeActive from '../../../images/new side bar/employee icon active.png';
import employeeInactive from '../../../images/new side bar/employee icon not active.png';
import employeeHover from '../../../images/new side bar/employee icon hover.png';
import fileActive from '../../../images/new side bar/file icon active.png';
import fileInactive from '../../../images/new side bar/file icon not active.png';
import fileHover from '../../../images/new side bar/file icon hover.png';
import exportActive from '../../../images/new side bar/export icon active.png';
import exportInactive from '../../../images/new side bar/export icon not active.png';
import passwordActive from '../../../images/new side bar/password icon active.png';
import passwordInactive from '../../../images/new side bar/password icon not active.png';
import passwordHold from '../../../images/new side bar/password icon hold.png';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'แดชบอร์ด', iconActive: dashboardActive, iconInactive: dashboardInactive, iconHover: undefined as string | undefined },
  { id: 'tasks', label: 'จัดการงานและโครงงาน', iconActive: projectActive, iconInactive: projectInactive, iconHover: projectHover as string | undefined },
  { id: 'calendar', label: 'ปฏิทินและตารางเวลา', iconActive: calendarActive, iconInactive: calendarInactive, iconHover: calendarHover as string | undefined },
  { id: 'gantt', label: 'ตารางภาระงาน', iconActive: employeeActive, iconInactive: employeeInactive, iconHover: employeeHover as string | undefined },
  { id: 'docs', label: 'เอกสาร Drive', iconActive: fileActive, iconInactive: fileInactive, iconHover: fileHover as string | undefined },
  { id: 'reports', label: 'การออกรายงาน', iconActive: exportActive, iconInactive: exportInactive, iconHover: exportActive as string | undefined },
  { id: 'vault', label: 'คลังรหัสผ่าน', iconActive: passwordActive, iconInactive: passwordInactive, iconHover: passwordHold as string | undefined },
] as const;

interface SidebarProps {
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'unityspace_sidebar_collapsed';

export default function Sidebar({ isMobileMenuOpen, onCloseMobileMenu }: SidebarProps) {
  const { handleLogout } = useAppData();
  const { pathname } = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) return saved === 'true';
    } catch {
      // localStorage unavailable — fall through to the viewport-based default below
    }
    // No saved preference yet (first visit): default to collapsed on laptop-width
    // viewports (1024–1279px) to leave more room for the page content.
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && window.innerWidth < 1280) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // localStorage unavailable — collapse state just won't persist across reloads
    }
  }, [isCollapsed]);

  return (
    <>
      {/* Sidebar Nav (Desktop) — floats as a rounded panel spanning the full viewport height */}
      <aside
        className={`hidden lg:flex flex-col ${isCollapsed ? 'w-21.25' : 'w-60'} bg-[#000000] rounded-3xl shadow-[3px_0px_20px_rgba(0,0,0,0.5)] my-4 ml-4 shrink-0 justify-between overflow-y-auto overflow-x-hidden scrollbar-none transition-[width] duration-300 ease-in-out relative z-50`}
      >
        <div className="space-y-2">
          <div className={`flex items-center shrink-0 h-18.5 overflow-hidden ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
            <div className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-45 opacity-100'}`}>
              <img src={logo} alt="Wong Workpath" className="w-12.5 h-12.5 rounded-full shrink-0 object-cover" />
              <span className="text-base font-semibold leading-tight whitespace-nowrap">
                <span className="text-[#FF6537]">Wong</span>
                <br />
                <span className="text-white">Workpath</span>
              </span>
            </div>
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/5"
              title={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
              id="btn-sidebar-collapse"
            >
              <img src={isCollapsed ? minimizeSmall : minimizeFull} alt="" className="w-4 h-4 object-contain" />
            </button>
          </div>

          <div className="border-t border-[#666666] mx-4" />

          <nav className="space-y-0.5 px-2 pt-1.5">
            {NAV_ITEMS.map(({ id, label, iconActive, iconInactive, iconHover }) => {
              const isActive = pathname === `/${id}`;
              const hasHoverIcon = Boolean(iconHover);
              return (
                <Link
                  key={id}
                  to={`/${id}`}
                  className={`group relative w-full min-w-0 flex items-center gap-3 pl-6 pr-3.5 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ease-out cursor-pointer ${
                    isActive ? 'text-white' : 'text-[#6F6F6F] hover:text-white'
                  }`}
                  id={`menu-${id}`}
                  title={isCollapsed ? label : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className={`absolute rounded-xl bg-[#FF6537] ${isCollapsed ? 'inset-y-0 left-3 right-3' : 'inset-0'}`}
                      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                    />
                  )}
                  {!isActive && (
                    <div className={`absolute rounded-xl bg-[rgba(255,91,38,0)] group-hover:bg-[rgba(255,91,38,0.1)] transition-colors duration-150 ease-out ${isCollapsed ? 'inset-y-0 left-3 right-3' : 'inset-0'}`} />
                  )}

                  <span className="relative z-10 w-5 h-5 shrink-0">
                    <img
                      src={iconInactive}
                      alt=""
                      className={`absolute inset-0 w-5 h-5 object-contain transition-opacity duration-150 ease-out ${isActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                    />
                    {hasHoverIcon && !isActive && (
                      <img
                        src={iconHover}
                        alt=""
                        className="absolute inset-0 w-5 h-5 object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out"
                      />
                    )}
                    <img
                      src={iconActive}
                      alt=""
                      className={`absolute inset-0 w-5 h-5 object-contain transition-opacity duration-150 ease-out ${
                        isActive ? 'opacity-100' : hasHoverIcon ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                  </span>
                  <span
                    className={`relative z-10 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                      isCollapsed ? 'max-w-0 opacity-0' : 'max-w-45 opacity-100'
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="w-full min-w-0 flex items-center gap-3 pl-6 pr-3.5 py-3 rounded-xl text-sm font-medium text-[#FF4E4E] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            id="btn-logout"
            title={isCollapsed ? 'ออกจากระบบ' : undefined}
          >
            <img src={logoutIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed ? 'max-w-0 opacity-0' : 'max-w-45 opacity-100'
              }`}
            >
              ออกจากระบบ
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden flex" onClick={onCloseMobileMenu}>
          <div className="bg-[#1c1c1e] w-64 h-full p-5 space-y-6 flex flex-col justify-between overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
                  <span className="font-bold text-sm text-white">Wong Workpath</span>
                </div>
                <button onClick={onCloseMobileMenu} className="text-white cursor-pointer"><X size={18} /></button>
              </div>

              <nav className="space-y-1 mt-4">
                {NAV_ITEMS.map(({ id, label, iconActive, iconInactive }) => {
                  const isActive = pathname === `/${id}`;
                  return (
                    <Link
                      key={id}
                      to={`/${id}`}
                      onClick={onCloseMobileMenu}
                      className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isActive ? 'bg-[#f4622f] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="relative w-[15px] h-[15px] shrink-0">
                        <img
                          src={iconInactive}
                          alt=""
                          className={`absolute inset-0 w-[15px] h-[15px] object-contain transition-opacity ${isActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                        />
                        <img
                          src={iconActive}
                          alt=""
                          className={`absolute inset-0 w-[15px] h-[15px] object-contain transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        />
                      </span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <button
              onClick={() => { handleLogout(); onCloseMobileMenu(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#f4622f] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <img src={logoutIcon} alt="" className="w-3.75 h-3.75 object-contain shrink-0" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
