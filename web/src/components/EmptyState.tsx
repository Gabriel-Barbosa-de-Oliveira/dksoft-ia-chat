import { SUGGESTIONS } from "../lib/suggestions.ts";
import styles from "./EmptyState.module.css";

/** Estado vazio do chat. Acionar uma sugestão só preenche o campo (FR-014). */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <section className={styles.root} aria-labelledby="empty-title">
      <h2 id="empty-title" className={styles.title}>
        O que você quer saber?
      </h2>
      <p className={styles.lead}>
        Pergunte sobre alunos, pacotes e contas a receber ou pagas. O assistente consulta os dados da DKSOFT e responde em
        português.
      </p>
      <ul className={styles.list}>
        {SUGGESTIONS.map((text) => (
          <li key={text}>
            <button type="button" className={`card ${styles.card}`} onClick={() => onPick(text)}>
              {text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
