/**
 * Single homepage user-location model: one initial geolocation read, then bias vs strict (Nearby) modes.
 */

export type UserLocationState =
  | { status: 'unknown' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'granted'; lat: number; lng: number };

/** True once the initial browser geolocation attempt has finished (any outcome). */
export function isLocationResolved(state: UserLocationState): boolean {
  return state.status !== 'unknown';
}

/**
 * Request geolocation once (moderate cache OK). Call from client mount only.
 */
export function runInitialGeolocation(onDone: (next: UserLocationState) => void): void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    onDone({ status: 'unsupported' });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onDone({
        status: 'granted',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    () => onDone({ status: 'denied' }),
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
  );
}
