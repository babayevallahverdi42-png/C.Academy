export type SupportedLanguage =
  | 'English'
  | 'Turkish'
  | 'Azerbaijani'
  | 'Russian'
  | 'Spanish'
  | 'Chinese'
  | 'Korean'
  | 'Persian'
  | 'Kazakh'
  | 'Portuguese';

export type OfficialSubject =
  | 'Math'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'Computer science'
  | 'Art'
  | 'Music'
  | 'Geography'
  | 'History'
  | 'Languages'
  | 'Literature'
  | 'Economy';

export type AcademicDegree =
  | 'Undergraduate'
  | 'Bachelor'
  | 'Master'
  | 'PhD'
  | 'Postdoctoral Fellow'
  | 'Professor';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface ConnectedDevice {
  id: string;
  name: string;
  platform: string;
  lastActive: string;
  location: string;
  isCurrentDevice: boolean;
}

export interface BankCardVault {
  maskedNumber: string; // XXXX-XXXX-XXXX-1234
  encryptedPayloadHash: string;
  cardHolder: string;
  expiry: string;
  addedAt: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  gmail: string;
  passwordHash: string;
  age: number;
  phone: string;
  biometricRegistered?: boolean;
  biometricMethod?: 'fingerprint' | 'face_id';
  biometricKeyId?: string;
  connectedDevices: ConnectedDevice[];
  // Teacher-specific fields
  academicDegree?: AcademicDegree;
  majorField?: string;
  teachingSubjects?: OfficialSubject[];
  isPremium?: boolean;
  monthlyPublishedCount?: number;
  bankCard?: BankCardVault | null;
  channelId?: string;
  // Gamification & Status
  examScore?: number; // Correct Exam Answers * 100
  correctExamAnswersTotal?: number;
  subscribersCount?: number;
  rating?: number;
  isBlocked: boolean;
  joinedAt: string;
}

export interface ExamQuestion {
  id: string;
  questionNumber: number;
  prompt: string;
  formulaOrContext?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface AcademicProduct {
  id: string;
  type: 'pdf' | 'exam';
  subject: OfficialSubject;
  topicName: string;
  auditorium: 'School' | 'University';
  price: number; // $0 to $60
  pageNumber: number;
  fileName: string;
  coverThumbnail: string; // Data URL or SVG theme key
  authorId: string;
  authorName: string;
  authorDegree: string;
  createdAt: string;
  salesCount: number;
  // Document reader content
  documentPages: {
    pageNumber: number;
    heading: string;
    bodyParagraphs: string[];
    keyFormula?: string;
  }[];
  // Exam questions (when type === 'exam')
  examQuestions?: ExamQuestion[];
}

export interface PurchasedRecord {
  id: string;
  productId: string;
  productType: 'pdf' | 'exam';
  studentId: string;
  studentName: string;
  purchasedAt: string; // ISO string
  expiresAt?: string; // ISO string (purchasedAt + 7 days for exams)
  pricePaid: number;
  teacherShare: number; // 80% standard or 78% premium
  platformShare: number; // 20% standard or 22% premium
  revenueSplitLabel: '80/20 Standard' | '78/22 Premium';
  examCompleted?: boolean;
  examCorrectCount?: number;
  examScoreAwarded?: number; // correct * 100
}

export interface ChannelComment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface ChannelPost {
  id: string;
  channelId: string;
  teacherId: string;
  teacherName: string;
  subject: OfficialSubject;
  title: string;
  content: string;
  linkedProductId?: string;
  likes: number;
  dislikes: number;
  likedByUserIds: string[];
  dislikedByUserIds: string[];
  comments: ChannelComment[];
  sharesCount: number;
  createdAt: string;
}

export interface TeacherChannel {
  id: string;
  teacherId: string;
  teacherName: string;
  majorSubject: OfficialSubject;
  academicDegree: string;
  bio: string;
  subscribersCount: number;
  subscriberIds: string[];
  rating: number;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  subject: OfficialSubject;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
  author: string;
  readTimeMinutes: number;
  isPinned?: boolean;
  coverImage?: string;
  updatedAt?: string;
}

export interface SystemPayoneerConfig {
  payoneerAccountId: string;
  maskedRoutingAccount: string;
  settlementCurrency: string;
  autoPayoutEnabled: boolean;
  standardPlatformCutPercent: number; // 20
  premiumPlatformCutPercent: number; // 22
  lastUpdated: string;
}

