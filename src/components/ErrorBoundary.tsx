import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  // 'page' keeps the sidebar/header alive and offers a way back; 'app' is the last-resort screen.
  scope?: 'page' | 'app';
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Without a boundary, one component throwing while rendering blanks the whole app (React unmounts
// the entire tree). This keeps the damage to the page that broke and tells the person what to do.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed while rendering:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const fullScreen = this.props.scope === 'app';
    return (
      <div
        role="alert"
        className={`flex items-center justify-center p-6 ${fullScreen ? 'min-h-dvh bg-[#FCFAF8]' : 'min-h-[60vh]'}`}
      >
        <div className="max-w-sm text-center bg-white border border-slate-100 rounded-2xl shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-6">
          <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-[#FF6537]" aria-hidden />
          </div>
          <h2 className="text-base font-bold text-[#272220]">หน้านี้เกิดข้อผิดพลาด</h2>
          <p className="mt-1 text-sm text-[#6F6F6F]">
            ขออภัยครับ มีบางอย่างผิดพลาดระหว่างแสดงหน้านี้ ข้อมูลของคุณไม่ได้หายไปไหน ลองโหลดหน้าใหม่อีกครั้ง
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-4 rounded-lg bg-[#FF6537] text-white text-sm font-semibold hover:opacity-90 cursor-pointer"
            >
              โหลดหน้าใหม่
            </button>
            {!fullScreen && (
              <button
                type="button"
                onClick={() => window.location.assign('/dashboard')}
                className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-[#272220] hover:bg-slate-50 cursor-pointer"
              >
                กลับหน้าแรก
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
