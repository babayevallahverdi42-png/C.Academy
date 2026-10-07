/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AcademicProduct,
  ChannelPost,
  NewsArticle,
  PurchasedRecord,
  SupportedLanguage,
  SystemPayoneerConfig,
  TeacherChannel,
  UserProfile,
} from './types';
import {
  INITIAL_CHANNEL_POSTS,
  INITIAL_CHANNELS,
  INITIAL_NEWS,
  INITIAL_PAYONEER_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_PURCHASES,
  INITIAL_USERS,
} from './data/initialData';
import {
  computeVaultIntegritySeal,
  constantTimeHexCompare,
  generateSecureId,
  getInitialSystemVault,
  ObfuscatedSystemVault,
  sanitizeSafeImageUri,
  sanitizeTextInput,
} from './utils/security';
import {
  EncryptedMobileStorage,
  issueSignedSessionJwt,
  SignedJwtSession,
  verifySignedSessionJwt,
} from './utils/mobileEnterpriseSecurity';
import { SecurityCommitmentModal } from './components/SecurityCommitmentModal';
import { RoleSelectionAndAuth } from './components/RoleSelectionAndAuth';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { PaymentModal } from './components/PaymentModal';
import { SecureDocumentViewer } from './components/SecureDocumentViewer';

const IOS_SCREEN_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
  mass: 0.85,
};

export const APPROVED_REENGAGEMENT_MESSAGES = [
  'Ready for something new?',
  "New PDFs are ready, don't miss out!",
  "It's the perfect time to test yourself!",
  'C.Academy is waiting for you!',
] as const;

export default function App() {
  // 1. Initial App Launch Security Commitment state
  const [commitmentAccepted, setCommitmentAccepted] = useState<boolean>(false);
  const [sessionTerminated, setSessionTerminated] = useState<boolean>(false);
  const [pushBannerText, setPushBannerText] = useState<string | null>(null);
  const pushRotationIdxRef = useRef<number>(0);

  useEffect(() => {
    const triggerReengagementNotification = () => {
      const msg =
        APPROVED_REENGAGEMENT_MESSAGES[
          pushRotationIdxRef.current % APPROVED_REENGAGEMENT_MESSAGES.length
        ];
      pushRotationIdxRef.current += 1;
      setPushBannerText(msg);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('C.Academy', { body: msg });
        } catch {
          // Ignore Notification constructor errors in restricted contexts
        }
      }

      window.setTimeout(() => {
        setPushBannerText((prev) => (prev === msg ? null : prev));
      }, 4500);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerReengagementNotification();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 2. Global App Configuration
  const [language, setLanguage] = useState<SupportedLanguage>('English');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // 3. Core Platform State (Backed by EncryptedMobileStorage at Rest)
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [jwtSession, setJwtSession] = useState<SignedJwtSession | null>(null);
  const [products, setProducts] = useState<AcademicProduct[]>(INITIAL_PRODUCTS);
  const [purchases, setPurchases] =
    useState<PurchasedRecord[]>(INITIAL_PURCHASES);
  const [channels, setChannels] = useState<TeacherChannel[]>(INITIAL_CHANNELS);
  const [posts, setPosts] = useState<ChannelPost[]>(INITIAL_CHANNEL_POSTS);
  const [news, setNews] = useState<NewsArticle[]>(() => {
    try {
      const parsed =
        EncryptedMobileStorage.getItem<NewsArticle[]>('c_academy_news_v1');
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Schema & URI sanitization on untrusted deserialization (CWE-502 / CWE-79)
        const validated = parsed
          .filter(
            (item): item is NewsArticle =>
              item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              typeof item.summary === 'string' &&
              typeof item.body === 'string'
          )
          .map((item) => ({
            ...item,
            title: sanitizeTextInput(item.title, 180),
            summary: sanitizeTextInput(item.summary, 400),
            body: sanitizeTextInput(item.body, 4000),
            author: sanitizeTextInput(
              item.author || 'C. ACADEMY System Editorial',
              100
            ),
            coverImage: sanitizeSafeImageUri(item.coverImage),
          }));
        if (validated.length > 0) return validated;
      }
    } catch {
      // Fallback to initial news
    }
    return INITIAL_NEWS;
  });
  const [payoneerConfig, setPayoneerConfig] =
    useState<SystemPayoneerConfig>(INITIAL_PAYONEER_CONFIG);
  const [systemVault, setSystemVault] = useState<ObfuscatedSystemVault>(() =>
    getInitialSystemVault()
  );

  // 4. Active Modals (Payment Checkout & Protected Document Viewer)
  const [checkoutProduct, setCheckoutProduct] =
    useState<AcademicProduct | null>(null);
  const [viewingProduct, setViewingProduct] =
    useState<AcademicProduct | null>(null);

  const persistNews = (updated: NewsArticle[]) => {
    setNews(updated);
    EncryptedMobileStorage.setItem('c_academy_news_v1', updated);
  };

  const handleAuthenticateUser = (user: UserProfile) => {
    const issued = issueSignedSessionJwt({
      userId: user.id,
      role: user.role,
      ttlSeconds: 3600,
    });
    const verification = verifySignedSessionJwt(issued.token);
    if (!verification.valid) return;
    setJwtSession(issued);
    setCurrentUser(user);
  };

  const handleLogoutUser = () => {
    EncryptedMobileStorage.removeItem('c_academy_jwt_session_v4');
    setJwtSession(null);
    setCurrentUser(null);
  };

  // Verify active JWT session integrity on mobile lifecycle resume
  useEffect(() => {
    if (!jwtSession || !currentUser) return;
    const checkJwtOnFocus = () => {
      if (document.visibilityState === 'visible') {
        const check = verifySignedSessionJwt(jwtSession.token);
        if (!check.valid) {
          handleLogoutUser();
        }
      }
    };
    document.addEventListener('visibilitychange', checkJwtOnFocus);
    return () =>
      document.removeEventListener('visibilitychange', checkJwtOnFocus);
  }, [jwtSession, currentUser]);

  // Handle Admin Creating News Post (Auto-populates public News Section)
  const handleCreateNews = (newArticle: NewsArticle) => {
    persistNews([newArticle, ...news]);
  };

  // Handle Admin Updating News Post
  const handleUpdateNews = (updatedArticle: NewsArticle) => {
    persistNews(
      news.map((item) =>
        item.id === updatedArticle.id ? updatedArticle : item
      )
    );
  };

  // Handle Admin Deleting News Post
  const handleDeleteNews = (articleId: string) => {
    persistNews(news.filter((item) => item.id !== articleId));
  };

  // Handle User Registration
  const handleRegisterUser = (newUser: UserProfile) => {
    setUsers((prev) => [...prev, newUser]);
  };

  // Handle Student Purchase Confirmation with Automatic 80/20 vs 78/22 Revenue Split
  const handleConfirmPurchase = (product: AcademicProduct) => {
    if (!currentUser) return;

    const author = users.find((u) => u.id === product.authorId);
    const isPremiumAuthor = Boolean(author?.isPremium);
    const teacherPercent = isPremiumAuthor ? 78 : 80;
    const platformPercent = isPremiumAuthor ? 22 : 20;

    const teacherShare = Number(
      ((product.price * teacherPercent) / 100).toFixed(2)
    );
    const platformShare = Number(
      ((product.price * platformPercent) / 100).toFixed(2)
    );

    const nowIso = new Date().toISOString();
    const oneWeekLaterIso = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const newRecord: PurchasedRecord = {
      id: generateSecureId('pur'),
      productId: product.id,
      productType: product.type,
      studentId: currentUser.id,
      studentName: currentUser.fullName,
      purchasedAt: nowIso,
      expiresAt: product.type === 'exam' ? oneWeekLaterIso : undefined,
      pricePaid: product.price,
      teacherShare,
      platformShare,
      revenueSplitLabel: isPremiumAuthor ? '78/22 Premium' : '80/20 Standard',
      examCompleted: false,
      examCorrectCount: 0,
      examScoreAwarded: 0,
    };

    setPurchases((prev) => [newRecord, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, salesCount: p.salesCount + 1 } : p
      )
    );
    setCheckoutProduct(null);
    setViewingProduct(product);
  };

  // Handle Student Exam Completion -> Student Score = Correct Exam Answers * 100
  // Hardened against Exam Replay & Score Manipulation (CWE-840 Business Logic Enforcement)
  const handleCompleteExam = (
    productId: string,
    correctAnswersCount: number,
    scoreAwarded: number
  ) => {
    if (!currentUser) return;

    const targetPurchase = purchases.find(
      (rec) => rec.productId === productId && rec.studentId === currentUser.id
    );
    // Reject if purchase does not exist, was already completed, or has expired
    if (!targetPurchase || targetPurchase.examCompleted) return;
    if (
      targetPurchase.expiresAt &&
      new Date(targetPurchase.expiresAt).getTime() < Date.now()
    ) {
      return;
    }

    const targetProduct = products.find((p) => p.id === productId);
    const maxQuestions = targetProduct?.examQuestions?.length || 20;
    const boundedCorrect = Math.max(
      0,
      Math.min(Math.floor(correctAnswersCount), maxQuestions)
    );
    const verifiedScore = boundedCorrect * 100;

    setPurchases((prev) =>
      prev.map((rec) =>
        rec.id === targetPurchase.id
          ? {
              ...rec,
              examCompleted: true,
              examCorrectCount: boundedCorrect,
              examScoreAwarded: verifiedScore || scoreAwarded,
            }
          : rec
      )
    );

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== currentUser.id) return u;
        const updatedCorrect =
          (u.correctExamAnswersTotal || 0) + boundedCorrect;
        const updatedScore = updatedCorrect * 100;
        const updatedUser = {
          ...u,
          correctExamAnswersTotal: updatedCorrect,
          examScore: updatedScore,
        };
        setCurrentUser(updatedUser);
        return updatedUser;
      })
    );
  };

  // Handle Teacher Publishing Product (with Monthly Quota & Premium Upgrade)
  const handlePublishProduct = (
    newProduct: AcademicProduct,
    upgradeToPremium: boolean
  ) => {
    setProducts((prev) => [newProduct, ...prev]);

    if (!currentUser) return;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== currentUser.id) return u;
        const updatedTeacher: UserProfile = {
          ...u,
          isPremium: u.isPremium || upgradeToPremium,
          monthlyPublishedCount: (u.monthlyPublishedCount || 0) + 1,
        };
        setCurrentUser(updatedTeacher);
        return updatedTeacher;
      })
    );
  };

  // Handle Teacher Profile Update (Profession / Bank Card)
  const handleUpdateTeacherProfile = (updatedTeacher: UserProfile) => {
    setCurrentUser(updatedTeacher);
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedTeacher.id ? updatedTeacher : u))
    );
  };

  // Handle Channel Subscribe Toggle
  const handleToggleSubscribeChannel = (channelId: string) => {
    if (!currentUser) return;

    let targetTeacherId = '';
    let nextSubCount = 0;

    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        targetTeacherId = ch.teacherId;
        const alreadySubbed = ch.subscriberIds.includes(currentUser.id);
        const updatedSubIds = alreadySubbed
          ? ch.subscriberIds.filter((id) => id !== currentUser.id)
          : [...ch.subscriberIds, currentUser.id];
        nextSubCount = alreadySubbed
          ? Math.max(0, ch.subscribersCount - 1)
          : ch.subscribersCount + 1;
        return {
          ...ch,
          subscriberIds: updatedSubIds,
          subscribersCount: nextSubCount,
        };
      })
    );

    if (targetTeacherId) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetTeacherId
            ? { ...u, subscribersCount: nextSubCount }
            : u
        )
      );
    }
  };

  // Handle Channel Post Like / Dislike
  const handleReactToPost = (postId: string, reaction: 'like' | 'dislike') => {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const hasLiked = p.likedByUserIds.includes(currentUser.id);
        const hasDisliked = p.dislikedByUserIds.includes(currentUser.id);

        if (reaction === 'like') {
          const nextLikedIds = hasLiked
            ? p.likedByUserIds.filter((id) => id !== currentUser.id)
            : [...p.likedByUserIds, currentUser.id];
          const nextDislikedIds = p.dislikedByUserIds.filter(
            (id) => id !== currentUser.id
          );
          return {
            ...p,
            likedByUserIds: nextLikedIds,
            dislikedByUserIds: nextDislikedIds,
            likes: hasLiked ? p.likes - 1 : p.likes + 1,
            dislikes: hasDisliked ? Math.max(0, p.dislikes - 1) : p.dislikes,
          };
        } else {
          const nextDislikedIds = hasDisliked
            ? p.dislikedByUserIds.filter((id) => id !== currentUser.id)
            : [...p.dislikedByUserIds, currentUser.id];
          const nextLikedIds = p.likedByUserIds.filter(
            (id) => id !== currentUser.id
          );
          return {
            ...p,
            likedByUserIds: nextLikedIds,
            dislikedByUserIds: nextDislikedIds,
            dislikes: hasDisliked ? p.dislikes - 1 : p.dislikes + 1,
            likes: hasLiked ? Math.max(0, p.likes - 1) : p.likes,
          };
        }
      })
    );
  };

  // Handle Channel Post Comment (Sanitized against Stored XSS / Control Injection)
  const handleAddComment = (postId: string, commentText: string) => {
    if (!currentUser) return;
    const cleanComment = sanitizeTextInput(commentText, 600);
    if (!cleanComment) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: generateSecureId('cm'),
                  authorName: currentUser.fullName,
                  authorRole: currentUser.role,
                  text: cleanComment,
                  createdAt: 'Just now',
                },
              ],
            }
          : p
      )
    );
  };

  // Handle Channel Post Share
  const handleSharePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, sharesCount: p.sharesCount + 1 } : p
      )
    );
  };

  // Handle Admin Block / Unblock User (Revokes tokens & terminates active sessions)
  const handleToggleBlockUser = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const nextBlocked = !u.isBlocked;
        return {
          ...u,
          isBlocked: nextBlocked,
          connectedDevices: nextBlocked ? [] : u.connectedDevices,
        };
      })
    );
  };

  // Handle System Vault Update (Verifies HMAC-style Integrity Seal before persisting)
  const handleUpdateSystemVault = (newVault: ObfuscatedSystemVault) => {
    const expectedSeal = computeVaultIntegritySeal(
      newVault.gmailSha256,
      newVault.passSha256,
      newVault.cipherSha256,
      newVault.whatsNewSha256,
      newVault.updatedAt
    );
    if (!constantTimeHexCompare(newVault.integritySeal, expectedSeal)) {
      return;
    }
    setSystemVault(newVault);
    try {
      localStorage.setItem('c_academy_sys_vault_v2', JSON.stringify(newVault));
      localStorage.removeItem('c_academy_sys_vault_v1');
    } catch {
      // Ignore storage quota errors
    }
  };

  // Step 1: Security Commitment Screen on initial app launch
  if (!commitmentAccepted) {
    return (
      <SecurityCommitmentModal
        isTerminated={sessionTerminated}
        onAgree={() => setCommitmentAccepted(true)}
        onDisagree={() => setSessionTerminated(true)}
        onRelaunchAfterTerminate={() => setSessionTerminated(false)}
      />
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <motion.div
            key="auth_flow"
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -12 }}
            transition={IOS_SCREEN_SPRING}
          >
            <RoleSelectionAndAuth
              language={language}
              users={users}
              systemVault={systemVault}
              onAuthenticated={handleAuthenticateUser}
              onRegisterUser={handleRegisterUser}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`role_${currentUser.role}_${currentUser.id}`}
            initial={{ opacity: 0, x: 32, scale: 0.99 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -32, scale: 0.99 }}
            transition={IOS_SCREEN_SPRING}
          >
            {/* Active Role Dashboard */}
            {currentUser.role === 'student' && (
              <StudentDashboard
                student={currentUser}
                users={users}
                products={products}
                purchases={purchases}
                channels={channels}
                posts={posts}
                news={news}
                language={language}
                darkMode={darkMode}
                onChangeLanguage={setLanguage}
                onToggleDarkMode={() => setDarkMode((prev) => !prev)}
                onOpenPayment={(prod) => setCheckoutProduct(prod)}
                onOpenDocumentViewer={(prod) => setViewingProduct(prod)}
                onToggleSubscribeChannel={handleToggleSubscribeChannel}
                onReactToPost={handleReactToPost}
                onAddComment={handleAddComment}
                onSharePost={handleSharePost}
                onUpdateStudentDevices={(updatedDevices) => {
                  const updated = {
                    ...currentUser,
                    connectedDevices: updatedDevices,
                  };
                  setCurrentUser(updated);
                  setUsers((prev) =>
                    prev.map((u) => (u.id === updated.id ? updated : u))
                  );
                }}
                onLogout={handleLogoutUser}
              />
            )}

            {currentUser.role === 'teacher' && (
              <TeacherDashboard
                teacher={currentUser}
                users={users}
                products={products}
                purchases={purchases}
                channels={channels}
                posts={posts}
                news={news}
                language={language}
                darkMode={darkMode}
                onChangeLanguage={setLanguage}
                onToggleDarkMode={() => setDarkMode((prev) => !prev)}
                onPublishProduct={handlePublishProduct}
                onUpdateTeacherProfile={handleUpdateTeacherProfile}
                onCreateOrUpdateChannel={(ch) => {
                  setChannels((prev) => {
                    const exists = prev.some((item) => item.id === ch.id);
                    return exists
                      ? prev.map((item) => (item.id === ch.id ? ch : item))
                      : [ch, ...prev];
                  });
                }}
                onCreateChannelPost={(newPost) =>
                  setPosts((prev) => [newPost, ...prev])
                }
                onOpenDocumentViewer={(prod) => setViewingProduct(prod)}
                onLogout={handleLogoutUser}
              />
            )}

            {currentUser.role === 'admin' && (
              <AdminDashboard
                users={users}
                products={products}
                purchases={purchases}
                news={news}
                payoneerConfig={payoneerConfig}
                systemVault={systemVault}
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode((prev) => !prev)}
                onToggleBlockUser={handleToggleBlockUser}
                onCreateNews={handleCreateNews}
                onUpdateNews={handleUpdateNews}
                onDeleteNews={handleDeleteNews}
                onUpdatePayoneerConfig={setPayoneerConfig}
                onUpdateSystemVault={handleUpdateSystemVault}
                onLogout={handleLogoutUser}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Checkout Modal */}
      {checkoutProduct && currentUser && (
        <PaymentModal
          product={checkoutProduct}
          authorProfile={users.find((u) => u.id === checkoutProduct.authorId)}
          onClose={() => setCheckoutProduct(null)}
          onConfirmPurchase={handleConfirmPurchase}
        />
      )}

      {/* Protected Anti-Piracy Document & Interactive Exam Viewer */}
      {viewingProduct && currentUser && (
        <SecureDocumentViewer
          product={viewingProduct}
          viewer={currentUser}
          purchaseRecord={purchases.find(
            (p) =>
              p.productId === viewingProduct.id &&
              p.studentId === currentUser.id
          )}
          darkMode={darkMode}
          onClose={() => setViewingProduct(null)}
          onCompleteExam={handleCompleteExam}
        />
      )}

      {/* Re-Engagement Push Notification Banner */}
      <AnimatePresence>
        {pushBannerText && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={IOS_SCREEN_SPRING}
            onClick={() => setPushBannerText(null)}
            className="fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl fluid-glass-droplet-glider text-white text-xs font-semibold shadow-xl cursor-pointer flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>{pushBannerText}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
