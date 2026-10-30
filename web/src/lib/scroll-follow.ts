export interface ScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/** Acompanha a resposta enquanto a pessoa estiver a até `tolerance` do fim. */
export function shouldFollow({ scrollTop, clientHeight, scrollHeight }: ScrollMetrics, tolerance = 48): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= tolerance;
}
