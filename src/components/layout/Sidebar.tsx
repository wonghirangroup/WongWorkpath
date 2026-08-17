import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

import minimizeNotActive from '../../../images/icon menu/minimize not active 1-2.png';
import minimizeHold from '../../../images/icon menu/minimize hold 2-2.png';
import m1Active from '../../../images/icon menu/m1 active.png';
import m1Inactive from '../../../images/icon menu/m1 not active.png';
import m2Active from '../../../images/icon menu/m2 active.png';
import m2Inactive from '../../../images/icon menu/m2 not active.png';
import m3Active from '../../../images/icon menu/m3 active.png';
import m3Inactive from '../../../images/icon menu/m3 not active.png';
import m4Active from '../../../images/icon menu/m4 active.png';
import m4Inactive from '../../../images/icon menu/m4 not active.png';
import m5Active from '../../../images/icon menu/m5 active.png';
import m5Inactive from '../../../images/icon menu/m5 not active.png';
import m6Active from '../../../images/icon menu/m6 active.png';
import m6Inactive from '../../../images/icon menu/m6 not active.png';
import m7Active from '../../../images/icon menu/m7 active.png';
import m7Inactive from '../../../images/icon menu/m7 not active.png';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'แดชบอร์ด', iconActive: m1Active, iconInactive: m1Inactive },
  { id: 'tasks', label: 'จัดการงานและโครงงาน', iconActive: m2Active, iconInactive: m2Inactive },
  { id: 'calendar', label: 'ปฏิทินและตารางเวลา', iconActive: m3Active, iconInactive: m3Inactive },
  { id: 'gantt', label: 'ตารางภาระงาน', iconActive: m4Active, iconInactive: m4Inactive },
  { id: 'docs', label: 'ห้องเก็บเอกสาร Drive', iconActive: m5Active, iconInactive: m5Inactive },
  { id: 'reports', label: 'การออกรายงาน', iconActive: m6Active, iconInactive: m6Inactive },
  { id: 'vault', label: 'คลังรหัสผ่าน', iconActive: m7Active, iconInactive: m7Inactive },
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
      {/* Sidebar Nav (Desktop) */}
      <aside
        className={`hidden lg:flex flex-col ${isCollapsed ? 'w-16' : 'w-58'} bg-[#272220] py-6 px-2 shrink-0 justify-between overflow-y-auto transition-[width] duration-300 ease-in-out`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2.5">
            <span
              className={`text-[13px] font-medium text-[#FFFFFF] uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed ? 'max-w-0 opacity-0' : 'max-w-45 opacity-100'
              }`}
            >
              แผงควบคุมหลัก
            </span>
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="group relative w-6 h-6 shrink-0 rounded-lg flex items-center justify-center cursor-pointer"
              title={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
              id="btn-sidebar-collapse"
            >
              <span className={`relative w-4 h-4 shrink-0 transition-transform duration-300 ease-in-out ${isCollapsed ? 'rotate-180' : ''}`}>
                <img
                  src={minimizeNotActive}
                  alt=""
                  className="absolute inset-0 w-4 h-4 object-contain transition-opacity duration-150 ease-out opacity-100 group-hover:opacity-0"
                />
                <img
                  src={minimizeHold}
                  alt=""
                  className="absolute inset-0 w-4 h-4 object-contain transition-opacity duration-150 ease-out opacity-0 group-hover:opacity-100"
                />
              </span>
            </button>
          </div>

          <nav className="space-y-0.5">
            {NAV_ITEMS.map(({ id, label, iconActive, iconInactive }) => {
              const isActive = pathname === `/${id}`;
              return (
                <Link
                  key={id}
                  to={`/${id}`}
                  className={`group relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ease-out cursor-pointer ${
                    isActive ? 'text-white' : 'text-[#6F6F6F] hover:text-white'
                  }`}
                  id={`menu-${id}`}
                  title={isCollapsed ? label : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-xl bg-[#FF6537]"
                      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                    />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-xl bg-[rgba(255,91,38,0)] group-hover:bg-[rgba(255,91,38,0.1)] transition-colors duration-150 ease-out" />
                  )}

                  <span className="relative z-10 w-4.5 h-4.5 shrink-0">
                    <img
                      src={iconInactive}
                      alt=""
                      className={`absolute inset-0 w-4.5 h-4.5 object-contain transition-opacity duration-150 ease-out ${isActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                    />
                    <img
                      src={iconActive}
                      alt=""
                      className={`absolute inset-0 w-4.5 h-4.5 object-contain transition-opacity duration-150 ease-out ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-[#FF4E4E] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          id="btn-logout"
          title={isCollapsed ? 'ออกจากระบบ' : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
              isCollapsed ? 'max-w-0 opacity-0' : 'max-w-45 opacity-100'
            }`}
          >
            ออกจากระบบ
          </span>
        </button>
      </aside>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden flex" onClick={onCloseMobileMenu}>
          <div className="bg-[#1c1c1e] w-64 h-full p-5 space-y-6 flex flex-col justify-between overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="font-bold text-sm text-white">Wong Workpath</span>
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
              <LogOut size={15} className="shrink-0" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
