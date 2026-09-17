import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  // Empty/undefined content renders the children alone — lets call sites keep a conditional
  // tooltip (e.g. a collapsed-sidebar-only label) inline instead of branching around the wrapper.
  content?: ReactNode;
  placement?: Placement;
}

const GAP = 8;

// The arrow is a rotated square pinned to the bubble's edge, half of it tucked behind the bubble
// so only the pointing corner shows. Same slate-900 fill, so the two read as one shape.
const ARROW_POSITION: Record<Placement, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
  left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
  right: 'right-full top-1/2 -translate-y-1/2 -mr-1',
};

const ENTER_OFFSET: Record<Placement, { x: number; y: number }> = {
  top: { x: 0, y: 4 },
  bottom: { x: 0, y: -4 },
  left: { x: 4, y: 0 },
  right: { x: -4, y: 0 },
};

// Hover-triggered tooltip on a plain black surface, scaled down to tooltip sizing — the app-wide
// replacement for the browser's native `title` box. State-driven rather than CSS group-hover so
// it animates in and out through motion/react like every other popover here.
//
// The wrapper is a `display: contents` span (a span, not a div, so it's valid even inside a <p> or
// <button>), so wrapping a trigger never changes layout — an absolutely
// positioned clear-search button, a grid-placed Gantt bar, or a w-full row all keep behaving as if
// the wrapper weren't there. A contents box has no geometry of its own, so position is measured off
// the trigger element itself (the wrapper's first child).
//
// The bubble renders through a portal into document.body, positioned from that measurement —
// exactly what Dropdown.tsx already does, and for the same reason: a plain in-flow absolute bubble
// gets silently clipped the moment its trigger sits inside a scrollable container.
export default function Tooltip({ children, content, placement = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [bubbleStyle, setBubbleStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const offset = ENTER_OFFSET[placement];
  const hasContent = content !== undefined && content !== null && content !== false && content !== '';

  // Positioned as plain top/left coordinates that already account for the bubble's own measured
  // size — deliberately no CSS translate, because motion/react owns the transform property here
  // (for the x/y enter animation) and would overwrite any translate set alongside it.
  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !bubbleRef.current) return;
    const trigger = triggerRef.current.firstElementChild ?? triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();

    const positions: Record<Placement, { top: number; left: number }> = {
      top: { top: rect.top - GAP - bubble.height, left: rect.left + rect.width / 2 - bubble.width / 2 },
      bottom: { top: rect.bottom + GAP, left: rect.left + rect.width / 2 - bubble.width / 2 },
      left: { top: rect.top + rect.height / 2 - bubble.height / 2, left: rect.left - GAP - bubble.width },
      right: { top: rect.top + rect.height / 2 - bubble.height / 2, left: rect.right + GAP },
    };
    const next = positions[placement];

    // A trigger near the viewport edge (e.g. the last action column of a wide table) would
    // otherwise push the bubble half off-screen — nudge it back inside instead.
    next.left = Math.min(Math.max(next.left, GAP), window.innerWidth - bubble.width - GAP);
    next.top = Math.min(Math.max(next.top, GAP), window.innerHeight - bubble.height - GAP);

    setBubbleStyle(next);
  }, [isVisible, placement, content]);

  // The bubble is fixed-positioned from a one-time measurement, so any scroll underneath it would
  // leave it floating over the wrong spot — hide instead, the same as the native title box does.
  useEffect(() => {
    if (!isVisible) return;
    const hide = () => setIsVisible(false);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [isVisible]);

  if (!hasContent) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className="contents"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      // Pressing the trigger usually opens something (a modal, a menu) right under the pointer —
      // without this the bubble (z-70) would stay hovering above it until the mouse next moves.
      onMouseDown={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              role="tooltip"
              initial={{ opacity: 0, x: offset.x, y: offset.y }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: offset.x, y: offset.y }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ position: 'fixed', top: bubbleStyle.top, left: bubbleStyle.left }}
              className="z-70 pointer-events-none"
            >
              <div ref={bubbleRef} className="relative w-max max-w-xs bg-black text-white text-xs font-normal px-3 py-2 rounded-md shadow-md wrap-break-word">
                {content}
                <span className={`absolute w-2 h-2 bg-black rotate-45 ${ARROW_POSITION[placement]}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
