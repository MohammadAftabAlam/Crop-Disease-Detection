import React, { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { ChevronsLeftRight } from "lucide-react";
import { cx } from "../ui";

// Drag to compare two images of the same size. A hidden range input does the
// work, so it also responds to the keyboard (arrow keys).
function CompareSlider({ before, after, beforeLabel, afterLabel, alt, label }) {
  const [position, setPosition] = useState(50);
  const [animating, setAnimating] = useState(false);

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();

  // A short sweep the first time it scrolls into view, to show it can be dragged
  useEffect(() => {
    if (!inView || reduceMotion) {
      return undefined;
    }

    setAnimating(true);
    const steps = [[300, 22], [1300, 78], [2300, 50], [3200, null]];
    const timers = steps.map(([delay, value]) =>
      setTimeout(() => (value === null ? setAnimating(false) : setPosition(value)), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [inView, reduceMotion]);

  const transition = animating ? "transition-all duration-700 ease-in-out" : "";

  return (
    <div ref={ref} className="relative aspect-[512/341] overflow-hidden rounded-2xl bg-surface-2 select-none">
      <img src={before} alt={alt} className="absolute inset-0 size-full object-cover" draggable="false" />
      <img
        src={after}
        alt=""
        draggable="false"
        className={cx("absolute inset-0 size-full object-cover", transition)}
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      />

      <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        {afterLabel}
      </span>

      <div
        aria-hidden="true"
        className={cx("pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]", transition)}
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
          <ChevronsLeftRight className="size-5" />
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => {
          setAnimating(false);
          setPosition(Number(event.target.value));
        }}
        aria-label={label}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

export default CompareSlider;
