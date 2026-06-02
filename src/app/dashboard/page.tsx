"use client";

import * as React from "react";
import { CalendarX2 } from "lucide-react";

import { DatePicker } from "@/components/_base/date-picker";
import {
  WorkoutCard,
  type WorkoutView,
} from "@/components/workout-card";
import { formatDate } from "@/helpers";

// Placeholder view data — wiring to real data fetching is out of scope here.
const PLACEHOLDER_WORKOUTS: WorkoutView[] = [
  {
    id: "1",
    name: "Push Day",
    startedAt: new Date(2026, 5, 2, 18, 30),
    completedAt: new Date(2026, 5, 2, 19, 45),
    notes: "Felt strong on bench, slight shoulder tightness on the last set.",
    exercises: [
      {
        id: "e1",
        name: "Bench Press",
        sets: [
          { id: "s1", weight: 60, reps: 10, isWarmup: true },
          { id: "s2", weight: 80, reps: 8 },
          { id: "s3", weight: 80, reps: 8 },
          { id: "s4", weight: 85, reps: 6 },
        ],
      },
      {
        id: "e2",
        name: "Overhead Press",
        sets: [
          { id: "s5", weight: 40, reps: 10 },
          { id: "s6", weight: 40, reps: 9 },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Core Finisher",
    startedAt: new Date(2026, 5, 2, 19, 50),
    completedAt: new Date(2026, 5, 2, 20, 5),
    exercises: [
      {
        id: "e3",
        name: "Hanging Leg Raise",
        sets: [
          { id: "s7", reps: 15 },
          { id: "s8", reps: 12 },
        ],
      },
    ],
  },
];

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date(),
  );

  // UI only — not filtered against a data source.
  const workouts = PLACEHOLDER_WORKOUTS;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDate
              ? `Workouts on ${formatDate(selectedDate)}`
              : "Select a date to view workouts"}
          </p>
        </div>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      <section className="flex flex-col gap-4">
        {workouts.length > 0 ? (
          workouts.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <CalendarX2 className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No workouts logged</p>
              <p className="text-sm text-muted-foreground">
                {selectedDate
                  ? `Nothing recorded for ${formatDate(selectedDate)}.`
                  : "Pick a date to see your sessions."}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
