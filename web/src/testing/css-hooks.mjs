// Hooks de carregamento: qualquer .css vira um módulo cujo default é um Proxy
// que devolve o próprio nome da chave (styles.foo === "foo").
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css") || url.includes(".css?")) {
    return {
      format: "module",
      shortCircuit: true,
      source:
        "export default new Proxy({}, { get: (_t, key) => (typeof key === 'string' ? key : undefined) });",
    };
  }
  return nextLoad(url, context);
}
