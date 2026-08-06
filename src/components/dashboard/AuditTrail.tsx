import { Shield } from 'lucide-react';
import { AuditLog } from '../../types';

interface AuditTrailProps {
  auditLogs: AuditLog[];
}

export default function AuditTrail({ auditLogs }: AuditTrailProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">บันทึกความปลอดภัยและระบบ (Audit Logs)</h3>
          <p className="text-xs text-slate-500">ติดตามประวัติกิจกรรมเพื่อความปลอดภัยข้อมูล</p>
        </div>
        <Shield size={16} className="text-slate-400" />
      </div>

      <div className="space-y-3 pt-2 max-h-[220px] overflow-y-auto pr-1">
        {auditLogs.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">ไม่มีประวัติบันทึกการทำงาน</p>
        ) : (
          auditLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="text-[11px] p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span className="font-semibold text-slate-600">{log.user}</span>
                <span>{log.timestamp.split(' ')[1] || log.timestamp}</span>
              </div>
              <p className="text-slate-700 font-medium">{log.action}</p>
              <p className="text-slate-500 leading-relaxed text-[10px]">{log.details}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
