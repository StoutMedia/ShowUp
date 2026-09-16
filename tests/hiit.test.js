import test from "node:test";
import assert from "node:assert/strict";
import {
  HIIT_ID,
  dayURL,
  nextDay,
  completedDays,
  logProgramDay,
} from "../hiit.js";
import { initialState, stats, recommendations } from "../model.js";
const input = {
  day: 1,
  level: 1,
  minutes: 12,
  effort: "moderate",
  notes: "Completed",
};
test("official links retain actual day indexing", () => {
  assert.equal(
    dayURL(1),
    "https://darebee.com/programs/30-days-of-hiit.html?start=1",
  );
  assert.match(dayURL(30), /start=30$/);
  assert.throws(() => dayURL(31));
  assert.throws(() => dayURL(0));
});
test("completion advances next day and counts as one real session", () => {
  const s = logProgramDay(initialState(), input);
  assert.equal(nextDay(s), 2);
  assert.equal(stats(s).xp, 100);
  assert.equal(stats(s).total, 1);
  assert.deepEqual(recommendations(s), []);
});
test("editing a day does not double count completion or XP", () => {
  const a = logProgramDay(
    initialState(),
    input,
    new Date("2026-09-15T12:00:00Z"),
  );
  const b = logProgramDay(
    a,
    { ...input, minutes: 15, level: 2 },
    new Date("2026-09-16T12:00:00Z"),
  );
  assert.equal(b.sessions.length, 1);
  assert.equal(stats(b).xp, 100);
  assert.equal(b.sessions[0].minutes, 15);
  assert.equal(b.sessions[0].finished, a.sessions[0].finished);
});
test("days can be completed out of order and retain missing next day", () => {
  let s = logProgramDay(initialState(), { ...input, day: 10 });
  assert.equal(nextDay(s), 1);
  for (let d = 1; d <= 30; d++) s = logProgramDay(s, { ...input, day: d });
  assert.equal(completedDays(s).size, 30);
  assert.equal(nextDay(s), 30);
  assert.equal(s.sessions.length, 30);
});
test("undo recalculates totals and preserves normal workouts", () => {
  const s = logProgramDay(initialState(), input);
  s.sessions.push({
    id: "regular",
    finished: new Date().toISOString(),
    sets: [{ exercise: "squat" }],
  });
  s.sessions = s.sessions.filter((w) => w.programId !== HIIT_ID);
  assert.equal(stats(s).total, 1);
  assert.equal(nextDay(s), 1);
});
test("invalid log values are rejected before storage", () => {
  for (const bad of [
    { day: 31 },
    { level: 4 },
    { minutes: 91 },
    { effort: "unknown" },
  ])
    assert.throws(() => logProgramDay(initialState(), { ...input, ...bad }));
});
