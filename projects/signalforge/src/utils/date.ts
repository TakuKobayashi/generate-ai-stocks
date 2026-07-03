export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function isoToDate(iso: string): Date {
  return new Date(iso);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
