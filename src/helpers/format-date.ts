import { format } from "date-fns";

/** Formats a date in the project's house style, e.g. "1st Sep 2021". */
export function formatDate(date: Date | number): string {
  return format(date, "do MMM yyyy");
}
