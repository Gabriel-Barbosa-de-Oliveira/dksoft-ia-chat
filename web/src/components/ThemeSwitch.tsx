import { useId } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme.ts";
import styles from "./ThemeSwitch.module.css";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
] as const;

/** Aparência da barra lateral: radios nativos, operáveis por teclado. */
export function ThemeSwitch() {
  const name = useId();
  const { theme, choose } = useTheme();
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>Aparência</legend>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input type="radio" className="sr-only" name={name} checked={theme === option.value} onChange={() => choose(option.value)} />
            <option.Icon size={16} aria-hidden="true" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
