import { useState, useEffect, useRef, SyntheticEvent, KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion, useAnimate } from 'motion/react';
import { Eye, EyeOff, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react';
import { Employee } from '../types';
import { loginRequest, ApiError } from '../lib/api';
import logo from '../assets/logo.png';

const REMEMBER_USERNAME_KEY = 'unityspace_remembered_username';

// Plays once per browser tab: the first mount of any session gets the full logo -> brand ->
// form choreography; every subsequent visit (a re-render after logout, a refresh) skips
// straight to the form so routine sign-ins never wait through the splash a second time.
const INTRO_SEEN_KEY = 'unityspace_intro_seen';
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// iOS-style spring for anything that should feel physical rather than timed (scale changes,
// the card's arrival) — a duration-based ease reads mechanical for those, a spring reads alive.
const SPRING = { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 } as const;
// `whileTap` only fires for an actual pointer press — submitting by pressing Enter in a text
// field never touches the button, so it silently skipped the press feedback. Every submit
// handler below triggers this imperatively instead, so the button visibly reacts either way.
const PRESS_FEEDBACK = { scale: [1, 0.94, 1] };
const PRESS_TRANSITION = { duration: 0.25, ease: EASE };

// Orchestrates the login card's own fields: title -> banners -> username -> password -> submit
// reveal in sequence instead of popping in together, each just enough behind the last to read
// as one continuous motion rather than a list.
const FIELD_STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
} as const;
const FIELD_ITEM = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
} as const;
const BRAND_STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const;
const BRAND_LINE = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const;
// The focus glow shared by every text input on this page.
const INPUT_FOCUS = { scale: 1.01, boxShadow: '0 0 0 4px rgba(255,101,55,0.15)' };

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

// Cross-fades + tilts between the two eye states instead of a hard icon swap — shared by every
// password field's show/hide toggle on this page (login, and both fields on the reset screen).
function AnimatedEyeIcon({ shown }: { shown: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={shown ? 'on' : 'off'}
        initial={{ opacity: 0, rotate: -20, scale: 0.7 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 20, scale: 0.7 }}
        transition={{ duration: 0.18, ease: EASE }}
        className="block"
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </motion.span>
    </AnimatePresence>
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
  const prefersReducedMotion = useReducedMotion();
  const [introPhase, setIntroPhase] = useState<'logo' | 'brand' | 'form'>(() => {
    try {
      return sessionStorage.getItem(INTRO_SEEN_KEY) ? 'form' : 'logo';
    } catch {
      return 'logo';
    }
  });
  const skipIntro = introPhase === 'form' || !!prefersReducedMotion;

  useEffect(() => {
    if (skipIntro) {
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* private-browsing storage block */ }
      setIntroPhase('form');
      return;
    }
    const toBrand = setTimeout(() => setIntroPhase('brand'), 1300);
    const toForm = setTimeout(() => {
      setIntroPhase('form');
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* private-browsing storage block */ }
    }, 2600);
    return () => { clearTimeout(toBrand); clearTimeout(toForm); };
    // Intentionally runs once — re-checking skipIntro on every render (e.g. after a
    // reduced-motion preference toggles mid-sequence) would restart the timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [view, setView] = useState<'login' | 'forgot' | 'otp' | 'reset' | 'loading'>('login');
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_USERNAME_KEY) || '');
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

  // A tiny imperative pop the instant the form becomes submittable — separate from the button's
  // declarative mount/stagger animation (useAnimate drives the DOM directly, so it can't fight
  // the variants-driven entrance the way a second `animate` prop on the same element would).
  const [submitScope, animateSubmit] = useAnimate();
  const wasLoginFilledRef = useRef(isLoginFilled);
  useEffect(() => {
    if (isLoginFilled && !wasLoginFilledRef.current) {
      animateSubmit(submitScope.current, { scale: [1, 1.03, 1] }, { duration: 0.3, ease: EASE });
    }
    wasLoginFilledRef.current = isLoginFilled;
  }, [isLoginFilled, animateSubmit, submitScope]);

  // One imperative scope per submit button (forgot / OTP / reset — login reuses submitScope
  // above) so Enter-key submission gets the same press feedback as a real click everywhere.
  const [forgotSubmitScope, animateForgotSubmit] = useAnimate();
  const [otpSubmitScope, animateOtpSubmit] = useAnimate();
  const [resetSubmitScope, animateResetSubmit] = useAnimate();

  const rejectLogin = (message: string) => {
    setError(message);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 300);
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isLoginFilled) return;
    animateSubmit(submitScope.current, PRESS_FEEDBACK, PRESS_TRANSITION);

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
    animateForgotSubmit(forgotSubmitScope.current, PRESS_FEEDBACK, PRESS_TRANSITION);

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
    animateOtpSubmit(otpSubmitScope.current, PRESS_FEEDBACK, PRESS_TRANSITION);

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
    animateResetSubmit(resetSubmitScope.current, PRESS_FEEDBACK, PRESS_TRANSITION);

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
    <div className="h-screen overflow-hidden bg-black flex flex-col items-center justify-center gap-3 p-3" id="login-page">
      {/* Earlier tries at repositioning this group when the card appears (marginTop, `layout`
          reflow, an absolute layer with a hand-picked fixed "top") each collided with the card —
          a reflow race, a dropped CSS transform, or a fixed position that didn't know the card's
          real height on a given screen. This one still shares one ordinary flex column with the
          card and footer below, but they're height-collapsed (not just invisible) during steps
          1-2, so this block is the only sized child and `justify-center` puts it at true
          viewport-center on its own. When the card/footer grow to their real height for step 3,
          plain browser reflow — not a transform we drive — is what pushes this block up into its
          final slot, so it can't fall out of sync with the card's actual size on any viewport. */}
      <motion.div
        className="flex flex-col items-center"
        initial={false}
        animate={{ scale: introPhase === 'form' ? 0.9 : 1 }}
        transition={SPRING}
      >
        <div className="relative mb-3">
          {/* Ambient breathing glow — settles to a faint, steady halo once the form is up so it
              doesn't keep pulling focus while someone is filling in the card below. */}
          <motion.div
            aria-hidden
            className="absolute -inset-6 rounded-full bg-[#FF6537] blur-2xl"
            initial={{ opacity: 0 }}
            animate={
              introPhase === 'form'
                ? { opacity: 0.12, scale: 1 }
                : { opacity: [0.15, 0.35, 0.15], scale: [0.92, 1.05, 0.92] }
            }
            transition={
              introPhase === 'form'
                ? { duration: 0.8, ease: EASE }
                : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.img
            src={logo}
            alt="Wong Workpath"
            className="relative w-20 h-20"
            initial={skipIntro ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
          />
        </div>
        {/* Always mounted (opacity/stagger-driven, never unmounted) so its height is reserved from
            frame one — logo + brand recenter together as a single stable unit through steps 1-2,
            matching the reference (the logo doesn't visibly shift when the brand line fades in). */}
        <motion.div
          variants={BRAND_STAGGER}
          initial={skipIntro ? false : 'hidden'}
          animate={introPhase !== 'logo' ? 'visible' : 'hidden'}
          className="flex flex-col items-center"
        >
          <motion.h1 variants={BRAND_LINE} className="text-4xl font-semibold tracking-wider">
            <span className="text-[#FF6537]">Wong</span>{' '}
            <span className="text-white">Workpath</span>
          </motion.h1>
          <motion.p variants={BRAND_LINE} className="text-sm font-normal text-white/90 mt-1">
            ระบบบริหารจัดการและติดตามสถานะการทำงาน
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Collapsed to height:0 (not just invisible) during steps 1-2, so the still-blank card
          never reserves layout space — the flex column above then has only the logo+brand to
          center, putting it at true viewport-center instead of "true center minus half the
          card's height". When this grows to its real height as introPhase reaches 'form', the
          browser's own reflow is what pushes the logo/brand block up into its final slot — no
          position math of ours to get out of sync with the card's actual size. */}
      <motion.div
        className="w-full max-w-md overflow-hidden"
        initial={false}
        animate={{ height: introPhase === 'form' ? 'auto' : 0 }}
        transition={SPRING}
      >
      <motion.div
        initial={skipIntro ? false : { opacity: 0, y: 40, filter: 'blur(8px)' }}
        animate={
          introPhase === 'form'
            ? { opacity: 1, y: 0, filter: 'blur(0px)' }
            : { opacity: 0, y: 40, filter: 'blur(8px)' }
        }
        transition={SPRING}
        inert={introPhase !== 'form'}
        className="w-full"
      >
        {view === 'login' && (
        <motion.form
          onSubmit={handleSubmit}
          variants={FIELD_STAGGER}
          initial={skipIntro ? false : 'hidden'}
          animate="visible"
          className={`bg-white p-5 rounded-2xl shadow-xl min-h-90 flex flex-col ${shakeError ? 'shake-login' : ''}`}
          id="login-form"
        >
          <motion.div variants={FIELD_STAGGER} className="space-y-5">
          <motion.div variants={FIELD_ITEM} className="text-center">
            <h2 className="text-3xl font-extrabold text-[#FF6537]">ยินดีต้อนรับ</h2>
            <p className="text-sm text-slate-500 mt-1">พร้อมเริ่มทำงานหรือยัง? เข้าสู่ระบบได้เลย</p>
          </motion.div>

          {error && <motion.div variants={FIELD_ITEM}><ErrorBanner message={error} /></motion.div>}
          {!error && loginSuccess && <motion.div variants={FIELD_ITEM}><SuccessBanner message={loginSuccess} /></motion.div>}

          <motion.div variants={FIELD_ITEM} className="space-y-1.5">
            <label htmlFor="login-username" className="text-sm font-semibold text-slate-700">ชื่อผู้ใช้</label>
            <motion.input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setLoginSuccess(''); }}
              placeholder="กรุณากรอกชื่อผู้ใช้"
              className="w-full text-sm px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
              autoComplete="username"
              whileFocus={INPUT_FOCUS}
              transition={{ duration: 0.2, ease: EASE }}
            />
          </motion.div>

          <motion.div variants={FIELD_ITEM} className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <motion.input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginSuccess(''); }}
                placeholder="กรุณากรอกรหัสผ่าน"
                className="w-full text-sm px-4 py-3 pr-11 border border-slate-300 rounded-xl focus:outline-none focus:border-[#FF6537]"
                autoComplete="current-password"
                whileFocus={INPUT_FOCUS}
                transition={{ duration: 0.2, ease: EASE }}
              />
              <motion.button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                whileTap={{ scale: 0.85 }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-password"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                <AnimatedEyeIcon shown={showPassword} />
              </motion.button>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] text-slate-500 cursor-pointer select-none" htmlFor="remember-me">
                <motion.input
                  id="remember-me"
                  type="checkbox"
                  tabIndex={-1}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#FF6537] focus:outline-none cursor-pointer"
                  whileTap={{ scale: 0.85 }}
                />
                จดจำรหัสผ่าน
              </label>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setView('forgot')}
                className="text-[12px] text-slate-500 hover:text-[#FF6537] underline cursor-pointer"
                id="btn-forgot-password"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </motion.div>
          </motion.div>

          <motion.button
            ref={submitScope}
            variants={FIELD_ITEM}
            type="submit"
            disabled={!isLoginFilled}
            whileHover={isLoginFilled ? { scale: 1.02 } : undefined}
            whileTap={isLoginFilled ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.15, ease: EASE }}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl mt-[42px] transition-colors ${
              isLoginFilled
                ? 'bg-[#FF6537] cursor-pointer hover:bg-[#E04D1D] hover:shadow-[0_4px_12px_rgba(255,91,38,0.3)]'
                : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-login-submit"
          >
            เข้าสู่ระบบ
          </motion.button>
        </motion.form>
        )}

        {view === 'forgot' && (
        <form
          onSubmit={handleRequestOtp}
          className="relative bg-white p-5 rounded-2xl shadow-xl min-h-90 flex flex-col"
          id="forgot-password-form"
        >
          <motion.button
            type="button"
            onClick={handleBackToLogin}
            whileTap={{ scale: 0.85 }}
            className="absolute left-8 top-9 text-slate-400 hover:text-slate-600 cursor-pointer"
            id="btn-back-to-login"
            aria-label="กลับไปหน้าเข้าสู่ระบบ"
          >
            <ChevronLeft size={22} />
          </motion.button>

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

          <motion.button
            ref={forgotSubmitScope}
            type="submit"
            disabled={!isForgotEmailValid}
            whileHover={isForgotEmailValid ? { scale: 1.02 } : undefined}
            whileTap={isForgotEmailValid ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.15, ease: EASE }}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors mt-auto ${
              isForgotEmailValid ? 'bg-[#FF6537] hover:opacity-90 cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-request-otp"
          >
            รับ OTP
          </motion.button>
        </form>
        )}

        {view === 'otp' && (
        <form
          onSubmit={handleVerifyOtp}
          className="relative bg-white p-5 rounded-2xl shadow-xl min-h-90 flex flex-col"
          id="otp-form"
        >
          <motion.button
            type="button"
            onClick={handleBackToForgot}
            whileTap={{ scale: 0.85 }}
            className="absolute left-8 top-9 text-slate-400 hover:text-slate-600 cursor-pointer"
            id="btn-back-to-forgot"
            aria-label="กลับไปหน้ากรอกอีเมล"
          >
            <ChevronLeft size={22} />
          </motion.button>

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

          <motion.button
            ref={otpSubmitScope}
            type="submit"
            disabled={!isOtpValid}
            whileHover={isOtpValid ? { scale: 1.02 } : undefined}
            whileTap={isOtpValid ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.15, ease: EASE }}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors mt-auto ${
              isOtpValid ? 'bg-[#FF6537] hover:opacity-90 cursor-pointer' : 'bg-[#F68C6C] cursor-not-allowed'
            }`}
            id="btn-verify-otp"
          >
            ยืนยัน
          </motion.button>
        </form>
        )}

        {view === 'reset' && (
        <form
          onSubmit={handleChangePassword}
          className="bg-white p-5 rounded-2xl shadow-xl min-h-90 flex flex-col"
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
              <motion.button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword(!showNewPassword)}
                whileTap={{ scale: 0.85 }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-new-password"
                aria-label={showNewPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                <AnimatedEyeIcon shown={showNewPassword} />
              </motion.button>
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
              <motion.button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                whileTap={{ scale: 0.85 }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                id="btn-toggle-confirm-password"
                aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                <AnimatedEyeIcon shown={showConfirmPassword} />
              </motion.button>
            </div>
          </div>
          </div>

          <motion.button
            ref={resetSubmitScope}
            type="submit"
            whileHover={isResetFilled ? { scale: 1.02 } : undefined}
            whileTap={isResetFilled ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.15, ease: EASE }}
            className={`w-full text-white text-base font-semibold py-3.5 rounded-xl transition-colors cursor-pointer mt-[70px] ${
              isResetFilled ? 'bg-[#FF6537] hover:opacity-90' : 'bg-[#F68C6C]'
            }`}
            id="btn-change-password"
          >
            เปลี่ยนรหัสผ่าน
          </motion.button>
        </form>
        )}

        {view === 'loading' && (
        <div className="flex flex-col items-center gap-3" id="login-loading">
          <p className="text-sm text-white/70">รอสักครู่...</p>
          <LoadingDots />
        </div>
        )}
      </motion.div>
      </motion.div>

      {/* Same height-collapse treatment as the card above, so the footer line doesn't add its
          own sliver of reserved space to the steps-1-2 centering either. */}
      <motion.div
        className="overflow-hidden"
        initial={false}
        animate={{ height: introPhase === 'form' ? 'auto' : 0 }}
        transition={SPRING}
      >
      <motion.p
        initial={skipIntro ? false : { opacity: 0 }}
        animate={{ opacity: introPhase === 'form' && view !== 'loading' ? 1 : 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: skipIntro ? 0 : 0.2 }}
        className="text-center text-xs text-white/40"
      >
        © 2026 Wong Workpath · Version 1.0.0
      </motion.p>
      </motion.div>
    </div>
  );
}
