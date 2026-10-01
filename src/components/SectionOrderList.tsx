'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OverlaySection } from '@/types';

/** Pixels the pointer must travel before a press on a block turns into a drag. */
const DRAG_THRESHOLD = 4;

interface Drag {
  section: OverlaySection;
  pointerId: number;
  startY: number;
  /** The block's offsetTop when the press started. */
  startTop: number;
  y: number;
  active: boolean;
}

function moved(order: readonly OverlaySection[], section: OverlaySection, index: number): OverlaySection[] {
  const next = order.filter((item) => item !== section);
  next.splice(Math.max(0, Math.min(next.length, index)), 0, section);
  return next;
}

/**
 * The page's sections as blocks, top to bottom, that can be dragged into a new
 * order: anywhere on the block with a mouse, by the grip on touch screens (so
 * the panel still scrolls), or with the arrow keys on the grip. `onReorder`
 * runs once, on drop; `byKeyboard` tells keyboard moves apart.
 */
export function SectionOrderList({
  order,
  onReorder,
  moveLabel,
  children,
}: {
  order: readonly OverlaySection[];
  onReorder: (order: OverlaySection[], byKeyboard: boolean) => void;
  /** Accessible name of the grip of `section`. */
  moveLabel: (section: OverlaySection) => string;
  /** The contents of the block of `section`. */
  children: (section: OverlaySection) => React.ReactNode;
}) {
  const blocks = useRef(new Map<OverlaySection, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  // The order shown while dragging; the saved one otherwise.
  const [draft, setDraftState] = useState<OverlaySection[] | null>(null);
  // The same, for pointer events that arrive before the next render.
  const draftRef = useRef<OverlaySection[] | null>(null);
  const setDraft = (next: OverlaySection[] | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const [dragged, setDragged] = useState<OverlaySection | null>(null);
  const shown = draft ?? order;
  const lastTops = useRef(new Map<OverlaySection, number>());
  const focusAfterMove = useRef<OverlaySection | null>(null);

  /** Keeps the dragged block under the pointer, wherever the list has placed it. */
  const follow = () => {
    const current = drag.current;
    const element = current && blocks.current.get(current.section);
    if (!current || !element) return;
    element.style.transform = `translateY(${current.startTop + current.y - current.startY - element.offsetTop}px)`;
  };

  // After each reorder: the other blocks glide from where they were, and the dragged one stays under the pointer.
  useLayoutEffect(() => {
    for (const [section, element] of blocks.current) {
      const before = lastTops.current.get(section);
      const now = element.offsetTop;
      lastTops.current.set(section, now);
      if (section === dragged || before === undefined || before === now) continue;
      element.style.transition = 'none';
      element.style.transform = `translateY(${before - now}px)`;
      void element.offsetHeight;
      element.style.transition = 'transform 150ms ease';
      element.style.transform = '';
    }
    follow();
    if (focusAfterMove.current) {
      blocks.current.get(focusAfterMove.current)?.querySelector<HTMLElement>('[data-grip]')?.focus();
      focusAfterMove.current = null;
    }
  });

  const onPointerDown = (section: OverlaySection) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return;
    const target = event.target as HTMLElement;
    const onGrip = !!target.closest('[data-grip]');
    // The switch keeps working as a switch; on touch only the grip drags, so the panel still scrolls.
    if (!onGrip && (target.closest('button, a, input') || event.pointerType !== 'mouse')) return;
    drag.current = {
      section,
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: event.currentTarget.offsetTop,
      y: event.clientY,
      active: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.y = event.clientY;
    if (!current.active) {
      if (Math.abs(current.y - current.startY) < DRAG_THRESHOLD) return;
      current.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragged(current.section);
      setDraft([...order]);
    }
    const element = blocks.current.get(current.section);
    if (!element) return;
    // The slot is the number of other blocks whose middle is above the dragged block's middle.
    const middle = current.startTop + current.y - current.startY + element.offsetHeight / 2;
    const list = draftRef.current ?? order;
    const index = list.filter((section) => {
      const other = blocks.current.get(section);
      return section !== current.section && other && other.offsetTop + other.offsetHeight / 2 < middle;
    }).length;
    if (list.indexOf(current.section) !== index) setDraft(moved(list, current.section, index));
    else follow();
  };

  const finish = (commit: boolean) => (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const element = blocks.current.get(current.section);
    if (element) {
      element.style.transition = 'transform 150ms ease';
      element.style.transform = '';
    }
    if (!current.active) return;
    const result = draftRef.current;
    setDraft(null);
    setDragged(null);
    if (commit && result && result.some((section, i) => section !== order[i])) onReorder(result, false);
  };

  const onGripKeyDown = (section: OverlaySection) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = order.indexOf(section) + step;
    if (index < 0 || index >= order.length) return;
    focusAfterMove.current = section;
    onReorder(moved(order, section, index), true);
  };

  return (
    <div className="relative space-y-2">
      {shown.map((section) => (
        <div
          key={section}
          ref={(element) => {
            if (element) blocks.current.set(section, element);
            else blocks.current.delete(section);
          }}
          onPointerDown={onPointerDown(section)}
          onPointerMove={onPointerMove}
          onPointerUp={finish(true)}
          onPointerCancel={finish(false)}
          data-section={section}
          className={cn(
            'relative flex cursor-grab select-none items-center rounded-lg bg-white/[0.03] transition-colors hover:bg-white/5',
            dragged === section && 'z-10 cursor-grabbing bg-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-accent',
          )}
        >
          <button
            type="button"
            data-grip
            aria-label={moveLabel(section)}
            title={moveLabel(section)}
            onKeyDown={onGripKeyDown(section)}
            className="flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-l-lg text-[var(--text-dim)] transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 flex-1">{children(section)}</div>
        </div>
      ))}
    </div>
  );
}
