import { useState, useEffect, useRef, SyntheticEvent, KeyboardEvent } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react';
import { Employee } from '../types';
import { loginRequest, ApiError } from '../lib/api';
import logo from '../assets/logo.png';

const REMEMBER_USERNAME_KEY = 'unityspace_remembered_username';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 text-sm px-3 py-2 rounded-lg">
      <AlertCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-3 py-2 rounded-lg">
      <CheckCircle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-white/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

interface LoginProps {
  employees: Employee[];
  onLogin: (employee: Employee) => void;
}

export default function Login({ employees, onLogin }: LoginProps) {
  const [view, setView] = useState<'login' | 'forgot' | 'otp' | 'reset' | 'loading'>('login');
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_USERNAME_KEY) || 'somsak.r');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_USERNAME_KEY));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(59);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  const isLoginFilled = username.trim() !== '' && password.trim() !== '';

  const justActivatedRef = useRef(isLoginFilled);
  const [justActivated, setJustActivated] = useState(false);

  useEffect(() => {
    if (isLoginFilled && !justActivatedRef.current) {
      setJustActivated(true);
      const t = setTimeout(() => setJustActivated(false), 200);
      justActivatedRef.current = isLoginFilled;
      return () => clearTimeout(t);
    }
    justActivatedRef.current = isLoginFilled;
  }, [isLoginFilled]);

  const rejectLogin = (message: string) => {
    setError(message);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 300);
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isLoginFilled) return;

    try {
      const result = await loginRequest(username.trim(), password);
      const matchedEmployee = employees.find(emp => emp.id === result.employeeId);
      if (!matchedEmployee) {
        rejectLogin('บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงานในระบบ');
        return;
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
      } else {
        localStorage.removeItem(REMEMBER_USERNAME_KEY);
      }

      setError('');
      setPendingEmployee(matchedEmployee);
      setView('loading');
    } catch (err) {
      rejectLogin(err instanceof ApiError ? err.message : 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const isForgotEmailValid = EMAIL_PATTERN.test(forgotEmail.trim());

  const handleRequestOtp = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isForgotEmailValid) {
      setForgotEmailError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    setForgotEmailError('');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setResendCooldown(59);
    setView('otp');
  };

  const handleBackToLogin = () => {
    setView('login');
    setForgotEmail('');
    setForgotEmailError('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setLoginSuccess('');
  };

  const handleBackToForgot = () => {
    setView('forgot');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
  };

  const isOtpValid = otpDigits.every((d) => d !== '');

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isOtpValid) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    setOtpError('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setView('reset');
  };

  const isResetFilled = newPassword.trim() !== '' && confirmPassword.trim() !== '';

  const handleChangePassword = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword.trim().length < 6) {
      setResetError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setResetError('');
    handleBackToLogin();
    setLoginSuccess('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง');
  };

  const handleResendOtp = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(59);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    otpInputRefs.current[0]?.focus();
  };

  useEffect(() => {
    if (view !== 'otp') return;
    otpInputRefs.current[0]?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== 'otp' || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [view, resendCooldown > 0]);

  useEffect(() => {
    if (view !== 'loading' || !pendingEmployee) return;
    const timer = setTimeout(() => {
      onLogin(pendingEmployee);
    }, 1500);
    return () => clearTimeout(timer);
  }, [view, pendingEmployee, onLogin]);

  return (
    <div className="min-h-screen bg-[#272220] grid grid-rows-[1fr_auto_1fr] justify-items-center gap-12 p-6" id="login-page">
      <div className="self-end flex flex-col items-center">
        <img src={logo} alt="Wong Workpath" className="w-28 h-28 mb-4" />
        <h1 className="text-4xl font-semibold tracking-wider">
          <span className="text-[#FF6537]">Wong</span>{' '}
          <span className="text-white">Workpath</span>
        </h1>
        <p className="text-sm font-normal text-[#FFFFFF] mt-1">ระบบบริหารจัดการและติดตามสถานะการทำงาน</p>
      </div>

      <div className="w-full max-w-md -translate-y-8">
        {view === 'login' && (
        <form
          onSubmit={handleSubmit}
          className={`bg-white p-8 rounded-2xl shadow-xl min-h-[414px] flex flex-col ${shakeError ? 'shake-login' : ''}`}
          id="login-form"
        >
          <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">ยินดีต้อนรับ</h2>
            <p className="text-sm text-slate-500 mt-1">พร้อมเริ่มทำงานหรือยัง? เข้าสู่ระบบได้เลย</p>
          </div>

          {error && <ErrorBanner message={error} />}
          {!error && loginSuccess && <SuccessBanner message={loginSuccess} />}

          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-sm font-semibold text-slate-700">ชื่อผู้ใช้</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setLoginSuccess(''); }}
              placeholder="กรุณากรอกชื่อผู้ใช้"
              className="w-full text-sm px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginSuccess(''); }}
                placeholder="กรุณากรอกรหัสผ่าน"
                className="w-full text-sm px-4 py-3 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-password"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] text-slate-500 cursor-pointer select-none" htmlFor="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#FF6537] focus:outline-none focus:ring-1 focus:ring-[#FF6537] cursor-pointer"
                />
                จดจำรหัสผ่าน
              </label>
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-[12px] text-slate-500 hover:text-[#FF6537] underline cursor-pointer"
                id="btn-forgot-password"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </div>
          </div>

          <button
            type="submit"
            disabled={!isLoginFilled}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl mt-[42px] transition-all duration-200 ease-out hover:duration-150 ${
              isLoginFilled
                ? `bg-[#FF6537] cursor-pointer hover:bg-[#E04D1D] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(255,91,38,0.3)] active:translate-y-0 active:duration-100 ${
                    justActivated ? 'scale-[1.02]' : 'active:scale-[0.98]'
                  }`
                : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-login-submit"
          >
            เข้าสู่ระบบ
          </button>
        </form>
        )}

        {view === 'forgot' && (
        <form
          onSubmit={handleRequestOtp}
          className="relative bg-white p-8 rounded-2xl shadow-xl min-h-[414px] flex flex-col"
          id="forgot-password-form"
        >
          <button
            type="button"
            onClick={handleBackToLogin}
            className="absolute left-8 top-9 text-slate-400 hover:text-slate-600 cursor-pointer"
            id="btn-back-to-login"
            aria-label="กลับไปหน้าเข้าสู่ระบบ"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">ลืมรหัสใช่ไหม?</h2>
            <p className="text-sm text-slate-500 mt-1">กรุณากรอกอีเมลที่ลงทะเบียนไว้ เพื่อรับรหัส OTP</p>
          </div>

          {forgotEmailError && <ErrorBanner message={forgotEmailError} />}

          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="text-sm font-semibold text-slate-700">อีเมล</label>
            <input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full text-sm px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
              autoComplete="email"
            />
          </div>
          </div>

          <button
            type="submit"
            disabled={!isForgotEmailValid}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors mt-auto ${
              isForgotEmailValid ? 'bg-[#FF6537] hover:opacity-90 cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-request-otp"
          >
            รับ OTP
          </button>
        </form>
        )}

        {view === 'otp' && (
        <form
          onSubmit={handleVerifyOtp}
          className="relative bg-white p-8 rounded-2xl shadow-xl min-h-[414px] flex flex-col"
          id="otp-form"
        >
          <button
            type="button"
            onClick={handleBackToForgot}
            className="absolute left-8 top-9 text-slate-400 hover:text-slate-600 cursor-pointer"
            id="btn-back-to-forgot"
            aria-label="กลับไปหน้ากรอกอีเมล"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">รหัส OTP</h2>
            <p className="text-sm text-slate-500 mt-1">
              กรุณากรอกรหัส OTP 6 หลักที่ส่งไปที่อีเมล {forgotEmail}
            </p>
          </div>

          {otpError && <ErrorBanner message={otpError} />}

          <div className="flex justify-center gap-2.5" id="otp-inputs">
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpInputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-11 h-14 text-center text-lg font-semibold border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                aria-label={`หลักที่ ${i + 1}`}
              />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 mt-4">
            หากไม่ได้รับรหัส?{' '}
            {resendCooldown > 0 ? (
              <span className="text-slate-400">ส่งอีกครั้ง ( 00:{String(resendCooldown).padStart(2, '0')} )</span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-[#FF6537] font-semibold cursor-pointer"
                id="btn-resend-otp"
              >
                ส่งอีกครั้ง
              </button>
            )}
          </p>
          </div>

          <button
            type="submit"
            disabled={!isOtpValid}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors mt-auto ${
              isOtpValid ? 'bg-[#FF6537] hover:opacity-90 cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-verify-otp"
          >
            ยืนยัน
          </button>
        </form>
        )}

        {view === 'reset' && (
        <form
          onSubmit={handleChangePassword}
          className="bg-white p-8 rounded-2xl shadow-xl min-h-[414px] flex flex-col"
          id="reset-password-form"
        >
          <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">ตั้งรหัสผ่านใหม่</h2>
            <p className="text-sm text-slate-500 mt-1">กรุณากำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบ</p>
          </div>

          {resetError && <ErrorBanner message={resetError} />}

          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-semibold text-slate-700">รหัสผ่านใหม่</label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรุณากรอกรหัสผ่านใหม่"
                className="w-full text-sm px-4 py-3 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                autoComplete="new-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-new-password"
                aria-label={showNewPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-semibold text-slate-700">รหัสผ่านใหม่อีกครั้ง</label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรุณากรอกรหัสผ่านอีกครั้ง"
                className="w-full text-sm px-4 py-3 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                autoComplete="new-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-confirm-password"
                aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          </div>

          <button
            type="submit"
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors cursor-pointer mt-[70px] ${
              isResetFilled ? 'bg-[#FF6537] hover:opacity-90' : 'bg-[#F68C6C]'
            }`}
            id="btn-change-password"
          >
            เปลี่ยนรหัสผ่าน
          </button>
        </form>
        )}

        {view === 'loading' && (
        <div className="flex flex-col items-center gap-3" id="login-loading">
          <p className="text-sm text-white/70">รอสักครู่...</p>
          <LoadingDots />
        </div>
        )}
      </div>

      {view !== 'loading' && (
        <p className="self-start text-center text-xs text-white/60 mt-4 max-w-sm">
          ใช้ Username ที่องค์กรกำหนดให้ เช่น somsak.r
        </p>
      )}
    </div>
  );
}
