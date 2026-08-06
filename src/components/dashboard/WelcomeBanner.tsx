import { Plus } from 'lucide-react';

interface WelcomeBannerProps {
  onAddTask: () => void;
}

export default function WelcomeBanner({ onAddTask }: WelcomeBannerProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สวัสดี ยินดีต้อนรับสู่ UnitySpace</h1>
        <p className="text-indigo-200 text-sm mt-1">ระบบบริหารจัดการโครงการ ภาระงานพนักงาน และข้อมูลความปลอดภัยองค์กร</p>
      </div>
      <div className="mt-4 md:mt-0 flex gap-3">
        <button
          onClick={onAddTask}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
          id="btn-add-task-dash"
        >
          <Plus size={16} />
          สร้างงานใหม่
        </button>
      </div>
    </div>
  );
}
