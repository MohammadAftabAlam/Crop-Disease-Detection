import React from "react";
import logoMark from "../assets/brand/logo-mark.webp";
import { cx } from "./ui";

// The CropCare AI emblem (leaf "C" around a camera lens), cut out of the brand artwork.
// Decorative by default; pass alt when it stands alone.
function LogoMark({ className, alt = "" }) {
  return <img src={logoMark} alt={alt} draggable="false" className={cx("shrink-0 object-contain select-none", className)} />;
}

export default LogoMark;
