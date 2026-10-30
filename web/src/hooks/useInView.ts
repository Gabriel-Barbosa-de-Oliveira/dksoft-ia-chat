import { useEffect, type RefObject } from "react";

/** Chama `onVisible` uma vez quando o elemento entra na janela; sem IntersectionObserver, chama de imediato. */
export function useInView(ref: RefObject<Element | null>, onVisible: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      onVisible();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onVisible();
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onVisible]);
}
