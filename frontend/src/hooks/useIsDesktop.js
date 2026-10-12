import { useEffect, useState } from "react";

// Same breakpoint as Tailwind's lg: (the sidebar layout)
const DESKTOP = "(min-width: 1024px)";

// True on wide screens; used where a panel animates differently on desktop and phones
function useIsDesktop() {
  const [matches, setMatches] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setMatches(query.matches);

    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}

export default useIsDesktop;
