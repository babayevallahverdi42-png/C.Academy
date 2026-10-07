import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Fingerprint,
  ScanFace,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Smartphone,
  Check,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import {
  AcademicDegree,
  OfficialSubject,
  SupportedLanguage,
  UserProfile,
} from '../types';
import { OFFICIAL_SUBJECTS, TRANSLATIONS } from '../utils/i18n';
import {
  checkAuthRateLimit,
  constantTimeHexCompare,
  generateSecureId,
  hashCredential,
  ObfuscatedSystemVault,
  recordAuthFailure,
  resetAuthFailures,
  sanitizeTextInput,
  verifySystemStepOne,
  verifySystemStepTwo,
} from '../utils/security';
import { validateTrustedUserEvent } from '../utils/antiTamperEngine';

interface RoleSelectionAndAuthProps {
  language: SupportedLanguage;
  users: UserProfile[];
  systemVault: ObfuscatedSystemVault;
  onAuthenticated: (user: UserProfile) => void;
  onRegisterUser: (newUser: UserProfile) => void;
}

const ACADEMIC_DEGREES: AcademicDegree[] = [
  'Undergraduate',
  'Bachelor',
  'Master',
  'PhD',
  'Postdoctoral Fellow',
  'Professor',
];

export const RoleSelectionAndAuth: React.FC<RoleSelectionAndAuthProps> = ({
  language,
  users,
  systemVault,
  onAuthenticated,
  onRegisterUser,
}) => {
  const t = TRANSLATIONS[language];

  // Screen routing state
  const [selectedRole, setSelectedRole] = useState<
    null | 'student' | 'teacher' | 'admin'
  >(null);

  // Hidden Easter Egg state: 20 taps on "Welcome" + 10-second press & hold
  const [, setWelcomeTapCount] = useState(0);
  const welcomeTapCountRef = useRef(0);
  const holdElapsedMsRef = useRef(0);
  const [, setHoldElapsedMs] = useState(0);
  const [, setIsHoldingWelcome] = useState(false);
  const [systemRoleUnlocked, setSystemRoleUnlocked] = useState(false);
  const holdIntervalRef = useRef<number | null>(null);

  // Student Auth state
  const [studentMode, setStudentMode] = useState<'signin' | 'register'>('signin');
  const [studentStep, setStudentStep] = useState<'form' | 'biometric_setup'>('form');
  const [stuGmail, setStuGmail] = useState('aydan.mammadova@gmail.com');
  const [stuPassword, setStuPassword] = useState('student123');
  const [stuAge, setStuAge] = useState('20');
  const [stuFullName, setStuFullName] = useState('');
  const [stuPhone, setStuPhone] = useState('');
  const [stuBiometricMethod, setStuBiometricMethod] = useState<'fingerprint' | 'face_id'>('fingerprint');
  const [stuBiometricDone, setStuBiometricDone] = useState(false);
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [biometricModalMethod, setBiometricModalMethod] = useState<'fingerprint' | 'face_id'>('fingerprint');
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [simulateNewFourthDevice, setSimulateNewFourthDevice] = useState(false);

  // Teacher Auth state
  const [teacherMode, setTeacherMode] = useState<'signin' | 'register'>('register');
  const [tchGmail, setTchGmail] = useState('kamran.aliyev@gmail.com');
  const [tchPassword, setTchPassword] = useState('teacher123');
  const [tchFullName, setTchFullName] = useState('');
  const [tchAge, setTchAge] = useState('34');
  const [tchDegree, setTchDegree] = useState<AcademicDegree>('PhD');
  const [tchMajor, setTchMajor] = useState('');
  const [tchSubjects, setTchSubjects] = useState<OfficialSubject[]>(['Math', 'Physics']);

  // Member of System (Super Admin) Sequential Auth state
  const [adminStep, setAdminStep] = useState<1 | 2>(1);
  const [sysGmail, setSysGmail] = useState('');
  const [sysPassword, setSysPassword] = useState('');
  const [sysCipher, setSysCipher] = useState('');
  const [sysWhatsNewAnswer, setSysWhatsNewAnswer] = useState('');

  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        window.clearInterval(holdIntervalRef.current);
      }
    };
  }, []);

  // Handle "Welcome" tap & 10-second press-and-hold sequence
  const handleWelcomePointerDown = () => {
    if (systemRoleUnlocked) return;

    const nextTaps =
      welcomeTapCountRef.current < 20 ? welcomeTapCountRef.current + 1 : 20;
    welcomeTapCountRef.current = nextTaps;
    setWelcomeTapCount(nextTaps);

    // Once user reaches 20 taps (either on the 20th tap or immediately after 20 taps), start 10-second hold timer
    if (nextTaps === 20) {
      setIsHoldingWelcome(true);
      const startTime = Date.now() - holdElapsedMsRef.current;
      if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);

      holdIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= 10000) {
          holdElapsedMsRef.current = 10000;
          setHoldElapsedMs(10000);
          setIsHoldingWelcome(false);
          setSystemRoleUnlocked(true);
          if (holdIntervalRef.current) {
            window.clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
          }
        } else {
          holdElapsedMsRef.current = elapsed;
          setHoldElapsedMs(elapsed);
        }
      }, 100);
    }
  };

  const handleWelcomePointerUpOrLeave = () => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHoldingWelcome(false);
    if (!systemRoleUnlocked && holdElapsedMsRef.current < 10000) {
      holdElapsedMsRef.current = 0;
      setHoldElapsedMs(0);
    }
  };

  const toggleTeacherSubject = (sub: OfficialSubject) => {
    setTchSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  // Student Sign-In Handler with Max 3 Devices Enforcement + Brute-Force Rate Limiting
  const handleStudentSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const eventCheck = validateTrustedUserEvent(e);
    if (!eventCheck.valid) {
      setAuthError(
        eventCheck.reason ||
          'Authentication rejected: Untrusted synthetic event detected.'
      );
      return;
    }

    const rateScope = `student_auth:${stuGmail.trim().toLowerCase()}`;
    const rateStatus = checkAuthRateLimit(rateScope);
    if (!rateStatus.allowed) {
      setAuthError(
        `RATE LIMIT LOCKOUT: Too many failed sign-in attempts. Please wait ${rateStatus.remainingSeconds}s before retrying.`
      );
      return;
    }

    const found = users.find(
      (u) =>
        u.role === 'student' &&
        u.gmail.toLowerCase() === stuGmail.trim().toLowerCase()
    );

    if (
      !found ||
      !constantTimeHexCompare(found.passwordHash, hashCredential(stuPassword))
    ) {
      const failure = recordAuthFailure(rateScope);
      setAuthError(
        failure.locked
          ? `ACCOUNT LOCKED FOR ${failure.remainingSeconds}s: 5 consecutive failed authentication attempts.`
          : `Invalid Gmail or password (${failure.attemptsRemaining} attempts remaining before lockout).`
      );
      return;
    }

    if (found.isBlocked) {
      setAuthError(
        'ACCOUNT BLOCKED: Your access tokens have been revoked by System Administration.'
      );
      return;
    }

    // Device limit check (Max 3 unique devices allowed simultaneously)
    const existingDeviceCount = found.connectedDevices.length;
    if (
      (simulateNewFourthDevice && existingDeviceCount >= 3) ||
      existingDeviceCount > 3
    ) {
      setAuthError(
        `DEVICE LIMIT EXCEEDED (Max 3 Devices): Account "${found.fullName}" already has ${existingDeviceCount}/3 active devices connected. Access from a 4th device is strictly rejected.`
      );
      return;
    }

    resetAuthFailures(rateScope);
    onAuthenticated(found);
  };

  // Direct Biometric Sensor Login (Supports Fingerprint or Face ID)
  const handleBiometricSensorSignIn = (method: 'fingerprint' | 'face_id' = 'fingerprint') => {
    setAuthError(null);
    setBiometricModalMethod(method);
    setBiometricModalOpen(true);
    setBiometricScanning(true);

    window.setTimeout(() => {
      setBiometricScanning(false);
      const targetStudent =
        users.find(
          (u) =>
            u.role === 'student' &&
            u.gmail.toLowerCase() === stuGmail.trim().toLowerCase()
        ) || users.find((u) => u.role === 'student' && u.biometricRegistered);

      if (!targetStudent) {
        setBiometricModalOpen(false);
        setAuthError(
          `No ${method === 'face_id' ? 'Face ID' : 'Fingerprint'} biometric key registered on this device.`
        );
        return;
      }

      if (targetStudent.isBlocked) {
        setBiometricModalOpen(false);
        setAuthError(
          'ACCOUNT BLOCKED: Your access tokens have been revoked by System Administration.'
        );
        return;
      }

      if (
        simulateNewFourthDevice &&
        targetStudent.connectedDevices.length >= 3
      ) {
        setBiometricModalOpen(false);
        setAuthError(
          `DEVICE LIMIT EXCEEDED (Max 3 Devices): Account "${targetStudent.fullName}" already has 3/3 active devices connected. 4th device login rejected.`
        );
        return;
      }

      setBiometricModalOpen(false);
      onAuthenticated(targetStudent);
    }, 1100);
  };

  // Student Registration Next -> Biometric Setup (Fingerprint or Face ID)
  const handleStudentProceedToBiometric = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (
      !stuGmail.trim() ||
      !stuPassword.trim() ||
      !stuAge.trim() ||
      !stuFullName.trim() ||
      !stuPhone.trim()
    ) {
      setAuthError('All 5 registration fields are mandatory before Biometric Setup.');
      return;
    }

    if (!stuGmail.toLowerCase().includes('@')) {
      setAuthError('Please enter a valid Gmail address.');
      return;
    }

    if (stuPassword.trim().length < 8) {
      setAuthError(
        'Password Policy Violation: Password must be at least 8 characters long.'
      );
      return;
    }

    setStudentStep('biometric_setup');
  };

  const handleCompleteStudentRegistration = () => {
    if (!stuBiometricDone) {
      setAuthError(
        `Please complete your ${
          stuBiometricMethod === 'face_id' ? 'Face ID' : 'Fingerprint'
        } scan before finishing registration.`
      );
      return;
    }

    const newStudent: UserProfile = {
      id: generateSecureId('stu'),
      role: 'student',
      fullName: sanitizeTextInput(stuFullName, 100),
      gmail: sanitizeTextInput(stuGmail.toLowerCase(), 120),
      passwordHash: hashCredential(stuPassword),
      age: Math.max(10, Math.min(100, Number(stuAge) || 19)),
      phone: sanitizeTextInput(stuPhone, 30),
      biometricRegistered: true,
      biometricMethod: stuBiometricMethod,
      biometricKeyId: generateSecureId(`bio_${stuBiometricMethod}`),
      connectedDevices: [
        {
          id: generateSecureId('dev'),
          name: 'Current Browser Session (Verified)',
          platform: navigator.platform || 'Web Client OS',
          lastActive: 'Active now',
          location: 'Verified Session',
          isCurrentDevice: true,
        },
      ],
      examScore: 0,
      correctExamAnswersTotal: 0,
      isBlocked: false,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    onRegisterUser(newStudent);
    onAuthenticated(newStudent);
  };

  // Teacher Registration & Sign-In with Brute-Force Rate Limiting & Constant-Time Hash Check
  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const eventCheck = validateTrustedUserEvent(e);
    if (!eventCheck.valid) {
      setAuthError(
        eventCheck.reason ||
          'Authentication rejected: Untrusted synthetic event detected.'
      );
      return;
    }

    if (teacherMode === 'signin') {
      const rateScope = `teacher_auth:${tchGmail.trim().toLowerCase()}`;
      const rateStatus = checkAuthRateLimit(rateScope);
      if (!rateStatus.allowed) {
        setAuthError(
          `RATE LIMIT LOCKOUT: Too many failed sign-in attempts. Please wait ${rateStatus.remainingSeconds}s.`
        );
        return;
      }

      const found = users.find(
        (u) =>
          u.role === 'teacher' &&
          u.gmail.toLowerCase() === tchGmail.trim().toLowerCase()
      );
      if (
        !found ||
        !constantTimeHexCompare(found.passwordHash, hashCredential(tchPassword))
      ) {
        const failure = recordAuthFailure(rateScope);
        setAuthError(
          failure.locked
            ? `ACCOUNT LOCKED FOR ${failure.remainingSeconds}s: 5 consecutive failed authentication attempts.`
            : `Invalid Gmail or password (${failure.attemptsRemaining} attempts remaining).`
        );
        return;
      }
      if (found.isBlocked) {
        setAuthError(
          'ACCOUNT BLOCKED: Your access tokens have been revoked by System Administration.'
        );
        return;
      }
      resetAuthFailures(rateScope);
      onAuthenticated(found);
      return;
    }

    // Teacher Registration
    if (!tchFullName.trim() || !tchAge.trim() || !tchMajor.trim()) {
      setAuthError('Please fill in Full Name, Age, Academic Degree, and Major Field.');
      return;
    }
    if (tchPassword.trim().length < 8) {
      setAuthError(
        'Password Policy Violation: Educator password must be at least 8 characters long.'
      );
      return;
    }
    if (tchSubjects.length === 0) {
      setAuthError('Please select at least one Teaching Subject.');
      return;
    }

    const generatedGmail =
      sanitizeTextInput(tchGmail.toLowerCase(), 120) ||
      `${tchFullName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@gmail.com`;

    const newTeacher: UserProfile = {
      id: generateSecureId('tch'),
      role: 'teacher',
      fullName: sanitizeTextInput(tchFullName, 100),
      gmail: generatedGmail,
      passwordHash: hashCredential(tchPassword),
      age: Math.max(18, Math.min(100, Number(tchAge) || 30)),
      phone: '+994 50 000 00 00',
      academicDegree: tchDegree,
      majorField: sanitizeTextInput(tchMajor, 140),
      teachingSubjects: tchSubjects,
      isPremium: false,
      monthlyPublishedCount: 0,
      bankCard: null,
      subscribersCount: 0,
      rating: 5.0,
      connectedDevices: [
        {
          id: generateSecureId('dev_tch'),
          name: 'Author Workstation',
          platform: 'Desktop OS',
          lastActive: 'Active now',
          location: 'Verified',
          isCurrentDevice: true,
        },
      ],
      isBlocked: false,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    onRegisterUser(newTeacher);
    onAuthenticated(newTeacher);
  };

  // Member of System (Super Admin) Step 1 & Step 2 Verification with Rate-Limit & Event Attestation
  const handleAdminStepOne = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const eventCheck = validateTrustedUserEvent(e);
    if (!eventCheck.valid) {
      setAuthError(
        eventCheck.reason ||
          'System Gate Rejected: Untrusted synthetic event detected.'
      );
      return;
    }

    const rateScope = 'sys_admin_step_1';
    const rateStatus = checkAuthRateLimit(rateScope);
    if (!rateStatus.allowed) {
      setAuthError(
        `SYSTEM VAULT LOCKED: Brute-force protection active. Retry in ${rateStatus.remainingSeconds}s.`
      );
      return;
    }

    const isValid = verifySystemStepOne(
      systemVault,
      sysGmail,
      sysPassword,
      sysCipher
    );

    if (!isValid) {
      const failure = recordAuthFailure(rateScope);
      setAuthError(
        failure.locked
          ? `SYSTEM VAULT LOCKED FOR ${failure.remainingSeconds}s due to repeated failed attempts.`
          : `System Verification Failed: Invalid Gmail, Password, or Cipher Code (${failure.attemptsRemaining} attempts left).`
      );
      return;
    }

    resetAuthFailures(rateScope);
    setAdminStep(2);
  };

  const handleAdminStepTwo = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const eventCheck = validateTrustedUserEvent(e);
    if (!eventCheck.valid) {
      setAuthError(
        eventCheck.reason ||
          'System Gate Rejected: Untrusted synthetic event detected.'
      );
      return;
    }

    const rateScope = 'sys_admin_step_2_pin_honeypot';
    const rateStatus = checkAuthRateLimit(rateScope);
    if (!rateStatus.allowed) {
      setAuthError(
        `SECURITY CHALLENGE LOCKED: Too many failed attempts. Retry in ${rateStatus.remainingSeconds}s.`
      );
      return;
    }

    const isValid = verifySystemStepTwo(systemVault, sysWhatsNewAnswer);
    if (!isValid) {
      const failure = recordAuthFailure(rateScope);
      setAuthError(
        failure.locked
          ? `SECURITY CHALLENGE LOCKED FOR ${failure.remainingSeconds}s.`
          : `Access Denied: Security question verification failed (${failure.attemptsRemaining} attempts left).`
      );
      return;
    }

    resetAuthFailures(rateScope);
    const adminProfile: UserProfile = {
      id: 'sys_admin_root',
      role: 'admin',
      fullName: 'System Root Member',
      gmail: sanitizeTextInput(sysGmail.toLowerCase(), 120),
      passwordHash: 'vault_protected',
      age: 35,
      phone: '+994 50 000 00 01',
      connectedDevices: [],
      isBlocked: false,
      joinedAt: '2026-01-01',
    };

    onAuthenticated(adminProfile);
  };

  return (
    <div className="min-h-screen ocean-water-canvas text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Dynamic Flowing Ocean Currents & Caustic Light Refraction Layers */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[38rem] h-[38rem] rounded-full ocean-current-blob-1" />
      <div className="pointer-events-none absolute -bottom-36 -right-32 w-[42rem] h-[42rem] rounded-full ocean-current-blob-2" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(125,211,252,0.22)_0%,rgba(0,82,255,0.08)_48%,transparent_75%)]" />

      {/* Animated Multi-Depth Flowing Ocean Waves at Bottom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 overflow-hidden opacity-45"
      >
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-44 ocean-wave-track-slow"
        >
          <path
            fill="rgba(56, 189, 248, 0.25)"
            d="M0,192L60,181.3C120,171,240,149,360,154.7C480,160,600,192,720,197.3C840,203,960,181,1080,165.3C1200,149,1320,139,1380,133.3L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
        </svg>
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-36 ocean-wave-track-fast"
        >
          <path
            fill="rgba(186, 230, 253, 0.2)"
            d="M0,224L80,213.3C160,203,320,181,480,186.7C640,192,800,224,960,218.7C1120,213,1280,171,1360,149.3L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
          />
        </svg>
      </div>

      {/* Main Centered Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Top Brand Mark */}
        <div className="mb-3 flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-sky-100/90 drop-shadow-xs">
          <GraduationCap className="w-4 h-4 text-sky-200" />
          <span>C. ACADEMY PLATFORM</span>
        </div>

        {/* ROLE SELECTION VIEW */}
        {selectedRole === null && (
          <div className="w-full flex flex-col items-center text-center space-y-8 py-6">
            {/* Interactive "Welcome" Heading for Hidden Easter Egg (20 taps + 10s hold) */}
            <div className="flex flex-col items-center space-y-2">
              <h1
                onPointerDown={handleWelcomePointerDown}
                onPointerUp={handleWelcomePointerUpOrLeave}
                onPointerLeave={handleWelcomePointerUpOrLeave}
                onPointerCancel={handleWelcomePointerUpOrLeave}
                onContextMenu={(e) => e.preventDefault()}
                className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-sm cursor-pointer select-none px-4 py-2"
              >
                {t.welcome}
              </h1>
            </div>

            {/* Stacked Fluid Glass Role Buttons */}
            <div className="w-full space-y-4 max-w-xs">
              <motion.button
                whileHover={{ y: -2, scale: 1.015 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSelectedRole('student');
                }}
                className="w-full py-4 px-6 rounded-2xl font-semibold text-base text-white fluid-glass-role-btn flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap"
              >
                <span className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <BookOpen className="w-4 h-4 text-white" />
                </span>
                <span className="tracking-wide drop-shadow-xs">
                  {t.asStudent}
                </span>
              </motion.button>

              <motion.button
                whileHover={{ y: -2, scale: 1.015 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setSelectedRole('teacher');
                }}
                className="w-full py-4 px-6 rounded-2xl font-semibold text-base text-white fluid-glass-role-btn flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap"
              >
                <span className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <GraduationCap className="w-4 h-4 text-white" />
                </span>
                <span className="tracking-wide drop-shadow-xs">
                  {t.asTeacher}
                </span>
              </motion.button>

              {systemRoleUnlocked && (
                <motion.button
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ y: -2, scale: 1.015 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAdminStep(1);
                    setSelectedRole('admin');
                  }}
                  className="w-full py-4 px-6 rounded-2xl font-semibold text-base text-white fluid-glass-role-btn border-amber-300/70 flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap"
                >
                  <span className="w-8 h-8 rounded-xl bg-amber-400/25 border border-amber-200/50 flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-4 h-4 text-amber-200" />
                  </span>
                  <span className="tracking-wide drop-shadow-xs">
                    {t.asSystemMember}
                  </span>
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* STUDENT AUTH VIEW */}
        {selectedRole === 'student' && (
          <div className="w-full bg-white text-slate-900 rounded-2xl p-6 md:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setStudentStep('form');
                  setAuthError(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setStudentMode('signin');
                    setStudentStep('form');
                    setAuthError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    studentMode === 'signin'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentMode('register');
                    setStudentStep('form');
                    setAuthError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    studentMode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {studentMode === 'signin' ? (
              <form onSubmit={handleStudentSignIn} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Student Sign In
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Max 3 connected devices allowed per student account.
                  </p>
                </div>

                {/* Quick Demo Account Selector */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStuGmail('aydan.mammadova@gmail.com');
                      setStuPassword('student123');
                      setSimulateNewFourthDevice(false);
                      setAuthError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    Aydan (2/3 Devices)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStuGmail('emre.yilmaz@gmail.com');
                      setStuPassword('student123');
                      setSimulateNewFourthDevice(true);
                      setAuthError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium cursor-pointer"
                  >
                    Emre (3/3 Devices · Test 4th Device Block)
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Gmail Address
                    </label>
                    <input
                      type="email"
                      required
                      value={stuGmail}
                      onChange={(e) => setStuGmail(e.target.value)}
                      placeholder="student@gmail.com"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-[#0052FF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={stuPassword}
                      onChange={(e) => setStuPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-[#0052FF] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-600 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateNewFourthDevice}
                      onChange={(e) =>
                        setSimulateNewFourthDevice(e.target.checked)
                      }
                      className="rounded border-slate-300 text-[#0052FF]"
                    />
                    <span>
                      Simulate login from unrecognized 4th device (Tests 3-device limit)
                    </span>
                  </label>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Sign In with Gmail & Password
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleBiometricSensorSignIn('fingerprint')}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Fingerprint className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Fingerprint Login</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBiometricSensorSignIn('face_id')}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ScanFace className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Face ID Login</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : studentStep === 'form' ? (
              <form
                onSubmit={handleStudentProceedToBiometric}
                className="space-y-3.5"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Student Registration
                  </h2>
                  <p className="text-xs text-slate-500">
                    All fields & Biometric setup (Fingerprint or Face ID) are mandatory.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Gmail Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={stuGmail}
                    onChange={(e) => setStuGmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={stuPassword}
                      onChange={(e) => setStuPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      3. Age *
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      required
                      value={stuAge}
                      onChange={(e) => setStuAge(e.target.value)}
                      placeholder="20"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    4. Full Name (First & Last Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={stuFullName}
                    onChange={(e) => setStuFullName(e.target.value)}
                    placeholder="e.g. Leyla Hasanova"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    5. Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={stuPhone}
                    onChange={(e) => setStuPhone(e.target.value)}
                    placeholder="+994 50 123 45 67"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Next: 6. Biometric Setup (Fingerprint / Face ID) →
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center py-2">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    6. Biometric Verification Setup
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose your preferred biometric method and tap the sensor below to enroll.
                  </p>
                </div>

                {/* Biometric Option Selector: Option 1 (Fingerprint) vs Option 2 (Face ID) */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setStuBiometricMethod('fingerprint');
                      setStuBiometricDone(false);
                      setAuthError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      stuBiometricMethod === 'fingerprint'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5 text-[#0052FF]" />
                    <span>Option 1: Fingerprint</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStuBiometricMethod('face_id');
                      setStuBiometricDone(false);
                      setAuthError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      stuBiometricMethod === 'face_id'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5 text-[#0052FF]" />
                    <span>Option 2: Face ID</span>
                  </button>
                </div>

                {/* Interactive Scanner Target for Selected Method */}
                <button
                  type="button"
                  onClick={() => {
                    setStuBiometricDone(true);
                    setAuthError(null);
                  }}
                  className={`w-24 h-24 rounded-2xl mx-auto flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
                    stuBiometricDone
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                      : 'bg-blue-50/70 border-[#0052FF] text-[#0052FF] hover:scale-105'
                  }`}
                >
                  {stuBiometricMethod === 'face_id' ? (
                    <ScanFace className="w-12 h-12" />
                  ) : (
                    <Fingerprint className="w-12 h-12" />
                  )}
                </button>

                <p className="text-xs font-semibold text-slate-700">
                  {stuBiometricDone
                    ? `✓ ${
                        stuBiometricMethod === 'face_id'
                          ? 'Face ID Facial Recognition'
                          : 'Biometric Fingerprint'
                      } Enrolled Successfully`
                    : stuBiometricMethod === 'face_id'
                    ? 'Tap Face ID camera frame above to scan your face'
                    : 'Tap sensor icon above to scan your fingerprint'}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentStep('form')}
                    className="w-1/3 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteStudentRegistration}
                    className="w-2/3 py-2.5 px-4 bg-[#0052FF] hover:bg-[#0040C9] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Complete Registration
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TEACHER / AUTHOR AUTH VIEW */}
        {selectedRole === 'teacher' && (
          <div className="w-full bg-white text-slate-900 rounded-2xl p-6 md:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setAuthError(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherMode('register');
                    setAuthError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    teacherMode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Author Registration
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherMode('signin');
                    setAuthError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    teacherMode === 'signin'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Existing Author
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-3.5">
              {teacherMode === 'signin' ? (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Teacher / Author Sign In
                    </h2>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTchGmail('kamran.aliyev@gmail.com');
                          setTchPassword('teacher123');
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                      >
                        Dr. Kamran Aliyev (2/3 Free Quota)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTchGmail('elena.voronova@gmail.com');
                          setTchPassword('teacher123');
                        }}
                        className="text-[11px] px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium cursor-pointer"
                      >
                        Prof. Voronova (Premium 78/22)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Author Gmail
                    </label>
                    <input
                      type="email"
                      required
                      value={tchGmail}
                      onChange={(e) => setTchGmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={tchPassword}
                      onChange={(e) => setTchPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Enter Teacher Dashboard
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Author / Teacher Registration
                    </h2>
                    <p className="text-xs text-slate-500">
                      Complete your academic credentials to publish PDFs & Exams.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. Full Name (First & Last) *
                      </label>
                      <input
                        type="text"
                        required
                        value={tchFullName}
                        onChange={(e) => setTchFullName(e.target.value)}
                        placeholder="Dr. Rashad Mahmudov"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Age *
                      </label>
                      <input
                        type="number"
                        required
                        min={18}
                        max={99}
                        value={tchAge}
                        onChange={(e) => setTchAge(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. Academic Degree *
                      </label>
                      <select
                        value={tchDegree}
                        onChange={(e) =>
                          setTchDegree(e.target.value as AcademicDegree)
                        }
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white"
                      >
                        {ACADEMIC_DEGREES.map((deg) => (
                          <option key={deg} value={deg}>
                            {deg}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        4. Major / Graduated Field *
                      </label>
                      <input
                        type="text"
                        required
                        value={tchMajor}
                        onChange={(e) => setTchMajor(e.target.value)}
                        placeholder="e.g. Quantum Physics"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      5. Teaching Subjects (Multi-select from Official List) *
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                      {OFFICIAL_SUBJECTS.map((subject) => {
                        const active = tchSubjects.includes(subject);
                        return (
                          <button
                            key={subject}
                            type="button"
                            onClick={() => toggleTeacherSubject(subject)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer whitespace-nowrap truncate ${
                              active
                                ? 'bg-[#0052FF] text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <span className="truncate">{subject}</span>
                            {active && <Check className="w-3 h-3 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Register & Launch Teacher Dashboard
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* MEMBER OF SYSTEM (SUPER ADMIN - HIDDEN AUTH) */}
        {selectedRole === 'admin' && (
          <div className="w-full bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 md:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setAdminStep(1);
                  setAuthError(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <span className="text-xs font-mono text-amber-400">
                STEP {adminStep} OF 2 · SYSTEM VAULT
              </span>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/90 border border-red-800 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {adminStep === 1 ? (
              <form onSubmit={handleAdminStepOne} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Member of System — Step 1
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter root Gmail, Password, and Cryptographic Cipher Code.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    System Gmail
                  </label>
                  <input
                    type="email"
                    required
                    value={sysGmail}
                    onChange={(e) => setSysGmail(e.target.value)}
                    placeholder="Enter system Gmail"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    System Password
                  </label>
                  <input
                    type="password"
                    required
                    value={sysPassword}
                    onChange={(e) => setSysPassword(e.target.value)}
                    placeholder="Enter system password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cipher Code
                  </label>
                  <input
                    type="password"
                    required
                    value={sysCipher}
                    onChange={(e) => setSysCipher(e.target.value)}
                    placeholder="Enter cipher string"
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Verify Credentials & Proceed to Step 2 →
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminStepTwo} className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Security Question Verification
                  </h2>
                  <p className="text-sm font-mono text-amber-300 mt-1.5">
                    Question: &quot;what&apos;s new?&quot;
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter 4-digit security PIN code to unlock console:
                  </p>
                </div>

                {/* DECEPTIVE 4-DIGIT PIN HONEY-POT UI (Reverse Social Engineering) */}
                {/* Visually mimics a 4-digit numeric PIN pad, while internally accepting a full 36-38+ character secret phrase */}
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const activeCount =
                        sysWhatsNewAnswer.length === 0
                          ? 0
                          : sysWhatsNewAnswer.length % 4 === 0
                          ? 4
                          : sysWhatsNewAnswer.length % 4;
                      const isFilled = slotIdx < activeCount;
                      const isCurrentCursor =
                        slotIdx === activeCount ||
                        (activeCount === 4 && slotIdx === 3);

                      return (
                        <div
                          key={slotIdx}
                          className={`h-14 rounded-xl border flex items-center justify-center font-mono text-xl font-bold transition-all ${
                            isFilled
                              ? 'bg-slate-900 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.18)]'
                              : isCurrentCursor
                              ? 'bg-slate-900/90 border-slate-600 text-slate-500'
                              : 'bg-slate-900/50 border-slate-800 text-slate-600'
                          }`}
                        >
                          {isFilled ? '•' : '_'}
                        </div>
                      );
                    })}
                  </div>

                  {/* Unrestricted Secret Input (Disguised with misleading "enter 4 number code" placeholder) */}
                  <input
                    type="password"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={sysWhatsNewAnswer}
                    onChange={(e) => setSysWhatsNewAnswer(e.target.value)}
                    placeholder="enter 4 number code"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tracking-widest text-center rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 placeholder:tracking-normal focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminStep(1)}
                    className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Verify PIN &amp; Unlock
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Biometric Sensor Modal (Fingerprint or Face ID) */}
      {biometricModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 mx-auto flex items-center justify-center text-[#0052FF]">
              {biometricModalMethod === 'face_id' ? (
                <ScanFace
                  className={`w-9 h-9 ${biometricScanning ? 'animate-pulse' : ''}`}
                />
              ) : (
                <Fingerprint
                  className={`w-9 h-9 ${biometricScanning ? 'animate-pulse' : ''}`}
                />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {biometricModalMethod === 'face_id'
                ? 'C. ACADEMY Face ID Scanner'
                : 'C. ACADEMY Fingerprint Sensor'}
            </h3>
            <p className="text-xs text-slate-500">
              {biometricModalMethod === 'face_id'
                ? 'Scanning 3D facial geometry & checking 3-device concurrency limit...'
                : 'Verifying hardware fingerprint token & checking 3-device concurrency limit...'}
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#0052FF]">
              <Smartphone className="w-4 h-4" />
              <span>
                {biometricModalMethod === 'face_id'
                  ? 'Face ID / TrueDepth Enclave Active'
                  : 'Touch ID / Biometric Enclave Active'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
