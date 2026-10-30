import { TriangleAlert } from "lucide-react";
import styles from "./StorageNotice.module.css";

/** Aviso discreto: o navegador bloqueou o armazenamento. Não impede o uso. */
export function StorageNotice({ persisted }: { persisted: boolean }) {
  if (persisted) return null;
  return (
    <p className={styles.root} role="status">
      <TriangleAlert className={styles.icon} size={16} aria-hidden="true" />
      <span>Seu navegador bloqueou o armazenamento; a chave e o tema não serão lembrados.</span>
    </p>
  );
}
