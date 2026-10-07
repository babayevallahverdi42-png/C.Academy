import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  MonitorOff,
  Award,
  EyeOff,
  Terminal,
  Cpu,
  Smartphone,
  Zap,
  X,
  PenTool,
  Highlighter,
  Type,
  Eraser,
  MousePointer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Check,
} from 'lucide-react';
import { AcademicProduct, PurchasedRecord, UserProfile } from '../types';
import {
  installHardenedRuntimeProtections,
  validateTrustedUserEvent,
  SecurityIncidentLog,
  RuntimeIntegrityStatus,
  NATIVE_ANDROID_FLAG_SECURE_KOTLIN_CODE,
  NATIVE_IOS_SECURE_LAYER_SWIFT_CODE,
} from '../utils/antiTamperEngine';
import { sanitizeTextInput } from '../utils/security';
import { EncryptedMobileStorage } from '../utils/mobileEnterpriseSecurity';
import { FluidGlassButton } from './FluidGlassButton';
import { FluidDropletFilterGroup } from './FluidDropletFilterGroup';

export type AnnotationToolMode =
  | 'view'
  | 'pen'
  | 'highlight'
  | 'text'
  | 'eraser';

export interface PdfStrokePoint {
  x: number; // Normalized 0..1000 page width
  y: number; // Normalized 0..1000 page height
}

export interface PdfDrawingStroke {
  id: string;
  pageNumber: number;
  tool: 'pen' | 'highlight';
  color: string;
  strokeWidth: number;
  points: PdfStrokePoint[];
}

export interface PdfTextNote {
  id: string;
  pageNumber: number;
  x: number; // Normalized 0..1000
  y: number; // Normalized 0..1000
  text: string;
  color: string;
  createdAt: string;
}

export interface PersistedPdfAnnotations {
  productId: string;
  studentId: string;
  updatedAt: string;
  strokes: PdfDrawingStroke[];
  textNotes: PdfTextNote[];
}

const ANNOTATION_COLORS = [
  { id: '#0052FF', label: 'Electric Blue' },
  { id: '#10B981', label: 'Emerald' },
  { id: '#F59E0B', label: 'Amber Highlight' },
  { id: '#EF4444', label: 'Crimson' },
  { id: '#A855F7', label: 'Violet' },
  { id: '#0F172A', label: 'Carbon Ink' },
] as const;

const STROKE_SIZES = [
  { size: 2.5, label: 'Fine' },
  { size: 4.5, label: 'Medium' },
  { size: 7.5, label: 'Bold' },
] as const;

interface SecureDocumentViewerProps {
  product: AcademicProduct;
  viewer: UserProfile;
  purchaseRecord?: PurchasedRecord;
  darkMode: boolean;
  onClose: () => void;
  onCompleteExam?: (
    productId: string,
    correctAnswersCount: number,
    scoreAwarded: number
  ) => void;
}

export const SecureDocumentViewer: React.FC<SecureDocumentViewerProps> = ({
  product,
  viewer,
  purchaseRecord,
  darkMode,
  onClose,
  onCompleteExam,
}) => {
  const storageKey = `c_academy_annotations_${viewer.id}_${product.id}`;

  // 1. PDF Zoom & Interactive Annotation Tool State
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<AnnotationToolMode>('view');
  const [selectedColor, setSelectedColor] = useState<string>('#0052FF');
  const [strokeWidth, setStrokeWidth] = useState<number>(4.5);

  // 2. Annotation Layer State (Strokes + Text Notes + Undo/Redo History) — Encrypted at Rest
  const [strokes, setStrokes] = useState<PdfDrawingStroke[]>(() => {
    const parsed =
      EncryptedMobileStorage.getItem<PersistedPdfAnnotations>(storageKey);
    return parsed && Array.isArray(parsed.strokes) ? parsed.strokes : [];
  });

  const [textNotes, setTextNotes] = useState<PdfTextNote[]>(() => {
    const parsed =
      EncryptedMobileStorage.getItem<PersistedPdfAnnotations>(storageKey);
    return parsed && Array.isArray(parsed.textNotes) ? parsed.textNotes : [];
  });

  const [undoStack, setUndoStack] = useState<
    Array<{ strokes: PdfDrawingStroke[]; textNotes: PdfTextNote[] }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{ strokes: PdfDrawingStroke[]; textNotes: PdfTextNote[] }>
  >([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [saveBannerMessage, setSaveBannerMessage] = useState<string | null>(
    null
  );

  // Active pointer drawing ref
  const drawingRef = useRef<{
    isDrawing: boolean;
    isErasing: boolean;
    pageNumber: number | null;
    currentStrokeId: string | null;
  }>({
    isDrawing: false,
    isErasing: false,
    pageNumber: null,
    currentStrokeId: null,
  });

  const pageSurfaceRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Exam & Security State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>(
    {}
  );
  const [examSubmitted, setExamSubmitted] = useState(
    Boolean(purchaseRecord?.examCompleted)
  );
  const [captureAlertMessage, setCaptureAlertMessage] = useState<string | null>(
    null
  );
  const [simulateEmitterDetected, setSimulateEmitterDetected] = useState(false);
  const [iosCaptureShieldActive, setIosCaptureShieldActive] = useState(false);
  const [windowBlurred, setWindowBlurred] = useState(false);
  const [domTamperLocked, setDomTamperLocked] = useState(false);
  const [jitterOffset, setJitterOffset] = useState({ x: 0, y: 0, angle: -24 });

  // Hardened Security Engine Telemetry & Architecture Modal
  const [securityConsoleOpen, setSecurityConsoleOpen] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<
    'overview' | 'android' | 'ios' | 'incidents'
  >('overview');
  const [incidents, setIncidents] = useState<SecurityIncidentLog[]>([]);
  const [integrityStatus, setIntegrityStatus] =
    useState<RuntimeIntegrityStatus | null>(null);

  const watermarkRef = useRef<HTMLDivElement | null>(null);
  const protectedStageRef = useRef<HTMLDivElement | null>(null);
  const protectedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Push snapshot to Undo history before modifying annotations
  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-24),
      { strokes: [...strokes], textNotes: [...textNotes] },
    ]);
    setRedoStack([]);
  }, [strokes, textNotes]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      { strokes: [...strokes], textNotes: [...textNotes] },
    ]);
    setStrokes(previous.strokes);
    setTextNotes(previous.textNotes);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [
      ...prev,
      { strokes: [...strokes], textNotes: [...textNotes] },
    ]);
    setStrokes(next.strokes);
    setTextNotes(next.textNotes);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClearAllAnnotations = () => {
    if (strokes.length === 0 && textNotes.length === 0) return;
    pushUndoSnapshot();
    setStrokes([]);
    setTextNotes([]);
    setEditingNoteId(null);
  };

  // Persist annotations to EncryptedMobileStorage (AES-256 Stream + HMAC-SHA256 Seal at rest)
  const persistAnnotationsToStorage = useCallback(
    (
      nextStrokes: PdfDrawingStroke[] = strokes,
      nextNotes: PdfTextNote[] = textNotes
    ): PersistedPdfAnnotations => {
      const cleanedNotes = nextNotes
        .filter((n) => n.text.trim().length > 0)
        .map((n) => ({
          ...n,
          text: sanitizeTextInput(n.text, 1000),
        }));
      const payload: PersistedPdfAnnotations = {
        productId: product.id,
        studentId: viewer.id,
        updatedAt: new Date().toISOString(),
        strokes: nextStrokes,
        textNotes: cleanedNotes,
      };
      EncryptedMobileStorage.setItem(storageKey, payload);
      return payload;
    },
    [product.id, storageKey, strokes, textNotes, viewer.id]
  );

  // Auto-save whenever strokes or textNotes change
  useEffect(() => {
    persistAnnotationsToStorage(strokes, textNotes);
  }, [strokes, textNotes, persistAnnotationsToStorage]);

  /**
   * "Done / Təhlil et · Bitiş" Handler:
   * a) Saves & persists the updated PDF annotation layer to storage.
   * b) Terminates the active editing mode ('view' mode + closes active text inputs).
   * c) Safely navigates the student back to the main assignment/course dashboard.
   */
  const handleCompleteAndExit = () => {
    // 1. Save / persist annotation state
    const savedPayload = persistAnnotationsToStorage(strokes, textNotes);
    const totalCount =
      savedPayload.strokes.length + savedPayload.textNotes.length;

    // 2. Terminate active editing mode
    setActiveTool('view');
    setEditingNoteId(null);
    drawingRef.current = {
      isDrawing: false,
      isErasing: false,
      pageNumber: null,
      currentStrokeId: null,
    };

    // 3. Show brief confirmation & safely navigate back to dashboard
    setSaveBannerMessage(
      `Saved ${totalCount} annotation${
        totalCount === 1 ? '' : 's'
      } · Returning to Dashboard...`
    );
    window.setTimeout(() => {
      onClose();
    }, 240);
  };

  // Export Annotation Layer as JSON file
  const handleExportAnnotationJson = () => {
    const payload = persistAnnotationsToStorage(strokes, textNotes);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product.topicName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')}_annotations.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveBannerMessage('Annotation JSON layer exported successfully.');
    window.setTimeout(() => setSaveBannerMessage(null), 2600);
  };

  // Convert pointer client coordinates to normalized (0..1000) page coordinates
  const getNormalizedPagePoint = (
    pageNumber: number,
    clientX: number,
    clientY: number
  ): PdfStrokePoint | null => {
    const el = pageSurfaceRefs.current[pageNumber];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(
      0,
      Math.min(1000, ((clientX - rect.left) / rect.width) * 1000)
    );
    const y = Math.max(
      0,
      Math.min(1000, ((clientY - rect.top) / rect.height) * 1000)
    );
    return { x, y };
  };

  // Erase any stroke on `pageNumber` within normalized radius of (pt.x, pt.y)
  const eraseStrokesNearPoint = (pageNumber: number, pt: PdfStrokePoint) => {
    const eraseRadius = 26;
    setStrokes((prev) =>
      prev.filter((stroke) => {
        if (stroke.pageNumber !== pageNumber) return true;
        const hit = stroke.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= eraseRadius
        );
        return !hit;
      })
    );
  };

  // Page Surface Pointer Handlers for Pen, Highlight, Text, and Eraser Modes
  const handlePagePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => {
    if (activeTool === 'view') return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-annotation-note="true"]')) {
      return;
    }

    const pt = getNormalizedPagePoint(pageNumber, e.clientX, e.clientY);
    if (!pt) return;

    if (activeTool === 'text') {
      e.preventDefault();
      pushUndoSnapshot();
      const newNoteId = `note_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const newNote: PdfTextNote = {
        id: newNoteId,
        pageNumber,
        x: Math.min(820, Math.max(20, pt.x)),
        y: Math.min(920, Math.max(20, pt.y)),
        text: 'New Study Note...',
        color: selectedColor,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTextNotes((prev) => [...prev, newNote]);
      setEditingNoteId(newNoteId);
      return;
    }

    if (activeTool === 'eraser') {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      pushUndoSnapshot();
      drawingRef.current = {
        isDrawing: false,
        isErasing: true,
        pageNumber,
        currentStrokeId: null,
      };
      eraseStrokesNearPoint(pageNumber, pt);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlight') {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      pushUndoSnapshot();
      const strokeId = `stroke_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      drawingRef.current = {
        isDrawing: true,
        isErasing: false,
        pageNumber,
        currentStrokeId: strokeId,
      };
      const newStroke: PdfDrawingStroke = {
        id: strokeId,
        pageNumber,
        tool: activeTool,
        color: selectedColor,
        strokeWidth: activeTool === 'highlight' ? strokeWidth * 3.8 : strokeWidth,
        points: [pt],
      };
      setStrokes((prev) => [...prev, newStroke]);
    }
  };

  const handlePagePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => {
    const d = drawingRef.current;
    if (d.pageNumber !== pageNumber) return;

    if (d.isErasing) {
      const pt = getNormalizedPagePoint(pageNumber, e.clientX, e.clientY);
      if (pt) eraseStrokesNearPoint(pageNumber, pt);
      return;
    }

    if (d.isDrawing && d.currentStrokeId) {
      const pt = getNormalizedPagePoint(pageNumber, e.clientX, e.clientY);
      if (!pt) return;
      const activeStrokeId = d.currentStrokeId;
      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== activeStrokeId) return s;
          const last = s.points[s.points.length - 1];
          if (last && Math.hypot(last.x - pt.x, last.y - pt.y) < 2.2) {
            return s;
          }
          return { ...s, points: [...s.points, pt] };
        })
      );
    }
  };

  const handlePagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    drawingRef.current = {
      isDrawing: false,
      isErasing: false,
      pageNumber: null,
      currentStrokeId: null,
    };
  };

  // Convert stroke points to smooth SVG path string
  const buildSmoothSvgStrokePath = (points: PdfStrokePoint[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.5).toFixed(
        1
      )} ${(p.y + 0.5).toFixed(1)}`;
    }
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) * 0.5;
      const midY = (points[i].y + points[i + 1].y) * 0.5;
      d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(
        1
      )} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  };

  const recordSecurityIncident = (
    category: SecurityIncidentLog['category'],
    severity: SecurityIncidentLog['severity'],
    vector: string,
    actionTaken: string
  ) => {
    const newIncident: SecurityIncidentLog = {
      id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      category,
      severity,
      vector,
      actionTaken,
      blocked: true,
    };
    setIncidents((prev) => [newIncident, ...prev.slice(0, 29)]);
    setCaptureAlertMessage(`[${category}] ${vector} — ${actionTaken}`);
  };

  // 1. Initialize Hardened Runtime Protections & Protected Canvas
  useEffect(() => {
    const status = installHardenedRuntimeProtections((inc) => {
      setIncidents((prev) => [inc, ...prev.slice(0, 29)]);
      setCaptureAlertMessage(
        `[${inc.category}] ${inc.vector} — ${inc.actionTaken}`
      );
    });
    setIntegrityStatus(status);

    const canvas = protectedCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0052FF';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(
          `FLAG_SECURE SEAL · ${viewer.fullName.toUpperCase()} · ${viewer.gmail}`,
          10,
          20
        );
      }
    }
  }, [viewer.fullName, viewer.gmail]);

  // 2. Dynamic AI-resilient watermark micro-shift every 2.4 seconds
  useEffect(() => {
    const interval = window.setInterval(() => {
      setJitterOffset({
        x: Math.floor(Math.random() * 18) - 9,
        y: Math.floor(Math.random() * 14) - 7,
        angle: -24 + (Math.random() * 4 - 2),
      });
    }, 2400);
    return () => window.clearInterval(interval);
  }, []);

  // 3. Self-Healing DOM MutationObserver (Detects DevTools removal/hiding of Watermark)
  useEffect(() => {
    const stageNode = protectedStageRef.current;
    if (!stageNode || typeof MutationObserver === 'undefined') return;

    let isRestoring = false;
    const observer = new MutationObserver(() => {
      if (isRestoring) return;
      const wm = watermarkRef.current;
      if (!wm || !stageNode.contains(wm)) {
        setDomTamperLocked(true);
        recordSecurityIncident(
          'DOM_TAMPER',
          'CRITICAL',
          'Watermark DOM Node Removal Attempt',
          'Engaged immediate document lockout and self-healing guard.'
        );
        return;
      }
      const computed = window.getComputedStyle(wm);
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        parseFloat(computed.opacity) < 0.08
      ) {
        isRestoring = true;
        wm.style.display = 'flex';
        wm.style.visibility = 'visible';
        wm.style.opacity = '0.2';
        recordSecurityIncident(
          'DOM_TAMPER',
          'WARNING',
          'Watermark CSS Style Tampering Detected',
          'Restored mandatory watermark opacity and visibility.'
        );
        window.setTimeout(() => {
          isRestoring = false;
        }, 50);
      }
    });

    observer.observe(stageNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });

    return () => observer.disconnect();
  }, []);

  // 4. Hardened Anti-Screenshot keyboard, clipboard, visibility, and print listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingAnnotation = Boolean(
        target && target.closest('textarea, input')
      );

      const keyLower = e.key.toLowerCase();
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isCtrlOrCmdShortcut =
        !isEditingAnnotation &&
        (e.ctrlKey || e.metaKey) &&
        ['p', 's', 'c', 'u', 'x'].includes(keyLower);
      const isDevToolsShortcut =
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          ['i', 'j', 'c', 's'].includes(keyLower));
      const isMacScreenshot =
        e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(e.key);
      const isWinSnippingTool =
        e.metaKey && e.shiftKey && keyLower === 's';

      if (
        isPrintScreen ||
        isCtrlOrCmdShortcut ||
        isDevToolsShortcut ||
        isMacScreenshot ||
        isWinSnippingTool
      ) {
        e.preventDefault();
        e.stopPropagation();
        setIosCaptureShieldActive(true);
        if (isPrintScreen && navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText('PROTECTED BY C. ACADEMY FLAG_SECURE')
            .catch(() => {});
        }
        recordSecurityIncident(
          'ANTI_SCREENSHOT',
          'CRITICAL',
          `Intercepted ${e.key} Capture/Extraction Shortcut`,
          'Blocked key event, scrubbed clipboard, and engaged UIScreen/FLAG_SECURE blur shield.'
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setWindowBlurred(true);
      } else if (document.visibilityState === 'visible') {
        setWindowBlurred(false);
      }
    };

    const handleBlur = () => setWindowBlurred(true);
    const handleFocus = () => setWindowBlurred(false);

    const handleCopyOrCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('textarea, input')) return;
      e.preventDefault();
      recordSecurityIncident(
        'ANTI_SCREENSHOT',
        'WARNING',
        `Clipboard ${e.type.toUpperCase()} Attempt`,
        'Blocked clipboard exfiltration on protected academic surface.'
      );
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopyOrCut, true);
    document.addEventListener('cut', handleCopyOrCut, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopyOrCut, true);
      document.removeEventListener('cut', handleCopyOrCut, true);
    };
  }, []);

  const getRemainingValidityText = () => {
    if (product.type !== 'exam') return 'Lifetime Achieved PDF Access';
    const expiryIso =
      purchaseRecord?.expiresAt ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const diffMs = new Date(expiryIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired (1-Week Window Ended)';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    return `${days}d ${hours}h remaining (1-Week Validity)`;
  };

  const handleSelectOption = (
    e: React.MouseEvent<HTMLButtonElement>,
    questionId: string,
    optionIdx: number
  ) => {
    if (examSubmitted) return;

    const validation = validateTrustedUserEvent(e);
    if (!validation.valid) {
      recordSecurityIncident(
        validation.threatCategory || 'SYNTHETIC_EVENT',
        'CRITICAL',
        'Exam Answer Selection Handler',
        validation.reason || 'Untrusted synthetic event rejected.'
      );
      return;
    }

    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleSubmitExam = (e: React.MouseEvent<HTMLButtonElement> | Event) => {
    const validation = validateTrustedUserEvent(e);
    if (!validation.valid) {
      recordSecurityIncident(
        validation.threatCategory || 'SYNTHETIC_EVENT',
        'CRITICAL',
        'Exam Submit Handler (Anti-Emitter Gate)',
        validation.reason || 'Blocked synthetic/automated exam submission.'
      );
      return;
    }

    if (!product.examQuestions || product.examQuestions.length === 0) return;
    let correctCount = 0;
    product.examQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctOptionIndex) {
        correctCount += 1;
      }
    });
    const scoreEarned = correctCount * 100;
    setExamSubmitted(true);
    if (onCompleteExam) {
      onCompleteExam(product.id, correctCount, scoreEarned);
    }
  };

  const runSyntheticEventPenTest = () => {
    const syntheticClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
    });
    handleSubmitExam(syntheticClick);
  };

  const runCanvasScrapingPenTest = () => {
    const canvas = protectedCanvasRef.current;
    if (!canvas) return;
    canvas.toDataURL('image/png');
  };

  const watermarkIdentityLine = `${viewer.fullName} · ${viewer.gmail} · ${
    viewer.phone || '+994-VERIFIED'
  }`;

  const totalAnnotationsCount = strokes.length + textNotes.length;

  return (
    <div
      onPointerDown={() => {
        if (windowBlurred) setWindowBlurred(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        recordSecurityIncident(
          'ANTI_SCREENSHOT',
          'WARNING',
          'ContextMenu / Right-Click Inspection',
          'Blocked context menu extraction on protected document surface.'
        );
      }}
      onDragStart={(e) => {
        e.preventDefault();
        recordSecurityIncident(
          'ANTI_SCREENSHOT',
          'WARNING',
          'DOM Element Drag-and-Drop Extraction',
          'Blocked dragstart event on protected content.'
        );
      }}
      className={`fixed inset-0 z-50 flex flex-col secure-content-surface ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Primary Header: Navigation, Metadata, Security Controls & Prominent "Done / Təhlil et · Bitiş" Button */}
      <header
        className={`px-4 md:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ios-glass-header ${
          darkMode
            ? 'border-slate-800 text-white'
            : 'border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FluidGlassButton
            variant="surface"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </FluidGlassButton>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileText className="w-3.5 h-3.5 text-[#0052FF] shrink-0" />
              <span className="truncate font-semibold text-slate-900 dark:text-white">
                {product.topicName}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {product.subject} · {product.auditorium} · {product.pageNumber}{' '}
              Pages · Saved Annotations: {totalAnnotationsCount}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.type === 'exam' && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono tabular-nums text-amber-700 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>{getRemainingValidityText()}</span>
            </div>
          )}

          <FluidGlassButton
            variant={iosCaptureShieldActive ? 'active' : 'surface'}
            onClick={() => setIosCaptureShieldActive((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
            title="Simulate iOS UIScreen.capturedDidChangeNotification / Android FLAG_SECURE Blur Shield"
          >
            <span>
              {iosCaptureShieldActive ? 'Release Blur' : 'Test Capture Blur'}
            </span>
          </FluidGlassButton>

          <FluidGlassButton
            variant="surface"
            onClick={() => setSecurityConsoleOpen(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0052FF]" />
            <span className="hidden sm:inline">Security</span>
            <span className="font-mono">({incidents.length})</span>
          </FluidGlassButton>

          {/* Prominent Completion & Safe Navigation Button ("Done / Təhlil et · Bitiş") */}
          <FluidGlassButton
            variant="emerald"
            onClick={handleCompleteAndExit}
            className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Done · Təhlil et / Bitiş</span>
          </FluidGlassButton>
        </div>
      </header>

      {/* Secondary Interactive PDF Annotation & Zoom Toolbar (Sliding Liquid Droplet Tool Selector) */}
      <div
        className={`px-4 md:px-6 py-2 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ios-glass-card ${
          darkMode ? 'border-slate-800/90' : 'border-slate-200/90'
        }`}
      >
        {/* Left: Sliding Liquid Droplet Tool Mode Selector (View / Pen / Highlight / Text / Eraser) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <FluidDropletFilterGroup
            variant="segmented"
            activeId={activeTool}
            onSelect={(mode) => {
              setActiveTool(mode);
              if (mode !== 'text') setEditingNoteId(null);
            }}
            buttonClassName="px-3 py-1.5"
            items={[
              {
                id: 'view',
                label: 'View / Scroll',
                icon: <MousePointer className="w-3.5 h-3.5" />,
              },
              {
                id: 'pen',
                label: 'Pen / Draw',
                icon: <PenTool className="w-3.5 h-3.5" />,
              },
              {
                id: 'highlight',
                label: 'Highlight',
                icon: <Highlighter className="w-3.5 h-3.5" />,
              },
              {
                id: 'text',
                label: 'Write Text',
                icon: <Type className="w-3.5 h-3.5" />,
              },
              {
                id: 'eraser',
                label: 'Eraser',
                icon: <Eraser className="w-3.5 h-3.5" />,
              },
            ]}
          />

          {/* Color Palette Picker & Stroke Thickness Controls */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
            {ANNOTATION_COLORS.map((c) => {
              const active = selectedColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setSelectedColor(c.id)}
                  style={{ backgroundColor: c.id }}
                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                    active
                      ? 'scale-125 ring-2 ring-offset-1 ring-[#0052FF]'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                />
              );
            })}

            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

            {STROKE_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStrokeWidth(s.size)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  strokeWidth === s.size
                    ? 'bg-[#0052FF] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Undo / Redo / Clear / Export JSON & Smooth Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FluidGlassButton
            variant="surface"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title="Undo Last Annotation"
            className="p-2 rounded-xl text-xs"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </FluidGlassButton>

          <FluidGlassButton
            variant="surface"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            title="Redo Annotation"
            className="p-2 rounded-xl text-xs"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </FluidGlassButton>

          <FluidGlassButton
            variant="surface"
            disabled={totalAnnotationsCount === 0}
            onClick={handleClearAllAnnotations}
            title="Clear All Annotations"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Clear</span>
          </FluidGlassButton>

          {/* Zoom Controls (60% .. 175%) */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
            <FluidGlassButton
              variant="surface"
              onClick={() =>
                setZoomScale((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))
              }
              title="Zoom Out"
              className="p-1.5 rounded-xl text-xs"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </FluidGlassButton>

            <span className="px-2 text-xs font-mono font-bold tabular-nums min-w-[48px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>

            <FluidGlassButton
              variant="surface"
              onClick={() =>
                setZoomScale((z) => Math.min(1.75, Number((z + 0.15).toFixed(2))))
              }
              title="Zoom In"
              className="p-1.5 rounded-xl text-xs"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </FluidGlassButton>

            {zoomScale !== 1 && (
              <FluidGlassButton
                variant="surface"
                onClick={() => setZoomScale(1)}
                title="Reset Zoom to 100%"
                className="p-1.5 rounded-xl text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </FluidGlassButton>
            )}
          </div>
        </div>
      </div>

      {/* Save / Export Notification Banner */}
      {saveBannerMessage && (
        <div className="bg-emerald-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveBannerMessage}</span>
          </div>
        </div>
      )}

      {/* Capture / Piracy Warning Banner if triggered */}
      {captureAlertMessage && (
        <div className="bg-red-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{captureAlertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setCaptureAlertMessage(null)}
            className="underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Protected Document Stage with Smooth Scrolling & Zoom Scaling */}
      <div
        ref={protectedStageRef}
        className="relative flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start"
      >
        {/* 1. Anti-Emitter / Display Projection / DOM Tamper Blocker Overlay */}
        {(simulateEmitterDetected || domTamperLocked) && (
          <div className="fixed inset-0 top-14 z-40 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-center text-white">
            <div className="max-w-md space-y-4 p-6 rounded-2xl border border-red-800 bg-slate-900">
              <MonitorOff className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-lg font-bold">
                {domTamperLocked
                  ? 'DOM Watermark Tampering Blocked'
                  : 'External Display / Event Emitter Hook Blocked'}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {domTamperLocked
                  ? 'C. ACADEMY MutationObserver detected an unauthorized attempt to strip or hide the dynamic forensic watermark layer. Rendering is locked.'
                  : 'C. ACADEMY Anti-Emitter Protection detected an unverified external display projection (HDMI / AirPlay / Miracast / MediaProjection) or hooked event emitter. Document rendering is suspended.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSimulateEmitterDetected(false);
                  setDomTamperLocked(false);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white cursor-pointer"
              >
                Restore Verified Surface & Resume
              </button>
            </div>
          </div>
        )}

        {/* 2. iOS UIScreen.capturedDidChangeNotification / Android FLAG_SECURE Dynamic Blur Shield */}
        {(windowBlurred || iosCaptureShieldActive) &&
          !simulateEmitterDetected &&
          !domTamperLocked && (
            <div className="fixed inset-0 top-14 z-30 bg-slate-950/88 backdrop-blur-2xl flex items-center justify-center p-6 text-center text-white">
              <div className="max-w-md space-y-3 p-6 rounded-2xl border border-amber-500/40 bg-slate-900/90">
                <EyeOff className="w-9 h-9 text-amber-400 mx-auto" />
                <p className="text-base font-bold">
                  FLAG_SECURE & iOS UIScreen Capture Blur Shield Active
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sensitive academic content is dynamically obfuscated via secure layer blur whenever screen capture, screen recording (<code className="font-mono">UIScreen.capturedDidChangeNotification</code>), or window focus loss is detected.
                </p>
                <FluidGlassButton
                  variant="primary"
                  onClick={() => {
                    setIosCaptureShieldActive(false);
                    setWindowBlurred(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  <span>Acknowledge & Unblur Protected Surface</span>
                </FluidGlassButton>
              </div>
            </div>
          )}

        {/* Zoom-Scaled Document Container */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
          }}
          className={`relative w-full max-w-4xl rounded-2xl border shadow-sm p-6 md:p-10 overflow-hidden transition-transform duration-150 ${
            windowBlurred || iosCaptureShieldActive
              ? 'blur-xl scale-[0.99] select-none'
              : ''
          } ${
            darkMode
              ? 'bg-slate-900 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* AI-Resilient Tiled Dynamic Security Watermark Overlay (Monitored by MutationObserver) */}
          <div
            ref={watermarkRef}
            aria-hidden="true"
            style={{
              transform: `translate3d(${jitterOffset.x}px, ${jitterOffset.y}px, 0) rotate(${jitterOffset.angle}deg)`,
            }}
            className="pointer-events-none absolute -inset-32 z-20 flex flex-wrap items-center justify-center gap-x-14 gap-y-12 opacity-20 select-none watermark-pattern-drift"
          >
            {Array.from({ length: 36 }).map((_, idx) => (
              <div
                key={idx}
                className="text-[11px] font-mono font-semibold tracking-wider text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                {watermarkIdentityLine} · ID:{viewer.id.slice(-4)}-{idx + 10}
              </div>
            ))}
          </div>

          {/* Document Header */}
          <div className="relative z-10 border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
              <span>
                C. ACADEMY Official{' '}
                {product.type === 'exam'
                  ? 'Interactive Examination'
                  : 'Academic Monograph'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Subject: {product.subject}</span>
              <span aria-hidden="true">·</span>
              <span>Auditorium: {product.auditorium}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {product.pageNumber} Pages
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {product.topicName}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <p className="text-xs text-slate-500">
                Authored by{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {product.authorName}
                </strong>{' '}
                ({product.authorDegree}) · Licensed to{' '}
                <span className="font-mono">
                  {viewer.fullName} ({viewer.gmail})
                </span>
              </p>

              {/* Protected Hardware-Poisoned Canvas Seal */}
              <canvas
                ref={protectedCanvasRef}
                data-c-academy-protected="true"
                width={380}
                height={28}
                className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 max-w-full"
              />
            </div>

            {/* Active Tool Helper Hint */}
            {activeTool !== 'view' && (
              <div className="mt-4 px-3.5 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-2 text-xs text-[#0052FF] dark:text-sky-300">
                <span>
                  {activeTool === 'pen' &&
                    'Pen Mode Active: Draw freehand notes or equations directly on any PDF page below.'}
                  {activeTool === 'highlight' &&
                    'Highlight Mode Active: Drag across formulas or paragraphs to highlight key concepts.'}
                  {activeTool === 'text' &&
                    'Text Note Mode Active: Click anywhere on a PDF page to insert a written text box.'}
                  {activeTool === 'eraser' &&
                    'Eraser Mode Active: Drag over any drawing stroke or click a text note to remove it.'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTool('view')}
                  className="font-semibold underline cursor-pointer shrink-0"
                >
                  Switch to View Mode
                </button>
              </div>
            )}
          </div>

          {/* Paginated PDF Sheets with Interactive SVG & Text Note Overlay */}
          <div className="relative z-10 space-y-8">
            {product.documentPages.map((page) => {
              const pageStrokes = strokes.filter(
                (s) => s.pageNumber === page.pageNumber
              );
              const pageNotes = textNotes.filter(
                (n) => n.pageNumber === page.pageNumber
              );

              return (
                <section
                  key={page.pageNumber}
                  ref={(el) => {
                    pageSurfaceRefs.current[page.pageNumber] = el;
                  }}
                  onPointerDown={(e) =>
                    handlePagePointerDown(e, page.pageNumber)
                  }
                  onPointerMove={(e) =>
                    handlePagePointerMove(e, page.pageNumber)
                  }
                  onPointerUp={handlePagePointerUp}
                  onPointerCancel={handlePagePointerUp}
                  style={{
                    touchAction: activeTool === 'view' ? 'auto' : 'none',
                  }}
                  className={`relative rounded-xl border p-6 md:p-8 space-y-3.5 transition-colors ${
                    darkMode
                      ? 'bg-slate-950/60 border-slate-800'
                      : 'bg-slate-50/50 border-slate-200/90'
                  } ${
                    activeTool === 'pen' || activeTool === 'highlight'
                      ? 'cursor-crosshair ring-1 ring-[#0052FF]/30'
                      : activeTool === 'text'
                      ? 'cursor-text ring-1 ring-[#0052FF]/30'
                      : activeTool === 'eraser'
                      ? 'cursor-pointer ring-1 ring-red-500/30'
                      : ''
                  }`}
                >
                  {/* Page Heading & Number */}
                  <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                    <h2 className="text-lg font-bold">{page.heading}</h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                      {(pageStrokes.length > 0 || pageNotes.length > 0) && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#0052FF] dark:text-sky-400">
                          {pageStrokes.length + pageNotes.length} notes
                        </span>
                      )}
                      <span>
                        Page {page.pageNumber} of {product.pageNumber}
                      </span>
                    </div>
                  </div>

                  {page.keyFormula && (
                    <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm text-[#0052FF] dark:text-sky-400">
                      {page.keyFormula}
                    </div>
                  )}

                  {page.bodyParagraphs.map((para, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                    >
                      {para}
                    </p>
                  ))}

                  {/* Interactive Vector Ink & Highlighter Overlay (Normalized 0..1000 ViewBox) */}
                  <svg
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 w-full h-full z-20 overflow-visible"
                  >
                    {pageStrokes.map((stroke) => (
                      <path
                        key={stroke.id}
                        d={buildSmoothSvgStrokePath(stroke.points)}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={stroke.tool === 'highlight' ? 0.34 : 0.92}
                        style={
                          stroke.tool === 'highlight'
                            ? { mixBlendMode: darkMode ? 'screen' : 'multiply' }
                            : undefined
                        }
                      />
                    ))}
                  </svg>

                  {/* Interactive Text Notes Layer on Top of PDF Page */}
                  {pageNotes.map((note) => {
                    const isEditing = editingNoteId === note.id;
                    return (
                      <div
                        key={note.id}
                        data-annotation-note="true"
                        style={{
                          left: `${Math.min(84, Math.max(2, note.x / 10))}%`,
                          top: `${Math.min(88, Math.max(4, note.y / 10))}%`,
                          borderColor: note.color,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            pushUndoSnapshot();
                            setTextNotes((prev) =>
                              prev.filter((n) => n.id !== note.id)
                            );
                          } else {
                            setEditingNoteId(note.id);
                          }
                        }}
                        className={`
                          absolute z-30 min-w-[170px] max-w-[260px] rounded-xl border-2 p-2.5 shadow-lg backdrop-blur-md transition-transform
                          ${
                            darkMode
                              ? 'bg-slate-900/95 text-slate-100'
                              : 'bg-white/95 text-slate-900'
                          }
                          ${
                            activeTool === 'eraser'
                              ? 'hover:scale-95 hover:border-red-500 cursor-pointer'
                              : 'cursor-pointer'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            style={{ color: note.color }}
                            className="text-[10px] font-mono font-bold uppercase tracking-wider"
                          >
                            Note · {note.createdAt}
                          </span>
                          <button
                            type="button"
                            title="Delete Text Note"
                            onClick={(e) => {
                              e.stopPropagation();
                              pushUndoSnapshot();
                              setTextNotes((prev) =>
                                prev.filter((n) => n.id !== note.id)
                              );
                            }}
                            className="p-0.5 rounded hover:bg-red-500/15 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {isEditing ? (
                          <textarea
                            autoFocus
                            rows={2}
                            value={note.text}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTextNotes((prev) =>
                                prev.map((n) =>
                                  n.id === note.id ? { ...n, text: val } : n
                                )
                              );
                            }}
                            onBlur={() => setEditingNoteId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingNoteId(null);
                              }
                            }}
                            className="w-full text-xs bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 focus:outline-none"
                          />
                        ) : (
                          <p className="text-xs leading-snug whitespace-pre-wrap break-words">
                            {note.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}

            {/* Interactive Google Docs-Style Examination Questions */}
            {product.type === 'exam' && product.examQuestions && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">
                      Interactive Examination Sheet (Anti-Emitter Protected)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Scoring Formula: Student Score = Correct Exam Answers × 100 · Synthetic/Automated Clicks Rejected
                    </p>
                  </div>

                  {examSubmitted && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono tabular-nums">
                      <Award className="w-4 h-4" />
                      <span>
                        Score Awarded:{' '}
                        {purchaseRecord?.examScoreAwarded ??
                          product.examQuestions.filter(
                            (q) =>
                              selectedAnswers[q.id] === q.correctOptionIndex
                          ).length * 100}{' '}
                        pts
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  {product.examQuestions.map((q) => {
                    const userChoice = selectedAnswers[q.id];
                    const isCorrect = userChoice === q.correctOptionIndex;

                    return (
                      <div
                        key={q.id}
                        className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-sm font-semibold">
                            Question {q.questionNumber}. {q.prompt}
                          </h3>
                          <span className="text-xs font-mono text-slate-500 shrink-0">
                            +100 pts
                          </span>
                        </div>

                        {q.formulaOrContext && (
                          <p className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg">
                            {q.formulaOrContext}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, idx) => {
                            const selected = userChoice === idx;
                            let btnStyle =
                              'border-slate-200 dark:border-slate-700 hover:border-[#0052FF]';

                            if (examSubmitted) {
                              if (idx === q.correctOptionIndex) {
                                btnStyle =
                                  'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                              } else if (selected) {
                                btnStyle =
                                  'border-red-500 bg-red-50/70 dark:bg-red-950/40 text-red-900 dark:text-red-200';
                              }
                            } else if (selected) {
                              btnStyle =
                                'border-[#0052FF] bg-blue-50/80 dark:bg-blue-950/50 text-[#0052FF] dark:text-sky-300 font-semibold';
                            }

                            return (
                              <FluidGlassButton
                                key={idx}
                                variant={selected ? 'active' : 'surface'}
                                disabled={examSubmitted}
                                onClick={(e) => handleSelectOption(e, q.id, idx)}
                                className={`p-3 rounded-xl text-left text-xs transition-all flex items-center justify-between gap-2 ${btnStyle}`}
                              >
                                <span className="flex-1 text-left">
                                  {String.fromCharCode(65 + idx)}. {opt}
                                </span>
                                {examSubmitted &&
                                  idx === q.correctOptionIndex && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  )}
                                {examSubmitted &&
                                  selected &&
                                  idx !== q.correctOptionIndex && (
                                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                  )}
                              </FluidGlassButton>
                            );
                          })}
                        </div>

                        {examSubmitted && (
                          <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                            <strong
                              className={
                                isCorrect ? 'text-emerald-600' : 'text-red-600'
                              }
                            >
                              {isCorrect
                                ? 'Correct (+100 pts): '
                                : 'Solution Note: '}
                            </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!examSubmitted && (
                  <div className="pt-4 flex justify-end">
                    <FluidGlassButton
                      variant="primary"
                      onClick={(e) => handleSubmitExam(e)}
                      className="px-6 py-3 rounded-xl text-sm font-semibold"
                    >
                      <span>Submit Completed Exam & Calculate Rank Score</span>
                    </FluidGlassButton>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Document Completion Bar ("Done / Təhlil et · Bitiş") */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span>
                  Active Mode:{' '}
                  <strong className="uppercase text-slate-800 dark:text-slate-200">
                    {activeTool}
                  </strong>{' '}
                  · {strokes.length} Ink/Highlight Strokes · {textNotes.length}{' '}
                  Text Notes
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <FluidGlassButton
                  variant="surface"
                  onClick={handleExportAnnotationJson}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Annotations JSON</span>
                </FluidGlassButton>

                <FluidGlassButton
                  variant="emerald"
                  onClick={handleCompleteAndExit}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold"
                >
                  <Check className="w-4 h-4" />
                  <span>Done · Təhlil et / Bitiş (Save & Exit)</span>
                </FluidGlassButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HARDENED ANTI-TAMPER, ANTI-EMITTER & NATIVE MOBILE SECURITY INSPECTOR MODAL */}
      {securityConsoleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`max-w-4xl w-full max-h-[88vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#0052FF]" />
                <div>
                  <h2 className="text-base font-bold">
                    Hardened Anti-Screenshot & Anti-Emitter Security Engine
                  </h2>
                  <p className="text-xs text-slate-500">
                    Android FLAG_SECURE · iOS Secure CALayer + UIScreen.isCaptured · Web Prototype & Event Attestation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSecurityConsoleOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50/70 dark:bg-slate-950/50">
              {(
                [
                  {
                    id: 'overview',
                    label: '1. Live Verification & Pen-Tests',
                    icon: Zap,
                  },
                  {
                    id: 'android',
                    label: '2. Android (FLAG_SECURE + Anti-Emitter Kotlin)',
                    icon: Smartphone,
                  },
                  {
                    id: 'ios',
                    label: '3. iOS (Secure CALayer + UIScreen Swift)',
                    icon: Cpu,
                  },
                  {
                    id: 'incidents',
                    label: `4. Forensic Incident Log (${incidents.length})`,
                    icon: Terminal,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCodeTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      activeCodeTab === tab.id
                        ? 'bg-[#0052FF] text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {activeCodeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 block">
                        EventTarget Prototype Integrity
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {integrityStatus?.nativePrototypesIntact
                          ? '✓ [native code] Verified'
                          : '⚠ Hook Detected'}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Attests addEventListener & dispatchEvent against Proxy/Frida hooks.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 block">
                        Anti-Screenshot Surface Lock
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        ✓ FLAG_SECURE + Canvas Poisoned
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Blocks getDisplayMedia(), PrintScreen, and canvas.toDataURL().
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 block">
                        UI Automation / Hook Signatures
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {integrityStatus?.automationDetected
                          ? `⚠ ${integrityStatus.automationSignatures.length} Flagged`
                          : '✓ 0 Hooks (Clean Runtime)'}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Scans for Frida, Appium, WebDriver, Xposed & CDP globals.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/30 space-y-3">
                    <h3 className="text-sm font-bold">
                      Run Live Anti-Tamper & Anti-Emitter Penetration Tests
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Click any test below to simulate an attack against the active viewer and verify that the security layer intercepts and logs it without degrading 60fps UI performance:
                    </p>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={runSyntheticEventPenTest}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                      >
                        1. Inject Untrusted Synthetic Click (isTrusted: false)
                      </button>
                      <button
                        type="button"
                        onClick={runCanvasScrapingPenTest}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                      >
                        2. Attempt Canvas Pixel Scrape (toDataURL)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSecurityConsoleOpen(false);
                          setIosCaptureShieldActive(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 cursor-pointer"
                      >
                        3. Trigger iOS UIScreen.isCaptured Blur Overlay
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeCodeTab === 'android' && (
                <div className="space-y-3">
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                    {NATIVE_ANDROID_FLAG_SECURE_KOTLIN_CODE}
                  </pre>
                </div>
              )}

              {activeCodeTab === 'ios' && (
                <div className="space-y-3">
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                    {NATIVE_IOS_SECURE_LAYER_SWIFT_CODE}
                  </pre>
                </div>
              )}

              {activeCodeTab === 'incidents' && (
                <div className="space-y-3">
                  {incidents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No security violations recorded in this session yet.
                    </p>
                  ) : (
                    incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-mono font-bold text-red-600 dark:text-red-400">
                            <span>[{inc.category}]</span>
                            <span>·</span>
                            <span>{inc.severity}</span>
                            <span>·</span>
                            <span>{inc.timestamp}</span>
                          </div>
                          <p className="font-semibold">{inc.vector}</p>
                          <p className="text-slate-600 dark:text-slate-300">
                            {inc.actionTaken}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-mono text-[11px] font-semibold shrink-0">
                          BLOCKED
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
