// Companion tracking only. DAREBEE workout cards and media remain on darebee.com.
export const HIIT_ID = "darebee-30-days-hiit";
export const HIIT_URL = "https://darebee.com/programs/30-days-of-hiit.html";
export const HIIT_LIBRARY = "https://darebee.com/library.html";
export const validDay = (day) => Number.isInteger(day) && day >= 1 && day <= 30;
export function dayURL(day) {
  if (!validDay(day))
    throw new RangeError("Choose a program day from 1 to 30.");
  return `${HIIT_URL}?start=${day}`;
}
export function completedDays(state) {
  return new Set(
    state.sessions
      .filter((s) => s.programId === HIIT_ID && validDay(s.programDay))
      .map((s) => s.programDay),
  );
}
export function nextDay(state) {
  const done = completedDays(state);
  for (let day = 1; day <= 30; day++) if (!done.has(day)) return day;
  return 30;
}
export function logProgramDay(
  state,
  { day, level, minutes, effort, notes },
  now = new Date(),
) {
  if (
    !validDay(day) ||
    ![1, 2, 3].includes(level) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 90 ||
    !["easy", "moderate", "hard"].includes(effort) ||
    typeof notes !== "string" ||
    notes.length > 1000
  )
    throw new Error("Invalid program log");
  const n = structuredClone(state);
  const existing = n.sessions.find(
    (s) => s.programId === HIIT_ID && s.programDay === day,
  );
  const record = {
    id: existing?.id ?? `darebee-hiit-day-${day}`,
    programId: HIIT_ID,
    programDay: day,
    title: `30 Days of HIIT · Day ${day}`,
    level,
    minutes,
    effort,
    notes,
    finished: existing?.finished ?? now.toISOString(),
    updated: now.toISOString(),
    status: "complete",
    sets: [],
  };
  n.sessions = n.sessions.filter(
    (s) => !(s.programId === HIIT_ID && s.programDay === day),
  );
  n.sessions.push(record);
  n.sessions.sort((a, b) => a.finished.localeCompare(b.finished));
  return n;
}
export const isLoggedSession = (session) =>
  session.sets.length > 0 ||
  (session.programId === HIIT_ID && validDay(session.programDay));
