import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Briefcase, Network, LayoutGrid, List, Crown, AtSign, Mail, Phone, LocateFixed } from 'lucide-react';
import { Employee } from '../types';
import { ACCOUNT_TYPE_LABELS } from '../lib/permissions';
import { getAvatarColor } from '../lib/avatarColor';
import { getDepartmentTagClass } from '../lib/departmentColors';
import { DEFAULT_ORG_DIVISIONS, OrgDivisionData } from '../data/orgStructure';
import Dropdown from './Dropdown';
import Tooltip from './Tooltip';
import OrgChart, { OrgChartHandle, EmployeeLocateSearch } from './OrgChart';

interface EmployeeDirectoryProps {
  employees: Employee[];
  orgDivisions: OrgDivisionData[];
  currentUserId?: string;
}

// Read-only mirror of EmployeeManagement for a plain employee's own view — same toolbar/search/
// view-toggle/tab chrome and the exact same OrgChart canvas, just with the audit-log tab and every
// add/edit/delete affordance removed, and the employee list narrowed to the 8 fields the spec
// allows: ชื่อ-นามสกุล, ชื่อเล่น, เบอร์โทร, E-mail, สิทธิใช้งาน, ตำแหน่ง, ฝ่าย, แผนก.
export default function EmployeeDirectory({ employees, orgDivisions, currentUserId }: EmployeeDirectoryProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'org'>('employees');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('__all__');
  const [orgFilterDivision, setOrgFilterDivision] = useState('__all__');
  const [markedId, setMarkedId] = useState<string | null>(null);
  const orgChartRef = useRef<OrgChartHandle>(null);
  const currentUserInOrgChart = Boolean(currentUserId && employees.some((e) => e.id === currentUserId));
  const orgSections = useMemo(() => orgDivisions.flatMap((d) => d.sections), [orgDivisions]);
  const noop = () => {};

  useEffect(() => {
    if (!markedId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-markable-id]')) return;
      setMarkedId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [markedId]);

  const [tableMaxHeight, setTableMaxHeight] = useState<number>();
  const tableWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function updateTableMaxHeight() {
      if (!tableWrapRef.current) return;
      const top = tableWrapRef.current.getBoundingClientRect().top;
      setTableMaxHeight(window.innerHeight - top - 18);
    }
    updateTableMaxHeight();
    window.addEventListener('resize', updateTableMaxHeight);
    return () => window.removeEventListener('resize', updateTableMaxHeight);
  }, [activeTab, viewMode]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesSearch = !query || emp.name.toLowerCase().includes(query) || (emp.nickname ?? '').toLowerCase().includes(query) || emp.email.toLowerCase().includes(query);
      const matchesDepartment = departmentFilter === '__all__' || emp.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [employees, searchTerm, departmentFilter]);

  // Every role gets a visible "สิทธิใช้งาน" badge (management's own card only bothers to badge
  // non-employee accounts, since its own row already has other cues for "this is a normal
  // employee" — this directory's whole point is showing the field explicitly for everyone).
  const accountBadge = (emp: Employee, size: 'sm' | 'xs' = 'sm') => (
    <span
      className={`shrink-0 inline-flex items-center gap-1 font-bold uppercase px-2 py-0.5 rounded-full leading-none ${
        size === 'sm' ? 'text-[9px]' : 'text-[8px]'
      } ${emp.accountType !== 'employee' ? 'text-[#FF6537] bg-black border border-[#FF6537]' : 'text-[#6F6F6F] bg-slate-100 border border-slate-200'}`}
    >
      {emp.accountType !== 'employee' && <Crown size={9} className="fill-current" />}
      {ACCOUNT_TYPE_LABELS[emp.accountType]}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1 space-y-4">
        {activeTab === 'employees' ? (
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative w-full lg:w-137.5 lg:flex-none">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาพนักงาน (ชื่อ / อีเมล)"
                className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
              />
              {searchTerm && (
                <Tooltip content="ล้างคำค้นหา">
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={15} />
                  </button>
                </Tooltip>
              )}
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
                <Tooltip content="มุมมองการ์ด">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${viewMode === 'grid' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                    aria-label="มุมมองการ์ด"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="มุมมองรายการ">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${viewMode === 'list' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
                    aria-label="มุมมองรายการ"
                  >
                    <List size={15} />
                  </button>
                </Tooltip>
              </div>

              <div className="w-36 h-10">
                <Dropdown<string>
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  options={[{ value: '__all__', label: 'ทุกแผนก' }, ...orgSections.map((d) => ({ value: d, label: d }))]}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="w-full lg:w-137.5 lg:flex-none">
              <EmployeeLocateSearch employees={employees} onSelect={(id) => orgChartRef.current?.focusOnEmployee(id)} />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-44 h-9 shrink-0">
                <Dropdown<string>
                  value={orgFilterDivision}
                  onChange={setOrgFilterDivision}
                  size="compact"
                  options={[{ value: '__all__', label: 'ทุกฝ่าย' }, ...orgDivisions.map((d) => ({ value: d.name, label: d.name }))]}
                />
              </div>
              {currentUserInOrgChart && (
                <Tooltip content="ไปที่ตำแหน่งของฉันในผังองค์กร">
                  <button
                    type="button"
                    onClick={() => orgChartRef.current?.focusOnEmployee(currentUserId!)}
                    aria-label="ตำแหน่งของฉัน"
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-[#6F6F6F] bg-[#F4F4F5] hover:bg-slate-200 cursor-pointer transition-colors shrink-0"
                  >
                    <LocateFixed size={13} /> ตำแหน่งของฉัน
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'employees' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
            }`}
          >
            <Briefcase size={13} /> รายชื่อพนักงาน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('org')}
            className={`flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'org' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
            }`}
          >
            <Network size={13} /> โครงสร้างองค์กร
          </button>
        </div>
      </div>

      {activeTab === 'employees' ? (
        <>
          <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredEmployees.length} คน</p>

          {filteredEmployees.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
              {employees.length === 0 ? 'ยังไม่มีพนักงานในระบบ' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  data-markable-id={emp.id}
                  onClick={() => setMarkedId(emp.id)}
                  className={`bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
                    markedId === emp.id ? 'shadow-lg' : ''
                  }`}
                  style={markedId === emp.id ? { transform: 'translateY(-4px)' } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {emp.avatar ? (
                      <img src={emp.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: getAvatarColor(emp.name) }}
                      >
                        {emp.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-bold text-[#272220] truncate flex items-center gap-1.5">
                        <span className="truncate">{emp.nickname || emp.name}</span>
                        {accountBadge(emp)}
                      </h4>
                      {emp.nickname && emp.nickname !== emp.name && (
                        <p className="text-[11px] text-slate-400 truncate">{emp.name}</p>
                      )}
                      {emp.department && (
                        <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(emp.department)}`}>
                          {emp.department}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EDEEEF] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                      <Briefcase size={12} className="shrink-0" />
                      <span className="truncate">{emp.role}{emp.division ? ` · ${emp.division}` : ''}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                        <Phone size={12} className="shrink-0" />
                        <span className="truncate">{emp.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div ref={tableWrapRef} style={{ maxHeight: tableMaxHeight }} className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ชื่อเล่น</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">เบอร์โทร</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">E-mail</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">สิทธิใช้งาน</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ตำแหน่ง</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">ฝ่าย</th>
                    <th className="px-4 py-3 whitespace-nowrap sticky top-0 z-20 bg-[#F9F9F9]">แผนก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      data-markable-id={emp.id}
                      onClick={() => setMarkedId(emp.id)}
                      className={`border-b border-[#EDEEEF] last:border-b-0 cursor-pointer ${markedId === emp.id ? 'bg-slate-200' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                              style={{ backgroundColor: getAvatarColor(emp.name) }}
                            >
                              {emp.name.trim().charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-[13px] font-bold text-slate-900">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.nickname || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.phone || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">
                        <span className="flex items-center gap-1"><AtSign size={11} className="text-slate-300 shrink-0" />{emp.email}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{accountBadge(emp, 'xs')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.role}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">{emp.division || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.department ? (
                          <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(emp.department)}`}>
                            {emp.department}
                          </span>
                        ) : (
                          <span className="text-[#A0A0A0]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="h-[70vh]">
          <OrgChart
            ref={orgChartRef}
            employees={employees}
            orgDivisions={orgDivisions.length ? orgDivisions : DEFAULT_ORG_DIVISIONS}
            filterDivision={orgFilterDivision}
            onFilterDivisionChange={setOrgFilterDivision}
            editMode={false}
            onEditModeChange={noop}
            onAddDivision={noop}
            onRenameDivision={noop}
            onDeleteDivision={noop}
            onAddSection={noop}
            onRenameSection={noop}
            onDeleteSection={noop}
          />
        </div>
      )}
    </div>
  );
}
