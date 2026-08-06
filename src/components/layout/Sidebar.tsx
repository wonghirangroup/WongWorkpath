import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

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

export default function Sidebar({ isMobileMenuOpen, onCloseMobileMenu }: SidebarProps) {
  const { handleLogout } = useAppData();
  const { pathname } = useLocation();

  return (
    <>
      {/* Sidebar Nav (Desktop) */}
      <aside className="hidden md:flex flex-col w-[270px] bg-[#272220] py-7 px-2.5 shrink-0 justify-between overflow-y-auto">
        <div className="space-y-2.5">
          <span className="text-sm font-medium text-[#FFFFFF] uppercase tracking-widest block px-3">
            แผงควบคุมหลัก
          </span>

          <nav className="space-y-0.5">
            {NAV_ITEMS.map(({ id, label, iconActive, iconInactive }) => {
              const isActive = pathname === `/${id}`;
              return (
                <Link
                  key={id}
                  to={`/${id}`}
                  className={`group relative w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[15px] text-base font-medium transition-colors duration-150 ease-out cursor-pointer ${
                    isActive ? 'text-white' : 'text-[#6F6F6F] hover:text-white'
                  }`}
                  id={`menu-${id}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-[15px] bg-[#FF6537]"
                      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                    />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-[15px] bg-[rgba(255,91,38,0)] group-hover:bg-[rgba(255,91,38,0.1)] transition-colors duration-150 ease-out" />
                  )}

                  <span className="relative z-10 w-5 h-5 shrink-0">
                    <img
                      src={iconInactive}
                      alt=""
                      className={`absolute inset-0 w-5 h-5 object-contain transition-opacity duration-150 ease-out ${isActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                    />
                    <img
                      src={iconActive}
                      alt=""
                      className={`absolute inset-0 w-5 h-5 object-contain transition-opacity duration-150 ease-out ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    />
                  </span>
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[15px] text-base font-medium text-[#FF4E4E] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          id="btn-logout"
        >
          <LogOut size={20} />
          <span>ออกจากระบบ</span>
        </button>
      </aside>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden flex" onClick={onCloseMobileMenu}>
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
              <LogOut size={15} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
