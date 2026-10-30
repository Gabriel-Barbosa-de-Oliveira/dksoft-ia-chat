import styles from "./Skeleton.module.css";

/** `block` imita itens de lista; o padrão imita linhas de texto. */
export function Skeleton({ lines = 3, label = "Carregando…", block = false }: { lines?: number; label?: string; block?: boolean }) {
  return (
    <div className={styles.root} role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={block ? `${styles.bar} ${styles.block}` : styles.bar} aria-hidden="true" />
      ))}
    </div>
  );
}
