import { useMemo, useRef, useState } from 'react';
import { Search, Briefcase, Network } from 'lucide-react';
import { Employee } from '../types';
import { ACCOUNT_TYPE_LABELS } from '../lib/permissions';
import { getAvatarColor } from '../lib/avatarColor';
import { getDepartmentTagClass } from '../lib/departmentColors';
import { DEFAULT_ORG_DIVISIONS, OrgDivisionData } from '../data/orgStructure';
import Dropdown from './Dropdown';
import OrgChart, { OrgChartHandle } from './OrgChart';

interface EmployeeDirectoryProps {
  employees: Employee[];
  orgDivisions: OrgDivisionData[];
}

// Read-only mirror of EmployeeManagement for a plain employee's own view — same two-tab shape
// (รายชื่อพนักงาน / โครงสร้างองค์กร), but every add/edit/delete affordance and the audit-log tab are
// gone entirely, and the employee list only ever shows the 8 fields the spec allows: ชื่อ-นามสกุล,
// ชื่อเล่น, เบอร์โทร, E-mail, สิทธิใช้งาน, ตำแหน่ง, ฝ่าย, แผนก. OrgChart is reused as-is with
// editMode permanently false and every mutating handler a no-op, since it already renders fully
// inert (no pencil/trash/+ controls) whenever editMode is off.
export default function EmployeeDirectory({ employees, orgDivisions }: EmployeeDirectoryProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'org'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('__all__');
  const [orgFilterDivision, setOrgFilterDivision] = useState('__all__');
  const orgChartRef = useRef<OrgChartHandle>(null);
  const noop = () => {};

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchesSearch = !query || emp.name.toLowerCase().includes(query) || (emp.nickname ?? '').toLowerCase().includes(query);
      const matchesDepartment = departmentFilter === '__all__' || emp.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [employees, searchTerm, departmentFilter]);

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1 space-y-3">
        {activeTab === 'employees' ? (
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative w-full lg:w-96">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาพนักงาน (ชื่อ / ชื่อเล่น)"
                className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#FF6537]"
              />
            </div>
            <div className="w-full lg:w-44">
              <Dropdown<string>
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={[
                  { value: '__all__', label: 'ทุกแผนก' },
                  ...orgDivisions.flatMap((d) => d.sections).map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="w-full lg:w-44">
            <Dropdown<string>
              value={orgFilterDivision}
              onChange={setOrgFilterDivision}
              size="compact"
              options={[{ value: '__all__', label: 'ทุกฝ่าย' }, ...orgDivisions.map((d) => ({ value: d.name, label: d.name }))]}
            />
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
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">ไม่พบรายการที่ตรงกับการค้นหา</div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                    <th className="px-4 py-3 whitespace-nowrap">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 whitespace-nowrap">ชื่อเล่น</th>
                    <th className="px-4 py-3 whitespace-nowrap">เบอร์โทร</th>
                    <th className="px-4 py-3 whitespace-nowrap">E-mail</th>
                    <th className="px-4 py-3 whitespace-nowrap">สิทธิใช้งาน</th>
                    <th className="px-4 py-3 whitespace-nowrap">ตำแหน่ง</th>
                    <th className="px-4 py-3 whitespace-nowrap">ฝ่าย</th>
                    <th className="px-4 py-3 whitespace-nowrap">แผนก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-50 border border-slate-100" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"
                              style={{ backgroundColor: getAvatarColor(emp.name) }}
                            >
                              {emp.name.trim().charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-[13px] font-medium text-[#272220]">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-[#272220]">{emp.nickname || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-[#272220]">{emp.phone || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-[#272220]">{emp.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-semibold text-[#6F6F6F]">{ACCOUNT_TYPE_LABELS[emp.accountType]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-[#272220]">{emp.role}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[13px] text-[#272220]">{emp.division || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.department ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDepartmentTagClass(emp.department)}`}>
                            {emp.department}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
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
