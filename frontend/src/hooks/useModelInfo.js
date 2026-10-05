import { useEffect, useState } from "react";
import { getModelInfo } from "../services/modelService";

// Returns the model info, or null while loading / if the AI service is not running.
function useModelInfo() {
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    let active = true;

    getModelInfo()
      .then((data) => {
        if (active) {
          setModelInfo(data);
        }
      })
      .catch(() => {
        if (active) {
          setModelInfo(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return modelInfo;
}

export default useModelInfo;
