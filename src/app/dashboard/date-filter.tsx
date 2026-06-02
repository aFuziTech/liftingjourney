"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/_base/date-picker";

export interface DateFilterProps {
  /** The currently selected date, reflected in the URL. */
  value: Date;
}

/**
 * Client island wrapping {@link DatePicker}. Reflects the selected day into the
 * `?date=` search param so the dashboard Server Component can fetch for it.
 */
export function DateFilter({ value }: DateFilterProps) {
  const router = useRouter();

  return (
    <DatePicker
      value={value}
      onChange={(date) => {
        router.push(date ? `/dashboard?date=${format(date, "yyyy-MM-dd")}` : "/dashboard");
      }}
    />
  );
}
