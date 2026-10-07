import React, { useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from 'motion/react';
import {
  Menu,
  Search,
  BookOpen,
  FileCheck2,
  Newspaper,
  Trophy,
  Tv,
  SlidersHorizontal,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Smartphone,
  Moon,
  Sun,
  LogOut,
  X,
  CheckCircle2,
  Trash2,
  Plus,
  Send,
  Pin,
} from 'lucide-react';
import {
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
import { ProductCoverVisual } from './ProductCoverVisual';
import {
  FluidGlassButton,
  FluidGlassCard,
  FluidGlassTabBar,
} from './FluidGlassButton';
import { FluidDropletFilterGroup } from './FluidDropletFilterGroup';
import { FluidDropletSearchBar } from './FluidDropletSearchBar';
import {
  FluidSwipePager,
  FluidGlassBottomDock,
} from './FluidSwipePager';

interface StudentDashboardProps {
  student: UserProfile;
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
  onOpenPayment: (product: AcademicProduct) => void;
  onOpenDocumentViewer: (product: AcademicProduct) => void;
  onToggleSubscribeChannel: (channelId: string) => void;
  onReactToPost: (postId: string, reaction: 'like' | 'dislike') => void;
  onAddComment: (postId: string, commentText: string) => void;
  onSharePost: (postId: string) => void;
  onUpdateStudentDevices: (updatedDevices: UserProfile['connectedDevices']) => void;
  onLogout: () => void;
}

type StudentTab = 'pdfs' | 'exams' | 'news' | 'ranks' | 'channels';
const STUDENT_TAB_ORDER: StudentTab[] = [
  'pdfs',
  'exams',
  'news',
  'ranks',
  'channels',
];
const IOS_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};
type DrawerModalView =
  | null
  | 'pdf_achieved'
  | 'downloaded_exams'
  | 'devices'
  | 'language';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
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
  onOpenPayment,
  onOpenDocumentViewer,
  onToggleSubscribeChannel,
  onReactToPost,
  onAddComment,
  onSharePost,
  onUpdateStudentDevices,
  onLogout,
}) => {
  const t = TRANSLATIONS[language];

  const [activeTab, setActiveTab] = useState<StudentTab>('pdfs');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerModal, setDrawerModal] = useState<DrawerModalView>(null);

  // News Section filter & active article reader state
  const [newsSubjectFilter, setNewsSubjectFilter] = useState<OfficialSubject | 'ALL'>('ALL');
  const [selectedNewsArticle, setSelectedNewsArticle] = useState<NewsArticle | null>(null);

  // Real-time horizontal swipe progress MotionValue (-1..+1 tab units) synced with Bottom Dock & Header Gliders
  const dragProgressMotion = useMotionValue(0);
  const dragX = useTransform(dragProgressMotion, [-1, 0, 1], [-260, 0, 260]);

  const switchTab = (next: StudentTab) => {
    setActiveTab(next);
  };

  // PDF Section state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectFilters, setShowSubjectFilters] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<OfficialSubject | 'ALL'>('ALL');
  const [auditoriumFilter, setAuditoriumFilter] = useState<'ALL' | 'School' | 'University'>('ALL');

  // Channels & Comments state
  const [selectedTeacherChannelId, setSelectedTeacherChannelId] = useState<string | 'ALL'>('ALL');
  const [channelSubFilter, setChannelSubFilter] = useState<'all' | 'subscribed'>('all');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [sharedBannerPostId, setSharedBannerPostId] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  const handleOpenTeacherChannel = (authorId: string) => {
    const foundChannel = channels.find((c) => c.teacherId === authorId);
    if (foundChannel) {
      setSelectedTeacherChannelId(foundChannel.id);
    } else {
      setSelectedTeacherChannelId('ALL');
    }
    switchTab('channels');
  };

  // Student's purchases
  const myPurchases = purchases.filter((p) => p.studentId === student.id);
  const hasPurchased = (productId: string) =>
    myPurchases.some((p) => p.productId === productId);

  const myAchievedPdfs = products.filter(
    (p) => p.type === 'pdf' && hasPurchased(p.id)
  );
  const myDownloadedExams = products.filter(
    (p) => p.type === 'exam' && hasPurchased(p.id)
  );

  // Filtered PDFs (ranked higher if teacher has more channel subscribers/likes)
  const pdfProducts = products
    .filter((p) => p.type === 'pdf')
    .filter((p) => (selectedSubject === 'ALL' ? true : p.subject === selectedSubject))
    .filter((p) =>
      auditoriumFilter === 'ALL' ? true : p.auditorium === auditoriumFilter
    )
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.topicName.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
      );
    });

  const examProducts = products
    .filter((p) => p.type === 'exam')
    .filter((p) => (selectedSubject === 'ALL' ? true : p.subject === selectedSubject))
    .filter((p) =>
      auditoriumFilter === 'ALL' ? true : p.auditorium === auditoriumFilter
    )
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.topicName.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
      );
    });

  // Leaderboards
  const studentLeaderboard = users
    .filter((u) => u.role === 'student')
    .sort((a, b) => (b.examScore || 0) - (a.examScore || 0));

  const teacherLeaderboard = users
    .filter((u) => u.role === 'teacher')
    .sort((a, b) => (b.subscribersCount || 0) - (a.subscribersCount || 0));

  const getExamRemainingCounter = (productId: string) => {
    const rec = myPurchases.find((p) => p.productId === productId);
    if (!rec?.expiresAt) return '7d 00h remaining';
    const ms = new Date(rec.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${d}d ${h}h remaining`;
  };

  const handleAddSimulatedDevice = () => {
    setDeviceNotice(null);
    if (student.connectedDevices.length >= 3) {
      setDeviceNotice(
        'MAX 3 DEVICES ENFORCED: Cannot connect a 4th device. Remove an existing device first.'
      );
      return;
    }
    const newDev = {
      id: `dev_${Date.now()}`,
      name: `Secondary Tablet #${student.connectedDevices.length + 1}`,
      platform: 'Android 15 · Verified Biometric',
      lastActive: 'Just connected',
      location: 'Verified IP',
      isCurrentDevice: false,
    };
    onUpdateStudentDevices([...student.connectedDevices, newDev]);
  };

  const handleRemoveDevice = (deviceId: string) => {
    setDeviceNotice(null);
    onUpdateStudentDevices(
      student.connectedDevices.filter((d) => d.id !== deviceId)
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col pb-24 transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Navigation (Header) - 3-Zone Contract with iOS Fluid Glass */}
      <header
        className={`sticky top-0 z-30 px-4 md:px-8 py-3.5 border-b flex items-center justify-between ios-glass-header ${
          darkMode ? 'border-slate-800/80' : 'border-white/75'
        }`}
      >
        {/* Zone 1: Hamburger + Single Brand Wordmark */}
        <div className="flex items-center gap-3">
          <FluidGlassButton
            variant="nav"
            onClick={() => setDrawerOpen(true)}
            ariaLabel="Open Navigation Drawer"
            className="p-2 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </FluidGlassButton>
          <span className="text-lg font-bold tracking-tight font-display">
            C. ACADEMY
          </span>
        </div>

        {/* Zone 2: Desktop Quick Nav Links with Synced Gliding Fluid Glass Indicator & Water Droplet Ripple */}
        <nav className="hidden md:flex items-center">
          <FluidGlassTabBar
            layoutId="student-header-gliding-pill"
            dragX={dragX}
            activeTab={activeTab}
            onSelectTab={switchTab}
            tabs={[
              { id: 'pdfs', label: t.pdfSection, badge: pdfProducts.length },
              { id: 'exams', label: t.examsSection, badge: examProducts.length },
              { id: 'news', label: t.newsSection },
              { id: 'ranks', label: t.scoresRanks },
              { id: 'channels', label: t.channels },
            ]}
          />
        </nav>

        {/* Zone 3: Student Score & Profile Action */}
        <div className="flex items-center gap-3">
          <FluidGlassButton
            variant="primary"
            onClick={() => switchTab('ranks')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold font-mono tabular-nums whitespace-nowrap"
          >
            <span>Score: {student.examScore || 0} pts</span>
          </FluidGlassButton>
        </div>
      </header>

      {/* Main Content Container with Native iOS Slide/Swipe Physics & Gliding Fluid Glass Switcher */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 overflow-x-hidden">
        {/* Synced PDF Section <-> Exam Section Fluid Glass Switcher & Swipe Gesture Bar */}
        {(activeTab === 'pdfs' || activeTab === 'exams') && (
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FluidGlassTabBar
              layoutId="student-pdfs-exams-switcher-pill"
              dragX={dragX}
              activeTab={activeTab as 'pdfs' | 'exams'}
              onSelectTab={(nextTab) => switchTab(nextTab)}
              className="w-full sm:w-auto"
              tabs={[
                {
                  id: 'pdfs',
                  label: t.pdfSection,
                  icon: <BookOpen className="w-3.5 h-3.5" />,
                  badge: pdfProducts.length,
                },
                {
                  id: 'exams',
                  label: t.examsSection,
                  icon: <FileCheck2 className="w-3.5 h-3.5" />,
                  badge: examProducts.length,
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
                  switchTab(activeTab === 'pdfs' ? 'exams' : 'pdfs')
                }
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap"
              >
                <span>
                  {activeTab === 'pdfs'
                    ? `Slide to ${t.examsSection} →`
                    : `← Slide to ${t.pdfSection}`}
                </span>
              </FluidGlassButton>
            </div>
          </div>
        )}

        <FluidSwipePager
          tabOrder={STUDENT_TAB_ORDER}
          activeTab={activeTab}
          onSelectTab={switchTab}
          dragProgressMotion={dragProgressMotion}
          renderSection={(tabToRender) => (
            <>
        {/* TAB 1: PDF SECTION */}
        {tabToRender === 'pdfs' && (
          <div className="space-y-6">
            {/* Fluid Water Droplet Drag & Release Search Bar & Fluid Glass Subjects Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <FluidDropletSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t.searchPlaceholder}
                darkMode={darkMode}
                sectionLabel="PDFs & Topics"
              />

              <FluidGlassButton
                variant="primary"
                onClick={() => setShowSubjectFilters((prev) => !prev)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{t.subjectsButton}</span>
              </FluidGlassButton>
            </div>

            {/* Sliding Liquid Droplet Auditorium Filter Row + Quick Actions */}
            <FluidDropletFilterGroup
              activeId={auditoriumFilter}
              onSelect={(aud) => setAuditoriumFilter(aud)}
              items={[
                { id: 'ALL', label: 'All Auditoriums' },
                { id: 'University', label: 'University Auditorium Curricula' },
                { id: 'School', label: 'School Auditorium Curricula' },
              ]}
              trailingActions={
                <>
                  <FluidGlassButton
                    variant="surface"
                    onClick={() => setDrawerModal('pdf_achieved')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                  >
                    <span>My Achieved PDFs ({myAchievedPdfs.length})</span>
                  </FluidGlassButton>
                  <FluidGlassButton
                    variant="surface"
                    onClick={() => {
                      setSelectedTeacherChannelId('ALL');
                      setActiveTab('channels');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0052FF] dark:text-sky-300 whitespace-nowrap"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Teacher Channels (See What Teachers Shared)</span>
                  </FluidGlassButton>
                </>
              }
            />

            {/* Subject Filter Buttons (12 Official Subjects) with Continuous Sliding Liquid Droplet Selection */}
            {showSubjectFilters && (
              <div
                className={`p-3.5 rounded-2xl border ios-glass-card ${
                  darkMode ? 'border-slate-800' : 'border-white/80'
                }`}
              >
                <FluidDropletFilterGroup
                  activeId={selectedSubject}
                  onSelect={(subj) => setSelectedSubject(subj)}
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
            )}

            {/* Published PDFs Grid (Fluid Glass Cards & Water Droplet Action Triggers) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pdfProducts.map((pdf) => {
                const owned = hasPurchased(pdf.id);
                return (
                  <FluidGlassCard
                    key={pdf.id}
                    className="rounded-2xl flex flex-col justify-between"
                  >
                    <div>
                      <ProductCoverVisual
                        coverThumbnail={pdf.coverThumbnail}
                        subject={pdf.subject}
                        type="pdf"
                        auditorium={pdf.auditorium}
                        pageNumber={pdf.pageNumber}
                      />
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{pdf.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span>{pdf.auditorium}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {pdf.pageNumber} pages
                          </span>
                        </div>

                        <h3 className="text-base font-bold leading-snug">
                          {pdf.topicName}
                        </h3>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <p className="text-xs text-slate-500 truncate">
                            Author: {pdf.authorName} · {pdf.authorDegree}
                          </p>
                          <FluidGlassButton
                            variant="surface"
                            onClick={() => handleOpenTeacherChannel(pdf.authorId)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0052FF] dark:text-sky-300 shrink-0"
                          >
                            <Tv className="w-3 h-3" />
                            <span>View Channel</span>
                          </FluidGlassButton>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
                      <span className="text-base font-bold font-mono tabular-nums">
                        {pdf.price === 0 ? 'Free' : `$${pdf.price.toFixed(2)}`}
                      </span>

                      {owned ? (
                        <FluidGlassButton
                          variant="emerald"
                          onClick={() => onOpenDocumentViewer(pdf)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                        >
                          <span>{t.openReader}</span>
                        </FluidGlassButton>
                      ) : (
                        <FluidGlassButton
                          variant="primary"
                          onClick={() => onOpenPayment(pdf)}
                          className="px-5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                        >
                          <span>{t.getButton}</span>
                        </FluidGlassButton>
                      )}
                    </div>
                  </FluidGlassCard>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: EXAMS SECTION */}
        {tabToRender === 'exams' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Interactive Academic Examinations
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Purchased exams grant a 1-week (168-hour) validity window in our Google Docs-style exam interface. Formula: Correct Answers × 100 = Rank Score.
                </p>
              </div>
              <FluidGlassButton
                variant="surface"
                onClick={() => setDrawerModal('downloaded_exams')}
                className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap self-start"
              >
                <span>Active Downloaded Exams ({myDownloadedExams.length})</span>
              </FluidGlassButton>
            </div>

            {/* Fluid Water Droplet Drag & Release Search Bar for Exams */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <FluidDropletSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search interactive exams, subjects, or educators..."
                darkMode={darkMode}
                sectionLabel="Interactive Exams"
              />
              <FluidGlassButton
                variant="primary"
                onClick={() => setShowSubjectFilters((prev) => !prev)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{t.subjectsButton}</span>
              </FluidGlassButton>
            </div>

            {/* Sliding Liquid Droplet Auditorium & Subject Filters for Exams */}
            <FluidDropletFilterGroup
              activeId={auditoriumFilter}
              onSelect={(aud) => setAuditoriumFilter(aud)}
              items={[
                { id: 'ALL', label: 'All Auditoriums' },
                { id: 'University', label: 'University Auditorium Curricula' },
                { id: 'School', label: 'School Auditorium Curricula' },
              ]}
            />

            {showSubjectFilters && (
              <div
                className={`p-3.5 rounded-2xl border ios-glass-card ${
                  darkMode ? 'border-slate-800' : 'border-white/80'
                }`}
              >
                <FluidDropletFilterGroup
                  activeId={selectedSubject}
                  onSelect={(subj) => setSelectedSubject(subj)}
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {examProducts.map((exam) => {
                const owned = hasPurchased(exam.id);
                const purchaseRec = myPurchases.find(
                  (p) => p.productId === exam.id
                );
                return (
                  <FluidGlassCard
                    key={exam.id}
                    className="rounded-2xl flex flex-col justify-between"
                  >
                    <div>
                      <ProductCoverVisual
                        coverThumbnail={exam.coverThumbnail}
                        subject={exam.subject}
                        type="exam"
                        auditorium={exam.auditorium}
                        pageNumber={exam.pageNumber}
                      />
                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{exam.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span>{exam.auditorium}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {exam.examQuestions?.length || 5} Questions
                          </span>
                        </div>

                        <h3 className="text-base font-bold leading-snug">
                          {exam.topicName}
                        </h3>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <p className="text-xs text-slate-500 truncate">
                            Author: {exam.authorName} ({exam.authorDegree})
                          </p>
                          <FluidGlassButton
                            variant="surface"
                            onClick={() => handleOpenTeacherChannel(exam.authorId)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0052FF] dark:text-sky-300 shrink-0"
                          >
                            <Tv className="w-3 h-3" />
                            <span>View Channel</span>
                          </FluidGlassButton>
                        </div>

                        {owned && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-600 dark:text-amber-400 pt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{getExamRemainingCounter(exam.id)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-base font-bold font-mono tabular-nums">
                          ${exam.price.toFixed(2)}
                        </span>
                        {purchaseRec?.examCompleted && (
                          <span className="block text-[11px] font-mono text-emerald-600">
                            Completed (+{purchaseRec.examScoreAwarded} pts)
                          </span>
                        )}
                      </div>

                      {owned ? (
                        <FluidGlassButton
                          variant="primary"
                          onClick={() => onOpenDocumentViewer(exam)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                        >
                          <span>{t.startExam}</span>
                        </FluidGlassButton>
                      ) : (
                        <FluidGlassButton
                          variant="primary"
                          onClick={() => onOpenPayment(exam)}
                          className="px-5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                        >
                          <span>{t.getButton}</span>
                        </FluidGlassButton>
                      )}
                    </div>
                  </FluidGlassCard>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: NEWS SECTION (AUTO-POPULATED BY SYSTEM ADMIN "ADD NEWS") */}
        {tabToRender === 'news' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  C. ACADEMY Academic Bulletins & News Feed
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Live announcements, Olympiad schedules, and curriculum updates published by System Administration.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {news.length} Official Bulletins
              </span>
            </div>

            {/* Subject Filter Bar for News Feed with Sliding Liquid Droplet Selection */}
            <div
              className={`p-3 rounded-2xl border ios-glass-card ${
                darkMode ? 'border-slate-800' : 'border-white/80'
              }`}
            >
              <FluidDropletFilterGroup
                activeId={newsSubjectFilter}
                onSelect={(subj) => setNewsSubjectFilter(subj)}
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
                  newsSubjectFilter === 'ALL'
                    ? true
                    : item.subject === newsSubjectFilter
                )
                .map((item) => (
                  <motion.article
                    layout
                    whileHover={{ y: -2 }}
                    key={item.id}
                    onClick={() => setSelectedNewsArticle(item)}
                    className={`p-6 rounded-2xl border space-y-3 ios-glass-card cursor-pointer transition-all ${
                      item.isPinned
                        ? 'border-[#0052FF]/60 ring-1 ring-[#0052FF]/25'
                        : darkMode
                        ? 'border-slate-800'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {item.coverImage && (
                      <div className="h-44 rounded-xl overflow-hidden bg-slate-900">
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {item.isPinned && (
                        <span className="font-semibold text-[#0052FF] dark:text-sky-400 inline-flex items-center gap-1">
                          <Pin className="w-3.5 h-3.5" />
                          Pinned System Bulletin ·
                        </span>
                      )}
                      <span>{item.subject}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.publishedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.author}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {item.readTimeMinutes} min read
                      </span>
                    </div>

                    <h2 className="text-lg font-bold">{item.title}</h2>
                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                      {item.summary}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed pt-1">
                      {item.body}
                    </p>
                  </motion.article>
                ))}
            </div>
          </div>
        )}

        {/* TAB 4: SCORES / RANKS */}
        {tabToRender === 'ranks' && (
          <div className="space-y-8">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Global Academic Leaderboards
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Student Score = Correct Exam Answers × 100 · Teacher Rank = Channel Subscribers & Ratings
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-[#0052FF] dark:text-sky-300">
                Your Formula Score: {student.correctExamAnswersTotal || 0} × 100 ={' '}
                <strong>{student.examScore || 0} pts</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Student Leaderboard Table */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    Monthly Student Ranking
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    Correct × 100
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentLeaderboard.map((stu, idx) => (
                    <div
                      key={stu.id}
                      className={`px-5 py-3.5 flex items-center justify-between text-sm ${
                        stu.id === student.id
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-mono font-bold text-slate-400 tabular-nums">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold">
                            {stu.fullName}{' '}
                            {stu.id === student.id && (
                              <span className="text-xs text-[#0052FF]">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums">
                            {stu.correctExamAnswersTotal || 0} Correct Exam Answers
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-[#0052FF] dark:text-sky-400">
                        {stu.examScore || 0} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teacher Leaderboard Table */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    Top Ranked Educators & Authors
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    Subscribers · Rating
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teacherLeaderboard.map((tch, idx) => (
                    <div
                      key={tch.id}
                      className="px-5 py-3.5 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-mono font-bold text-slate-400 tabular-nums">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold">
                            {tch.fullName} · {tch.academicDegree}
                          </p>
                          <p className="text-xs text-slate-500">
                            {tch.majorField}
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span className="text-sm font-bold block">
                          {(tch.subscribersCount || 0).toLocaleString()} subs
                        </span>
                        <span className="text-xs text-emerald-600">
                          Rating {(tch.rating || 5.0).toFixed(2)} / 5.0
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CHANNELS (SEE WHAT TEACHERS SHARED) */}
        {tabToRender === 'channels' && (
          <div className="space-y-8">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Teacher Channels — Shared PDFs, Exams & Announcements
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Explore educator channels to see every PDF monograph, interactive exam, and course announcement shared by teachers.
                </p>
              </div>

              {/* Filter: All Channels vs Subscribed Channels (Sliding Liquid Droplet) */}
              <FluidDropletFilterGroup
                variant="segmented"
                activeId={channelSubFilter}
                onSelect={(val) => setChannelSubFilter(val)}
                className="self-start"
                items={[
                  {
                    id: 'all',
                    label: `All Channels (${channels.length})`,
                  },
                  {
                    id: 'subscribed',
                    label: `Subscribed (${
                      channels.filter((c) =>
                        c.subscriberIds.includes(student.id)
                      ).length
                    })`,
                  },
                ]}
              />
            </div>

            {/* Channel Selector Pills / Bar (Sliding Liquid Droplet) */}
            <FluidDropletFilterGroup
              activeId={selectedTeacherChannelId}
              onSelect={(chId) => setSelectedTeacherChannelId(chId)}
              items={[
                { id: 'ALL', label: 'All Teachers’ Shared Content' },
                ...channels
                  .filter((ch) =>
                    channelSubFilter === 'subscribed'
                      ? ch.subscriberIds.includes(student.id)
                      : true
                  )
                  .map((ch) => ({
                    id: ch.id,
                    label: `${ch.teacherName} · ${ch.majorSubject}`,
                  })),
              ]}
            />

            {/* Channel Directory Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {channels
                .filter((ch) =>
                  channelSubFilter === 'subscribed'
                    ? ch.subscriberIds.includes(student.id)
                    : true
                )
                .map((ch) => {
                  const isSubbed = ch.subscriberIds.includes(student.id);
                  const isSelected = selectedTeacherChannelId === ch.id;
                  const teacherSharedProducts = products.filter(
                    (p) => p.authorId === ch.teacherId
                  );
                  const teacherSharedPosts = posts.filter(
                    (p) => p.channelId === ch.id || p.teacherId === ch.teacherId
                  );

                  return (
                    <div
                      key={ch.id}
                      className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 transition-all ${
                        isSelected
                          ? 'ring-2 ring-[#0052FF] border-[#0052FF]'
                          : darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{ch.majorSubject}</span>
                          <span className="font-mono tabular-nums">
                            {ch.subscribersCount.toLocaleString()} subscribers
                          </span>
                        </div>
                        <h3 className="text-base font-bold">
                          {ch.teacherName} ({ch.academicDegree})
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {ch.bio}
                        </p>
                        <div className="pt-1 flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span>{teacherSharedProducts.filter((p) => p.type === 'pdf').length} PDFs</span>
                          <span>·</span>
                          <span>{teacherSharedProducts.filter((p) => p.type === 'exam').length} Exams</span>
                          <span>·</span>
                          <span>{teacherSharedPosts.length} Posts</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTeacherChannelId(isSelected ? 'ALL' : ch.id)
                          }
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                              : 'border-slate-200 dark:border-slate-700 hover:border-[#0052FF]'
                          }`}
                        >
                          {isSelected ? 'Viewing Shared' : 'See What Shared'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleSubscribeChannel(ch.id)}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            isSubbed
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                              : 'bg-[#0052FF] hover:bg-[#0040C9] text-white'
                          }`}
                        >
                          {isSubbed ? 'Subscribed ✓' : 'Subscribe'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* PDFs & EXAMS SHARED BY SELECTED TEACHER(S) */}
            {(() => {
              const activeChannelObj =
                selectedTeacherChannelId === 'ALL'
                  ? null
                  : channels.find((c) => c.id === selectedTeacherChannelId);

              const sharedProductsList = products.filter((p) => {
                if (activeChannelObj) {
                  return p.authorId === activeChannelObj.teacherId;
                }
                if (channelSubFilter === 'subscribed') {
                  const subbedTeacherIds = new Set(
                    channels
                      .filter((c) => c.subscriberIds.includes(student.id))
                      .map((c) => c.teacherId)
                  );
                  return subbedTeacherIds.has(p.authorId);
                }
                return true;
              });

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">
                        {activeChannelObj
                          ? `PDFs & Exams Shared by ${activeChannelObj.teacherName}`
                          : 'PDFs & Exams Shared Across Teacher Channels'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Direct access to all study materials and examinations published by the educator.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {sharedProductsList.length} items shared
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sharedProductsList.map((prod) => {
                      const owned = hasPurchased(prod.id);
                      return (
                        <div
                          key={prod.id}
                          className="p-4 rounded-2xl fluid-glass-item-card flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {prod.type === 'exam' ? 'INTERACTIVE EXAM' : 'PROTECTED PDF'} · {prod.subject}
                              </span>
                              <span className="font-mono tabular-nums">
                                {prod.type === 'exam'
                                  ? `${prod.examQuestions?.length || 5} Qs`
                                  : `${prod.pageNumber}p`}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold leading-snug">
                              {prod.topicName}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Shared by {prod.authorName} ({prod.authorDegree}) · {prod.auditorium}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-sm font-bold font-mono tabular-nums">
                              ${prod.price.toFixed(2)}
                            </span>
                            {owned ? (
                              <FluidGlassButton
                                variant="emerald"
                                onClick={() => onOpenDocumentViewer(prod)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                              >
                                <span>
                                  {prod.type === 'exam' ? t.startExam : t.openReader}
                                </span>
                              </FluidGlassButton>
                            ) : (
                              <FluidGlassButton
                                variant="primary"
                                onClick={() => onOpenPayment(prod)}
                                className="px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                              >
                                <span>{t.getButton}</span>
                              </FluidGlassButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Channel Feed Posts (Like, Dislike, Comment, Share) */}
            <div className="space-y-5">
              <h2 className="text-lg font-bold">
                Channel Announcements & Course Cards Shared by Teachers
              </h2>

              {posts
                .filter((post) =>
                  selectedTeacherChannelId === 'ALL'
                    ? true
                    : post.channelId === selectedTeacherChannelId
                )
                .map((post) => {
                  const liked = post.likedByUserIds.includes(student.id);
                  const disliked = post.dislikedByUserIds.includes(student.id);
                  const linkedProduct = products.find(
                    (p) => p.id === post.linkedProductId
                  );

                  return (
                    <article
                      key={post.id}
                      className={`p-6 rounded-xl border space-y-4 ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>
                        <strong className="text-slate-900 dark:text-white">
                          {post.teacherName}
                        </strong>{' '}
                        · {post.subject} · {post.createdAt}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold">{post.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {post.content}
                      </p>
                    </div>

                    {linkedProduct && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="text-xs">
                          <span className="text-slate-500 block">
                            Featured {linkedProduct.type.toUpperCase()} Product:
                          </span>
                          <strong className="text-slate-900 dark:text-white">
                            {linkedProduct.topicName} (${linkedProduct.price})
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            hasPurchased(linkedProduct.id)
                              ? onOpenDocumentViewer(linkedProduct)
                              : onOpenPayment(linkedProduct)
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-[#0052FF] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          {hasPurchased(linkedProduct.id) ? 'Open' : t.getButton}
                        </button>
                      </div>
                    )}

                    {/* Like, Dislike, Share Bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onReactToPost(post.id, 'like')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          liked
                            ? 'bg-blue-50 text-[#0052FF] border border-blue-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{post.likes}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onReactToPost(post.id, 'dislike')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          disliked
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">
                          {post.dislikes}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSharePost(post.id);
                          setSharedBannerPostId(post.id);
                          window.setTimeout(() => setSharedBannerPostId(null), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share ({post.sharesCount})</span>
                      </button>

                      {sharedBannerPostId === post.id && (
                        <span className="text-xs text-emerald-600 font-medium">
                          ✓ Channel announcement link copied & shared!
                        </span>
                      )}
                    </div>

                    {/* Comments Section */}
                    <div className="space-y-2.5 pt-2">
                      {post.comments.map((c) => (
                        <div
                          key={c.id}
                          className="text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                          <div className="flex items-center justify-between text-slate-500 mb-0.5">
                            <strong className="text-slate-800 dark:text-slate-200">
                              {c.authorName}
                            </strong>
                            <span>{c.createdAt}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">
                            {c.text}
                          </p>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={commentDrafts[post.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          placeholder="Write a comment or question for the author..."
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                            darkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const txt = (commentDrafts[post.id] || '').trim();
                            if (!txt) return;
                            onAddComment(post.id, txt);
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [post.id]: '',
                            }));
                          }}
                          className="px-3.5 py-2 rounded-lg bg-[#0052FF] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Post</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
            </>
          )}
        />
      </main>

      {/* Bottom Navigation Bar (5 Tabs) with Real-Time Swipe-Synced Fluid Glass Glider */}
      <FluidGlassBottomDock
        tabs={[
          { id: 'pdfs', label: t.pdfSection, icon: BookOpen },
          { id: 'exams', label: t.examsSection, icon: FileCheck2 },
          { id: 'news', label: t.newsSection, icon: Newspaper },
          { id: 'ranks', label: t.scoresRanks, icon: Trophy },
          { id: 'channels', label: t.channels, icon: Tv },
        ]}
        activeTab={activeTab}
        onSelectTab={switchTab}
        dragProgressMotion={dragProgressMotion}
        darkMode={darkMode}
      />

      {/* STUDENT LEFT SLIDE-OUT DRAWER MENU WITH iOS SPRING & FLUID GLASS */}
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
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold">{student.fullName}</h2>
                    <p className="text-xs text-slate-500 font-mono">
                      {student.gmail}
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

                {/* Student Drawer Menu Items */}
                <div className="space-y-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeacherChannelId('ALL');
                      switchTab('channels');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>Channels (What Teachers Shared)</span>
                    <span className="text-xs font-mono text-[#0052FF]">
                      {channels.length} channels
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchTab('ranks');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>1. Ranks / Scores</span>
                    <span className="text-xs font-mono text-[#0052FF]">
                      {student.examScore || 0} pts
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('pdf_achieved');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>2. PDF Achieved</span>
                    <span className="text-xs font-mono text-slate-500">
                      {myAchievedPdfs.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('downloaded_exams');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>3. Downloaded Exams</span>
                    <span className="text-xs font-mono text-slate-500">
                      {myDownloadedExams.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerModal('devices');
                      setDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>4. My Devices Connected to App</span>
                    <span className="text-xs font-mono text-emerald-600">
                      {student.connectedDevices.length}/3
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
                    <span>5. {t.changeLanguage}</span>
                    <span className="text-xs text-slate-500">{language}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>6. {t.darkMode}</span>
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
                <span>7. {t.logOut}</span>
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* EXPANDED NEWS ARTICLE MODAL SHEET */}
      <AnimatePresence>
        {selectedNewsArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNewsArticle(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 18 }}
              transition={IOS_SPRING}
              className={`relative z-10 max-w-2xl w-full rounded-2xl border p-6 md:p-8 space-y-4 ios-glass-card ${
                darkMode
                  ? 'border-slate-800 text-white'
                  : 'border-white/80 text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{selectedNewsArticle.subject}</span>
                    <span>·</span>
                    <span>{selectedNewsArticle.publishedAt}</span>
                    <span>·</span>
                    <span className="font-mono">
                      {selectedNewsArticle.readTimeMinutes} min read
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">
                    {selectedNewsArticle.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNewsArticle(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedNewsArticle.coverImage && (
                <div className="h-52 rounded-xl overflow-hidden bg-slate-900">
                  <img
                    src={selectedNewsArticle.coverImage}
                    alt={selectedNewsArticle.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {selectedNewsArticle.summary}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedNewsArticle.body}
              </p>
              <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-500">
                Published by {selectedNewsArticle.author}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAWER MODALS: PDF Achieved, Downloaded Exams, Connected Devices (Max 3), Language Selector */}
      {drawerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border p-6 space-y-5 shadow-2xl ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold">
                {drawerModal === 'pdf_achieved' && 'PDF Achieved Library'}
                {drawerModal === 'downloaded_exams' &&
                  'Downloaded Exams (1-Week Validity Window)'}
                {drawerModal === 'devices' &&
                  'My Devices Connected to App (Max 3 Allowed)'}
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

            {drawerModal === 'pdf_achieved' && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {myAchievedPdfs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No PDFs purchased yet. Browse the PDF Section to acquire monographs.
                  </p>
                ) : (
                  myAchievedPdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="p-3.5 rounded-xl fluid-glass-item-card flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{pdf.topicName}</p>
                        <p className="text-xs text-slate-500">
                          {pdf.subject} · {pdf.pageNumber} pages · {pdf.authorName}
                        </p>
                      </div>
                      <FluidGlassButton
                        variant="primary"
                        onClick={() => {
                          setDrawerModal(null);
                          onOpenDocumentViewer(pdf);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                      >
                        <span>Read PDF</span>
                      </FluidGlassButton>
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerModal === 'downloaded_exams' && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {myDownloadedExams.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No active exams downloaded yet.
                  </p>
                ) : (
                  myDownloadedExams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-xl fluid-glass-item-card flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{ex.topicName}</p>
                        <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                          {getExamRemainingCounter(ex.id)}
                        </p>
                      </div>
                      <FluidGlassButton
                        variant="primary"
                        onClick={() => {
                          setDrawerModal(null);
                          onOpenDocumentViewer(ex);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                      >
                        <span>Open Exam</span>
                      </FluidGlassButton>
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerModal === 'devices' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  C. ACADEMY security policy enforces a maximum of <strong>3 unique devices</strong> simultaneously per student account. A 4th device attempting login is automatically rejected.
                </p>

                {deviceNotice && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {deviceNotice}
                  </div>
                )}

                <div className="space-y-2.5">
                  {student.connectedDevices.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-4 h-4 text-[#0052FF] shrink-0" />
                        <div>
                          <p className="text-xs font-bold">
                            {dev.name}{' '}
                            {dev.isCurrentDevice && (
                              <span className="text-emerald-600">(This Device)</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {dev.platform} · {dev.location} · {dev.lastActive}
                          </p>
                        </div>
                      </div>
                      {!dev.isCurrentDevice && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDevice(dev.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Revoke Device Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddSimulatedDevice}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0052FF] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Simulate Connecting Additional Device ({student.connectedDevices.length}/3 Active)
                  </span>
                </button>
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
                        : 'border-slate-200 dark:border-slate-800 hover:border-[#0052FF]'
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
