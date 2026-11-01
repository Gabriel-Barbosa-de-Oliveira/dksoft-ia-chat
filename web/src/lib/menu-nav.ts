/** Navegação por teclado de um menu (padrão WAI-ARIA de menu button). Puro. */
export type MenuKeyAction = { type: "focus"; index: number } | { type: "close"; refocus: boolean } | { type: "none" };

export function menuKeyAction(key: string, current: number, count: number): MenuKeyAction {
  if (count <= 0) return { type: "none" };
  switch (key) {
    case "ArrowDown":
      return { type: "focus", index: current < 0 ? 0 : (current + 1) % count };
    case "ArrowUp":
      return { type: "focus", index: current <= 0 ? count - 1 : current - 1 };
    case "Home":
      return { type: "focus", index: 0 };
    case "End":
      return { type: "focus", index: count - 1 };
    case "Escape":
      return { type: "close", refocus: true };
    case "Tab":
      return { type: "close", refocus: false };
    default:
      return { type: "none" };
  }
}
