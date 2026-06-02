"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/helpers";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** Currently selected date. */
  value?: Date;
  /** Fired when the user picks a date. */
  onChange?: (date: Date | undefined) => void;
  /** Placeholder shown when no date is selected. */
  placeholder?: string;
  className?: string;
}

/**
 * A single-date picker composed from the shadcn `Popover` + `Calendar`
 * primitives. Displays the selected date in the project's house format.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "w-full justify-start gap-2 font-normal sm:w-56",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon />
          {value ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
