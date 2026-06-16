"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Dumbbell, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ExerciseOption {
  id: string;
  name: string;
}

interface ExerciseComboboxProps {
  exercises: ExerciseOption[];
  value: string;
  onSelectExisting: (option: ExerciseOption) => void;
  onCreate: (name: string) => void;
}

/**
 * Catalog picker with create-on-the-fly support. Lists existing exercises and,
 * when the typed query has no exact match, offers to create it.
 */
export function ExerciseCombobox({
  exercises,
  value,
  onSelectExisting,
  onCreate,
}: ExerciseComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  const filtered = trimmed
    ? exercises.filter((e) => e.name.toLowerCase().includes(lowerQuery))
    : exercises;
  const hasExactMatch = exercises.some(
    (e) => e.name.toLowerCase() === lowerQuery,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex-1 justify-between gap-2 font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Dumbbell className="size-4 shrink-0" />
            {value || "Select or create an exercise"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search exercises…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && !trimmed && (
              <CommandEmpty>No exercises yet.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Catalog">
                {filtered.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onSelectExisting(option);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === option.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {trimmed && !hasExactMatch && (
              <CommandGroup heading="Create new">
                <CommandItem
                  value={`create-${trimmed}`}
                  onSelect={() => {
                    onCreate(trimmed);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="size-4" />
                  Create &quot;{trimmed}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
