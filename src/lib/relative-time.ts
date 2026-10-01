const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "in 20 minutes", "now". Server-rendered, so no time zone is involved. */
export function relativeTime(date: Date, now: Date): string {
  const difference = date.getTime() - now.getTime();
  for (const [unit, milliseconds] of UNITS) {
    if (Math.abs(difference) >= milliseconds) {
      return formatter.format(Math.round(difference / milliseconds), unit);
    }
  }
  return "just now";
}
