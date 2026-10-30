import { useCallback, useState, useSyncExternalStore } from "react";
import { resolveTheme, type ThemePreference } from "../lib/theme.ts";
import { createThemePreferenceStore } from "../storage/theme-preference.ts";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const systemIsDark = () => window.matchMedia(QUERY).matches;

/** Tema efetivo: segue o sistema até a pessoa escolher; a escolha fica em `data-theme` e no armazenamento. */
export function useTheme() {
  const [store] = useState(createThemePreferenceStore);
  const [preference, setPreference] = useState<ThemePreference>(() => store.get());
  const systemDark = useSyncExternalStore(subscribe, systemIsDark, () => false);

  const choose = useCallback(
    (next: "light" | "dark") => {
      store.set(next);
      document.documentElement.dataset.theme = next;
      setPreference(next);
    },
    [store],
  );

  return { theme: resolveTheme(preference, systemDark), choose };
}
