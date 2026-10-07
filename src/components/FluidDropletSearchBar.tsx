import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from 'motion/react';
import { Search, X, Sparkles, ArrowDownRight, ArrowUpLeft } from 'lucide-react';
import { FluidGlassButton } from './FluidGlassButton';

interface FluidDropletSearchBarProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  darkMode: boolean;
  sectionLabel?: string;
}

interface BurstRipple {
  id: number;
  x: number;
  y: number;
}

const SNAP_THRESHOLD_PX = 80;
const COLLAPSE_THRESHOLD_PX = 52;
const MAX_RUBBER_STRETCH_PX = 165;

/**
 * Computes a smooth, closed Cubic-Bezier Metaball / Surface-Tension Droplet SVG path
 * connecting the Anchor Sphere at (cx0, cy0, r0) and the Pulled/Rebounding Droplet at (cx1, cy1, r1).
 *
 * Used for BOTH:
 * 1. Forward Drag & Stretch (elongating downwards/sideways before popping open)
 * 2. Reverse Collapse & Settle Wobble (vertical elongation and elastic surface-tension oscillation upon return)
 */
function buildLiquidMetaballPath(
  cx0: number,
  cy0: number,
  r0: number,
  cx1: number,
  cy1: number,
  r1: number,
  tensionProgress: number
): string {
  const dx = cx1 - cx0;
  const dy = cy1 - cy0;
  const d = Math.hypot(dx, dy);

  // When nearly at rest, render a single smooth circle/capsule around the origin
  if (d < 2) {
    return `M ${cx0 - r0},${cy0} a ${r0},${r0} 0 1,0 ${r0 * 2},0 a ${r0},${r0} 0 1,0 -${r0 * 2},0 Z`;
  }

  // Unit vector along pull/recoil direction and perpendicular normal vector
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;

  // Surface tension waist narrowing: narrows down to 14% width right before the snap threshold
  const waistFactor = Math.max(0.14, 1 - tensionProgress * 0.82);
  const midX = cx0 + dx * 0.48;
  const midY = cy0 + dy * 0.48;
  const waistRadius = Math.min(r0, r1) * waistFactor;

  // Outer tangent points on Anchor Sphere (0) and Pulled Droplet (1)
  const p0TopX = cx0 + nx * r0;
  const p0TopY = cy0 + ny * r0;
  const p0BotX = cx0 - nx * r0;
  const p0BotY = cy0 - ny * r0;

  const p1TopX = cx1 + nx * r1;
  const p1TopY = cy1 + ny * r1;
  const p1BotX = cx1 - nx * r1;
  const p1BotY = cy1 - ny * r1;

  // Rear cap point of Anchor Sphere and Front nose point of Pulled Droplet
  const rearX = cx0 - ux * r0;
  const rearY = cy0 - uy * r0;
  const noseX = cx1 + ux * r1 * (1 + tensionProgress * 0.14);
  const noseY = cy1 + uy * r1 * (1 + tensionProgress * 0.14);

  // Waist control points pulled inward toward the centerline for concave liquid neck
  const waistTopX = midX + nx * waistRadius;
  const waistTopY = midY + ny * waistRadius;
  const waistBotX = midX - nx * waistRadius;
  const waistBotY = midY - ny * waistRadius;

  const k0 = r0 * 0.552;
  const k1 = r1 * 0.58;

  return [
    // Start at Anchor top tangent
    `M ${p0TopX.toFixed(1)} ${p0TopY.toFixed(1)}`,
    // Concave viscous neck from Anchor top to Pulled Droplet top
    `C ${(p0TopX + ux * d * 0.28).toFixed(1)} ${(p0TopY + uy * d * 0.28).toFixed(1)}, ${(waistTopX - ux * d * 0.16).toFixed(1)} ${(waistTopY - uy * d * 0.16).toFixed(1)}, ${waistTopX.toFixed(1)} ${waistTopY.toFixed(1)}`,
    `C ${(waistTopX + ux * d * 0.18).toFixed(1)} ${(waistTopY + uy * d * 0.18).toFixed(1)}, ${(p1TopX - ux * d * 0.24).toFixed(1)} ${(p1TopY - uy * d * 0.24).toFixed(1)}, ${p1TopX.toFixed(1)} ${p1TopY.toFixed(1)}`,
    // Rounded nose of Pulled Droplet (top tangent -> nose tip -> bottom tangent)
    `C ${(p1TopX + ux * k1).toFixed(1)} ${(p1TopY + uy * k1).toFixed(1)}, ${(noseX + nx * k1).toFixed(1)} ${(noseY + ny * k1).toFixed(1)}, ${noseX.toFixed(1)} ${noseY.toFixed(1)}`,
    `C ${(noseX - nx * k1).toFixed(1)} ${(noseY - ny * k1).toFixed(1)}, ${(p1BotX + ux * k1).toFixed(1)} ${(p1BotY + uy * k1).toFixed(1)}, ${p1BotX.toFixed(1)} ${p1BotY.toFixed(1)}`,
    // Concave viscous neck from Pulled Droplet bottom back to Anchor bottom
    `C ${(p1BotX - ux * d * 0.24).toFixed(1)} ${(p1BotY - uy * d * 0.24).toFixed(1)}, ${(waistBotX + ux * d * 0.18).toFixed(1)} ${(waistBotY + uy * d * 0.18).toFixed(1)}, ${waistBotX.toFixed(1)} ${waistBotY.toFixed(1)}`,
    `C ${(waistBotX - ux * d * 0.16).toFixed(1)} ${(waistBotY - uy * d * 0.16).toFixed(1)}, ${(p0BotX + ux * d * 0.28).toFixed(1)} ${(p0BotY + uy * d * 0.28).toFixed(1)}, ${p0BotX.toFixed(1)} ${p0BotY.toFixed(1)}`,
    // Rounded rear cap of Anchor Sphere (bottom tangent -> rear cap -> top tangent)
    `C ${(p0BotX - ux * k0).toFixed(1)} ${(p0BotY - uy * k0).toFixed(1)}, ${(rearX - nx * k0).toFixed(1)} ${(rearY - ny * k0).toFixed(1)}, ${rearX.toFixed(1)} ${rearY.toFixed(1)}`,
    `C ${(rearX + nx * k0).toFixed(1)} ${(rearY + ny * k0).toFixed(1)}, ${(p0TopX - ux * k0).toFixed(1)} ${(p0TopY - uy * k0).toFixed(1)}, ${p0TopX.toFixed(1)} ${p0TopY.toFixed(1)}`,
    'Z',
  ].join(' ');
}

export const FluidDropletSearchBar: React.FC<FluidDropletSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  darkMode,
  sectionLabel = 'PDFs & Topics',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(value));
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [pastThreshold, setPastThreshold] = useState<boolean>(false);
  const [rawPullDistance, setRawPullDistance] = useState<number>(0);

  // Reverse Collapse Gesture & Settle Splash State
  const [isReverseDragging, setIsReverseDragging] = useState<boolean>(false);
  const [collapseProgress, setCollapseProgress] = useState<number>(0);
  const [isDismissingInput, setIsDismissingInput] = useState<boolean>(false);
  const [burstRipples, setBurstRipples] = useState<BurstRipple[]>([]);
  const [settleSplashRipples, setSettleSplashRipples] = useState<BurstRipple[]>(
    []
  );

  // SVG path state synchronized with spring physics
  const [metaballPath, setMetaballPath] = useState<string>(() =>
    buildLiquidMetaballPath(28, 24, 21, 28, 24, 21, 0)
  );
  const [dropletHeadPos, setDropletHeadPos] = useState<{ x: number; y: number }>(
    {
      x: 28,
      y: 24,
    }
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const crossedThresholdRef = useRef<boolean>(false);
  const reverseOriginRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  // Underdamped liquid spring MotionValues for 60-120fps elastic snap-back & reverse wobble
  const rawDx = useMotionValue(0);
  const rawDy = useMotionValue(0);

  const springDx = useSpring(rawDx, {
    stiffness: 540,
    damping: 14,
    mass: 0.58,
  });
  const springDy = useSpring(rawDy, {
    stiffness: 540,
    damping: 14,
    mass: 0.58,
  });

  // Update dynamic SVG liquid metaball path on every spring frame
  const syncLiquidGeometry = useCallback((dxVal: number, dyVal: number) => {
    const cx0 = 28;
    const cy0 = 24;
    const dist = Math.hypot(dxVal, dyVal);
    const progress = Math.min(1, dist / 95);

    // Anchor radius shrinks as liquid volume flows into the stretched/rebounding droplet tip
    const r0 = 21 - progress * 5.5;
    const r1 = 21 - progress * 2.5;

    const cx1 = cx0 + dxVal;
    const cy1 = cy0 + dyVal;

    setDropletHeadPos({ x: cx1, y: cy1 });
    setMetaballPath(
      buildLiquidMetaballPath(cx0, cy0, r0, cx1, cy1, r1, progress)
    );
  }, []);

  useMotionValueEvent(springDx, 'change', (latestX) => {
    syncLiquidGeometry(latestX, springDy.get());
  });

  useMotionValueEvent(springDy, 'change', (latestY) => {
    syncLiquidGeometry(springDx.get(), latestY);
  });

  // Focus input automatically when droplet pops open into the full-width Search Bar
  useEffect(() => {
    if (isExpanded) {
      setIsDismissingInput(false);
      setCollapseProgress(0);
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 110);
      return () => window.clearTimeout(id);
    }
  }, [isExpanded]);

  const triggerPopBurst = useCallback((originX: number, originY: number) => {
    const id = Date.now() + Math.random();
    setBurstRipples((prev) => [
      ...prev.slice(-3),
      { id, x: originX, y: originY },
    ]);
    window.setTimeout(() => {
      setBurstRipples((prev) => prev.filter((r) => r.id !== id));
    }, 850);
  }, []);

  const triggerSettleSplash = useCallback((originX = 28, originY = 24) => {
    const id = Date.now() + Math.random();
    setSettleSplashRipples((prev) => [
      ...prev.slice(-3),
      { id, x: originX, y: originY },
    ]);
    window.setTimeout(() => {
      setSettleSplashRipples((prev) => prev.filter((r) => r.id !== id));
    }, 860);
  }, []);

  /**
   * Executes the Reverse Liquid Transformation:
   * 1. Smoothly blurs/dismisses keyboard and fades out text input opacity
   * 2. Morphs the expanded bar back into the compact Fluid Glass Search Droplet
   * 3. Injects a vertical-to-radial surface-tension spring impulse so the SVG metaball
   *    stretches vertically and wobbles elastically with a splash ripple as it settles
   */
  const executeReverseLiquidCollapse = useCallback(
    (clearText = false) => {
      // 1. Dismiss keyboard & fade out text input
      inputRef.current?.blur();
      setIsDismissingInput(true);
      if (clearText) {
        onChange('');
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([10, 26, 14]);
        } catch {
          // Ignore
        }
      }

      // 2. Collapse expanded bar after brief input opacity fade
      window.setTimeout(() => {
        setIsExpanded(false);
        setIsReverseDragging(false);
        setCollapseProgress(0);
        setIsDismissingInput(false);

        // 3. Inject reverse vertical stretch + elastic rebound wobble into the SVG metaball spring
        rawDy.set(-42);
        rawDx.set(16);
        triggerSettleSplash(28, 24);

        window.setTimeout(() => {
          rawDy.set(26);
          rawDx.set(-10);
        }, 85);

        window.setTimeout(() => {
          rawDy.set(0);
          rawDx.set(0);
        }, 175);
      }, 90);
    },
    [onChange, rawDx, rawDy, triggerSettleSplash]
  );

  // ============================================================================
  // FORWARD DRAG HANDLERS (Compact Droplet -> Stretch -> 80px Snap Open)
  // ============================================================================
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    crossedThresholdRef.current = false;
    setIsDragging(true);
    setPastThreshold(false);
    setRawPullDistance(0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragOriginRef.current) return;
    e.stopPropagation();

    const deltaX = e.clientX - dragOriginRef.current.x;
    const deltaY = e.clientY - dragOriginRef.current.y;

    // Allow downward and sideways stretching; clamp upward drag gently
    const effectiveY = deltaY < 0 ? deltaY * 0.25 : deltaY;
    const rawDist = Math.hypot(deltaX, effectiveY);
    setRawPullDistance(Math.round(rawDist));

    // Rubber-band logarithmic resistance curve: smooth elongation with surface tension
    const rubberDist =
      MAX_RUBBER_STRETCH_PX * (1 - Math.exp(-rawDist / 125));
    const angle = Math.atan2(effectiveY, deltaX);

    const stretchedX = Math.cos(angle) * rubberDist;
    const stretchedY = Math.sin(angle) * rubberDist;

    rawDx.set(stretchedX);
    rawDy.set(stretchedY);

    // Check 80px Snap Point Threshold
    if (rawDist >= SNAP_THRESHOLD_PX && !crossedThresholdRef.current) {
      crossedThresholdRef.current = true;
      setPastThreshold(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(18);
        } catch {
          // Ignore
        }
      }
    } else if (rawDist < SNAP_THRESHOLD_PX && crossedThresholdRef.current) {
      crossedThresholdRef.current = false;
      setPastThreshold(false);
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const wasPastThreshold = crossedThresholdRef.current;
    const finalX = dropletHeadPos.x;
    const finalY = dropletHeadPos.y;

    setIsDragging(false);
    dragOriginRef.current = null;
    crossedThresholdRef.current = false;
    setPastThreshold(false);
    setRawPullDistance(0);

    // Snap spring back to (0, 0)
    rawDx.set(0);
    rawDy.set(0);

    if (wasPastThreshold) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([12, 24, 16]);
        } catch {
          // Ignore
        }
      }
      setIsExpanded(true);
      triggerPopBurst(finalX, finalY);
    } else {
      // Released before 80px threshold: elastic liquid snap-back bounce
      if (Math.hypot(finalX - 28, finalY - 24) < 5) {
        rawDy.set(34);
        rawDx.set(18);
        window.setTimeout(() => {
          rawDy.set(0);
          rawDx.set(0);
        }, 95);
      }
    }
  };

  // ============================================================================
  // REVERSE DRAG HANDLERS (Expanded Search Bar -> Swipe Up / Left -> Collapse to Droplet)
  // ============================================================================
  const handleReversePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    // Allow normal clicks on buttons inside the search bar
    if (target && target.closest('button')) return;

    reverseOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  };

  const handleReversePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reverseOriginRef.current) return;

    const deltaX = e.clientX - reverseOriginRef.current.x;
    const deltaY = e.clientY - reverseOriginRef.current.y;

    // Detect upward swipe (deltaY < -8) or strong leftward compression swipe (deltaX < -24)
    const upwardPull = Math.max(0, -deltaY);
    const leftwardPull = Math.max(0, -deltaX * 0.55);
    const combinedReversePull = Math.hypot(upwardPull, leftwardPull);

    if (combinedReversePull > 8) {
      if (!isReverseDragging) {
        setIsReverseDragging(true);
        inputRef.current?.blur();
      }
      const prog = Math.min(1, combinedReversePull / COLLAPSE_THRESHOLD_PX);
      setCollapseProgress(prog);
    }
  };

  const handleReversePointerUpOrCancel = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!reverseOriginRef.current) return;

    const elapsedMs = Math.max(
      1,
      performance.now() - reverseOriginRef.current.time
    );
    const deltaY = e.clientY - reverseOriginRef.current.y;
    const velocityY = (deltaY / elapsedMs) * 1000; // px/s

    const shouldCollapse =
      collapseProgress >= 0.85 || (deltaY < -22 && velocityY < -280);

    reverseOriginRef.current = null;

    if (shouldCollapse) {
      executeReverseLiquidCollapse(false);
    } else {
      // Cancel collapse: snap search bar back open elastically
      setIsReverseDragging(false);
      setCollapseProgress(0);
    }
  };

  const pullProgress = Math.min(1, rawPullDistance / SNAP_THRESHOLD_PX);

  // Dynamic morphing transforms while swiping up on the open Search Bar
  // Contracts horizontally (scaleX -> 0.34) and stretches vertically (scaleY -> 1.44) like a liquid droplet
  const liveScaleX = isDismissingInput
    ? 0.24
    : 1 - collapseProgress * 0.64;
  const liveScaleY = isDismissingInput
    ? 1.38
    : 1 + collapseProgress * 0.44;
  const liveTranslateY = isDismissingInput
    ? -14
    : -collapseProgress * 18;
  const liveInputOpacity = isDismissingInput
    ? 0
    : Math.max(0, 1 - collapseProgress * 1.65);

  return (
    <div
      data-no-swipe="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="relative flex-1 min-w-0 select-none"
    >
      <AnimatePresence mode="wait" initial={false}>
        {!isExpanded ? (
          /* =========================================================================
             STATE 1: COMPACT FLUID GLASS WATER DROPLET BUTTON (DRAG TO STRETCH & POP)
             ========================================================================= */
          <motion.div
            key="droplet-collapsed"
            initial={{ opacity: 0, scaleX: 1.35, scaleY: 0.72 }}
            animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
            exit={{
              opacity: 0,
              scale: 1.08,
              filter: 'blur(6px)',
              transition: { duration: 0.16 },
            }}
            transition={{
              type: 'spring',
              stiffness: 520,
              damping: 15,
              mass: 0.6,
            }}
            className="relative flex items-center gap-3 min-h-[48px]"
          >
            {/* Settle Splash / Ripple Feedback Effect When Returning from Expanded Search Bar */}
            {settleSplashRipples.map((splash) => (
              <React.Fragment key={splash.id}>
                <span
                  className="water-droplet-crest"
                  style={{
                    left: splash.x,
                    top: splash.y,
                    width: 150,
                    height: 150,
                  }}
                />
                <span
                  className="water-droplet-capillary"
                  style={{
                    left: splash.x,
                    top: splash.y,
                    width: 110,
                    height: 110,
                  }}
                />
                <span
                  className="water-droplet-core"
                  style={{
                    left: splash.x,
                    top: splash.y,
                    width: 54,
                    height: 54,
                  }}
                />
              </React.Fragment>
            ))}

            {/* Interactive Liquid Metaball SVG Canvas (Allows 2D Downward & Sideways Stretching) */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              style={{ touchAction: 'none' }}
              className="relative flex items-center cursor-grab active:cursor-grabbing group"
              title="Drag droplet downwards or sideways (80px) to pop open Search Bar"
            >
              {/* Dynamic SVG Metaball Layer */}
              <svg
                width={260}
                height={190}
                viewBox="0 0 260 190"
                className="pointer-events-none overflow-visible absolute -top-1 -left-1 z-20"
              >
                <defs>
                  {/* Fluid Glass Liquid Gradient */}
                  <linearGradient
                    id="fluidDropletGlassGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor={pastThreshold ? '#10b981' : '#38bdf8'}
                      stopOpacity={0.92}
                    />
                    <stop
                      offset="52%"
                      stopColor={pastThreshold ? '#059669' : '#0052ff'}
                      stopOpacity={0.86}
                    />
                    <stop
                      offset="100%"
                      stopColor={pastThreshold ? '#047857' : '#0284c7'}
                      stopOpacity={0.94}
                    />
                  </linearGradient>

                  {/* Specular Top-Left Rim Highlight Gradient */}
                  <linearGradient
                    id="fluidDropletRimGrad"
                    x1="0%"
                    y1="0%"
                    x2="85%"
                    y2="85%"
                  >
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
                    <stop offset="45%" stopColor="#bae6fd" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.25} />
                  </linearGradient>

                  {/* Soft Caustic Glow Filter */}
                  <filter
                    id="fluidDropletGlow"
                    x="-40%"
                    y="-40%"
                    width="180%"
                    height="180%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="8"
                      stdDeviation="8"
                      floodColor={pastThreshold ? '#10b981' : '#0052ff'}
                      floodOpacity="0.42"
                    />
                  </filter>
                </defs>

                {/* Snap Threshold Target Ring when dragging */}
                {isDragging && (
                  <g>
                    <circle
                      cx={28}
                      cy={24}
                      r={56}
                      fill="none"
                      stroke={
                        pastThreshold
                          ? 'rgba(16, 185, 129, 0.7)'
                          : 'rgba(56, 189, 248, 0.38)'
                      }
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    {pastThreshold && (
                      <circle
                        cx={dropletHeadPos.x}
                        cy={dropletHeadPos.y}
                        r={28}
                        fill="none"
                        stroke="rgba(167, 243, 208, 0.9)"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                )}

                {/* Main Viscous Liquid Metaball Body */}
                <path
                  d={metaballPath}
                  fill="url(#fluidDropletGlassGrad)"
                  stroke="url(#fluidDropletRimGrad)"
                  strokeWidth={1.6}
                  filter="url(#fluidDropletGlow)"
                />

                {/* Specular crescent highlight inside the pulled/rebounding droplet head */}
                <ellipse
                  cx={dropletHeadPos.x - 5}
                  cy={dropletHeadPos.y - 6}
                  rx={7}
                  ry={3.8}
                  transform={`rotate(-28 ${dropletHeadPos.x - 5} ${
                    dropletHeadPos.y - 6
                  })`}
                  fill="rgba(255, 255, 255, 0.58)"
                />
              </svg>

              {/* Moving Search Icon Tracking the Pulled/Wobbling Droplet Tip */}
              <div
                style={{
                  transform: `translate3d(${dropletHeadPos.x - 28}px, ${
                    dropletHeadPos.y - 24
                  }px, 0)`,
                }}
                className="relative z-30 w-12 h-11 flex items-center justify-center text-white pointer-events-none"
              >
                <Search
                  className={`w-4 h-4 transition-transform duration-150 ${
                    pastThreshold ? 'scale-125' : 'group-hover:scale-110'
                  }`}
                />
              </div>

              {/* Frosted Glass Hint Pill Beside the Droplet */}
              <div
                className={`ml-2 pl-3.5 pr-4 py-2 rounded-2xl fluid-glass-tab-rail flex items-center gap-2.5 text-xs transition-all ${
                  pastThreshold
                    ? 'border-emerald-400/80 text-emerald-600 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <ArrowDownRight
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    pastThreshold
                      ? 'text-emerald-500 rotate-45 scale-110'
                      : 'text-[#0052FF] dark:text-sky-400'
                  }`}
                />
                <div className="flex flex-col">
                  <span className="font-semibold leading-tight whitespace-nowrap">
                    {isDragging
                      ? pastThreshold
                        ? 'Snap Point Reached! Release to Pop Search Bar'
                        : `Stretching Water Droplet... (${rawPullDistance}px / ${SNAP_THRESHOLD_PX}px)`
                      : `Drag Search Droplet to Stretch & Pop (${sectionLabel})`}
                  </span>
                  {/* Live Surface-Tension Progress Micro-Bar */}
                  <div className="w-full h-1 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      style={{ width: `${Math.round(pullProgress * 100)}%` }}
                      className={`h-full rounded-full transition-colors ${
                        pastThreshold ? 'bg-emerald-500' : 'bg-[#0052FF]'
                      }`}
                    />
                  </div>
                </div>

                {/* Instant Pop Trigger for Accessibility / Quick Click */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                    triggerPopBurst(36, 24);
                  }}
                  className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-[#0052FF]/12 text-[#0052FF] dark:bg-sky-400/15 dark:text-sky-300 hover:bg-[#0052FF] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  Pop Open
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* =========================================================================
             STATE 2: POPPED FULL-WIDTH FLUID GLASS SEARCH INPUT BAR
             Supports Upward Swipe / Reverse Liquid Contraction + Vertical Stretch -> Droplet
             ========================================================================= */
          <motion.div
            key="search-bar-expanded"
            onPointerDown={handleReversePointerDown}
            onPointerMove={handleReversePointerMove}
            onPointerUp={handleReversePointerUpOrCancel}
            onPointerCancel={handleReversePointerUpOrCancel}
            initial={{
              opacity: 0,
              scaleX: 0.28,
              scaleY: 1.32,
              originX: 0.04,
              originY: 0.5,
            }}
            animate={{
              opacity: 1,
              scaleX: liveScaleX,
              scaleY: liveScaleY,
              y: liveTranslateY,
              borderRadius: `${16 + Math.round(collapseProgress * 28)}px`,
            }}
            exit={{
              opacity: 0,
              scaleX: 0.18,
              scaleY: 1.45,
              y: -12,
              originX: 0.04,
              originY: 0.5,
              filter: 'blur(4px)',
              transition: {
                type: 'spring',
                stiffness: 480,
                damping: 22,
                mass: 0.6,
              },
            }}
            transition={{
              type: 'spring',
              stiffness: 430,
              damping: 24,
              mass: 0.68,
            }}
            className={`relative w-full rounded-2xl fluid-glass-tab-rail overflow-visible flex items-center gap-2 px-3.5 py-1.5 ${
              darkMode
                ? 'border-sky-500/40 shadow-[0_10px_30px_-8px_rgba(0,82,255,0.35)]'
                : 'border-sky-300/80 shadow-[0_12px_32px_-8px_rgba(0,82,255,0.18)]'
            }`}
          >
            {/* Dynamic Reverse Metaball Tail Rendered During Upward Collapse Swipe */}
            {isReverseDragging && collapseProgress > 0.08 && (
              <svg
                width={180}
                height={140}
                viewBox="0 0 180 140"
                className="pointer-events-none overflow-visible absolute -top-10 -left-2 z-30"
              >
                <path
                  d={buildLiquidMetaballPath(
                    28,
                    64,
                    18 * (1 - collapseProgress * 0.25),
                    28,
                    64 - collapseProgress * 44,
                    20,
                    collapseProgress
                  )}
                  fill="rgba(14, 165, 233, 0.72)"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth={1.4}
                />
              </svg>
            )}

            {/* Concentric Water-Droplet Burst Ripples on Pop Open */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              {burstRipples.map((ripple) => (
                <React.Fragment key={ripple.id}>
                  <span
                    className="water-droplet-crest"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: 280,
                      height: 280,
                    }}
                  />
                  <span
                    className="water-droplet-capillary"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: 210,
                      height: 210,
                    }}
                  />
                  <span
                    className="water-droplet-core"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: 95,
                      height: 95,
                    }}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* Glowing Fluid Glass Droplet Badge (Swipe Up or Tap to Collapse into Droplet) */}
            <button
              type="button"
              onClick={() => executeReverseLiquidCollapse(false)}
              title="Swipe up or tap to morph back into Fluid Water Droplet"
              className="w-8 h-8 rounded-xl fluid-glass-gliding-pill flex items-center justify-center text-white shrink-0 cursor-pointer hover:scale-105 transition-transform"
            >
              <Search className="w-4 h-4" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={
                isReverseDragging
                  ? 'Release upward swipe to morph into Water Droplet...'
                  : placeholder
              }
              style={{ opacity: liveInputOpacity }}
              className={`relative z-10 flex-1 bg-transparent py-1.5 text-sm font-medium transition-opacity duration-100 focus:outline-none ${
                darkMode
                  ? 'text-white placeholder:text-slate-400'
                  : 'text-slate-900 placeholder:text-slate-500'
              }`}
            />

            {/* Upward Swipe Hint Micro-Badge */}
            <span
              style={{ opacity: liveInputOpacity }}
              className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap select-none"
            >
              <ArrowUpLeft className="w-3 h-3" />
              <span>Swipe ↑ to morph</span>
            </span>

            {value && (
              <FluidGlassButton
                variant="surface"
                onClick={() => onChange('')}
                className="px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </FluidGlassButton>
            )}

            {/* Reverse Collapse / Morph Back to Water Droplet Button */}
            <FluidGlassButton
              variant="nav"
              onClick={() => executeReverseLiquidCollapse(true)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#0052FF] dark:text-sky-300 shrink-0 whitespace-nowrap"
              title="Morph search bar back into Fluid Water Droplet"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </FluidGlassButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
