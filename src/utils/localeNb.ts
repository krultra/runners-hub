export function formatDateTimeNb(value: Date | string | number | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('nb-NO', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function formatDateNb(value: Date | string | number | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('nb-NO', {
    year: 'numeric', month: 'short', day: '2-digit'
  }).format(d);
}

export function nbGenderLabel(gender: string | null | undefined): string {
  if (!gender) return '';
  const g = String(gender).toLowerCase();
  if (g === 'male' || g === 'm' || g === 'menn') return 'Menn';
  if (g === 'female' || g === 'f' || g === 'kvinner') return 'Kvinner';
  return '';
}

export function nbClassLabel(value: string | null | undefined): string {
  if (!value) return '';
  const v = String(value).toLowerCase();
  if (v === 'konkurranse') return 'Konkurranse';
  if (v === 'trim_tidtaking' || v === 'trim' || v === 'timed') return 'Trim med tidtaking';
  if (v === 'turklasse' || v === 'hike') return 'Turklasse';
  return value;
}
