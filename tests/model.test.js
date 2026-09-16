import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  stats,
  weightProgress,
  weightInsight,
  recommendations,
  weekKey,
} from "../model.js";
function base() {
  const s = initialState();
  s.profile = { start: 315, target: 230 };
  return s;
}
function row(id, rir = 2, pain = false) {
  return {
    id,
    finished: `2026-09-${id === "a" ? "10" : "12"}T12:00:00Z`,
    sets: Array.from({ length: 2 }, () => ({
      exercise: "row",
      variant: "Seated cable row",
      weight: 60,
      reps: 10,
      rir,
      pain,
    })),
  };
}
test("starting weight creates no fictional loss or XP", () => {
  const s = base();
  assert.equal(weightProgress(s).percent, 0);
  assert.equal(stats(s).xp, 0);
});
test("weight progress uses latest measurement and clamps at target", () => {
  const s = base();
  s.checks = [{ weight: 300 }, { weight: 230 }];
  assert.equal(weightProgress(s).percent, 100);
  assert.equal(weightProgress(s).remaining, 0);
});
test("one weigh-in does not trigger a trend recommendation", () => {
  const s = base();
  s.checks = [{ weight: 305, date: "2026-09-01" }];
  assert.match(weightInsight(s), /at least three/);
});
test("closely spaced measurements do not create weekly trend", () => {
  const s = base();
  s.checks = [
    { weight: 315, date: "2026-09-01" },
    { weight: 314, date: "2026-09-02" },
    { weight: 313, date: "2026-09-03" },
  ];
  assert.match(weightInsight(s), /too close/);
});
test("two comparable sessions allow a rep suggestion; acceptance prevents repeat", () => {
  const s = base();
  s.sessions = [row("a")];
  assert.deepEqual(recommendations(s), []);
  s.sessions.push(row("b"));
  const r = recommendations(s)[0];
  assert.equal(r.reps, 11);
  s.decisions.push({ signature: r.signature });
  assert.deepEqual(recommendations(s), []);
});
test("hard effort and changed loads prevent progression", () => {
  const s = base();
  s.sessions = [row("a"), row("b", 0)];
  assert.deepEqual(recommendations(s), []);
  s.sessions = [row("a"), row("b")];
  s.sessions[1].sets[0].weight = 70;
  assert.deepEqual(recommendations(s), []);
});
test("pain blocks progression even in otherwise successful sets", () => {
  const s = base();
  s.sessions = [row("a"), row("b", 2, true)];
  assert.equal(recommendations(s)[0].type, "review");
  assert.equal(recommendations(s)[0].reps, null);
});
test("weekly grouping uses Monday boundary", () => {
  assert.equal(weekKey(new Date("2026-09-13T12:00:00")), "2026-09-07");
  assert.equal(weekKey(new Date("2026-09-14T12:00:00")), "2026-09-14");
});
test("low recovery suppresses progression", () => {
  const s = base();
  s.sessions = [row("a"), row("b")];
  const d = new Date();
  s.checks = [
    {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      energy: 1,
      recovery: 2,
    },
  ];
  assert.deepEqual(recommendations(s), []);
});

test("duration budgets from 15 to 90 total correctly without unlimited sets", async () => {
  const { sessionPlan, plannedSets } = await import("../model.js");
  for (let m = 15; m <= 90; m++) {
    const p = sessionPlan(m);
    assert.equal(p.warmup + p.strength + p.cardio + p.cooldown, m);
    assert.ok(p.cardio >= 0);
    assert.ok(p.sets <= 3);
  }
  assert.equal(plannedSets({ short: true }), 1);
  assert.equal(plannedSets({ short: false }), 2);
  assert.equal(plannedSets({ minutes: 90 }), 3);
});
test("long workouts must meet all three sets for progression", () => {
  const s = base();
  s.sessions = [
    { ...row("a"), minutes: 90 },
    { ...row("b"), minutes: 90 },
  ];
  assert.deepEqual(recommendations(s), []);
  for (const w of s.sessions) w.sets.push({ ...w.sets[0] });
  assert.equal(recommendations(s)[0].reps, 11);
});
