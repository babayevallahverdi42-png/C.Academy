import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Users,
  CreditCard,
  BarChart3,
  KeyRound,
  CheckCircle2,
  Ban,
  LogOut,
  X,
  Sun,
  Moon,
  Lock,
  Newspaper,
  Plus,
  Trash2,
  Edit3,
  Pin,
  FolderOpen,
  Send,
} from 'lucide-react';
import {
  AcademicProduct,
  NewsArticle,
  OfficialSubject,
  PurchasedRecord,
  SystemPayoneerConfig,
  UserProfile,
} from '../types';
import { OFFICIAL_SUBJECTS } from '../utils/i18n';
import {
  createSignedSystemVault,
  generateSecureId,
  ObfuscatedSystemVault,
  sanitizeSafeImageUri,
  sanitizeTextInput,
  validateSafeImageFile,
} from '../utils/security';
import {
  installHardenedRuntimeProtections,
  validateTrustedUserEvent,
  NATIVE_ANDROID_FLAG_SECURE_KOTLIN_CODE,
  NATIVE_IOS_SECURE_LAYER_SWIFT_CODE,
} from '../utils/antiTamperEngine';
import {
  REACT_NATIVE_ENTERPRISE_ARCHITECTURE_CODE,
  FLUTTER_ENTERPRISE_ARCHITECTURE_CODE,
} from '../utils/mobileEnterpriseSecurity';

interface AdminDashboardProps {
  users: UserProfile[];
  products: AcademicProduct[];
  purchases: PurchasedRecord[];
  news: NewsArticle[];
  payoneerConfig: SystemPayoneerConfig;
  systemVault: ObfuscatedSystemVault;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleBlockUser: (userId: string) => void;
  onCreateNews: (article: NewsArticle) => void;
  onUpdateNews: (article: NewsArticle) => void;
  onDeleteNews: (articleId: string) => void;
  onUpdatePayoneerConfig: (newConfig: SystemPayoneerConfig) => void;
  onUpdateSystemVault: (newVault: ObfuscatedSystemVault) => void;
  onLogout: () => void;
}

type AdminSection =
  | 'users_list'
  | 'add_news'
  | 'bank_setup'
  | 'earnings_analytics'
  | 'security_settings';

const ADMIN_SECTION_ORDER: AdminSection[] = [
  'users_list',
  'add_news',
  'bank_setup',
  'earnings_analytics',
  'security_settings',
];

const IOS_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users,
  products,
  purchases,
  news,
  payoneerConfig,
  systemVault,
  darkMode,
  onToggleDarkMode,
  onToggleBlockUser,
  onCreateNews,
  onUpdateNews,
  onDeleteNews,
  onUpdatePayoneerConfig,
  onUpdateSystemVault,
  onLogout,
}) => {
  const [activeSection, setActiveSection] =
    useState<AdminSection>('users_list');
  const [direction, setDirection] = useState<number>(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Add / Manage News state
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsSubject, setNewsSubject] = useState<OfficialSubject>('Math');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [newsAuthor, setNewsAuthor] = useState('C. ACADEMY System Editorial');
  const [newsReadTime, setNewsReadTime] = useState<number>(3);
  const [newsIsPinned, setNewsIsPinned] = useState<boolean>(false);
  const [newsCoverImage, setNewsCoverImage] = useState<string>('');
  const [newsFeedback, setNewsFeedback] = useState<string | null>(null);

  // Payoneer Bank Setup state
  const [payoneerIdInput, setPayoneerIdInput] = useState(
    payoneerConfig.payoneerAccountId
  );
  const [routingInput, setRoutingInput] = useState(
    payoneerConfig.maskedRoutingAccount
  );
  const [currencyInput, setCurrencyInput] = useState(
    payoneerConfig.settlementCurrency
  );
  const [payoneerSavedNotice, setPayoneerSavedNotice] = useState<string | null>(
    null
  );

  // Change gmail, passwords and cipher and what's news state
  const [newGmail, setNewGmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCipher, setNewCipher] = useState('');
  const [newWhatsNew, setNewWhatsNew] = useState('');
  const [vaultSavedNotice, setVaultSavedNotice] = useState<string | null>(null);

  const switchSection = (next: AdminSection) => {
    const currIdx = ADMIN_SECTION_ORDER.indexOf(activeSection);
    const nextIdx = ADMIN_SECTION_ORDER.indexOf(next);
    setDirection(nextIdx >= currIdx ? 1 : -1);
    setActiveSection(next);
  };

  // Mathematical breakdown calculations
  const totalSalesCount = purchases.length;
  const pdfSalesCount = purchases.filter((p) => p.productType === 'pdf').length;
  const examSalesCount = purchases.filter(
    (p) => p.productType === 'exam'
  ).length;
  const grossVolume = purchases.reduce((acc, p) => acc + p.pricePaid, 0);
  const totalPlatformShare = purchases.reduce(
    (acc, p) => acc + p.platformShare,
    0
  );
  const totalTeacherShare = purchases.reduce(
    (acc, p) => acc + p.teacherShare,
    0
  );

  const handleNewsCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateSafeImageFile(file);
    if (!validation.valid) {
      setNewsFeedback(validation.error || 'Unsafe image file blocked.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const safeUri = sanitizeSafeImageUri(reader.result);
        if (safeUri) setNewsCoverImage(safeUri);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetNewsForm = () => {
    setEditingNewsId(null);
    setNewsSubject('Math');
    setNewsTitle('');
    setNewsSummary('');
    setNewsBody('');
    setNewsAuthor('C. ACADEMY System Editorial');
    setNewsReadTime(3);
    setNewsIsPinned(false);
    setNewsCoverImage('');
  };

  const handlePublishOrUpdateNews = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTrustedUserEvent(e);
    if (!check.valid) {
      setNewsFeedback(
        check.reason || 'Rejected untrusted synthetic event on News Publish.'
      );
      return;
    }

    const cleanTitle = sanitizeTextInput(newsTitle, 180);
    const cleanSummary = sanitizeTextInput(newsSummary, 400);
    const cleanBody = sanitizeTextInput(newsBody, 4000);
    const cleanAuthor =
      sanitizeTextInput(newsAuthor, 100) || 'C. ACADEMY System Editorial';
    const cleanCover = sanitizeSafeImageUri(newsCoverImage);

    if (!cleanTitle || !cleanSummary || !cleanBody) return;

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());

    if (editingNewsId) {
      const existing = news.find((n) => n.id === editingNewsId);
      const updatedArticle: NewsArticle = {
        id: editingNewsId,
        subject: newsSubject,
        title: cleanTitle,
        summary: cleanSummary,
        body: cleanBody,
        author: cleanAuthor,
        readTimeMinutes: Math.max(1, Math.min(60, Number(newsReadTime) || 3)),
        publishedAt: existing?.publishedAt || formattedDate,
        updatedAt: formattedDate,
        isPinned: newsIsPinned,
        coverImage: cleanCover,
      };
      onUpdateNews(updatedArticle);
      setNewsFeedback(
        `Updated news post "${updatedArticle.title}" in the public News Section.`
      );
    } else {
      const newArticle: NewsArticle = {
        id: generateSecureId('news'),
        subject: newsSubject,
        title: cleanTitle,
        summary: cleanSummary,
        body: cleanBody,
        author: cleanAuthor,
        readTimeMinutes: Math.max(1, Math.min(60, Number(newsReadTime) || 3)),
        publishedAt: formattedDate,
        isPinned: newsIsPinned,
        coverImage: cleanCover,
      };
      onCreateNews(newArticle);
      setNewsFeedback(
        `Published "${newArticle.title}" live to the public News Section feed!`
      );
    }

    resetNewsForm();
  };

  const handleStartEditNews = (article: NewsArticle) => {
    setEditingNewsId(article.id);
    setNewsSubject(article.subject);
    setNewsTitle(article.title);
    setNewsSummary(article.summary);
    setNewsBody(article.body);
    setNewsAuthor(article.author);
    setNewsReadTime(article.readTimeMinutes);
    setNewsIsPinned(Boolean(article.isPinned));
    setNewsCoverImage(article.coverImage || '');
    setNewsFeedback(null);
  };

  const handleSavePayoneer = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTrustedUserEvent(e);
    if (!check.valid) return;
    onUpdatePayoneerConfig({
      ...payoneerConfig,
      payoneerAccountId: sanitizeTextInput(payoneerIdInput, 80),
      maskedRoutingAccount: sanitizeTextInput(routingInput, 120),
      settlementCurrency: sanitizeTextInput(currencyInput, 20),
      lastUpdated: new Date().toISOString().split('T')[0],
    });
    setPayoneerSavedNotice(
      'System Payoneer integration & platform share routing updated.'
    );
  };

  const handleUpdateSecurityCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTrustedUserEvent(e);
    if (!check.valid) {
      setVaultSavedNotice(
        check.reason ||
          'Rejected untrusted synthetic event on System Vault rotation.'
      );
      return;
    }
    if (
      !newGmail.trim() ||
      !newPassword.trim() ||
      !newCipher.trim() ||
      !newWhatsNew.trim()
    ) {
      return;
    }

    const updatedVault = createSignedSystemVault(
      newGmail,
      newPassword,
      newCipher,
      newWhatsNew
    );

    onUpdateSystemVault(updatedVault);
    setNewGmail('');
    setNewPassword('');
    setNewCipher('');
    setNewWhatsNew('');
    setVaultSavedNotice(
      "System Vault rotated: 2,048-round salted SHA-256 digests and HMAC integrity seal updated (zero reversible byte vectors)."
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col pb-24 transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Bar Contract (3 Zones) with iOS Fluid Glass */}
      <header
        className={`sticky top-0 z-30 px-4 md:px-8 py-3.5 border-b flex items-center justify-between ios-glass-header ${
          darkMode ? 'border-slate-800/80' : 'border-white/70'
        }`}
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </motion.button>
          <span className="text-lg font-bold tracking-tight font-display">
            C. ACADEMY
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          {(
            [
              { id: 'users_list', label: 'Lists of Users' },
              { id: 'add_news', label: 'Add News' },
              { id: 'bank_setup', label: 'Bank Account Setup' },
              { id: 'earnings_analytics', label: 'Earnings & Analytics' },
              { id: 'security_settings', label: 'Security Vault' },
            ] as { id: AdminSection; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchSection(item.id)}
              className={`relative py-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap ${
                activeSection === item.id
                  ? 'text-[#0052FF] dark:text-sky-400 font-semibold'
                  : ''
              }`}
            >
              {item.label}
              {activeSection === item.id && (
                <motion.div
                  layoutId="adminTopNavUnderline"
                  transition={IOS_SPRING}
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0052FF] dark:bg-sky-400 rounded-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Exit System Console
          </motion.button>
        </div>
      </header>

      {/* Main Content Area with iOS Screen-Transition Physics & Swipe Gestures */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: direction * 38, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -38, scale: 0.985 }}
            transition={IOS_SPRING}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={(_, info) => {
              const idx = ADMIN_SECTION_ORDER.indexOf(activeSection);
              if (info.offset.x < -75 && idx < ADMIN_SECTION_ORDER.length - 1) {
                switchSection(ADMIN_SECTION_ORDER[idx + 1]);
              } else if (info.offset.x > 75 && idx > 0) {
                switchSection(ADMIN_SECTION_ORDER[idx - 1]);
              }
            }}
            className="space-y-6"
          >
            {/* SECTION 1: LISTS OF USERS (Block or Not) */}
            {activeSection === 'users_list' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      Lists of Users — Registry & Access Token Control
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Clicking Block instantly revokes access tokens and terminates all active device sessions for that user.
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => switchSection('add_news')}
                    className="px-4 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap self-start"
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>Open Add News Studio ({news.length} Live)</span>
                  </motion.button>
                </div>

                <div
                  className={`rounded-2xl border overflow-x-auto ios-glass-card ${
                    darkMode ? 'border-slate-800' : 'border-slate-200/80'
                  }`}
                >
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">
                          Full Name & Role
                        </th>
                        <th className="py-3.5 px-4 font-semibold">
                          Gmail & Phone
                        </th>
                        <th className="py-3.5 px-4 font-semibold">
                          Academic / Device Details
                        </th>
                        <th className="py-3.5 px-4 font-semibold">
                          Session Status
                        </th>
                        <th className="py-3.5 px-4 font-semibold text-right">
                          Block or Not
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <p className="font-bold">{u.fullName}</p>
                            <p className="text-xs text-slate-500 capitalize">
                              {u.role} · Age {u.age}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs">
                            <p>{u.gmail}</p>
                            <p className="text-slate-500">{u.phone}</p>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {u.role === 'teacher' ? (
                              <span>
                                {u.academicDegree} · {u.majorField} ·{' '}
                                {u.isPremium
                                  ? 'Premium (78/22)'
                                  : 'Standard (80/20)'}
                              </span>
                            ) : (
                              <span className="font-mono">
                                Score: {u.examScore || 0} pts · Active Devices:{' '}
                                {u.connectedDevices.length}/3
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            {u.isBlocked ? (
                              <span className="text-red-600 dark:text-red-400">
                                ✕ BLOCKED (Tokens Revoked)
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ● ACTIVE SESSION
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <motion.button
                              whileTap={{ scale: 0.93 }}
                              type="button"
                              onClick={() => onToggleBlockUser(u.id)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                u.isBlocked
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-red-600 hover:bg-red-500 text-white'
                              }`}
                            >
                              {u.isBlocked ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Unblock User</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Block</span>
                                </>
                              )}
                            </motion.button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 2: ADD NEWS (CREATE, PUBLISH & MANAGE PUBLIC NEWS FEED) */}
            {activeSection === 'add_news' && (
              <div className="space-y-8">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      Add News — System Editorial & Public Feed Manager
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Create, publish, pin, and manage official news posts. All published posts automatically populate the public News Section across the platform.
                    </p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-[#0052FF] dark:text-sky-300 self-start">
                    {news.length} Published Articles in Public Feed
                  </div>
                </div>

                {newsFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between"
                  >
                    <span>{newsFeedback}</span>
                    <button
                      type="button"
                      onClick={() => setNewsFeedback(null)}
                      className="underline ml-3 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Create / Edit News Post Form */}
                  <form
                    onSubmit={handlePublishOrUpdateNews}
                    className={`lg:col-span-5 p-6 rounded-2xl border space-y-4 ios-glass-card self-start ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-3">
                      <h2 className="text-base font-bold flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-[#0052FF]" />
                        <span>
                          {editingNewsId
                            ? 'Edit Published News Post'
                            : 'Create & Publish News Post'}
                        </span>
                      </h2>
                      {editingNewsId && (
                        <button
                          type="button"
                          onClick={resetNewsForm}
                          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Subject Category *
                        </label>
                        <select
                          value={newsSubject}
                          onChange={(e) =>
                            setNewsSubject(e.target.value as OfficialSubject)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          {OFFICIAL_SUBJECTS.map((subj) => (
                            <option key={subj} value={subj}>
                              {subj}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Read Time (Min) *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          required
                          value={newsReadTime}
                          onChange={(e) =>
                            setNewsReadTime(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        News Headline Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={newsTitle}
                        onChange={(e) => setNewsTitle(e.target.value)}
                        placeholder="e.g. Global Olympiad Scholarship Applications Now Open"
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Executive Summary (Feed Preview) *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={newsSummary}
                        onChange={(e) => setNewsSummary(e.target.value)}
                        placeholder="Concise 1-2 sentence summary displayed on the News Feed card..."
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Full Article Content *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={newsBody}
                        onChange={(e) => setNewsBody(e.target.value)}
                        placeholder="Write the full official announcement or academic article body..."
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Author / System Division *
                      </label>
                      <input
                        type="text"
                        required
                        value={newsAuthor}
                        onChange={(e) => setNewsAuthor(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Optional Cover Image (From Device Gallery)
                      </label>
                      <label className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-xs cursor-pointer hover:border-[#0052FF]">
                        <span className="truncate text-slate-500">
                          {newsCoverImage
                            ? 'Cover Image Attached ✓'
                            : 'Choose Cover Visual from Gallery...'}
                        </span>
                        <FolderOpen className="w-4 h-4 text-[#0052FF] shrink-0 ml-2" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleNewsCoverPick}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={newsIsPinned}
                        onChange={(e) => setNewsIsPinned(e.target.checked)}
                        className="rounded border-slate-300 text-[#0052FF]"
                      />
                      <span>
                        Pin this bulletin to the top of the public News Section
                      </span>
                    </label>

                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {editingNewsId
                          ? 'Save Changes to Public News Feed'
                          : 'Publish Live to Public News Section'}
                      </span>
                    </motion.button>
                  </form>

                  {/* Right Column: Live Managed News Posts */}
                  <div className="lg:col-span-7 space-y-4">
                    <h2 className="text-base font-bold">
                      Published News Feed Posts (Auto-Synced with Student & Public News Section)
                    </h2>

                    <div className="space-y-3.5">
                      {news.map((item) => (
                        <motion.article
                          layout
                          key={item.id}
                          className={`p-5 rounded-2xl border space-y-3 ios-glass-card ${
                            item.isPinned
                              ? 'border-[#0052FF]/60 ring-1 ring-[#0052FF]/30'
                              : darkMode
                              ? 'border-slate-800'
                              : 'border-slate-200/80'
                          }`}
                        >
                          {item.coverImage && (
                            <div className="h-36 rounded-xl overflow-hidden bg-slate-900">
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              {item.isPinned && (
                                <span className="font-semibold text-[#0052FF] dark:text-sky-400 inline-flex items-center gap-1">
                                  <Pin className="w-3 h-3" />
                                  Pinned Bulletin ·
                                </span>
                              )}
                              <span>{item.subject}</span>
                              <span aria-hidden="true">·</span>
                              <span>{item.publishedAt}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">
                                {item.readTimeMinutes} min read
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateNews({
                                    ...item,
                                    isPinned: !item.isPinned,
                                  })
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                  item.isPinned
                                    ? 'bg-blue-50 text-[#0052FF] border-blue-200 dark:bg-blue-950/50 dark:border-blue-800'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                                title="Toggle Pin to Top"
                              >
                                {item.isPinned ? 'Pinned' : 'Pin'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStartEditNews(item)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0052FF] text-slate-600 dark:text-slate-300 cursor-pointer"
                                title="Edit News Post"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteNews(item.id)}
                                className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                title="Delete News Post"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h3 className="text-base font-bold">{item.title}</h3>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {item.summary}
                            </p>
                            <p className="text-xs text-slate-500 leading-relaxed pt-1">
                              {item.body}
                            </p>
                          </div>

                          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                            <span>Published by {item.author}</span>
                            {item.updatedAt && (
                              <span>Edited {item.updatedAt}</span>
                            )}
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: BANK ACCOUNT SETUP (System Payoneer Integration) */}
            {activeSection === 'bank_setup' && (
              <div className="max-w-2xl space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h1 className="text-2xl font-bold tracking-tight">
                    System Bank Account & Payoneer Platform Share Setup
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Collects 20% platform commission on Standard Accounts (1–3 sales) and 22% on Premium Accounts (4+ sales) via Payoneer Global Settlement.
                  </p>
                </div>

                {payoneerSavedNotice && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {payoneerSavedNotice}
                  </div>
                )}

                <form
                  onSubmit={handleSavePayoneer}
                  className={`p-6 rounded-2xl border space-y-4 ios-glass-card ${
                    darkMode ? 'border-slate-800' : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Payoneer Global Enterprise / Payee Account ID
                    </label>
                    <input
                      type="text"
                      required
                      value={payoneerIdInput}
                      onChange={(e) => setPayoneerIdInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Payoneer Receiving Treasury IBAN / Masked Routing Vault
                    </label>
                    <input
                      type="text"
                      required
                      value={routingInput}
                      onChange={(e) => setRoutingInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={currencyInput}
                        onChange={(e) => setCurrencyInput(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Standard Platform Share
                      </label>
                      <input
                        type="text"
                        disabled
                        value="20% (Teacher 80%)"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 opacity-75"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Premium Platform Share
                      </label>
                      <input
                        type="text"
                        disabled
                        value="22% (Teacher 78%)"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 opacity-75"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm cursor-pointer"
                  >
                    Save System Payoneer Settlement Configuration
                  </motion.button>
                </form>
              </div>
            )}

            {/* SECTION 4: EARNINGS & ANALYTICS */}
            {activeSection === 'earnings_analytics' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Platform Earnings & Mathematical Split Analytics
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Real-time breakdown of PDF & Exam sales count, gross volume, 80/20 Standard vs 78/22 Premium splits, and net platform revenue.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div
                    className={`p-5 rounded-2xl border ios-glass-card ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block">
                      Total PDF & Exam Sales
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums mt-1 block">
                      {totalSalesCount} ({pdfSalesCount} PDF / {examSalesCount} Exam)
                    </span>
                  </div>

                  <div
                    className={`p-5 rounded-2xl border ios-glass-card ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block">
                      Gross Transaction Volume
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums mt-1 block">
                      ${grossVolume.toFixed(2)}
                    </span>
                  </div>

                  <div
                    className={`p-5 rounded-2xl border ios-glass-card ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <span className="text-xs text-emerald-600 font-semibold block">
                      C. ACADEMY Platform Net Share (20% / 22%)
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1 block">
                      ${totalPlatformShare.toFixed(2)}
                    </span>
                  </div>

                  <div
                    className={`p-5 rounded-2xl border ios-glass-card ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block">
                      Disbursed to Teachers (80% / 78%)
                    </span>
                    <span className="text-2xl font-bold font-mono tabular-nums mt-1 block">
                      ${totalTeacherShare.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Detailed Settlement Ledger Table */}
                <div
                  className={`rounded-2xl border overflow-x-auto ios-glass-card ${
                    darkMode ? 'border-slate-800' : 'border-slate-200/80'
                  }`}
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-base font-bold">
                      Mathematical Revenue Split Ledger
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      Payoneer Account: {payoneerConfig.payoneerAccountId}
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Student Buyer</th>
                        <th className="py-3 px-4">Product & Type</th>
                        <th className="py-3 px-4">Split Tier</th>
                        <th className="py-3 px-4 text-right">Gross Paid</th>
                        <th className="py-3 px-4 text-right">Teacher Payout</th>
                        <th className="py-3 px-4 text-right">
                          Platform Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                      {purchases.map((pur) => {
                        const prod = products.find(
                          (p) => p.id === pur.productId
                        );
                        return (
                          <tr key={pur.id}>
                            <td className="py-3 px-4 font-sans font-medium">
                              {pur.studentName}
                            </td>
                            <td className="py-3 px-4 font-sans">
                              {prod?.topicName || pur.productId} (
                              {pur.productType.toUpperCase()})
                            </td>
                            <td className="py-3 px-4">
                              {pur.revenueSplitLabel}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              ${pur.pricePaid.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-slate-500">
                              ${pur.teacherShare.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-600">
                              +${pur.platformShare.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 5: ADMIN SECURITY SETTINGS (Change gmail, passwords and cipher and what's news + Hardened Anti-Tamper Engine) */}
            {activeSection === 'security_settings' && (
              <div className="space-y-8">
                <div className="max-w-2xl space-y-6">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                    <h1 className="text-2xl font-bold tracking-tight">
                      Change gmail, passwords and cipher and what&apos;s news
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      All Member of System credentials are encoded as XOR-salted cryptographic byte vectors and never persisted in plaintext.
                    </p>
                  </div>

                  {vaultSavedNotice && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      {vaultSavedNotice}
                    </div>
                  )}

                  <form
                    onSubmit={handleUpdateSecurityCredentials}
                    className={`p-6 rounded-2xl border space-y-4 ios-glass-card ${
                      darkMode ? 'border-slate-800' : 'border-slate-200/80'
                    }`}
                  >
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        New System Gmail *
                      </label>
                      <input
                        type="email"
                        required
                        value={newGmail}
                        onChange={(e) => setNewGmail(e.target.value)}
                        placeholder="Enter new system Gmail address"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        New System Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new system password"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        New Cipher Code *
                      </label>
                      <input
                        type="password"
                        required
                        value={newCipher}
                        onChange={(e) => setNewCipher(e.target.value)}
                        placeholder="Enter new cryptographic cipher code"
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        New Answer for Security Question (&quot;what&apos;s new?&quot;) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newWhatsNew}
                        onChange={(e) => setNewWhatsNew(e.target.value)}
                        placeholder="Enter new exact phrase for 'what's new?'"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>
                        Change gmail, passwords and cipher and what&apos;s news
                      </span>
                    </motion.button>
                  </form>
                </div>

                {/* Hardened Anti-Screenshot & Anti-Emitter Native Modules */}
                {(() => {
                  const runtimeAttestation = installHardenedRuntimeProtections();
                  return (
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">
                          Hardened Anti-Screenshot & Anti-Emitter Architecture (Android / iOS / Web)
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Runtime status: Native Prototypes Intact ({runtimeAttestation.nativePrototypesIntact ? 'VERIFIED' : 'ALERT'}) · DisplayMedia Locked · Canvas Readback Poisoned · Event isTrusted Gate Active.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div
                          className={`p-5 rounded-2xl border space-y-3 ios-glass-card ${
                            darkMode ? 'border-slate-800' : 'border-slate-200/80'
                          }`}
                        >
                          <h3 className="text-sm font-bold">
                            Android Native Hardening (Kotlin FLAG_SECURE + Anti-Emitter)
                          </h3>
                          <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                            {NATIVE_ANDROID_FLAG_SECURE_KOTLIN_CODE}
                          </pre>
                        </div>

                        <div
                          className={`p-5 rounded-2xl border space-y-3 ios-glass-card ${
                            darkMode ? 'border-slate-800' : 'border-slate-200/80'
                          }`}
                        >
                          <h3 className="text-sm font-bold">
                            iOS Native Hardening (Swift Secure CALayer + UIScreen.isCaptured)
                          </h3>
                          <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                            {NATIVE_IOS_SECURE_LAYER_SWIFT_CODE}
                          </pre>
                        </div>

                        <div
                          className={`p-5 rounded-2xl border space-y-3 ios-glass-card ${
                            darkMode ? 'border-slate-800' : 'border-slate-200/80'
                          }`}
                        >
                          <h3 className="text-sm font-bold">
                            React Native Enterprise Security (Keychain + MMKV AES-256 + SSL Pinning)
                          </h3>
                          <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                            {REACT_NATIVE_ENTERPRISE_ARCHITECTURE_CODE}
                          </pre>
                        </div>

                        <div
                          className={`p-5 rounded-2xl border space-y-3 ios-glass-card ${
                            darkMode ? 'border-slate-800' : 'border-slate-200/80'
                          }`}
                        >
                          <h3 className="text-sm font-bold">
                            Flutter Enterprise Security (SecureStorage + Certificate Pinning + Biometrics)
                          </h3>
                          <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                            {FLUTTER_ENTERPRISE_ARCHITECTURE_CODE}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* iOS Floating Fluid Glass Bottom Dock for Admin Panel */}
      <nav
        className={`fixed bottom-0 inset-x-0 z-30 border-t px-2 py-2 flex items-center justify-around ios-glass-dock ${
          darkMode ? 'border-slate-800/80' : 'border-white/80'
        }`}
      >
        {(
          [
            { id: 'users_list', label: 'Users', icon: Users },
            { id: 'add_news', label: 'Add News', icon: Newspaper },
            { id: 'bank_setup', label: 'Bank Setup', icon: CreditCard },
            { id: 'earnings_analytics', label: 'Earnings', icon: BarChart3 },
            { id: 'security_settings', label: 'Vault', icon: KeyRound },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchSection(tab.id)}
              className={`relative flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'text-[#0052FF] dark:text-sky-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="adminBottomDockPill"
                  transition={IOS_SPRING}
                  className="absolute inset-0 rounded-xl bg-[#0052FF]/10 dark:bg-sky-400/15 border border-[#0052FF]/20"
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="whitespace-nowrap relative z-10">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ADMIN LEFT SLIDE-OUT DRAWER MENU WITH iOS SPRING & FLUID GLASS */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={IOS_SPRING}
              className={`relative z-10 w-80 max-w-[85vw] h-full p-6 flex flex-col justify-between ios-glass-drawer ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold">Member of System</h2>
                    <p className="text-xs text-amber-500 font-mono">
                      Root Administrative Console
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      switchSection('users_list');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>1. Lists of Users</span>
                    <Users className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchSection('add_news');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-[#0052FF] dark:text-sky-400 hover:bg-blue-100/80 flex items-center justify-between font-semibold cursor-pointer"
                  >
                    <span>2. Add News (Public Feed)</span>
                    <Newspaper className="w-4 h-4 text-[#0052FF] dark:text-sky-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchSection('bank_setup');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>3. Bank Account Setup</span>
                    <CreditCard className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchSection('earnings_analytics');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>4. Earnings & Analytics</span>
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchSection('security_settings');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium text-left cursor-pointer"
                  >
                    <span>
                      5. Change gmail, passwords and cipher and what&apos;s news
                    </span>
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>6. Dark Mode Toggle</span>
                    {darkMode ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
