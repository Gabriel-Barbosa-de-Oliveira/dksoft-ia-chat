import { SUGGESTIONS } from "../lib/suggestions.ts";
import styles from "./EmptyState.module.css";

/** Estado vazio do chat. Acionar uma sugestão só preenche o campo (FR-014). */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <section className={styles.root} aria-labelledby="empty-title">
      <div className={styles.column}>
        <span className={styles.mark} aria-hidden="true" />
        <h2 id="empty-title" className={styles.title}>
          Como posso ajudar hoje?
        </h2>
        <p className={styles.lead}>Pergunte sobre alunos, pacotes, parcelas, presenças, provas e contas.</p>
        <ul className={styles.list}>
          {SUGGESTIONS.map((text) => (
            <li key={text} className={styles.entry}>
              <button type="button" className={styles.card} onClick={() => onPick(text)}>
                {text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
