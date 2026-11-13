import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;

/**
 * Keeps a scroll container pinned to the bottom while content grows, but stops
 * following as soon as the user scrolls up. `jumpToLatest` re-pins.
 */
export function useAutoScroll() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let lastTop = el.scrollTop;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
      // Content growing under a pinned view must not unpin it: only an upward move counts as the user leaving.
      const movedUp = el.scrollTop < lastTop - 1;
      lastTop = el.scrollTop;
      if (atBottom) pinned.current = true;
      else if (movedUp) pinned.current = false;
      setShowJump(!pinned.current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const inner = content.current;
    if (!inner || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) scrollToBottom();
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  const jumpToLatest = useCallback(() => {
    pinned.current = true;
    setShowJump(false);
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  /** Call when the user sends a message: always follow the new reply. */
  const pin = useCallback(() => {
    pinned.current = true;
    setShowJump(false);
    scrollToBottom();
  }, [scrollToBottom]);

  return { scroller, content, showJump, jumpToLatest, pin };
}
