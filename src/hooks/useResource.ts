import { useCallback, useEffect, useRef, useState } from 'react';
import { toMessage } from '../lib/errors';

interface State<T> { data: T | null; loading: boolean; error: string | null }

export function useResource<T>(key: string, loader: () => Promise<T>, opts: { enabled?: boolean; pollMs?: number } = {}) {
  const { enabled = true, pollMs } = opts;
  const [state, setState] = useState<State<T>>({ data: null, loading: enabled, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: toMessage(e) });
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: null }); return; }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !pollMs) return;
    const id = setInterval(run, pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, run]);

  return { ...state, reload: run };
}
