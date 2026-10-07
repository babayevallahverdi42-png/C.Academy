import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from 'react';

export interface FluidFilterItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface FluidDropletFilterGroupProps<T extends string> {
  items: FluidFilterItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  /** Optional extra action buttons rendered inline at the end of the filter row */
  trailingActions?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  variant?: 'wrap' | 'segmented';
}

interface BoxMetrics {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SnapSplashWave {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * FluidDropletFilterGroup
 *
 * Implements a 60–120 FPS "Sliding Liquid Droplet" Selection Interaction:
 * 1. Continuous Drag & Swipe Selection Across Buttons:
 *    Press down on any button and drag continuously across the row/grid without lifting touch.
 *    Hit-tests pointer coordinates against all button bounding boxes in real time.
 * 2. Morphing Fluid Glass Indicator (Viscous Droplet Glider):
 *    Couples a fast Leading Head spring with a viscous Trailing Tail spring and renders a
 *    dynamic SVG Metaball / Bezier pinched-waist liquid bridge that stretches and narrows in
 *    the middle as the droplet travels between buttons.
 * 3. Haptic & Visual Bounce Wobble on Snap:
 *    Triggers a volume-preserving damped harmonic jelly wobble and concentric water-droplet
 *    splash each time the droplet snaps onto a newly highlighted button.
 */
export function FluidDropletFilterGroup<T extends string>({
  items,
  activeId,
  onSelect,
  trailingActions,
  className = '',
  buttonClassName = '',
  variant = 'wrap',
}: FluidDropletFilterGroupProps<T>) {
  const uniqueSvgId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const gliderRef = useRef<HTMLDivElement | null>(null);
  const tailGliderRef = useRef<HTMLDivElement | null>(null);
  const bridgePathRef = useRef<SVGPathElement | null>(null);
  const bridgeSpecularPathRef = useRef<SVGPathElement | null>(null);

  const activeIdRef = useRef<T>(activeId);
  activeIdRef.current = activeId;

  const [splashes, setSplashes] = useState<SnapSplashWave[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Target button box + coupled Head and Tail spring states for 60-120fps viscous physics
  const physicsRef = useRef<{
    initialized: boolean;
    target: BoxMetrics;
    head: BoxMetrics;
    headVel: BoxMetrics;
    tail: BoxMetrics;
    tailVel: BoxMetrics;
    pointerOffset: { dx: number; dy: number; active: boolean };
    snapTime: number;
    snapAxis: 'x' | 'y';
    rafId: number | null;
  }>({
    initialized: false,
    target: { x: 0, y: 0, w: 96, h: 36 },
    head: { x: 0, y: 0, w: 96, h: 36 },
    headVel: { x: 0, y: 0, w: 0, h: 0 },
    tail: { x: 0, y: 0, w: 96, h: 36 },
    tailVel: { x: 0, y: 0, w: 0, h: 0 },
    pointerOffset: { dx: 0, dy: 0, active: false },
    snapTime: 0,
    snapAxis: 'x',
    rafId: null,
  });

  // Compute concave pinched-waist liquid bridge SVG path between Tail & Head capsules
  const buildViscousBridgePath = (
    head: BoxMetrics,
    tail: BoxMetrics
  ): { fillPath: string; rimPath: string } => {
    const hcx = head.x + head.w * 0.5;
    const hcy = head.y + head.h * 0.5;
    const tcx = tail.x + tail.w * 0.5;
    const tcy = tail.y + tail.h * 0.5;

    const dx = hcx - tcx;
    const dy = hcy - tcy;
    const dist = Math.hypot(dx, dy);

    if (dist < 5) {
      return { fillPath: '', rimPath: '' };
    }

    // Unit direction vector (tx, ty) -> (hx, hy) and perpendicular normal (nx, ny)
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;

    // Effective half-thickness of head and tail perpendicular to travel axis
    const headRadius =
      0.44 * (Math.abs(nx) * head.w + Math.abs(ny) * head.h);
    const tailRadius =
      0.42 * (Math.abs(nx) * tail.w + Math.abs(ny) * tail.h);

    // Waist narrows in the middle as stretch distance increases (viscous surface tension)
    const stretchRatio = Math.min(1, dist / 155);
    const waistFactor = Math.max(0.22, 0.72 - stretchRatio * 0.48);
    const avgRadius = (headRadius + tailRadius) * 0.5;
    const waistRadius = avgRadius * waistFactor;

    // Anchor points on Tail and Head
    const tTopX = tcx + nx * tailRadius;
    const tTopY = tcy + ny * tailRadius;
    const tBotX = tcx - nx * tailRadius;
    const tBotY = tcy - ny * tailRadius;

    const hTopX = hcx + nx * headRadius;
    const hTopY = hcy + ny * headRadius;
    const hBotX = hcx - nx * headRadius;
    const hBotY = hcy - ny * headRadius;

    // Midpoint pinched waist control coordinates
    const midX = (tcx + hcx) * 0.5;
    const midY = (tcy + hcy) * 0.5;
    const ctrlTopX = midX + nx * waistRadius;
    const ctrlTopY = midY + ny * waistRadius;
    const ctrlBotX = midX - nx * waistRadius;
    const ctrlBotY = midY - ny * waistRadius;

    const fillPath = [
      `M ${tTopX.toFixed(1)} ${tTopY.toFixed(1)}`,
      `Q ${ctrlTopX.toFixed(1)} ${ctrlTopY.toFixed(1)} ${hTopX.toFixed(1)} ${hTopY.toFixed(1)}`,
      `L ${hBotX.toFixed(1)} ${hBotY.toFixed(1)}`,
      `Q ${ctrlBotX.toFixed(1)} ${ctrlBotY.toFixed(1)} ${tBotX.toFixed(1)} ${tBotY.toFixed(1)}`,
      'Z',
    ].join(' ');

    const rimPath = `M ${tTopX.toFixed(1)} ${tTopY.toFixed(1)} Q ${ctrlTopX.toFixed(1)} ${ctrlTopY.toFixed(1)} ${hTopX.toFixed(1)} ${hTopY.toFixed(1)}`;

    return { fillPath, rimPath };
  };

  // 60-120Hz Spring Animation Loop
  const startAnimationLoop = useCallback(() => {
    const p = physicsRef.current;
    if (p.rafId !== null) return;

    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Target includes subtle magnetic pull toward finger while actively dragging
      const pullX = p.pointerOffset.active ? p.pointerOffset.dx * 0.22 : 0;
      const pullY = p.pointerOffset.active ? p.pointerOffset.dy * 0.22 : 0;
      const goalX = p.target.x + pullX;
      const goalY = p.target.y + pullY;
      const goalW = p.target.w;
      const goalH = p.target.h;

      // 1. Integrate Leading Head Spring (Snappy Fluid Response)
      const headStiff = 490;
      const headDamp = 30;
      (['x', 'y', 'w', 'h'] as const).forEach((k) => {
        const goal =
          k === 'x' ? goalX : k === 'y' ? goalY : k === 'w' ? goalW : goalH;
        const force = (goal - p.head[k]) * headStiff - p.headVel[k] * headDamp;
        p.headVel[k] += force * dt;
        p.head[k] += p.headVel[k] * dt;
      });

      // 2. Integrate Viscous Trailing Tail Spring (Lags behind to form liquid droplet tail)
      const tailStiff = 195;
      const tailDamp = 21;
      (['x', 'y', 'w', 'h'] as const).forEach((k) => {
        const goal = p.head[k];
        const force = (goal - p.tail[k]) * tailStiff - p.tailVel[k] * tailDamp;
        p.tailVel[k] += force * dt;
        p.tail[k] += p.tailVel[k] * dt;
      });

      // Compute velocity & head-tail separation for liquid stretch & squeeze deformation
      const hcx = p.head.x + p.head.w * 0.5;
      const hcy = p.head.y + p.head.h * 0.5;
      const tcx = p.tail.x + p.tail.w * 0.5;
      const tcy = p.tail.y + p.tail.h * 0.5;
      const sepX = hcx - tcx;
      const sepY = hcy - tcy;
      const sepDist = Math.hypot(sepX, sepY);

      // Liquid Stretch: elongates along motion axis and narrows in the middle
      const horizStretch = Math.min(0.24, Math.abs(sepX) / 145);
      const vertStretch = Math.min(0.2, Math.abs(sepY) / 110);

      // On-Snap Damped Harmonic Jelly Wobble (volume-preserving oscillation)
      const elapsedSinceSnap = (now - p.snapTime) / 1000;
      let wobbleX = 0;
      let wobbleY = 0;
      if (elapsedSinceSnap >= 0 && elapsedSinceSnap < 0.52) {
        const amp = Math.exp(-elapsedSinceSnap * 9.5) * 0.085;
        const wave = Math.sin(elapsedSinceSnap * 34);
        wobbleX = p.snapAxis === 'x' ? wave * amp : -wave * amp;
        wobbleY = -wobbleX;
      }

      const scaleX = 1 + horizStretch - vertStretch * 0.55 + wobbleX;
      const scaleY = 1 - horizStretch * 0.48 + vertStretch + wobbleY;

      // Apply transform to Leading Head Glider DOM element
      if (gliderRef.current) {
        gliderRef.current.style.width = `${Math.max(24, p.head.w).toFixed(1)}px`;
        gliderRef.current.style.height = `${Math.max(20, p.head.h).toFixed(1)}px`;
        gliderRef.current.style.transform = `translate3d(${p.head.x.toFixed(
          2
        )}px, ${p.head.y.toFixed(2)}px, 0) scale(${scaleX.toFixed(
          4
        )}, ${scaleY.toFixed(4)})`;
      }

      // Apply transform to Viscous Trailing Droplet Lobes & SVG Bridge
      if (tailGliderRef.current) {
        if (sepDist > 3.5) {
          const tailScale = Math.max(0.56, 1 - Math.min(0.38, sepDist / 190));
          tailGliderRef.current.style.opacity = `${Math.min(
            0.85,
            sepDist / 28
          ).toFixed(2)}`;
          tailGliderRef.current.style.width = `${Math.max(
            20,
            p.tail.w
          ).toFixed(1)}px`;
          tailGliderRef.current.style.height = `${Math.max(
            18,
            p.tail.h
          ).toFixed(1)}px`;
          tailGliderRef.current.style.transform = `translate3d(${p.tail.x.toFixed(
            2
          )}px, ${p.tail.y.toFixed(2)}px, 0) scale(${tailScale.toFixed(3)})`;
        } else {
          tailGliderRef.current.style.opacity = '0';
        }
      }

      if (bridgePathRef.current && bridgeSpecularPathRef.current) {
        const { fillPath, rimPath } = buildViscousBridgePath(p.head, p.tail);
        bridgePathRef.current.setAttribute('d', fillPath);
        bridgeSpecularPathRef.current.setAttribute('d', rimPath);
      }

      // Check if springs and wobble have settled
      const totalResidual =
        Math.abs(goalX - p.head.x) +
        Math.abs(goalY - p.head.y) +
        Math.abs(goalW - p.head.w) +
        Math.abs(goalH - p.head.h) +
        sepDist +
        Math.abs(p.headVel.x) +
        Math.abs(p.headVel.y);

      if (
        totalResidual > 0.35 ||
        elapsedSinceSnap < 0.52 ||
        p.pointerOffset.active
      ) {
        p.rafId = window.requestAnimationFrame(step);
      } else {
        p.rafId = null;
      }
    };

    p.rafId = window.requestAnimationFrame(step);
  }, []);

  // Measure active button bounding box relative to container
  const syncActiveButtonBox = useCallback(
    (triggerSnapBounce: boolean) => {
      const containerEl = containerRef.current;
      const btnEl = buttonRefs.current[activeId];
      if (!containerEl || !btnEl) return;

      const cRect = containerEl.getBoundingClientRect();
      const bRect = btnEl.getBoundingClientRect();

      const nextBox: BoxMetrics = {
        x: bRect.left - cRect.left,
        y: bRect.top - cRect.top,
        w: bRect.width,
        h: bRect.height,
      };

      const p = physicsRef.current;
      if (!p.initialized) {
        p.initialized = true;
        p.target = { ...nextBox };
        p.head = { ...nextBox };
        p.tail = { ...nextBox };
        startAnimationLoop();
        return;
      }

      const dx = Math.abs(nextBox.x - p.target.x);
      const dy = Math.abs(nextBox.y - p.target.y);
      p.snapAxis = dy > dx ? 'y' : 'x';
      p.target = nextBox;

      if (triggerSnapBounce) {
        p.snapTime = performance.now();
        // Spawn a concentric water-droplet splash wave at the target button's center
        const splashId = Date.now() + Math.random();
        const cx = nextBox.x + nextBox.w * 0.5;
        const cy = nextBox.y + nextBox.h * 0.5;
        const size = Math.max(nextBox.w, nextBox.h, 88) * 1.15;
        setSplashes((prev) => [...prev.slice(-3), { id: splashId, x: cx, y: cy, size }]);
        window.setTimeout(() => {
          setSplashes((prev) => prev.filter((s) => s.id !== splashId));
        }, 720);
      }

      startAnimationLoop();
    },
    [activeId, startAnimationLoop]
  );

  // Sync when activeId or items change
  useEffect(() => {
    syncActiveButtonBox(true);
  }, [activeId, items.length, syncActiveButtonBox]);

  // Keep glider aligned on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleResize = () => syncActiveButtonBox(false);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(handleResize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncActiveButtonBox]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (physicsRef.current.rafId !== null) {
        window.cancelAnimationFrame(physicsRef.current.rafId);
      }
    };
  }, []);

  /**
   * Hit-tests pointer (clientX, clientY) against all filter buttons in the group.
   * Supports both 1D horizontal rows and 2D wrapped multi-row grids.
   */
  const hitTestButtonAtPointer = useCallback(
    (clientX: number, clientY: number): T | null => {
      let bestId: T | null = null;
      let bestDist = Infinity;

      for (const item of items) {
        const el = buttonRefs.current[item.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();

        // 1. Direct containment (with 4px liquid surface tolerance)
        if (
          clientX >= rect.left - 4 &&
          clientX <= rect.right + 4 &&
          clientY >= rect.top - 4 &&
          clientY <= rect.bottom + 4
        ) {
          return item.id;
        }

        // 2. Nearest bounding-box distance for smooth scrubbing across gaps
        const clampedX = Math.max(rect.left, Math.min(clientX, rect.right));
        const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom));
        const d = Math.hypot(clientX - clampedX, clientY - clampedY);
        if (d < bestDist && d <= 32) {
          bestDist = d;
          bestId = item.id;
        }
      }

      return bestId;
    },
    [items]
  );

  const updatePointerStretchAndSelection = useCallback(
    (clientX: number, clientY: number) => {
      const hitId = hitTestButtonAtPointer(clientX, clientY);
      if (hitId && hitId !== activeIdRef.current) {
        activeIdRef.current = hitId;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(8);
        }
        onSelect(hitId);
      }

      // Compute relative offset from currently active button center for elastic tension pull
      const activeBtn = buttonRefs.current[activeIdRef.current];
      const p = physicsRef.current;
      if (activeBtn) {
        const rect = activeBtn.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        p.pointerOffset = {
          dx: Math.max(-42, Math.min(42, clientX - cx)),
          dy: Math.max(-24, Math.min(24, clientY - cy)),
          active: true,
        };
        startAnimationLoop();
      }
    },
    [hitTestButtonAtPointer, onSelect, startAnimationLoop]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    // Ignore clicks on trailing non-filter action buttons if any
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-trailing-action="true"]')) return;

    const hitId = hitTestButtonAtPointer(e.clientX, e.clientY);
    if (!hitId) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on synthetic events
    }

    setIsDragging(true);
    updatePointerStretchAndSelection(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePointerStretchAndSelection(e.clientX, e.clientY);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    setIsDragging(false);
    physicsRef.current.pointerOffset = { dx: 0, dy: 0, active: false };
    physicsRef.current.snapTime = performance.now();
    startAnimationLoop();
  };

  return (
    <div
      ref={containerRef}
      data-no-swipe="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{ touchAction: 'none' }}
      className={`relative select-none ${
        variant === 'segmented'
          ? 'fluid-glass-tab-rail p-1.5 rounded-2xl inline-flex flex-wrap items-center gap-1.5'
          : 'flex flex-wrap items-center gap-2'
      } ${className}`}
    >
      {/* 1. Dynamic SVG Viscous Liquid Bridge (Pinched-Waist Metaball Neck during transitions) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full overflow-visible z-0"
      >
        <defs>
          <linearGradient
            id={`droplet-bridge-grad-${uniqueSvgId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgba(0, 82, 255, 0.88)" />
            <stop offset="50%" stopColor="rgba(14, 165, 233, 0.85)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.92)" />
          </linearGradient>
          <filter
            id={`droplet-neon-glow-${uniqueSvgId}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          ref={bridgePathRef}
          fill={`url(#droplet-bridge-grad-${uniqueSvgId})`}
          filter={`url(#droplet-neon-glow-${uniqueSvgId})`}
        />
        <path
          ref={bridgeSpecularPathRef}
          fill="none"
          stroke="rgba(255, 255, 255, 0.75)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>

      {/* 2. Viscous Trailing Droplet Lobe */}
      <div
        ref={tailGliderRef}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl fluid-glass-droplet-glider origin-center will-change-transform"
      />

      {/* 3. Morphing Primary Fluid Glass / Neon Glow Droplet Indicator */}
      <div
        ref={gliderRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl fluid-glass-droplet-glider origin-center will-change-transform"
      />

      {/* 4. Concentric Water-Droplet Splash Waves on Button Snap */}
      {splashes.map((s) => (
        <div
          key={s.id}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-0"
        >
          <span
            className="water-droplet-crest"
            style={{
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
            }}
          />
          <span
            className="water-droplet-capillary"
            style={{
              left: s.x,
              top: s.y,
              width: s.size * 0.8,
              height: s.size * 0.8,
            }}
          />
        </div>
      ))}

      {/* 5. Interactive Filter Buttons (Supports Tap + Continuous Finger Drag Scrubbing) */}
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[item.id] = el;
            }}
            type="button"
            onClick={() => {
              if (activeIdRef.current !== item.id) {
                activeIdRef.current = item.id;
                onSelect(item.id);
              }
            }}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors duration-150 ${
              variant === 'segmented'
                ? 'px-3.5 py-2'
                : 'px-3.5 py-2 fluid-glass-filter-chip'
            } ${
              isActive
                ? 'text-white !bg-transparent !border-transparent !shadow-none'
                : 'text-slate-700 dark:text-slate-200 hover:text-[#0052FF] dark:hover:text-sky-300'
            } ${buttonClassName}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200/75 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Optional Trailing Action Triggers in the same bar */}
      {trailingActions && (
        <div
          data-trailing-action="true"
          className="relative z-10 flex flex-wrap items-center gap-2"
        >
          {trailingActions}
        </div>
      )}
    </div>
  );
}
