/** '18 min', '1 h 5 min', '1 h'. Minutes are rounded. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** '850 m' under 1 km, otherwise kilometres with one decimal, '6.2 km'. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${m} m`;
  return `${(Math.round(m / 100) / 10).toFixed(1)} km`;
}
