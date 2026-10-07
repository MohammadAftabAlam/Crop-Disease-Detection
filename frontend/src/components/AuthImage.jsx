import React, { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { getPredictionImage } from "../services/predictionService";
import { cx } from "./ui";

// An <img> for a stored prediction photo. The endpoint needs the auth header,
// so the photo is fetched as a blob - only once it scrolls into view.
function AuthImage({ src, alt, className }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  const placeholderRef = useRef(null);

  useEffect(() => {
    const element = placeholderRef.current;

    if (!element || visible) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !src) {
      return undefined;
    }

    let active = true;
    let url = null;

    getPredictionImage(src)
      .then((blob) => {
        if (active) {
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;

      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [src, visible]);

  if (objectUrl) {
    return <img src={objectUrl} alt={alt} className={cx("object-cover", className)} />;
  }

  return (
    <div
      ref={placeholderRef}
      className={cx(
        "grid place-items-center bg-surface-2 text-subtle",
        !failed && "animate-pulse",
        className
      )}
    >
      <Leaf className="size-6" />
    </div>
  );
}

export default AuthImage;
