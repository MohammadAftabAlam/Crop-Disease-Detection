import { useContext } from "react";
import { PreferencesContext } from "../context/PreferencesContext";

function usePreferences() {
  return useContext(PreferencesContext);
}

export default usePreferences;
