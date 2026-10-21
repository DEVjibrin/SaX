import { useEffect, useState } from 'react';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

interface WakeSentinel {
  released: boolean;
  release(): Promise<void>;
}

export interface BatteryState {
  level: number | null;
  charging: boolean | null;
}

export function useBattery(): BatteryState {
  const [state, setState] = useState<BatteryState>({ level: null, charging: null });

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return undefined;
    let manager: BatteryManagerLike | null = null;
    let cancelled = false;
    const update = () => {
      if (manager) setState({ level: manager.level, charging: manager.charging });
    };

    nav
      .getBattery()
      .then((result) => {
        if (cancelled) return;
        manager = result;
        update();
        result.addEventListener('levelchange', update);
        result.addEventListener('chargingchange', update);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      manager?.removeEventListener('levelchange', update);
      manager?.removeEventListener('chargingchange', update);
    };
  }, []);

  return state;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeSentinel> } };
    if (!active || !nav.wakeLock) return undefined;
    const wakeLock = nav.wakeLock;
    let sentinel: WakeSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) await next.release();
        else sentinel = next;
      } catch {
        sentinel = null;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
