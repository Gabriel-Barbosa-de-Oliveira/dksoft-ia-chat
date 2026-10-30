import styles from "./Skeleton.module.css";

export function Skeleton({ lines = 3, label = "Carregando…" }: { lines?: number; label?: string }) {
  return (
    <div className={styles.root} role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.bar} aria-hidden="true" />
      ))}
    </div>
  );
}
