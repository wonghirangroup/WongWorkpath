import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X, Search, Mail, Briefcase } from 'lucide-react';
import { Employee, Department } from '../types';
import { ApiError } from '../lib/api';
import Dropdown from './Dropdown';

const DEPARTMENT_OPTIONS: Department[] = ['IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance'];

const DEPARTMENT_TAG_COLORS: Record<Department, string> = {
  IT: 'text-blue-700 bg-blue-100',
  HR: 'text-fuchsia-700 bg-fuchsia-100',
  Marketing: 'text-orange-700 bg-orange-100',
  Sales: 'text-emerald-700 bg-emerald-100',
  Design: 'text-purple-700 bg-purple-100',
  Finance: 'text-slate-700 bg-slate-200'
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const DEFAULT_PASSWORD = 'Wongwork2026!';

interface EmployeeManagementProps {
  employees: Employee[];
  onAddEmployee: (employee: Employee & { password: string }) => Promise<void>;
}

export default function EmployeeManagement({ employees, onAddEmployee }: EmployeeManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | '__all__'>('__all__');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState<Department>('IT');
  const [newMaxWorkload, setNewMaxWorkload] = useState('4');
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState(false);

  const resetForm = () => {
    setNewName('');
    setNewEmail('');
    setNewRole('');
    setNewDepartment('IT');
    setNewMaxWorkload('4');
    setNewPassword(DEFAULT_PASSWORD);
    setFormError('');
    setShowAddForm(false);
  };

  const isFormValid = !!(newName.trim() && newEmail.trim() && newRole.trim() && newPassword.trim() && Number(newMaxWorkload) > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      await onAddEmployee({
        id: 'E' + Date.now(),
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole.trim(),
        department: newDepartment,
        avatar: '',
        maxWorkload: Number(newMaxWorkload),
        password: newPassword
      });
      resetForm();
      setAddSuccessNotice(true);
      setTimeout(() => setAddSuccessNotice(false), 3000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'สร้างบัญชีพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesQuery = !query || emp.name.toLowerCase().includes(query) || emp.email.toLowerCase().includes(query);
    const matchesDepartment = departmentFilter === '__all__' || emp.department === departmentFilter;
    return matchesQuery && matchesDepartment;
  });

  return (
    <div className="space-y-6" id="employee-management-tab">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-137.5 lg:flex-none">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาพนักงาน (ชื่อ / อีเมล)"
            className="w-full h-10 pl-9 pr-9 bg-[#F6F6F8] border border-transparent rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-36 h-10">
            <Dropdown<Department | '__all__'>
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: '__all__', label: 'ทุกแผนก' },
                ...DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))
              ]}
            />
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap lg:ml-auto"
          >
            <Plus size={16} /> เพิ่มพนักงานใหม่
          </button>
        </div>
      </div>

      <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredEmployees.length} คน</p>

      {filteredEmployees.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
          {employees.length === 0 ? 'ยังไม่มีพนักงานในระบบ' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3"
            >
              <div className="flex items-center gap-3">
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
                <div className="min-w-0">
                  <h4 className="text-[15px] font-bold text-[#272220] truncate">{emp.name}</h4>
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${DEPARTMENT_TAG_COLORS[emp.department]}`}>
                    {emp.department}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EDEEEF] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                  <Briefcase size={12} className="shrink-0" />
                  <span className="truncate">{emp.role}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-[#6F6F6F] min-w-0">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create employee modal */}
      {createPortal(
        <AnimatePresence>
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={resetForm}
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
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">เพิ่มพนักงานใหม่</h3>
                  <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleCreate} className="space-y-3 text-xs">
                  {formError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="เช่น กิตตินันท์ ทิพย์รักษา"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">อีเมล *</label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">ตำแหน่ง *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น UX/UI Designer"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">แผนก *</label>
                      <Dropdown<Department>
                        value={newDepartment}
                        onChange={setNewDepartment}
                        size="compact"
                        options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[#272220] font-bold text-[11px] mb-1">ภาระงานสูงสุด *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newMaxWorkload}
                        onChange={(e) => setNewMaxWorkload(e.target.value)}
                        className="w-full h-10 p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#272220] font-bold text-[11px] mb-1">รหัสผ่านเริ่มต้น *</label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                    <button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
                        isFormValid && !isSubmitting ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Success toast */}
      {createPortal(
        <AnimatePresence>
          {addSuccessNotice && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 text-sm"
            >
              สร้างบัญชีพนักงานสำเร็จแล้ว
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
