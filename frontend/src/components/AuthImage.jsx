import React, { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { getPredictionImage } from "../services/predictionService";
import { cx } from "./ui";

const isRemote = (src) => /^https?:\/\//.test(src || "");

// Cloudinary can resize and re-encode on the fly: at most 1200px wide, best format and quality
// for the browser (a 4 MB phone photo becomes ~150 KB)
const optimised = (src) =>
  src.includes("res.cloudinary.com") && src.includes("/image/upload/") && !src.includes("/image/upload/f_auto")
    ? src.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_1200/")
    : src;

// An <img> for a stored prediction photo.
// - Photos on Cloudinary come as an https link and load straight from its CDN.
// - Photos kept on the backend need the auth header, so they are fetched as a blob,
//   only once they scroll into view.
function AuthImage({ src, alt, className }) {
  const remote = isRemote(src);
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  const placeholderRef = useRef(null);

  useEffect(() => {
    const element = placeholderRef.current;

    if (!element || visible || remote) {
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
  }, [visible, remote]);

  useEffect(() => {
    if (!visible || !src || remote) {
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
  }, [src, visible, remote]);

  if (remote && !failed) {
    return (
      <img
        src={optimised(src)}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cx("object-cover", className)}
      />
    );
  }

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
