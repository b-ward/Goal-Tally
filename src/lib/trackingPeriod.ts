import type { TrackingPeriod } from '../types';

export function localDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function defaultTrackingPeriod(): TrackingPeriod {
  const year = new Date().getFullYear();
  return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
}

export function elapsedFraction(period: TrackingPeriod, today: string) {
  const start = Date.parse(period.start_date);
  const end = Date.parse(period.end_date);
  const day = 86_400_000;
  return Math.max(0, Math.min(1, (Date.parse(today) - start + day) / (end - start + day)));
}
