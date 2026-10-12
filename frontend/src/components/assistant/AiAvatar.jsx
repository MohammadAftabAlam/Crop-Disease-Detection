import React from "react";
import LogoMark from "../LogoMark";
import { cx } from "../ui";

const SIZES = { sm: "size-7", md: "size-9", lg: "size-16" };

// CropCare AI's face: the brand emblem on a round tile. While thinking, a ring spins around it.
function AiAvatar({ size = "sm", thinking = false, className }) {
  const box = SIZES[size];

  return (
    <span className={cx("relative grid shrink-0 place-items-center rounded-full", box, className)}>
      {thinking && (
        <span aria-hidden="true" className="absolute -inset-1 overflow-hidden rounded-full">
          <span className="absolute -inset-1/2 animate-spin-slow bg-ai-conic motion-reduce:animate-none" />
        </span>
      )}
      <span className={cx("relative grid place-items-center rounded-full bg-surface ring-1 ring-border shadow-[0_0_18px_-6px_var(--glow)]", box)}>
        <LogoMark className="size-[80%]" />
      </span>
    </span>
  );
}

export default AiAvatar;
