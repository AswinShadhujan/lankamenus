/**
 * Single homepage user-location model: one initial geolocation read, then bias vs strict (Nearby) modes.
 */

/** Reject fixes worse than this (meters); higher accuracy value = less certain position. */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 3000;

export type UserLocationState =
  | { status: 'unknown' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  /** Fix received but accuracy too poor to trust for bias / Nearby. */
  | { status: 'low_accuracy'; accuracyM: number }
  | { status: 'granted'; lat: number; lng: number; accuracyM: number };

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
      const acc = pos.coords.accuracy;
      const accFinite = acc != null && Number.isFinite(acc);
      const tooLoose = !accFinite || acc > MAX_ACCEPTABLE_ACCURACY_METERS;

      if (tooLoose) {
        onDone({
          status: 'low_accuracy',
          accuracyM: accFinite ? (acc as number) : -1,
        });
        return;
      }

      onDone({
        status: 'granted',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: acc as number,
      });
    },
    () => onDone({ status: 'denied' }),
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
  );
}
