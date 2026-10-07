import { useEffect, useState } from "react";
import { getDiseases } from "../services/diseaseService";

// The disease library rarely changes, so it is loaded once per page load
// and shared by the library, the feedback form and the weather widget.
let cached = null;

const loadDiseases = () => {
  if (!cached) {
    cached = getDiseases()
      .then((data) => data.diseases || [])
      .catch((error) => {
        cached = null;
        throw error;
      });
  }

  return cached;
};

function useDiseases() {
  const [state, setState] = useState({ diseases: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    loadDiseases()
      .then((diseases) => {
        if (active) {
          setState({ diseases, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            diseases: [],
            loading: false,
            error: error.response?.data?.message || "Unable to load the disease library.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export default useDiseases;
