import { useEffect, useState } from "react";
import { getDiseases } from "../services/diseaseService";
import usePreferences from "./usePreferences";

// The disease library rarely changes, so it is loaded once per language per page load
// and shared by the library, the feedback form and the weather widget.
const cache = {};

// The last library seen is kept on the device, so advice still shows offline
const storageKey = (lang) => `diseaseLibrary:${lang}`;

const saved = (lang) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(lang)));
  } catch {
    return null;
  }
};

const loadDiseases = (lang) => {
  if (!cache[lang]) {
    cache[lang] = getDiseases()
      .then((data) => {
        const result = { diseases: data.diseases || [], translation: data.translation || null };
        try {
          localStorage.setItem(storageKey(lang), JSON.stringify(result));
        } catch {
          // storage full or blocked: the library still works online
        }
        return result;
      })
      .catch((error) => {
        delete cache[lang];
        const copy = saved(lang) || saved("en");
        if (copy) {
          return copy;
        }
        throw error;
      });
  }

  return cache[lang];
};

function useDiseases() {
  const { lang } = usePreferences();
  const [state, setState] = useState({ diseases: [], translation: null, loading: true, error: null });

  useEffect(() => {
    let active = true;

    loadDiseases(lang)
      .then(({ diseases, translation }) => {
        if (active) {
          setState({ diseases, translation, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.response?.data?.message || "Unable to load the disease library.",
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [lang]);

  return state;
}

export default useDiseases;
