import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { shouldFollow } from "../lib/scroll-follow.ts";

/** Acompanha o fim da conversa; deixa de acompanhar se a pessoa rolar para cima. */
export function useAutoFollow(containerRef: RefObject<HTMLElement | null>, changeToken: unknown) {
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const next = shouldFollow({ scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight });
    followingRef.current = next;
    setFollowing(next);
  }, [containerRef]);

  const scrollToEnd = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    followingRef.current = true;
    setFollowing(true);
  }, [containerRef]);

  useEffect(() => {
    if (followingRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [changeToken, containerRef]);

  return { following, onScroll, scrollToEnd };
}
