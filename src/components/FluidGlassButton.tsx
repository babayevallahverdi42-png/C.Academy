import React, { useState, useRef, useCallback } from 'react';
import { motion, MotionValue, useMotionValue, useTransform } from 'motion/react';

export type FluidGlassVariant =
  | 'primary'
  | 'emerald'
  | 'surface'
  | 'active'
  | 'nav';

interface WaterDropletWave {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface FluidGlassButtonProps {
  variant?: FluidGlassVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  triggerOnHover?: boolean;
}

const VARIANT_CLASSES: Record<FluidGlassVariant, string> = {
  primary: 'fluid-glass-btn fluid-glass-btn-primary',
  emerald: 'fluid-glass-btn fluid-glass-btn-emerald',
  surface: 'fluid-glass-btn fluid-glass-btn-surface',
  active: 'fluid-glass-btn fluid-glass-btn-active',
  nav: 'fluid-glass-btn fluid-glass-nav-trigger',
};

const DROPLET_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 26,
  mass: 0.72,
};

/**
 * FluidGlassButton
 *
 * Implements:
 * 1. Dynamic iOS/visionOS Fluid Glass material (saturate(200%) blur(22px), specular rim highlights,
 *    and pointer-tracked liquid caustic meniscus).
 * 2. Coordinate-Origin Water Droplet Ripple Physics:
 *    On touch, click, or hover entry, computes exact pointer coordinates (x, y) relative to the
 *    button surface and radiates a 3-layer concentric water droplet wave (Primary Crest, Capillary Ring,
 *    and Specular Core Flash).
 */
export const FluidGlassButton: React.FC<FluidGlassButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  title,
  ariaLabel,
  triggerOnHover = true,
}) => {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [droplets, setDroplets] = useState<WaterDropletWave[]>([]);
  const lastHoverRippleRef = useRef<number>(0);

  const spawnDropletAt = useCallback((clientX: number, clientY: number) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const maxDim = Math.max(rect.width, rect.height, 96);

    el.style.setProperty('--droplet-x', `${x}px`);
    el.style.setProperty('--droplet-y', `${y}px`);

    const id = Date.now() + Math.random();
    setDroplets((prev) => [...prev.slice(-4), { id, x, y, size: maxDim }]);

    window.setTimeout(() => {
      setDroplets((prev) => prev.filter((d) => d.id !== id));
    }, 820);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    spawnDropletAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--droplet-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--droplet-y', `${e.clientY - rect.top}px`);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !triggerOnHover) return;
    const now = Date.now();
    if (now - lastHoverRippleRef.current > 420) {
      lastHoverRippleRef.current = now;
      spawnDropletAt(e.clientX, e.clientY);
    }
  };

  return (
    <motion.button
      ref={btnRef}
      type={type}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.955 }}
      transition={DROPLET_SPRING}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onClick={onClick}
      className={`${VARIANT_CLASSES[variant]} cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* Concentric Water Droplet Impact Waves Radiating from Exact Touch/Hover Coordinates */}
      {droplets.map((drop) => (
        <React.Fragment key={drop.id}>
          <span
            className="water-droplet-crest"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size,
              height: drop.size,
            }}
          />
          <span
            className="water-droplet-capillary"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size * 0.85,
              height: drop.size * 0.85,
            }}
          />
          <span
            className="water-droplet-core"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size * 0.42,
              height: drop.size * 0.42,
            }}
          />
        </React.Fragment>
      ))}

      {/* Foreground Content Layer */}
      <span className="relative z-10 inline-flex items-center justify-center gap-2 w-full">
        {children}
      </span>
    </motion.button>
  );
};

interface FluidGlassLabelButtonProps {
  variant?: FluidGlassVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * FluidGlassLabelButton
 * Wraps <label> file-picker triggers inside the PDFs & Exams creation studio
 * with identical Fluid Glass aesthetics and coordinate water-droplet waves.
 */
export const FluidGlassLabelButton: React.FC<FluidGlassLabelButtonProps> = ({
  variant = 'surface',
  children,
  className = '',
}) => {
  const labelRef = useRef<HTMLLabelElement | null>(null);
  const [droplets, setDroplets] = useState<WaterDropletWave[]>([]);

  const spawnDropletAt = useCallback((clientX: number, clientY: number) => {
    const el = labelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const maxDim = Math.max(rect.width, rect.height, 96);

    el.style.setProperty('--droplet-x', `${x}px`);
    el.style.setProperty('--droplet-y', `${y}px`);

    const id = Date.now() + Math.random();
    setDroplets((prev) => [...prev.slice(-4), { id, x, y, size: maxDim }]);

    window.setTimeout(() => {
      setDroplets((prev) => prev.filter((d) => d.id !== id));
    }, 820);
  }, []);

  return (
    <motion.label
      ref={labelRef}
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={DROPLET_SPRING}
      onPointerDown={(e) => spawnDropletAt(e.clientX, e.clientY)}
      onPointerMove={(e) => {
        const el = labelRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--droplet-x', `${e.clientX - rect.left}px`);
        el.style.setProperty('--droplet-y', `${e.clientY - rect.top}px`);
      }}
      className={`${VARIANT_CLASSES[variant]} cursor-pointer select-none ${className}`}
    >
      {droplets.map((drop) => (
        <React.Fragment key={drop.id}>
          <span
            className="water-droplet-crest"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size,
              height: drop.size,
            }}
          />
          <span
            className="water-droplet-capillary"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size * 0.85,
              height: drop.size * 0.85,
            }}
          />
        </React.Fragment>
      ))}
      <span className="relative z-10 flex items-center justify-between w-full">
        {children}
      </span>
    </motion.label>
  );
};

interface FluidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * FluidGlassCard
 * Interactive frosted-glass card container for PDFs & Exams.
 * Spawns a coordinate-origin Water Droplet Impact wave when tapped/clicked directly
 * (while ignoring pointer events that already originated inside a nested button/label).
 */
export const FluidGlassCard: React.FC<FluidGlassCardProps> = ({
  children,
  className = '',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [droplets, setDroplets] = useState<WaterDropletWave[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, label, input, textarea, select, a')) {
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const maxDim = Math.max(rect.width, rect.height, 140) * 0.85;

    const id = Date.now() + Math.random();
    setDroplets((prev) => [...prev.slice(-3), { id, x, y, size: maxDim }]);

    window.setTimeout(() => {
      setDroplets((prev) => prev.filter((d) => d.id !== id));
    }, 840);
  };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      className={`fluid-glass-item-card ${className}`}
    >
      {droplets.map((drop) => (
        <React.Fragment key={drop.id}>
          <span
            className="water-droplet-crest"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size,
              height: drop.size,
            }}
          />
          <span
            className="water-droplet-capillary"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size * 0.82,
              height: drop.size * 0.82,
            }}
          />
          <span
            className="water-droplet-core"
            style={{
              left: drop.x,
              top: drop.y,
              width: drop.size * 0.36,
              height: drop.size * 0.36,
            }}
          />
        </React.Fragment>
      ))}
      {children}
    </div>
  );
};

export interface FluidGlassTabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface FluidGlassTabBarProps<T extends string> {
  tabs: FluidGlassTabItem<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  layoutId: string;
  dragX?: MotionValue<number>;
  className?: string;
  buttonClassName?: string;
}

const GLIDING_PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 410,
  damping: 30,
  mass: 0.72,
};

/**
 * FluidGlassTabBar
 * Renders a Fluid Glass tab rail where:
 * 1. Every tab button triggers coordinate-origin Water Droplet Impact ripples on touch/click.
 * 2. An animated Fluid Glass Gliding Pill (`layoutId`) glides smoothly across tabs AND
 *    shifts in real time in response to horizontal swipe `dragX` physics.
 */
export function FluidGlassTabBar<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  layoutId,
  dragX,
  className = '',
  buttonClassName = '',
}: FluidGlassTabBarProps<T>) {
  const fallbackDragX = useMotionValue(0);
  const pillShiftX = useTransform(
    dragX ?? fallbackDragX,
    [-260, 0, 260],
    [32, 0, -32]
  );

  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrubbingRef = useRef(false);
  const activeTabRef = useRef<T>(activeTab);
  activeTabRef.current = activeTab;

  const hitTestTab = useCallback(
    (clientX: number, clientY: number) => {
      for (const tab of tabs) {
        const el = tabRefs.current[tab.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (
          clientX >= rect.left - 4 &&
          clientX <= rect.right + 4 &&
          clientY >= rect.top - 8 &&
          clientY <= rect.bottom + 8
        ) {
          if (activeTabRef.current !== tab.id) {
            activeTabRef.current = tab.id;
            onSelectTab(tab.id);
          }
          break;
        }
      }
    },
    [onSelectTab, tabs]
  );

  return (
    <div
      data-no-swipe="true"
      onPointerDown={(e) => {
        isScrubbingRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors
        }
        hitTestTab(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!isScrubbingRef.current) return;
        hitTestTab(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        isScrubbingRef.current = false;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore release errors
        }
      }}
      onPointerCancel={() => {
        isScrubbingRef.current = false;
      }}
      style={{ touchAction: 'none' }}
      className={`fluid-glass-tab-rail p-1.5 rounded-2xl inline-flex items-center gap-1.5 select-none ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            className="relative flex-1 sm:flex-initial"
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                style={dragX ? { x: pillShiftX } : undefined}
                transition={GLIDING_PILL_SPRING}
                className="fluid-glass-droplet-glider absolute inset-0 rounded-xl z-0 pointer-events-none"
              />
            )}
            <FluidGlassButton
              variant="nav"
              onClick={() => onSelectTab(tab.id)}
              className={`relative z-10 w-full px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors !bg-transparent !border-transparent !shadow-none ${
                isActive
                  ? 'text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:text-[#0052FF] dark:hover:text-sky-300'
              } ${buttonClassName}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </FluidGlassButton>
          </div>
        );
      })}
    </div>
  );
}
