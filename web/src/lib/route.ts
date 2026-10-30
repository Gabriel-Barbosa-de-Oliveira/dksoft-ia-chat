export type AppRoute = { kind: "new" } | { kind: "conversation"; id: string } | { kind: "unknown" };

/** `/` → conversa nova; `/c/:id` → conversa; qualquer outra coisa → desconhecida (redireciona para `/`). */
export function parseRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return { kind: "new" };
  const m = /^\/c\/([^/]+)$/.exec(clean);
  if (m) {
    try {
      return { kind: "conversation", id: decodeURIComponent(m[1]!) };
    } catch {
      return { kind: "conversation", id: m[1]! };
    }
  }
  return { kind: "unknown" };
}

export function conversationPath(id: string): string {
  return `/c/${encodeURIComponent(id)}`;
}
