// Ingestion runs hourly, so shorter intervals would not refresh any sooner.
export const REFRESH_INTERVALS = [
  { minutes: 60, label: "Every hour" },
  { minutes: 180, label: "Every 3 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
] as const;

export function isRefreshInterval(minutes: number): boolean {
  return REFRESH_INTERVALS.some((option) => option.minutes === minutes);
}

/** "Every hour", or a plain description for values set outside the app. */
export function refreshIntervalLabel(minutes: number): string {
  const option = REFRESH_INTERVALS.find((candidate) => candidate.minutes === minutes);
  if (option) return option.label;
  return minutes % 60 === 0 ? `Every ${minutes / 60} hours` : `Every ${minutes} minutes`;
}
