export function formatSeconds1d(seconds?: number | null): string {
  if (seconds == null || isNaN(seconds as any)) return '-';
  const s = Math.max(0, Number(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rem = (s % 60);
  const remStr = rem.toFixed(1).padStart(4, '0'); // e.g., 3.2 -> '03.2'
  const mm = minutes.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${remStr}`;
  }
  return `${minutes}:${remStr}`;
}
