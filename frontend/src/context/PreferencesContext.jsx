import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "../i18n/en";
import hi from "../i18n/hi";

const DICTIONARIES = { en, hi };

export const PreferencesContext = createContext();

// localStorage can throw (private mode, blocked storage); the app must still work
const readSetting = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const saveSetting = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; the choice still applies until the page is reloaded
  }
};

const lookup = (dictionary, key) =>
  key.split(".").reduce((node, part) => node?.[part], dictionary);

// Theme (dark first) and language (English / Hindi) for the app pages
function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => readSetting("theme", "dark"));
  const [lang, setLang] = useState(() => readSetting("lang", "en"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveSetting("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    saveSetting("lang", lang);
  }, [lang]);

  // Saved immediately (not in an effect): pages reload their text when lang changes, and the
  // API reads the language from storage, so it must already be there when they do
  const changeLang = useCallback((next) => {
    saveSetting("lang", next);
    setLang(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  // t("dashboard.morning", { name }) -> text in the current language,
  // falling back to English, then to the key itself
  const t = useCallback(
    (key, values) => {
      let text = lookup(DICTIONARIES[lang], key) ?? lookup(en, key) ?? key;

      if (values && typeof text === "string") {
        text = text.replace(/\{(\w+)\}/g, (match, name) =>
          values[name] ?? match
        );
      }

      return text;
    },
    [lang]
  );

  // Crop names come from the backend in English ("Potato")
  const cropName = useCallback(
    (crop) => {
      if (!crop) {
        return "";
      }

      return lookup(DICTIONARIES[lang], `crops.${crop.toLowerCase()}`) || crop;
    },
    [lang]
  );

  // Disease names also come in English ("Late Blight"); unknown names are shown as they are
  const diseaseName = useCallback(
    (disease) => {
      if (!disease) {
        return "";
      }

      const key = disease.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      return lookup(DICTIONARIES[lang], `diseases.${key}`) || disease;
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      lang,
      setLang: changeLang,
      locale: lang === "hi" ? "hi-IN" : "en-IN",
      t,
      cropName,
      diseaseName,
    }),
    [theme, toggleTheme, lang, changeLang, t, cropName, diseaseName]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export default PreferencesProvider;
