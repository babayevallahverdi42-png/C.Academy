import React, { useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from 'motion/react';
import {
  Menu,
  Plus,
  BookOpen,
  FileCheck2,
  Trophy,
  Tv,
  Newspaper,
  Pin,
  FolderOpen,
  Upload,
  Trash2,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  X,
  CheckCircle2,
  Sparkles,
  Send,
} from 'lucide-react';
import {
  AcademicDegree,
  AcademicProduct,
  ChannelPost,
  NewsArticle,
  OfficialSubject,
  PurchasedRecord,
  SupportedLanguage,
  TeacherChannel,
  UserProfile,
} from '../types';
import { OFFICIAL_LANGUAGES, OFFICIAL_SUBJECTS, TRANSLATIONS } from '../utils/i18n';
import {
  generateSecureId,
  maskAndEncryptBankCard,
  sanitizeSafeImageUri,
  sanitizeTextInput,
  validateSafeImageFile,
} from '../utils/security';
import { ProductCoverVisual } from './ProductCoverVisual';
import {
  FluidGlassButton,
  FluidGlassCard,
  FluidGlassLabelButton,
  FluidGlassTabBar,
} from './FluidGlassButton';
import { FluidDropletFilterGroup } from './FluidDropletFilterGroup';
import {
  FluidSwipePager,
  FluidGlassBottomDock,
} from './FluidSwipePager';

interface TeacherDashboardProps {
  teacher: UserProfile;
  users: UserProfile[];
  products: AcademicProduct[];
  purchases: PurchasedRecord[];
  channels: TeacherChannel[];
  posts: ChannelPost[];
  news: NewsArticle[];
  language: SupportedLanguage;
  darkMode: boolean;
  onChangeLanguage: (lang: SupportedLanguage) => void;
  onToggleDarkMode: () => void;
  onPublishProduct: (newProduct: AcademicProduct, upgradeToPremium: boolean) => void;
  onUpdateTeacherProfile: (updatedTeacher: UserProfile) => void;
  onCreateOrUpdateChannel: (channel: TeacherChannel) => void;
  onCreateChannelPost: (post: ChannelPost) => void;
  onOpenDocumentViewer: (product: AcademicProduct) => void;
  onLogout: () => void;
}

type TeacherTab =
  | 'create_pdfs'
  | 'create_exams'
  | 'news'
  | 'ranks'
  | 'create_channel';

const TEACHER_TAB_ORDER: TeacherTab[] = [
  'create_pdfs',
  'create_exams',
  'news',
  'ranks',
  'create_channel',
];

const IOS_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

type TeacherDrawerModal =
  | null
  | 'profession'
  | 'earnings'
  | 'bank_card'
  | 'shared_pdfs'
  | 'language';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  users,
  products,
  purchases,
  channels,
  posts,
  news,
  language,
  darkMode,
  onChangeLanguage,
  onToggleDarkMode,
  onPublishProduct,
  onUpdateTeacherProfile,
  onCreateOrUpdateChannel,
  onCreateChannelPost,
  onOpenDocumentViewer,
  onLogout,
}) => {
  const t = TRANSLATIONS[language];

  const [activeTab, setActiveTab] = useState<TeacherTab>('create_pdfs');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerModal, setDrawerModal] = useState<TeacherDrawerModal>(null);
  const [teacherAuditoriumFilter, setTeacherAuditoriumFilter] = useState<
    'ALL' | 'School' | 'University'
  >('ALL');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState<
    OfficialSubject | 'ALL'
  >('ALL');
  const [teacherNewsSubjectFilter, setTeacherNewsSubjectFilter] = useState<
    OfficialSubject | 'ALL'
  >('ALL');

  // Real-time horizontal swipe progress MotionValue (-1..+1 tab units) synced with Bottom Dock & Header Gliders
  const dragProgressMotion = useMotionValue(0);
  const dragX = useTransform(dragProgressMotion, [-1, 0, 1], [-260, 0, 260]);

  const switchTab = (next: TeacherTab) => {
    setActiveTab(next);
  };

  // Storage Permission & Creation Form state
  const [storagePermissionGranted, setStoragePermissionGranted] = useState(false);
  const [showStoragePermissionPrompt, setShowStoragePermissionPrompt] =
    useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [premiumPromptOpen, setPremiumPromptOpen] = useState(false);

  // 7 Required Product Metadata Fields
  const [productFileName, setProductFileName] = useState('');
  const [priceValue, setPriceValue] = useState<number>(24); // $0 to $60 slider
  const [subjectName, setSubjectName] = useState<OfficialSubject>(
    teacher.teachingSubjects?.[0] || 'Math'
  );
  const [auditorium, setAuditorium] = useState<'School' | 'University'>(
    'University'
  );
  const [topicName, setTopicName] = useState('');
  const [firstPageThumbnail, setFirstPageThumbnail] =
    useState<string>('scheme_math_blue');
  const [pageNumber, setPageNumber] = useState<number>(48);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  // Channel creation & post state
  const existingChannel = channels.find((c) => c.teacherId === teacher.id);
  const [chTeacherName, setChTeacherName] = useState(teacher.fullName);
  const [chMajorSubject, setChMajorSubject] = useState<OfficialSubject>(
    existingChannel?.majorSubject || teacher.teachingSubjects?.[0] || 'Math'
  );
  const [chBio, setChBio] = useState(
    existingChannel?.bio ||
      `${teacher.academicDegree || 'Faculty'} in ${
        teacher.majorField || 'Academic Sciences'
      }. Publishing verified monographs and examinations.`
  );
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postLinkedProductId, setPostLinkedProductId] = useState('');

  // Drawer modals state: Change Profession & Bank Card
  const [profDegree, setProfDegree] = useState<AcademicDegree>(
    teacher.academicDegree || 'PhD'
  );
  const [profMajor, setProfMajor] = useState(teacher.majorField || '');
  const [rawCardInput, setRawCardInput] = useState('');
  const [cardHolderInput, setCardHolderInput] = useState(
    teacher.fullName.toUpperCase()
  );
  const [cardExpiryInput, setCardExpiryInput] = useState('09/29');

  const myProducts = products.filter((p) => p.authorId === teacher.id);
  const myProductIds = new Set(myProducts.map((p) => p.id));
  const mySalesRecords = purchases.filter((p) => myProductIds.has(p.productId));

  const monthlyCount = teacher.monthlyPublishedCount || 0;
  const isPremium = Boolean(teacher.isPremium);
  const teacherSplitPercent = isPremium ? 78 : 80;
  const platformSplitPercent = isPremium ? 22 : 20;

  // Trigger "Add Your Products" -> Storage Permission -> Metadata Form
  const handleClickAddProducts = () => {
    setPublishNotice(null);
    if (!storagePermissionGranted) {
      setShowStoragePermissionPrompt(true);
    } else {
      setShowCreateForm(true);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductFileName(file.name);
      // Auto-detect approximate page count from file size
      const estimatedPages = Math.max(
        6,
        Math.min(240, Math.round(file.size / 18000) || 42)
      );
      setPageNumber(estimatedPages);
    }
  };

  const handleCoverThumbnailPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateSafeImageFile(file);
    if (!validation.valid) {
      setPublishNotice(validation.error || 'Unsafe image file blocked.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const safeUri = sanitizeSafeImageUri(reader.result);
        if (safeUri) setFirstPageThumbnail(safeUri);
      }
    };
    reader.readAsDataURL(file);
  };

  const executePublish = (upgradeToPremiumFlag: boolean) => {
    const currentType: 'pdf' | 'exam' =
      activeTab === 'create_exams' ? 'exam' : 'pdf';

    const cleanTopic =
      sanitizeTextInput(topicName, 160) ||
      `${subjectName} ${auditorium} ${
        currentType === 'exam' ? 'Examination' : 'Monograph'
      }`;
    const cleanFileName =
      sanitizeTextInput(productFileName, 120) ||
      `${subjectName.replace(/\s+/g, '_')}_${currentType.toUpperCase()}.pdf`;

    const newProduct: AcademicProduct = {
      id: generateSecureId(`prod_${currentType}`),
      type: currentType,
      subject: subjectName,
      topicName: cleanTopic,
      auditorium,
      price: Math.max(0, Math.min(60, Number(priceValue) || 0)),
      pageNumber: Math.max(1, Math.min(500, Number(pageNumber) || 24)),
      fileName: cleanFileName,
      coverThumbnail:
        sanitizeSafeImageUri(firstPageThumbnail) || 'scheme_math_blue',
      authorId: teacher.id,
      authorName: teacher.fullName,
      authorDegree: teacher.academicDegree || 'PhD',
      createdAt: new Date().toISOString().split('T')[0],
      salesCount: 0,
      documentPages: [
        {
          pageNumber: 1,
          heading: `1. ${cleanTopic} — Core Curriculum`,
          keyFormula: `${subjectName} Verified Academic Module · ${auditorium}`,
          bodyParagraphs: [
            `Published by ${teacher.fullName} (${teacher.academicDegree}) on C. ACADEMY. Protected by dynamic viewer watermarking and FLAG_SECURE anti-capture enforcement.`,
            `This ${pageNumber}-page document covers advanced concepts and structured analytical methods tailored for ${auditorium} cohorts.`,
          ],
        },
      ],
      examQuestions:
        currentType === 'exam'
          ? [
              {
                id: generateSecureId('q_custom_1'),
                questionNumber: 1,
                prompt: `Core Analytical Assessment Question 1 in ${subjectName} (${cleanTopic}): Identify the invariant principle governing the system.`,
                formulaOrContext: 'Worth +100 Official Leaderboard Points',
                options: [
                  'Conservation & Symmetry Principle (Correct Solution)',
                  'Unbounded Linear Divergence',
                  'Zero-Gradient Approximation',
                  'Non-Equilibrium Perturbation',
                ],
                correctOptionIndex: 0,
                explanation:
                  'Verified by the fundamental conservation law established in Section 1.',
              },
              {
                id: generateSecureId('q_custom_2'),
                questionNumber: 2,
                prompt: `Core Analytical Assessment Question 2 in ${subjectName}: Compute the normalized equilibrium state.`,
                formulaOrContext: 'Worth +100 Official Leaderboard Points',
                options: [
                  'Normalized Eigenstate λ = 1.00',
                  'Divergent Series Limit',
                  'Undefined Boundary Value',
                  'Sub-threshold Oscillation',
                ],
                correctOptionIndex: 0,
                explanation:
                  'Normalized eigenstates satisfy unit probability density across the domain.',
              },
            ]
          : undefined,
    };

    onPublishProduct(newProduct, upgradeToPremiumFlag);
    setPremiumPromptOpen(false);
    setShowCreateForm(false);
    setTopicName('');
    setProductFileName('');
    setPublishNotice(
      `Published "${newProduct.topicName}" ($${newProduct.price}). Revenue split active: ${
        upgradeToPremiumFlag || isPremium
          ? '78% Teacher / 22% Platform (Premium)'
          : '80% Teacher / 20% Platform (Standard)'
      }.`
    );
  };

  const handleFormSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    // Free Account Limit: Maximum 3 products/month
    if (!isPremium && monthlyCount >= 3) {
      setPremiumPromptOpen(true);
      return;
    }
    executePublish(false);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const channelObj: TeacherChannel = {
      id: existingChannel?.id || generateSecureId('ch'),
      teacherId: teacher.id,
      teacherName: sanitizeTextInput(chTeacherName, 100) || teacher.fullName,
      majorSubject: chMajorSubject,
      academicDegree: teacher.academicDegree || 'PhD',
      bio: sanitizeTextInput(chBio, 600),
      subscribersCount: existingChannel?.subscribersCount || 120,
      subscriberIds: existingChannel?.subscriberIds || [],
      rating: existingChannel?.rating || 5.0,
      createdAt:
        existingChannel?.createdAt || new Date().toISOString().split('T')[0],
    };
    onCreateOrUpdateChannel(channelObj);
    setPublishNotice('Your C. ACADEMY Educator Channel is live and indexed!');
  };

  const handlePublishChannelPost = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = sanitizeTextInput(postTitle, 180);
    const cleanContent = sanitizeTextInput(postContent, 2000);
    if (!existingChannel || !cleanTitle || !cleanContent) return;
    const newPost: ChannelPost = {
      id: generateSecureId('post'),
      channelId: existingChannel.id,
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      subject: existingChannel.majorSubject,
      title: cleanTitle,
      content: cleanContent,
      linkedProductId: postLinkedProductId || undefined,
      likes: 1,
      dislikes: 0,
      likedByUserIds: [teacher.id],
      dislikedByUserIds: [],
      comments: [],
      sharesCount: 0,
      createdAt: 'Just now',
    };
    onCreateChannelPost(newPost);
    setPostTitle('');
    setPostContent('');
    setPostLinkedProductId('');
  };

  const totalGrossSales = mySalesRecords.reduce((acc, r) => acc + r.pricePaid, 0);
  const totalNetTeacherEarnings = mySalesRecords.reduce(
    (acc, r) => acc + r.teacherShare,
    0
  );

  return (
    <div
      className={`min-h-screen flex flex-col pb-24 transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Navigation (Header) - 3-Zone Contract with Fluid Glass & Water Droplet Ripple */}
      <header
        className={`sticky top-0 z-30 px-4 md:px-8 py-3.5 border-b flex items-center justify-between ios-glass-header ${
          darkMode ? 'border-slate-800/80' : 'border-white/75'
        }`}
      >
        <div className="flex items-center gap-3">
          <FluidGlassButton
            variant="nav"
            onClick={() => setDrawerOpen(true)}
            ariaLabel="Open Teacher Drawer"
            className="p-2 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </FluidGlassButton>
          <span className="text-lg font-bold tracking-tight font-display">
            C. ACADEMY
          </span>
        </div>

        <nav className="hidden md:flex items-center">
          <FluidGlassTabBar
            layoutId="teacher-header-gliding-pill"
            dragX={dragX}
            activeTab={activeTab}
            onSelectTab={switchTab}
            tabs={[
              {
                id: 'create_pdfs',
                label: t.createPdfs,
                badge: myProducts.filter((p) => p.type === 'pdf').length,
              },
              {
                id: 'create_exams',
                label: t.createExams,
                badge: myProducts.filter((p) => p.type === 'exam').length,
              },
              { id: 'news', label: t.newsSection },
              { id: 'ranks', label: t.ranks },
              { id: 'create_channel', label: t.createChannel },
            ]}
          />
        </nav>

        <div className="flex items-center gap-3">
          <FluidGlassButton
            variant="emerald"
            onClick={() => setDrawerModal('earnings')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold font-mono tabular-nums whitespace-nowrap"
          >
            <span>
              Split: {teacherSplitPercent}% / {platformSplitPercent}%
            </span>
          </FluidGlassButton>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 overflow-x-hidden">
        {/* Synced Create PDFs <-> Create Exams Fluid Glass Switcher & Swipe Gesture Bar */}
        {(activeTab === 'create_pdfs' || activeTab === 'create_exams') && (
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FluidGlassTabBar
              layoutId="teacher-pdfs-exams-switcher-pill"
              dragX={dragX}
              activeTab={activeTab as 'create_pdfs' | 'create_exams'}
              onSelectTab={(nextTab) => switchTab(nextTab)}
              className="w-full sm:w-auto"
              tabs={[
                {
                  id: 'create_pdfs',
                  label: t.createPdfs,
                  icon: <BookOpen className="w-3.5 h-3.5" />,
                  badge: myProducts.filter((p) => p.type === 'pdf').length,
                },
                {
                  id: 'create_exams',
                  label: t.createExams,
                  icon: <FileCheck2 className="w-3.5 h-3.5" />,
                  badge: myProducts.filter((p) => p.type === 'exam').length,
                },
              ]}
            />

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Swipe left / right to slide between PDFs & Exams
              </span>
              <FluidGlassButton
                variant="surface"
                onClick={() =>
                  switchTab(
                    activeTab === 'create_pdfs' ? 'create_exams' : 'create_pdfs'
                  )
                }
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap"
              >
                <span>
                  {activeTab === 'create_pdfs'
                    ? `Slide to ${t.createExams} →`
                    : `← Slide to ${t.createPdfs}`}
                </span>
              </FluidGlassButton>
            </div>
          </div>
        )}

        <FluidSwipePager
          tabOrder={TEACHER_TAB_ORDER}
          activeTab={activeTab}
          onSelectTab={switchTab}
          dragProgressMotion={dragProgressMotion}
          renderSection={(tabToRender) => (
            <div className="space-y-6">
        {publishNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <span>{publishNotice}</span>
            <FluidGlassButton
              variant="surface"
              onClick={() => setPublishNotice(null)}
              className="px-3 py-1 rounded-lg text-xs font-semibold ml-3"
            >
              <span>Dismiss</span>
            </FluidGlassButton>
          </div>
        )}

        {/* TAB 1 & TAB 2: CREATE PDFs & CREATE EXAMS */}
        {(tabToRender === 'create_pdfs' || tabToRender === 'create_exams') && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl fluid-glass-item-card flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>
                    {isPremium
                      ? 'PREMIUM AUTHOR TIER (Unlimited Monthly Quota · 78% Author / 22% Platform)'
                      : `STANDARD FREE TIER (${monthlyCount}/3 Products Published This Month · 80% Author / 20% Platform)`}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {tabToRender === 'create_pdfs'
                    ? 'Publish Protected Academic PDFs'
                    : 'Publish Interactive Google Docs-Style Examinations'}
                </h1>
                <p className="text-xs text-slate-500">
                  Every uploaded product is automatically wrapped with dynamic identity watermarking and screen-capture prevention.
                </p>
              </div>

              {/* Prominent Emerald Fluid Glass Button with Water Droplet Ripple: Add Your Products */}
              <FluidGlassButton
                variant="emerald"
                onClick={handleClickAddProducts}
                className="px-6 py-3.5 rounded-xl font-bold text-sm whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addYourProducts}</span>
              </FluidGlassButton>
            </div>

            {/* Product Creation Form (7 Required Metadata Fields) */}
            {showCreateForm && (
              <form
                onSubmit={handleFormSubmitProduct}
                className="p-6 rounded-2xl fluid-glass-item-card space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold">
                    New {tabToRender === 'create_exams' ? 'Exam' : 'PDF'} Product Metadata
                  </h2>
                  <FluidGlassButton
                    variant="surface"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold"
                  >
                    <span>Cancel</span>
                  </FluidGlassButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Product File */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      1. Product File (Upload PDF/File from Local Storage) *
                    </label>
                    <FluidGlassLabelButton
                      variant="surface"
                      className="px-4 py-2.5 rounded-xl text-xs"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {productFileName || 'Select PDF or Exam source file...'}
                      </span>
                      <Upload className="w-4 h-4 text-[#0052FF] shrink-0 ml-2" />
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </FluidGlassLabelButton>
                  </div>

                  {/* 2. Value Section: Interactive Price Slider $0 to $60 */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span>2. Value Section (Interactive Price Slider: $0 – $60)</span>
                      <span className="font-mono text-sm font-bold text-[#0052FF]">
                        ${priceValue}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={1}
                      value={priceValue}
                      onChange={(e) => setPriceValue(Number(e.target.value))}
                      className="w-full accent-[#0052FF] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
                      <span>$0 (Free)</span>
                      <span>
                        Your Net ({teacherSplitPercent}%): $
                        {((priceValue * teacherSplitPercent) / 100).toFixed(2)}
                      </span>
                      <span>$60 Max</span>
                    </div>
                  </div>

                  {/* 3. Product Name (Selected Subject Name) */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      3. Product Name (Official Subject) *
                    </label>
                    <select
                      value={subjectName}
                      onChange={(e) =>
                        setSubjectName(e.target.value as OfficialSubject)
                      }
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {OFFICIAL_SUBJECTS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Auditorium (School / University) */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      4. Auditorium (School / University) *
                    </label>
                    <select
                      value={auditorium}
                      onChange={(e) =>
                        setAuditorium(e.target.value as 'School' | 'University')
                      }
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="University">University</option>
                      <option value="School">School</option>
                    </select>
                  </div>

                  {/* 5. Name of the Topic */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      5. Name of the Topic *
                    </label>
                    <input
                      type="text"
                      required
                      value={topicName}
                      onChange={(e) => setTopicName(e.target.value)}
                      placeholder="e.g. Nonlinear Differential Equations & Chaos"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  {/* 6. First Page of the PDF (Image Picker from Device Gallery) */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      6. First Page of the PDF (Gallery Thumbnail Picker)
                    </label>
                    <FluidGlassLabelButton
                      variant="surface"
                      className="px-4 py-2.5 rounded-xl text-xs"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {firstPageThumbnail.startsWith('data:image/')
                          ? 'Custom First-Page Thumbnail Loaded ✓'
                          : 'Pick Cover Image from Device Gallery...'}
                      </span>
                      <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverThumbnailPick}
                        className="hidden"
                      />
                    </FluidGlassLabelButton>
                  </div>

                  {/* 7. Page Number */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      7. Page Number (Input or Auto-Detected) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1500}
                      required
                      value={pageNumber}
                      onChange={(e) => setPageNumber(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <FluidGlassButton
                    type="submit"
                    variant="emerald"
                    className="px-6 py-2.5 rounded-xl font-bold text-sm"
                  >
                    <span>
                      Publish {tabToRender === 'create_exams' ? 'Exam' : 'PDF'} to C. ACADEMY
                    </span>
                  </FluidGlassButton>
                </div>
              </form>
            )}

            {/* Teacher's Published Products List (Fluid Glass Item Cards & Sliding Liquid Droplet Filters) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  Your Published{' '}
                  {tabToRender === 'create_exams' ? 'Exams' : 'PDF Monographs'}
                </h2>
                <FluidDropletFilterGroup
                  activeId={teacherAuditoriumFilter}
                  onSelect={(aud) => setTeacherAuditoriumFilter(aud)}
                  items={[
                    { id: 'ALL', label: 'All Auditoriums' },
                    { id: 'University', label: 'University Curricula' },
                    { id: 'School', label: 'School Curricula' },
                  ]}
                />
              </div>

              <div
                className={`p-3 rounded-2xl border ios-glass-card ${
                  darkMode ? 'border-slate-800' : 'border-white/80'
                }`}
              >
                <FluidDropletFilterGroup
                  activeId={teacherSubjectFilter}
                  onSelect={(subj) => setTeacherSubjectFilter(subj)}
                  buttonClassName="px-3.5 py-1.5"
                  items={[
                    { id: 'ALL', label: t.allSubjects },
                    ...OFFICIAL_SUBJECTS.map((subj) => ({
                      id: subj as OfficialSubject | 'ALL',
                      label: subj,
                    })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myProducts
                  .filter((p) =>
                    tabToRender === 'create_exams'
                      ? p.type === 'exam'
                      : p.type === 'pdf'
                  )
                  .filter((p) =>
                    teacherAuditoriumFilter === 'ALL'
                      ? true
                      : p.auditorium === teacherAuditoriumFilter
                  )
                  .filter((p) =>
                    teacherSubjectFilter === 'ALL'
                      ? true
                      : p.subject === teacherSubjectFilter
                  )
                  .map((item) => (
                    <FluidGlassCard
                      key={item.id}
                      className="rounded-2xl flex flex-col justify-between"
                    >
                      <div>
                        <ProductCoverVisual
                          coverThumbnail={item.coverThumbnail}
                          subject={item.subject}
                          type={item.type}
                          auditorium={item.auditorium}
                          pageNumber={item.pageNumber}
                        />
                        <div className="p-5 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{item.subject}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.auditorium}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              {item.salesCount} sales
                            </span>
                          </div>
                          <h3 className="text-base font-bold">
                            {item.topicName}
                          </h3>
                        </div>
                      </div>
                      <div className="px-5 pb-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                        <span className="font-mono font-bold text-sm">
                          ${item.price.toFixed(2)}
                        </span>
                        <FluidGlassButton
                          variant="primary"
                          onClick={() => onOpenDocumentViewer(item)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                        >
                          <span>Preview Watermarked View</span>
                        </FluidGlassButton>
                      </div>
                    </FluidGlassCard>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PUBLIC NEWS SECTION (POPULATED BY SYSTEM ADMIN) */}
        {tabToRender === 'news' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  C. ACADEMY Public News Feed & System Bulletins
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Official news posts published from the System Administration panel.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {news.length} Live Posts
              </span>
            </div>

            {/* Subject Filter Bar for News Feed with Sliding Liquid Droplet Selection */}
            <div
              className={`p-3 rounded-2xl border ios-glass-card ${
                darkMode ? 'border-slate-800' : 'border-white/80'
              }`}
            >
              <FluidDropletFilterGroup
                activeId={teacherNewsSubjectFilter}
                onSelect={(subj) => setTeacherNewsSubjectFilter(subj)}
                buttonClassName="px-3.5 py-1.5"
                items={[
                  { id: 'ALL', label: 'All Bulletins' },
                  ...OFFICIAL_SUBJECTS.map((subj) => ({
                    id: subj as OfficialSubject | 'ALL',
                    label: subj,
                  })),
                ]}
              />
            </div>

            <div className="space-y-4">
              {[...news]
                .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                .filter((item) =>
                  teacherNewsSubjectFilter === 'ALL'
                    ? true
                    : item.subject === teacherNewsSubjectFilter
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className={`p-6 rounded-2xl border space-y-2.5 ios-glass-card ${
                      item.isPinned
                        ? 'border-[#0052FF]/60 ring-1 ring-[#0052FF]/25'
                        : darkMode
                        ? 'border-slate-800'
                        : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {item.isPinned && (
                        <span className="font-semibold text-[#0052FF] dark:text-sky-400 inline-flex items-center gap-1">
                          <Pin className="w-3.5 h-3.5" />
                          Pinned Bulletin ·
                        </span>
                      )}
                      <span>{item.subject}</span>
                      <span>·</span>
                      <span>{item.publishedAt}</span>
                      <span>·</span>
                      <span>{item.author}</span>
                    </div>
                    <h2 className="text-lg font-bold">{item.title}</h2>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {item.summary}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.body}
                    </p>
                  </article>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: RANKS */}
        {tabToRender === 'ranks' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <h1 className="text-2xl font-bold tracking-tight">
                Educator & Student Rankings
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Teachers are ranked by total Channel Subscribers & ratings; high engagement boosts your PDFs in student search.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {users
                  .filter((u) => u.role === 'teacher')
                  .sort(
                    (a, b) =>
                      (b.subscribersCount || 0) - (a.subscribersCount || 0)
                  )
                  .map((tch, idx) => (
                    <div
                      key={tch.id}
                      className={`p-4 flex items-center justify-between ${
                        tch.id === teacher.id
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-slate-400 w-6">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold">
                            {tch.fullName} ({tch.academicDegree}){' '}
                            {tch.id === teacher.id && (
                              <span className="text-xs text-[#0052FF]">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {tch.majorField}
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="font-bold block">
                          {(tch.subscribersCount || 0).toLocaleString()} Subscribers
                        </span>
                        <span className="text-emerald-600">
                          Rating {(tch.rating || 5.0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CREATE A CHANNEL */}
        {tabToRender === 'create_channel' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveChannel}
              className={`p-6 rounded-2xl border space-y-4 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <h2 className="text-lg font-bold">
                {existingChannel
                  ? 'Manage Your C. ACADEMY Channel'
                  : 'Create a Channel (Teachers Only)'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure your Teacher Name, Major/Subject, and academic bio. High subscriber & like counts boost your search ranking.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Teacher Name *
                </label>
                <input
                  type="text"
                  required
                  value={chTeacherName}
                  onChange={(e) => setChTeacherName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Major / Primary Subject *
                </label>
                <select
                  value={chMajorSubject}
                  onChange={(e) =>
                    setChMajorSubject(e.target.value as OfficialSubject)
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {OFFICIAL_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Channel Bio & Curriculum Focus *
                </label>
                <textarea
                  rows={3}
                  required
                  value={chBio}
                  onChange={(e) => setChBio(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0040C9] text-white font-semibold text-sm cursor-pointer"
              >
                {existingChannel ? 'Update Channel Profile' : 'Launch Official Channel'}
              </button>
            </form>

            {/* Post Promotional Card / Announcement */}
            <form
              onSubmit={handlePublishChannelPost}
              className={`p-6 rounded-2xl border space-y-4 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <h2 className="text-lg font-bold">
                Post Course / PDF Promotional Announcement
              </h2>
              <p className="text-xs text-slate-500">
                Students can Like, Dislike, Comment, and Share your channel posts.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Announcement Headline *
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. New Exam Cohort & Lecture Notes Released"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Announcement Details *
                </label>
                <textarea
                  rows={3}
                  required
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Describe the topics covered and exam preparation tips..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Attach Published Product Card (Optional)
                </label>
                <select
                  value={postLinkedProductId}
                  onChange={(e) => setPostLinkedProductId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">— None —</option>
                  {myProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.topicName} (${p.price})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!existingChannel}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {existingChannel
                    ? 'Publish Announcement to Channel'
                    : 'Save Channel Profile First'}
                </span>
              </button>
            </form>
          </div>
        )}
            </div>
          )}
        />
      </main>

      {/* Bottom Navigation Bar (5 Tabs for Teacher) with Real-Time Swipe-Synced Fluid Glass Glider */}
      <FluidGlassBottomDock
        tabs={[
          { id: 'create_pdfs', label: t.createPdfs, icon: BookOpen },
          { id: 'create_exams', label: t.createExams, icon: FileCheck2 },
          { id: 'news', label: t.newsSection, icon: Newspaper },
          { id: 'ranks', label: t.ranks, icon: Trophy },
          { id: 'create_channel', label: t.createChannel, icon: Tv },
        ]}
        activeTab={activeTab}
        onSelectTab={switchTab}
        dragProgressMotion={dragProgressMotion}
        darkMode={darkMode}
      />

      {/* Device Storage Permission Prompt Modal */}
      {showStoragePermissionPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center fluid-glass-item-card">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">
              Allow C. ACADEMY to Access Device Files & Gallery?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Required to select your PDF/Exam source file and pick the First Page Cover Thumbnail from your local storage.
            </p>
            <div className="flex gap-2 pt-2">
              <FluidGlassButton
                variant="surface"
                onClick={() => setShowStoragePermissionPrompt(false)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold"
              >
                <span>Deny</span>
              </FluidGlassButton>
              <FluidGlassButton
                variant="emerald"
                onClick={() => {
                  setStoragePermissionGranted(true);
                  setShowStoragePermissionPrompt(false);
                  setShowCreateForm(true);
                }}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold"
              >
                <span>Allow Access</span>
              </FluidGlassButton>
            </div>
          </div>
        </div>
      )}

      {/* 4th Product Monthly Quota Modal: "Do you want to get premium?" (Yes / No) */}
      {premiumPromptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center fluid-glass-item-card">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Do you want to get premium?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Free accounts are limited to a maximum of <strong>3 products/month</strong> (80% Teacher / 20% Platform split). Upgrading to Premium unlocks unlimited monthly product publishing with a <strong>78% Teacher / 22% System Platform</strong> revenue split.
            </p>
            <div className="flex gap-3 pt-2">
              <FluidGlassButton
                variant="surface"
                onClick={() => setPremiumPromptOpen(false)}
                className="w-1/2 py-2.5 rounded-xl text-sm font-semibold"
              >
                <span>No</span>
              </FluidGlassButton>
              <FluidGlassButton
                variant="primary"
                onClick={() => executePublish(true)}
                className="w-1/2 py-2.5 rounded-xl text-sm font-semibold"
              >
                <span>Yes</span>
              </FluidGlassButton>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER LEFT SLIDE-OUT DRAWER MENU (8 Items) WITH iOS SPRING & FLUID GLASS */}
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
                    <h2 className="text-base font-bold">{teacher.fullName}</h2>
                    <p className="text-xs text-slate-500">
                      {teacher.academicDegree} · {teacher.majorField}
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

                <div className="space-y-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      switchTab('create_channel');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>1. Channel</span>
                    <span className="text-xs font-mono text-[#0052FF]">
                      {teacher.subscribersCount || 0} subs
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('profession');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>2. Change Profession</span>
                    <span className="text-xs text-slate-500">
                      {teacher.academicDegree}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('earnings');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>3. Your Earnings</span>
                    <span className="text-xs font-mono text-emerald-600">
                      ${totalNetTeacherEarnings.toFixed(2)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('bank_card');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>4. Payoneer / Bank Card Info</span>
                    <span className="text-xs font-mono text-slate-500">
                      {teacher.bankCard ? 'Masked' : 'Add'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('shared_pdfs');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>5. PDFs I Shared</span>
                    <span className="text-xs font-mono text-slate-500">
                      {myProducts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('language');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>6. {t.changeLanguage}</span>
                    <span className="text-xs text-slate-500">{language}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>7. {t.darkMode}</span>
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
                <span>8. {t.logOut}</span>
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* TEACHER DRAWER MODALS */}
      {drawerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border p-6 space-y-5 shadow-2xl ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold">
                {drawerModal === 'profession' && 'Change Profession & Degree'}
                {drawerModal === 'earnings' &&
                  'Your Earnings & Revenue Split Analytics'}
                {drawerModal === 'bank_card' &&
                  'Payoneer & Bank Card Payout Information (Encrypted Vault)'}
                {drawerModal === 'shared_pdfs' && 'PDFs & Exams I Shared'}
                {drawerModal === 'language' && "Change App's Language"}
              </h3>
              <button
                type="button"
                onClick={() => setDrawerModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {drawerModal === 'profession' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Academic Degree
                  </label>
                  <select
                    value={profDegree}
                    onChange={(e) =>
                      setProfDegree(e.target.value as AcademicDegree)
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {(
                      [
                        'Undergraduate',
                        'Bachelor',
                        'Master',
                        'PhD',
                        'Postdoctoral Fellow',
                        'Professor',
                      ] as AcademicDegree[]
                    ).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Major / Graduated Field
                  </label>
                  <input
                    type="text"
                    value={profMajor}
                    onChange={(e) => setProfMajor(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTeacherProfile({
                      ...teacher,
                      academicDegree: profDegree,
                      majorField: profMajor,
                    });
                    setDrawerModal(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0052FF] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Profession Changes
                </button>
              </div>
            )}

            {drawerModal === 'earnings' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500 block">
                      Gross Product Volume
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums">
                      ${totalGrossSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 block">
                      Your Net Share ({teacherSplitPercent}%)
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                      ${totalNetTeacherEarnings.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-semibold">
                    Active Revenue Split Structure:
                  </p>
                  <p className="text-slate-500">
                    • Standard Account (1–3 products): <strong>80% to Teacher</strong>, 20% to System Platform (Taxes included in the 80%).
                  </p>
                  <p className="text-slate-500">
                    • Premium Account (4+ products): <strong>78% to Teacher</strong>, 22% to System Platform.
                  </p>
                </div>
              </div>
            )}

            {drawerModal === 'bank_card' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Payoneer Mastercard & Bank Card data is encrypted at rest for automated 80% / 78% author disbursements. For financial security, plain numbers can never be viewed after submission (<code className="font-mono">XXXX-XXXX-XXXX-1234</code>).
                </p>

                {teacher.bankCard ? (
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>ENCRYPTED PAYONEER AUTHOR PAYOUT CARD</span>
                      <ShieldCheck className="w-4 h-4 text-[#FF4800]" />
                    </div>
                    <p className="text-lg font-mono tracking-widest font-bold">
                      {teacher.bankCard.maskedNumber}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                      <span>{teacher.bankCard.cardHolder}</span>
                      <span>EXP {teacher.bankCard.expiry}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTeacherProfile({
                          ...teacher,
                          bankCard: null,
                        })
                      }
                      className="w-full mt-2 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Previous Card</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        New Payoneer / Bank Payout Card Number (Encrypted & masked immediately)
                      </label>
                      <input
                        type="text"
                        maxLength={19}
                        value={rawCardInput}
                        onChange={(e) => setRawCardInput(e.target.value)}
                        placeholder="4532 0192 8834 1234"
                        className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Cardholder
                        </label>
                        <input
                          type="text"
                          value={cardHolderInput}
                          onChange={(e) => setCardHolderInput(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Expiry
                        </label>
                        <input
                          type="text"
                          value={cardExpiryInput}
                          onChange={(e) => setCardExpiryInput(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (rawCardInput.replace(/\D/g, '').length < 4) return;
                        const encryptedCard = maskAndEncryptBankCard(
                          rawCardInput,
                          cardHolderInput,
                          cardExpiryInput
                        );
                        setRawCardInput('');
                        onUpdateTeacherProfile({
                          ...teacher,
                          bankCard: encryptedCard,
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#0052FF] text-white text-xs font-semibold cursor-pointer"
                    >
                      Encrypt & Save Masked Payout Card
                    </button>
                  </div>
                )}
              </div>
            )}

            {drawerModal === 'shared_pdfs' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {myProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl fluid-glass-item-card flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold">{p.topicName}</p>
                      <p className="text-xs text-slate-500">
                        {p.type.toUpperCase()} · {p.subject} · ${p.price} · {p.salesCount} sales
                      </p>
                    </div>
                    <FluidGlassButton
                      variant="primary"
                      onClick={() => {
                        setDrawerModal(null);
                        onOpenDocumentViewer(p);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold"
                    >
                      <span>Open</span>
                    </FluidGlassButton>
                  </div>
                ))}
              </div>
            )}

            {drawerModal === 'language' && (
              <div className="grid grid-cols-2 gap-2">
                {OFFICIAL_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      onChangeLanguage(lang);
                      setDrawerModal(null);
                    }}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer ${
                      language === lang
                        ? 'bg-[#0052FF] text-white border-[#0052FF]'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span>{lang}</span>
                    {language === lang && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
