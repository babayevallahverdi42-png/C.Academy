import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  motion,
  MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from 'motion/react';
import { FluidGlassButton } from './FluidGlassButton';

export interface BottomDockTabItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FluidSwipePagerProps<T extends string> {
  tabOrder: T[];
  activeTab: T;
  onSelectTab: (nextTab: T) => void;
  renderSection: (tab: T, isActive: boolean) => React.ReactNode;
  /**
   * Shared MotionValue representing the live horizontal drag/transition progress in tab units:
   * -1 = displaced 1 full screen toward next tab (left swipe)
   * +1 = displaced 1 full screen toward previous tab (right swipe)
   *  0 = settled at rest on activeTab
   */
  dragProgressMotion: MotionValue<number>;
}

const PAGE_SNAP_SPRING = {
  stiffness: 380,
  damping: 34,
  mass: 0.72,
};

/**
 * FluidSwipePager
 *
 * Implements 60–120 FPS horizontal touch & pointer swipe navigation across all main sections:
 * 1. Real-Time Dual-Panel Sliding: While dragging horizontally anywhere on the content area,
 *    the current section slides out while the adjacent section (left or right) slides in simultaneously.
 * 2. C1-Continuous Spring Handoff: On release past the swipe threshold, the incoming panel becomes
 *    active without a single pixel, scale, opacity, or parallax jump, completing the transition
 *    under unified spring physics.
 * 3. Elastic Rubber-Band Resistance: Swiping past the first ("PDF Section") or last section
 *    applies logarithmic rubber-band tension (0.22x resistance) and snaps back smoothly.
 * 4. Seamless Parallax, Scale & Opacity Effects: Active and adjacent section panels dynamically
 *    interpolate opacity, scale, and parallax depth offset as they slide into and out of focus.
 */
export function FluidSwipePager<T extends string>({
  tabOrder,
  activeTab,
  onSelectTab,
  renderSection,
  dragProgressMotion,
}: FluidSwipePagerProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);
  const [renderAdjacentPanels, setRenderAdjacentPanels] =
    useState<boolean>(false);

  const activeIndex = tabOrder.indexOf(activeTab);
  const prevTab = activeIndex > 0 ? tabOrder[activeIndex - 1] : null;
  const nextTab =
    activeIndex < tabOrder.length - 1 ? tabOrder[activeIndex + 1] : null;

  // Measure container width for accurate 1:1 pixel-to-tab-unit synchronization
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Raw target pixel offset + spring-driven position for 60-120fps physics
  const rawDragPx = useMotionValue(0);
  const springDragPx = useSpring(rawDragPx, PAGE_SNAP_SPRING);

  // Keep dragProgressMotion synchronized in real time with springDragPx
  useMotionValueEvent(springDragPx, 'change', (latestPx) => {
    const width = Math.max(280, containerWidth);
    dragProgressMotion.set(latestPx / width);
    if (Math.abs(latestPx) < 1.5 && !gestureRef.current.active) {
      setRenderAdjacentPanels(false);
    }
  });

  // Symmetric C1-continuous Opacity, Scale, and Parallax across Active / Next / Prev panels
  const activeOpacity = useTransform(
    springDragPx,
    [-containerWidth, 0, containerWidth],
    [0.42, 1, 0.42]
  );
  const activeScale = useTransform(
    springDragPx,
    [-containerWidth, 0, containerWidth],
    [0.94, 1, 0.94]
  );
  const activeParallaxX = useTransform(
    springDragPx,
    [-containerWidth, 0, containerWidth],
    [34, 0, -34]
  );

  // Incoming NEXT panel (positioned on the right: left-full)
  const nextOpacity = useTransform(
    springDragPx,
    [-containerWidth, 0],
    [1, 0.42]
  );
  const nextScale = useTransform(
    springDragPx,
    [-containerWidth, 0],
    [1, 0.94]
  );
  const nextParallaxX = useTransform(
    springDragPx,
    [-containerWidth, 0],
    [0, -34]
  );

  // Incoming PREVIOUS panel (positioned on the left: right-full)
  const prevOpacity = useTransform(
    springDragPx,
    [0, containerWidth],
    [0.42, 1]
  );
  const prevScale = useTransform(
    springDragPx,
    [0, containerWidth],
    [0.94, 1]
  );
  const prevParallaxX = useTransform(
    springDragPx,
    [0, containerWidth],
    [34, 0]
  );

  // Gesture state refs (zero React re-renders during 120Hz touch/pointer movement)
  const gestureRef = useRef<{
    active: boolean;
    lockedAxis: 'x' | 'y' | null;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
  }>({
    active: false,
    lockedAxis: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  });

  const canIgnoreTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(
      el.closest('input, textarea, select, [data-no-swipe="true"]')
    );
  };

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (canIgnoreTarget(e.target)) return;

      gestureRef.current = {
        active: true,
        lockedAxis: null,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastTime: performance.now(),
        velocityX: 0,
      };
    },
    []
  );

  const handlePointerMoveCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g.active) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      // Lock gesture axis after 8px travel so vertical scrolling & button taps remain native
      if (g.lockedAxis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.12) {
          g.lockedAxis = 'x';
          setRenderAdjacentPanels(true);
        } else {
          g.lockedAxis = 'y';
          g.active = false;
          return;
        }
      }

      if (g.lockedAxis !== 'x') return;

      const now = performance.now();
      const dt = Math.max(1, now - g.lastTime);
      g.velocityX = ((e.clientX - g.lastX) / dt) * 1000;
      g.lastX = e.clientX;
      g.lastTime = now;

      // Elastic rubber-band resistance at outer boundaries (before first tab or past last tab)
      const isSwipingRightAtStart = activeIndex === 0 && dx > 0;
      const isSwipingLeftAtEnd =
        activeIndex === tabOrder.length - 1 && dx < 0;

      let effectiveDx = dx;
      if (isSwipingRightAtStart || isSwipingLeftAtEnd) {
        const sign = dx >= 0 ? 1 : -1;
        effectiveDx =
          sign * containerWidth * 0.22 * (1 - Math.exp(-Math.abs(dx) / 180));
      } else {
        effectiveDx = Math.max(
          -containerWidth,
          Math.min(containerWidth, dx)
        );
      }

      rawDragPx.set(effectiveDx);
      springDragPx.jump(effectiveDx);
      dragProgressMotion.set(effectiveDx / Math.max(280, containerWidth));
    },
    [
      activeIndex,
      containerWidth,
      dragProgressMotion,
      rawDragPx,
      springDragPx,
      tabOrder.length,
    ]
  );

  const finishSwipeGesture = useCallback(() => {
    const g = gestureRef.current;
    if (!g.active) return;

    const wasHorizontalSwipe = g.lockedAxis === 'x';
    const currentPx = springDragPx.get();
    const vx = g.velocityX;

    g.active = false;
    g.lockedAxis = null;

    if (!wasHorizontalSwipe) {
      return;
    }

    const distanceThreshold = Math.min(88, containerWidth * 0.15);
    const swipedToNext =
      (currentPx < -distanceThreshold || vx < -320) &&
      activeIndex < tabOrder.length - 1;
    const swipedToPrev =
      (currentPx > distanceThreshold || vx > 320) && activeIndex > 0;

    const width = Math.max(280, containerWidth);

    if (swipedToNext) {
      // C1-continuous handoff: new activeTab starts at (+width + currentPx) and springs to 0
      const nextTarget = tabOrder[activeIndex + 1];
      const handoffPx = Math.max(0, width + currentPx);
      springDragPx.jump(handoffPx);
      dragProgressMotion.set(handoffPx / width);
      rawDragPx.set(0);
      onSelectTab(nextTarget);
    } else if (swipedToPrev) {
      // C1-continuous handoff: new activeTab starts at (-width + currentPx) and springs to 0
      const prevTarget = tabOrder[activeIndex - 1];
      const handoffPx = Math.min(0, -width + currentPx);
      springDragPx.jump(handoffPx);
      dragProgressMotion.set(handoffPx / width);
      rawDragPx.set(0);
      onSelectTab(prevTarget);
    } else {
      // Elastic rubber-band snap back to current section
      rawDragPx.set(0);
    }
  }, [
    activeIndex,
    containerWidth,
    dragProgressMotion,
    onSelectTab,
    rawDragPx,
    springDragPx,
    tabOrder,
  ]);

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={finishSwipeGesture}
      onPointerCancelCapture={finishSwipeGesture}
      style={{ touchAction: 'pan-y' }}
      className="relative w-full overflow-x-hidden select-none"
    >
      {/* Multi-Panel Horizontal Sliding Track */}
      <motion.div
        style={{ x: springDragPx }}
        className="relative w-full will-change-transform"
      >
        {/* 1. Incoming / Outgoing PREVIOUS Section Panel (Left Side: right-full) */}
        {renderAdjacentPanels && prevTab && (
          <motion.div
            aria-hidden="true"
            style={{
              opacity: prevOpacity,
              scale: prevScale,
              x: prevParallaxX,
            }}
            className="pointer-events-none absolute top-0 right-full w-full pr-6 will-change-transform"
          >
            {renderSection(prevTab, false)}
          </motion.div>
        )}

        {/* 2. Current ACTIVE Section Panel (Center: 0%) */}
        <motion.div
          style={{
            opacity: activeOpacity,
            scale: activeScale,
            x: activeParallaxX,
          }}
          className="relative w-full will-change-transform"
        >
          {renderSection(activeTab, true)}
        </motion.div>

        {/* 3. Incoming / Outgoing NEXT Section Panel (Right Side: left-full) */}
        {renderAdjacentPanels && nextTab && (
          <motion.div
            aria-hidden="true"
            style={{
              opacity: nextOpacity,
              scale: nextScale,
              x: nextParallaxX,
            }}
            className="pointer-events-none absolute top-0 left-full w-full pl-6 will-change-transform"
          >
            {renderSection(nextTab, false)}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

interface FluidGlassBottomDockProps<T extends string> {
  tabs: BottomDockTabItem<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  dragProgressMotion: MotionValue<number>;
  darkMode: boolean;
}

/**
 * FluidGlassBottomDock
 *
 * Synchronizes the bottom navigation bar's active "Fluid Glass" pill glider
 * in real time (60-120 FPS) with the user's horizontal swipe gesture across all sections.
 */
export function FluidGlassBottomDock<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  dragProgressMotion,
  darkMode,
}: FluidGlassBottomDockProps<T>) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const tabCount = tabs.length;

  const targetIndexMotion = useMotionValue(activeIndex);
  const smoothBaseIndex = useSpring(targetIndexMotion, {
    stiffness: 410,
    damping: 33,
    mass: 0.72,
  });

  useEffect(() => {
    // If tab switch was triggered by a live swipe handoff, dragProgressMotion already
    // carries the remaining spring delta, so jump smoothBaseIndex to avoid double-springing.
    if (Math.abs(dragProgressMotion.get()) > 0.02) {
      targetIndexMotion.jump(activeIndex);
      smoothBaseIndex.jump(activeIndex);
    } else {
      targetIndexMotion.set(activeIndex);
    }
  }, [activeIndex, dragProgressMotion, smoothBaseIndex, targetIndexMotion]);

  // Live fractional index combines smoothBaseIndex with real-time swipe dragProgressMotion:
  // Swiping left (dragProgressMotion < 0) glides the pill right (+index).
  const liveGliderPercent = useTransform(
    [smoothBaseIndex, dragProgressMotion],
    ([baseIdx, dragProg]: number[]) => {
      const rawIdx = (baseIdx ?? 0) - (dragProg ?? 0);
      const clampedIdx = Math.max(-0.22, Math.min(tabCount - 1 + 0.22, rawIdx));
      return `${clampedIdx * 100}%`;
    }
  );

  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-30 border-t px-2 py-2 ios-glass-dock ${
        darkMode ? 'border-slate-800/80' : 'border-white/80'
      }`}
    >
      <div className="relative max-w-4xl mx-auto grid grid-cols-5 items-center">
        {/* Continuous Real-Time Synchronized Fluid Glass Glider Pill */}
        <motion.div
          style={{
            width: `${100 / tabCount}%`,
            x: liveGliderPercent,
          }}
          className="pointer-events-none absolute inset-y-0 left-0 z-0 px-1 will-change-transform"
        >
          <div className="w-full h-full rounded-xl fluid-glass-gliding-pill" />
        </motion.div>

        {/* 5 Bottom Navigation Tab Triggers with Coordinate Water Droplet Ripple */}
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <div key={tab.id} className="relative z-10 px-1">
              <FluidGlassButton
                variant="nav"
                onClick={() => onSelectTab(tab.id)}
                className={`w-full py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors !bg-transparent !border-transparent !shadow-none ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0052FF] dark:hover:text-sky-300'
                }`}
              >
                <span className="flex flex-col items-center gap-1">
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap truncate max-w-full">
                    {tab.label}
                  </span>
                </span>
              </FluidGlassButton>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
