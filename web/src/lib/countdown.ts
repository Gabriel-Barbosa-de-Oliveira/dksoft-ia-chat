export function deadlineFrom(now: number, seconds: number): number {
  return now + seconds * 1000;
}

/** Segundos que faltam, arredondados para cima, com piso 0. */
export function remainingSeconds(now: number, deadline: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Anuncia a cada 15 s e ao zerar. */
export function shouldAnnounce(previous: number, next: number): boolean {
  if (next === previous) return false;
  if (next === 0) return true;
  return next % 15 === 0;
}
