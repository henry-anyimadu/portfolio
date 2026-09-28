'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextPainting, pickPainting, type Painting } from '@/lib/paintings';

const storageKey = 'henry:last-painting';

export function usePaintingRotation() {
  const [painting, setPainting] = useState<Painting | null>(null);
  const [isChanging, setIsChanging] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const request = useRef(0);
  const requestedId = useRef<string | null>(null);

  const show = useCallback(async (candidate: Painting) => {
    const version = ++request.current;
    requestedId.current = candidate.id;
    setIsChanging(true);
    setLoadError(false);
    try {
      const preload = new Image();
      preload.src = candidate.src;
      await preload.decode();
      if (version !== request.current) return;
      setPainting(candidate);
      try { sessionStorage.setItem(storageKey, candidate.id); } catch { /* Storage is optional. */ }
    } catch {
      if (version === request.current) setLoadError(true);
    } finally {
      if (version === request.current) setIsChanging(false);
    }
  }, []);

  useEffect(() => {
    let previous: string | null = null;
    try { previous = sessionStorage.getItem(storageKey); } catch { /* Private modes may deny storage. */ }
    void show(pickPainting(previous));
    return () => { request.current++; };
  }, [show]);

  const cycle = useCallback(() => { void show(nextPainting(requestedId.current)); }, [show]);
  return { painting, isChanging, loadError, cycle };
}
