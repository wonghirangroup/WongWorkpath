import { useState, useEffect, useRef, SyntheticEvent, KeyboardEvent } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, ChevronLeft, ChevronDown } from 'lucide-react';
import { Employee } from '../types';
import logo from '../assets/logo.png';

type CountryId = 'TH' | 'US' | 'SG' | 'VN' | 'MY';

const COUNTRY_CODES: { country: CountryId; code: string; label: string }[] = [
  { country: 'TH', code: '+66', label: 'ไทย' },
  { country: 'US', code: '+1', label: 'สหรัฐอเมริกา' },
  { country: 'SG', code: '+65', label: 'สิงคโปร์' },
  { country: 'VN', code: '+84', label: 'เวียดนาม' },
  { country: 'MY', code: '+60', label: 'มาเลเซีย' },
];

const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_FORMATS: Record<CountryId, { pattern: RegExp; placeholder: string; maxLength: number; groups: number[] }> = {
  TH: { pattern: /^0[0-9]{9}$/, placeholder: '08X-XXX-XXXX', maxLength: 10, groups: [3, 3, 4] },
  US: { pattern: /^[2-9][0-9]{9}$/, placeholder: '2XX-XXX-XXXX', maxLength: 10, groups: [3, 3, 4] },
  SG: { pattern: /^[89][0-9]{7}$/, placeholder: '8XXX-XXXX', maxLength: 8, groups: [4, 4] },
  VN: { pattern: /^[3-9][0-9]{8}$/, placeholder: '9XX-XXX-XXX', maxLength: 9, groups: [3, 3, 3] },
  MY: { pattern: /^1[0-9]{8}$/, placeholder: '1X-XXX-XXXX', maxLength: 9, groups: [2, 3, 4] },
};

function formatPhoneWithDashes(digits: string, groups: number[]) {
  const parts: string[] = [];
  let idx = 0;
  for (const len of groups) {
    if (idx >= digits.length) break;
    parts.push(digits.slice(idx, idx + len));
    idx += len;
  }
  return parts.join('-');
}

function StripedFlag({ colors, canton }: { colors: string[]; canton?: React.ReactNode }) {
  return (
    <div className="w-5 h-3.5 rounded-[2px] overflow-hidden shrink-0 relative flex flex-col">
      {colors.map((c, i) => (
        <div key={i} className={`flex-1 ${c}`} />
      ))}
      {canton}
    </div>
  );
}

function FlagIcon({ country }: { country: CountryId }) {
  if (country === 'TH') {
    return <StripedFlag colors={['bg-red-600', 'bg-white', 'bg-blue-800 flex-[2]', 'bg-white', 'bg-red-600']} />;
  }

  if (country === 'US') {
    return (
      <StripedFlag
        colors={['bg-red-600', 'bg-white', 'bg-red-600', 'bg-white', 'bg-red-600', 'bg-white', 'bg-red-600']}
        canton={<div className="absolute top-0 left-0 w-[42%] h-[54%] bg-blue-900" />}
      />
    );
  }

  if (country === 'SG') {
    return (
      <div className="w-5 h-3.5 rounded-[2px] overflow-hidden shrink-0 flex flex-col">
        <div className="flex-1 bg-red-600 relative">
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-600 rounded-full" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-white rounded-full" />
        </div>
        <div className="flex-1 bg-white" />
      </div>
    );
  }

  if (country === 'VN') {
    return (
      <div className="w-5 h-3.5 rounded-[2px] overflow-hidden shrink-0 bg-red-600 flex items-center justify-center">
        <div className="w-2 h-2 bg-yellow-400" style={{ clipPath: STAR_CLIP }} />
      </div>
    );
  }

  // MY
  return (
    <StripedFlag
      colors={['bg-red-600', 'bg-white', 'bg-red-600', 'bg-white', 'bg-red-600', 'bg-white', 'bg-red-600']}
      canton={
        <div className="absolute top-0 left-0 w-[55%] h-[54%] bg-blue-900 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-yellow-300" style={{ clipPath: STAR_CLIP }} />
        </div>
      }
    />
  );
}

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
  const [username, setUsername] = useState('somsak.r@company.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
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

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isLoginFilled) return;

    if (!EMAIL_PATTERN.test(username.trim())) {
      rejectLogin('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    // Demo-only check: no backend auth exists, this just matches against the mock employee directory by email
    const matchedEmployee = employees.find(emp => emp.email.toLowerCase() === username.trim().toLowerCase());
    if (!matchedEmployee) {
      rejectLogin('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    setError('');
    setPendingEmployee(matchedEmployee);
    setView('loading');
  };

  const isPhoneValid = PHONE_FORMATS[countryCode.country].pattern.test(phone.trim());

  const handleRequestOtp = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isPhoneValid) {
      setPhoneError('กรุณากรอกเบอร์มือถือให้ถูกต้อง');
      return;
    }

    setPhoneError('');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setResendCooldown(59);
    setView('otp');
  };

  const handleBackToLogin = () => {
    setView('login');
    setPhone('');
    setPhoneError('');
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
            <div className="text-right">
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
            <p className="text-sm text-slate-500 mt-1">กรุณากรอกเบอร์โทรศัพท์ที่ลงทะเบียนไว้ เพื่อรับรหัส OTP</p>
          </div>

          {phoneError && <ErrorBanner message={phoneError} />}

          <div className="space-y-1.5">
            <label htmlFor="forgot-phone" className="text-sm font-semibold text-slate-700">เบอร์มือถือ</label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50"
                  id="btn-country-code"
                >
                  <FlagIcon country={countryCode.country} />
                  {countryCode.code}
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCountryDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10" id="country-code-dropdown">
                    {COUNTRY_CODES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountryCode(c);
                          setIsCountryDropdownOpen(false);
                          setPhone((prev) => prev.slice(0, PHONE_FORMATS[c.country].maxLength));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <FlagIcon country={c.country} />
                        <span className="flex-1 text-left">{c.label}</span>
                        <span className="text-slate-400">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                id="forgot-phone"
                type="tel"
                inputMode="numeric"
                value={formatPhoneWithDashes(phone, PHONE_FORMATS[countryCode.country].groups)}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, PHONE_FORMATS[countryCode.country].maxLength);
                  setPhone(digitsOnly);
                }}
                placeholder={PHONE_FORMATS[countryCode.country].placeholder}
                className="flex-1 min-w-0 text-sm px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                autoComplete="tel"
              />
            </div>
          </div>
          </div>

          <button
            type="submit"
            disabled={!isPhoneValid}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors mt-auto ${
              isPhoneValid ? 'bg-[#FF6537] hover:opacity-90 cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
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
            aria-label="กลับไปหน้ากรอกเบอร์มือถือ"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">รหัส OTP</h2>
            <p className="text-sm text-slate-500 mt-1">
              กรุณากรอกรหัส OTP 6 หลักที่ส่งไปที่เบอร์ {formatPhoneWithDashes(phone, PHONE_FORMATS[countryCode.country].groups)}
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
          ใช้อีเมลพนักงานที่มีอยู่ในระบบ เช่น somsak.r@company.com
        </p>
      )}
    </div>
  );
}
