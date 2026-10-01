'use client';

import React, { useState } from 'react';

/**
 * An image scaled, up or down, until its width or its height reaches `size`
 * (whichever comes first), keeping its proportions. LiveSplit sends icons as
 * data URLs, so the real proportions are known as soon as it loads.
 */
export function FittedImage({ src, size, className }: { src: string; size: number; className?: string }) {
  // Width over height, once loaded; tracked per source so a new image starts over.
  const [loaded, setLoaded] = useState<{ src: string; ratio: number } | null>(null);
  const ratio = loaded?.src === src ? loaded.ratio : null;
  const style: React.CSSProperties =
    ratio === null
      ? { maxWidth: size, maxHeight: size }
      : ratio >= 1
        ? { width: size, height: size / ratio }
        : { width: size * ratio, height: size };
  return (
    // Data URL sent by LiveSplit; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (naturalWidth > 0 && naturalHeight > 0) setLoaded({ src, ratio: naturalWidth / naturalHeight });
      }}
      className={className}
      style={style}
    />
  );
}
