'use client';

import { useEffect, useState } from 'react';
import { fetchSpeedrunName } from '@/lib/speedrun';

/** Name of a speedrun.com platform or region from its ID; null while loading, when unknown or offline. */
export function useSpeedrunName(kind: 'platforms' | 'regions', id: string | null): string | null {
  const [found, setFound] = useState<{ id: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchSpeedrunName(kind, id, { signal: controller.signal })
      .then((name) => setFound({ id, name }))
      .catch(() => {
        // Offline or not found: the extras simply leave it out.
      });
    return () => controller.abort();
  }, [kind, id]);

  return id && found?.id === id ? found.name : null;
}
