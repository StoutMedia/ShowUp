import { isLoggedSession } from "./hiit.js";
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const weekKey = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
};
export const uid = () => crypto.randomUUID();
export const initialState = () => ({
  version: 1,
  profile: null,
  checks: [],
  sessions: [],
  active: null,
  targets: {},
  decisions: [],
});
export const exercises = [
  {
    id: "squat",
    name: "Box squat",
    equipment: "Bodyweight · sturdy bench",
    sets: 2,
    reps: 8,
    cue: "Use a stable seat. Sit back with control, then stand. Use support if needed.",
    steps: [
      "Place a stable bench behind you; clear the surrounding space.",
      "Stand with your feet comfortably apart. Lower toward the seat with control.",
      "Stand without bouncing off the seat. Keep the movement comfortable.",
    ],
    alt: "Supported sit-to-stand",
  },
  {
    id: "row",
    name: "Seated cable row",
    equipment: "Cable machine",
    sets: 2,
    reps: 10,
    cue: "Keep your chest tall. Pull toward your lower ribs, then return with control.",
    steps: [
      "Set the seat and foot support so you can reach the handles comfortably.",
      "Keep your torso steady and draw the handles toward your lower ribs.",
      "Return slowly. Avoid jerking or leaning back to move the weight.",
    ],
    alt: "Seated resistance-band row",
  },
  {
    id: "press",
    name: "Machine chest press",
    equipment: "Chest press machine",
    sets: 2,
    reps: 10,
    cue: "Set the handles near mid-chest. Press with control and avoid locking your elbows.",
    steps: [
      "Adjust the seat so the handles are around mid-chest height.",
      "Keep your back supported and feet planted.",
      "Press smoothly, then return under control within a comfortable range.",
    ],
    alt: "Wall push-up",
  },
];
export function weekSessions(s, key = weekKey()) {
  return s.sessions.filter(
    (x) => weekKey(new Date(x.finished)) === key && isLoggedSession(x),
  );
}
export function stats(s) {
  const sessions = s.sessions.filter((x) => isLoggedSession(x));
  const xp = sessions.length * 100 + s.checks.length * 25;
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    week: weekSessions(s).length,
    total: sessions.length,
  };
}
export function weightProgress(s) {
  const p = s.profile;
  const current = s.checks.at(-1)?.weight ?? p.start;
  const delta = p.start - p.target;
  return {
    current,
    remaining: Math.max(0, current - p.target),
    lost: p.start - current,
    percent:
      delta > 0
        ? Math.min(100, Math.max(0, ((p.start - current) / delta) * 100))
        : 0,
  };
}
export function weightInsight(s) {
  if (s.checks.length < 3)
    return "Log at least three weekly check-ins to start seeing a trend. One weigh-in will not change your plan.";
  const a = s.checks.at(-3),
    b = s.checks.at(-1);
  const weeks =
    (new Date(b.date + "T12:00:00") - new Date(a.date + "T12:00:00")) /
    604800000;
  if (weeks < 2)
    return "Your entries are too close together for a weekly trend. Keep checking in under similar conditions.";
  const loss = (a.weight - b.weight) / weeks;
  if (loss > 2)
    return "Your recent trend is more than 2 lb down per week. Review energy, recovery and nutrition with a qualified professional before increasing training.";
  if (loss <= 0)
    return "Your recent weight trend is steady or rising. Review consistency, nutrition and measurement conditions before changing the plan.";
  return `Recent trend: about ${loss.toFixed(1)} lb down per week. Keep monitoring recovery and strength alongside weight.`;
}
export function recommendations(s) {
  return exercises.flatMap((ex) => {
    const recent = s.sessions
      .filter((w) => w.sets.some((x) => x.exercise === ex.id))
      .slice(-2);
    if (!recent.length) return [];
    const signature = recent.map((x) => x.id).join(":") + ":" + ex.id;
    if (s.decisions.some((x) => x.signature === signature)) return [];
    const sets = recent.flatMap((w) =>
      w.sets.filter((x) => x.exercise === ex.id),
    );
    if (sets.some((x) => x.pain))
      return [
        {
          signature,
          id: ex.id,
          type: "review",
          title: `Pause progression: ${ex.name}`,
          reason:
            "You reported pain. Stop the painful movement and seek qualified guidance before resuming it.",
          reps: null,
        },
      ];
    const check = s.checks.at(-1);
    if (
      check &&
      (check.energy === 1 || check.recovery === 1) &&
      Date.now() - new Date(check.date + "T12:00:00").getTime() < 7 * 86400000
    )
      return [];
    if (recent.length < 2) return [];
    const sameVariant =
      new Set(sets.map((x) => x.variant || ex.name)).size === 1;
    if (!sameVariant) return [];
    const target = s.targets[ex.id]?.reps ?? ex.reps;
    const met =
      recent.every((w) => {
        const xs = w.sets.filter((x) => x.exercise === ex.id);
        return (
          xs.length >= Math.max(ex.sets, plannedSets(w)) &&
          xs.every((x) => x.reps >= target && x.rir >= 2 && !x.pain)
        );
      }) && new Set(sets.map((x) => x.weight)).size === 1;
    if (!met) return [];
    if (target >= 12)
      return [
        {
          signature,
          id: ex.id,
          type: "review",
          title: `Review the load: ${ex.name}`,
          reason:
            "You met the repetition target in two sessions with at least two reps left. Consider a small available increase only if the exercise feels comfortable; log your chosen weight next time.",
          reps: null,
        },
      ];
    return [
      {
        signature,
        id: ex.id,
        type: "reps",
        title: `Next target: ${ex.name}`,
        reason: `You completed the target in two sessions at the same logged weight, with at least two reps left. Try ${target + 1} reps per set at the same weight.`,
        reps: target + 1,
      },
    ];
  });
}

// Time is a budget, not a mandate to increase load or fill every minute.
export function sessionPlan(minutes = 35) {
  const m = Math.max(15, Math.min(90, Math.round(Number(minutes) || 35)));
  const sets = m <= 15 ? 1 : m < 45 ? 2 : 3;
  const warmup = m <= 20 ? 3 : m < 60 ? 5 : 8,
    cooldown = m <= 20 ? 3 : m < 60 ? 5 : 7;
  const strength = Math.min(
    m - warmup - cooldown,
    sets === 1 ? 9 : sets === 2 ? 25 : 40,
  );
  return {
    minutes: m,
    sets,
    warmup,
    strength,
    cooldown,
    cardio: m - warmup - cooldown - strength,
    rest: m >= 45 ? 90 : 60,
  };
}
export function plannedSets(session) {
  return sessionPlan(session.minutes ?? (session.short ? 15 : 35)).sets;
}
