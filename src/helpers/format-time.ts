import { format } from "date-fns";

/** Formats the time-of-day in the project's house style, e.g. "6:30 PM". */
export function formatTime(date: Date | number): string {
  return format(date, "h:mm a");
}
