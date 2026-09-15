import {
  dayKey,
  weekKey,
  uid,
  initialState,
  exercises,
  stats,
  weightProgress,
  weightInsight,
  recommendations,
  weekSessions,
} from "./model.js";
import { openDB, get, put, all, remove } from "./db.js";
let state,
  view = "today",
  videos = [],
  urls = [],
  restUntil = 0,
  busy = false;
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (n) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${{ today: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>', progress: '<path d="M5 20V12M12 20V4M19 20V8"/>', you: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3Z"/>' }[n]}</svg>`;
const button = (txt, action, cls = "ghost", extra = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${txt}</button>`;
const num = (id, label, value, min, max, step = 1) =>
  `<div><label for="${id}">${label}</label><input id="${id}" name="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value ?? ""}" required inputmode="decimal"></div>`;
const select = (id, label, opts, value) =>
  `<div><label for="${id}">${label}</label><select id="${id}" name="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
const dateLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
function toast(t) {
  const e = document.querySelector("#toast");
  e.textContent = t;
  e.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (e.style.display = "none"), 4000);
}
async function save(next) {
  await put("state", next, "main");
  state = next;
}
function showDialog(html) {
  modal.innerHTML = `<div class="row"><span class="eyebrow">SHOW UP.</span>${button("×", "close", "close", 'aria-label="Close dialog"')}</div><div class="gap">${html}</div>`;
  modal.showModal();
}
function nav() {
  return ["today", "progress", "you"]
    .map(
      (x) =>
        `<button class="navbutton ${view === x ? "active" : ""}" data-action="nav" data-view="${x}" ${view === x ? 'aria-current="page"' : ""}>${icon(x)}<span>${x[0].toUpperCase() + x.slice(1)}</span></button>`,
    )
    .join("");
}
function render() {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  if (!state.profile) {
    app.innerHTML = `<main class="content onboarding"><div class="brand">SHOW UP.</div><h1>Set your<br><span class="lime">starting point.</span></h1><p class="muted">Your goal. Your schedule. One session at a time.</p><section class="card gap">${profileForm()}</section></main>`;
    return;
  }
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">SHOW UP.</div><nav aria-label="Main navigation">${nav()}</nav><div class="foot">YOUR GOAL.<br>YOUR WORK.<br><br>Saved on this device.<br>No cloud sync.</div></aside><main class="content"><header class="topbar"><div class="mobilebrand brand">SHOW UP.</div><div class="desktopdate eyebrow">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div><button class="avatar" data-action="nav" data-view="you" aria-label="Your profile">${esc(state.profile.name[0].toUpperCase())}</button></header>${view === "today" ? today() : view === "progress" ? progress() : view === "workout" ? workout() : you()}</main><nav class="navbottom" aria-label="Mobile navigation">${nav()}</nav></div>`;
  updateTimer();
}
function profileForm() {
  const p = state.profile ?? {
    name: "Rob",
    start: 315,
    target: 230,
    goal: "fat",
    weekly: 3,
    minutes: 35,
    days: [1, 3, 5],
    experience: "beginner",
    endurance: 30,
    strength: 100,
  };
  return `<h2>${state.profile ? "Your targets" : "Build your plan"}</h2><form id="profile" class="fields gap"><div><label for="name">First name</label><input name="name" id="name" maxlength="40" value="${esc(p.name)}" required></div>${select(
    "goal",
    "Main goal",
    [
      ["fat", "Lose fat + build or preserve muscle"],
      ["strength", "Build strength"],
      ["endurance", "Build endurance"],
      ["consistent", "Stay consistent"],
    ],
    p.goal,
  )}<div class="two">${num("start", "Starting weight (lb)", p.start, 50, 1000, 0.1)}${num("target", "Target weight (lb)", p.target, 50, 1000, 0.1)}</div><p class="muted">Weight is one measure. Track your strength and optional waist measurements, too. For weight maintenance, use the same starting and target weight.</p><div class="two">${num("weekly", "Sessions per week", p.weekly, 1, 6)}${select(
    "minutes",
    "Session length",
    [
      [15, "15 minutes"],
      [35, "35 minutes"],
    ],
    p.minutes,
  )}</div><fieldset style="border:0;padding:0;margin:0"><legend class="muted">Preferred training days</legend><div class="checks gap-sm">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => `<label class="check"><input name="days" type="checkbox" value="${i}" ${p.days.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div></fieldset>${select(
    "experience",
    "Experience",
    [
      ["beginner", "Getting started / returning"],
      ["regular", "Training regularly"],
    ],
    p.experience,
  )}<div class="two">${num("endurance", "Endurance target (minutes)", p.endurance ?? 30, 5, 300)}${num("strength", "Seated row target (lb × 10 reps)", p.strength ?? 100, 1, 1000, 1)}</div><small>Strength and endurance targets appear when you select those goals. These do not automatically set your starting workout load.</small><div><label for="deadline">Target date (optional)</label><input id="deadline" name="deadline" type="date" min="${dayKey()}" value="${esc(p.deadline ?? "")}"></div><p class="notice">Start with a comfortable effort. Choose your own load; the app does not infer safe weights from body weight. Tell a qualified trainer about any exercise limitations.</p><button class="primary wide">${state.profile ? "SAVE TARGETS" : "BUILD MY PLAN"}</button><small>Progress and videos are stored in this browser on this device. Back up your data regularly.</small></form>`;
}
function goalCard() {
  const w = weightProgress(state),
    p = state.profile;
  const weight = p.goal === "fat";
  return `<section class="card"><div class="row"><span class="eyebrow">${weight ? "FAT LOSS + MUSCLE" : p.goal === "strength" ? "STRENGTH TARGET" : p.goal === "endurance" ? "ENDURANCE TARGET" : "CONSISTENCY TARGET"}</span>${button("Edit", "edit-goal", "textbutton")}</div>${
    weight
      ? `<div class="metrics">${[
          ["Start", p.start],
          ["Current", w.current],
          ["Target", p.target],
        ]
          .map(
            ([l, v]) =>
              `<div class="metric"><span class="eyebrow">${l}</span><strong>${v}<span> lb</span></strong></div>`,
          )
          .join(
            "",
          )}</div><div class="bar" role="progressbar" aria-label="Weight goal progress" aria-valuenow="${Math.round(w.percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${w.percent}%"></span></div><p>${w.remaining ? `${w.remaining.toFixed(1)} lb to your target` : "Target reached — review your next goal"}</p>`
      : p.goal === "strength"
        ? `<h2 class="gap">${p.strength} lb × 10</h2><p class="gap-sm">Seated cable row · your long-term target</p>`
        : p.goal === "endurance"
          ? `<h2 class="gap">${p.endurance} minutes</h2><p class="gap-sm">Continuous cycling, walking or swimming</p>`
          : `<h2 class="gap">${p.weekly} sessions / week</h2><p class="gap-sm">Your rhythm, built one session at a time.</p>`
  }${p.deadline ? `<small>Target date: ${dateLabel(p.deadline)} · a preference, not a guaranteed forecast</small>` : ""}</section>`;
}
function weekCard() {
  const st = stats(state),
    monday = new Date(weekKey() + "T12:00:00");
  return `<section class="card"><div class="row"><h3>Your week</h3><span class="badge">${st.week} / ${state.profile.weekly} sessions</span></div><div class="dayrow">${Array.from(
    { length: 7 },
    (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const done = state.sessions.some(
        (x) => dayKey(new Date(x.finished)) === dayKey(d) && x.sets.length,
      );
      return `<div class="day ${done ? "done" : ""} ${state.profile.days.includes(d.getDay()) ? "planned" : ""} ${dayKey(d) === dayKey() ? "today" : ""}">${d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}<span>${done ? "✓" : d.getDate()}</span></div>`;
    },
  ).join(
    "",
  )}</div><small>Outlined days are planned. Rest days are part of the plan.</small><div class="details row"><span class="eyebrow">Level ${String(st.level).padStart(2, "0")}</span><span>${st.xp % 500} / 500 XP</span></div><div class="bar"><span style="width:${(st.xp % 500) / 5}%"></span></div></section>`;
}
function recoveryCard() {
  const c = state.checks.at(-1);
  if (
    !c ||
    Date.now() - new Date(c.date + "T12:00:00").getTime() > 7 * 86400000 ||
    (c.energy > 1 && c.recovery > 1)
  )
    return "";
  return `<section class="card"><span class="badge">RECOVERY CHECK</span><h3 class="gap">Give yourself some room.</h3><p class="muted gap-sm">Your latest check-in reports low energy or fatigue. Consider a shorter session or rest today. Stop any movement that causes pain.</p><div class="gap">${button("Choose the shorter session", "short", "ghost wide")}</div></section>`;
}
function today() {
  return `<div class="eyebrow">Your next chapter</div><h1 class="gap-sm">${esc(state.profile.name)}.<br>You've got this.</h1><div class="layout"><div class="stack">${goalCard()}<section class="card mission"><span class="number">01</span><div><span class="eyebrow">Today's mission</span><h2>Build your<br>base.</h2><p>${state.profile.minutes} min · Full body · 3 movements</p></div><div class="gap">${button(state.active ? "RESUME WORKOUT" : "START WORKOUT", "start", "primary wide")}<div class="gap-sm">${button("Just get me started · 15 min", "short", "ghost wide")}</div></div></section>${button("Log walking, cycling or swimming", "cardio", "ghost wide")}</div><div class="stack">${weekCard()}${recoveryCard()}<section class="card"><div class="eyebrow">Weekly check-in</div><h2 class="gap-sm">Check in.<br>Move forward.</h2><p class="muted gap-sm">${state.checks.length ? `Last weigh-in: ${dateLabel(state.checks.at(-1).date)}` : "Your first weigh-in starts the trend."}</p><div class="gap">${button("LOG WEIGH-IN", "checkin", "primary wide")}</div></section>${recommendationCards()}<p class="muted"><small>Starter workouts are general templates. Adjust exercises to your equipment and comfort.</small></p></div></div>`;
}
function recommendationCards() {
  return recommendations(state)
    .map(
      (r, i) =>
        `<section class="card"><span class="badge">PLAN REVIEW</span><h3 class="gap">${esc(r.title)}</h3><p class="muted gap-sm">${esc(r.reason)}</p><div class="row gap wrap">${button(r.type === "reps" ? "Accept target" : "Reviewed", "accept", "primary", `data-index="${i}"`)}${button("Keep my plan", "dismiss", "ghost", `data-index="${i}"`)}</div><small>Based on your logs, not video analysis.</small></section>`,
    )
    .join("");
}
function checkinForm() {
  const existing = state.checks.find((x) => x.date === dayKey());
  showDialog(
    `<h2>Check in.<br>Move forward.</h2><form id="checkin" class="fields gap"><div><label for="date">Weigh-in date</label><input type="date" name="date" id="date" max="${dayKey()}" value="${dayKey()}" required></div>${num("weight", "Your weight (lb)", existing?.weight ?? weightProgress(state).current, 50, 1000, 0.1)}<div class="two">${select(
      "energy",
      "Energy",
      [
        [1, "Low"],
        [2, "Okay"],
        [3, "Great"],
      ],
      existing?.energy ?? 2,
    )}${select(
      "recovery",
      "Recovery",
      [
        [1, "Very sore / fatigued"],
        [2, "Okay"],
        [3, "Fresh"],
      ],
      existing?.recovery ?? 2,
    )}</div><div><label for="waist">Waist (inches, optional)</label><input name="waist" id="waist" type="number" min="10" max="100" step=".1" value="${existing?.waist ?? ""}"></div><div><label for="notes">Nutrition / recovery notes (optional)</label><textarea name="notes" id="notes" maxlength="1000" placeholder="Anything that affected this week?">${esc(existing?.notes ?? "")}</textarea></div><p class="muted">Weigh under similar conditions each week. Saving the same date updates that entry.</p><button class="primary wide">SAVE CHECK-IN</button></form>`,
  );
}
function workout() {
  const a = state.active;
  if (!a)
    return `<h1>Ready when<br>you are.</h1><div class="gap">${button("START WORKOUT", "start", "primary")}</div>`;
  const ex = exercises[a.index],
    sets = a.sets.filter((x) => x.exercise === ex.id),
    target = a.short ? 1 : ex.sets,
    last = state.sessions
      .flatMap((w) => w.sets)
      .filter((x) => x.exercise === ex.id)
      .at(-1),
    reps = state.targets[ex.id]?.reps ?? ex.reps,
    variant = a.variants[ex.id] ?? ex.name;
  return `<div class="row wrap"><span class="eyebrow">Movement ${a.index + 1} of ${exercises.length}</span>${button("Save & exit", "save-exit", "ghost")}</div><h1 class="exercisehead">${esc(variant)}</h1><p class="muted">${esc(ex.equipment)} · ${target} sets × ${reps} reps</p><div class="layout"><section class="card"><div class="row"><span class="badge">YOUR NEXT SET</span><span class="muted timer" id="rest"></span></div><div class="sets">${Array.from({ length: target }, (_, i) => `<span class="set ${i < sets.length ? "done" : i === sets.length ? "current" : ""}">${i < sets.length ? "✓" : i + 1}</span>`).join("")}</div><p class="notice">${esc(variant === ex.name ? ex.cue : "Use a comfortable range and controlled movement. Ask a trainer to check your setup for this alternative.")}</p><form id="set" class="fields gap"><div class="two">${num("load", "Weight (lb; 0 = bodyweight)", sets.at(-1)?.weight ?? last?.weight ?? "", 0, 1500, 0.5)}${num("reps", "Reps completed", reps, 1, 100)}</div>${select(
    "rir",
    "How many more reps could you do?",
    [
      [0, "0 — no more"],
      [1, "1 more"],
      [2, "2 more"],
      [3, "3 or more"],
    ],
    2,
  )}${select(
    "pain",
    "Any pain during this movement?",
    [
      ["no", "No"],
      ["yes", "Yes — stop this movement"],
    ],
    "no",
  )}<small>${last ? `Last logged: ${last.weight} lb × ${last.reps}.` : "No previous load. Choose a comfortable starting weight."} Weight means the machine setting or total external load; use the same convention each session.</small><button class="primary wide">COMPLETE SET</button></form><div class="row gap wrap">${button("Swap exercise", "swap", "ghost")}${button("Skip movement", "skip", "ghost")}</div><div class="gap">${button("Finish session early", "finish", "textbutton")}</div></section><div class="stack"><section class="card"><h3>Set up your movement</h3><ol class="list gap">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><small>Instructions describe the original exercise. No instructional video is supplied in this version.</small></section><section class="card"><h3>Record your set</h3><p class="muted gap-sm">Film a short set with your whole body and equipment visible. Keep other gym members out of frame.</p>${videoInputs(a.id, ex.id)}<p class="notice gap">Save, replay and add your own notes. Automatic form analysis is not connected.</p></section>${videoList(videos.filter((v) => v.session === a.id && v.exercise === ex.id))}</div></div>`;
}
function videoInputs(session, exercise) {
  return `<div class="videoactions gap">${button("Record set", "record", "ghost", `data-session="${esc(session)}" data-exercise="${esc(exercise)}"`)}${button("Upload video", "upload", "ghost", `data-session="${esc(session)}" data-exercise="${esc(exercise)}"`)}</div><input type="file" class="hidden" id="video-record" accept="video/*" capture="environment" data-session="${esc(session)}" data-exercise="${esc(exercise)}"><input type="file" class="hidden" id="video-upload" accept="video/*" data-session="${esc(session)}" data-exercise="${esc(exercise)}"><small>Up to 100 MB per clip. Saved only on this device.</small>`;
}
function videoList(vs) {
  return vs
    .map((v) => {
      const url = URL.createObjectURL(v.blob);
      urls.push(url);
      return `<section class="card videocard"><div class="row"><h3>${esc(exercises.find((x) => x.id === v.exercise)?.name ?? "Training video")}</h3><small>${dateLabel(dayKey(new Date(v.created)))}</small></div><video controls playsinline preload="metadata" src="${url}"></video><small>${esc(v.name)} · ${(v.blob.size / 1048576).toFixed(1)} MB</small><p>${esc(v.notes || "No review notes yet.")}</p><div class="videoactions">${button("Add review note", "video-note", "ghost", `data-id="${esc(v.id)}"`)}<a href="${url}" download="${esc(v.name)}">Download</a>${button("Delete", "video-delete", "ghost danger", `data-id="${esc(v.id)}"`)}</div></section>`;
    })
    .join("");
}
function progress() {
  const st = stats(state),
    w = weightProgress(state);
  return `<span class="eyebrow">Every session counts</span><h1 class="gap-sm">Your work<br>adds up.</h1><div class="layout"><div class="stack"><section class="card"><div class="ring" style="--angle:${Math.min(100, (st.week / state.profile.weekly) * 100) * 3.6}deg"><div><strong>${st.week} / ${state.profile.weekly}</strong><span class="eyebrow">THIS WEEK</span></div></div><p style="text-align:center">${st.week >= state.profile.weekly ? "Weekly target reached. Make room for recovery." : `${state.profile.weekly - st.week} sessions to your weekly target.`}</p><div class="two gap"><div class="metric"><span class="eyebrow">Sessions</span><strong>${st.total}</strong></div><div class="metric"><span class="eyebrow">Total XP</span><strong>${st.xp}</strong></div></div></section><section class="card"><div class="row"><h3>Weight check-ins</h3>${button("Add", "checkin", "textbutton")}</div><p class="notice gap">${weightInsight(state)}</p>${
    state.checks.length
      ? `<ul class="list">${[...state.checks]
          .reverse()
          .map(
            (c) =>
              `<li class="historyrow"><div><strong>${c.weight} lb</strong> <span class="muted">${dateLabel(c.date)}</span><p class="muted">${c.waist ? `Waist: ${c.waist} in · ` : ""}${esc(c.notes)}</p></div>${button("Delete", "check-delete", "textbutton", `data-id="${esc(c.id)}" aria-label="Delete weigh-in ${c.date}"`)}</li>`,
          )
          .join("")}</ul>`
      : '<p class="empty">No weigh-ins yet. Your starting weight is not a logged check-in.</p>'
  }</section><section class="card"><h3>Milestones</h3><div class="checks gap">${[
    ["First session", st.total >= 1],
    ["10 sessions", st.total >= 10],
    ["Weekly goal", st.week >= state.profile.weekly],
  ]
    .map(
      ([s, b]) =>
        `<span class="badge" style="${b ? "" : "color:var(--muted);background:transparent;border-color:var(--line)"}">${b ? "✓" : "○"} ${s}</span>`,
    )
    .join(
      "",
    )}</div><small>Earn 100 XP per logged session and 25 XP per weigh-in date. Your earned progress stays with you.</small></section></div><div class="stack">${recommendationCards()}<section class="card"><h3>Session history</h3>${
    state.sessions.length
      ? `<ul class="list">${[...state.sessions]
          .reverse()
          .map(
            (s) =>
              `<li><div class="row"><strong>${esc(s.title)}</strong><small>${dateLabel(dayKey(new Date(s.finished)))}</small></div><p class="muted gap-sm">${s.cardio ? `${s.minutes} minutes · ${s.effort} effort` : `${s.sets.length} sets · ${s.status === "partial" ? "Shortened session" : "Session complete"}`}</p>${button("View log", "session", "textbutton", `data-id="${esc(s.id)}"`)}</li>`,
          )
          .join("")}</ul>`
      : '<p class="empty">Your first session belongs here.<br>Start whenever you’re ready.</p>'
  }</section></div></div><h2 class="sectionhead">Your video library</h2><p class="muted">Personal review clips. No automated form scores.</p><div class="layout">${videos.length ? videoList(videos) : '<p class="empty">Record or upload a clip during a workout.</p>'}</div>`;
}
function you() {
  return `<h1>Your goal.<br>Your rules.</h1><div class="layout"><section class="card">${profileForm()}</section><div class="stack"><section class="card install"><h3>Take SHOW UP. to the gym</h3><p class="gap-sm muted">Open the hosted app in Safari on iPhone, use Share, then Add to Home Screen. On Android, use your browser’s Install app option.</p><p class="gap-sm muted">After the first online visit, the app can open offline. Camera access depends on your device and browser.</p></section><section class="card"><h3>Your data stays here</h3><p class="gap-sm muted">Logs and videos stay in this browser on this device. They do not sync between devices. Clearing site data may remove them.</p><div class="gap">${button("Export logs backup", "export", "primary wide")}</div><div class="gap-sm">${button("Restore logs backup", "import", "ghost wide")}</div><input class="hidden" type="file" accept="application/json" id="backup"><p class="gap-sm muted">JSON backups include goals, check-ins and workout logs. Download videos separately from Progress.</p></section><section class="card"><h3>What adapts</h3><p class="gap-sm muted">Two comparable sessions, repetition targets and effort ratings inform suggested changes. Accept or dismiss each recommendation.</p><p class="gap-sm muted">Video recording and playback work locally. Automated form analysis, cloud accounts and wearable tracking are not included.</p><p class="gap-sm"><a href="https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html" target="_blank" rel="noopener">CDC: healthy weight guidance</a></p></section></div></div>`;
}
async function start(short = false) {
  if (state.active) {
    view = "workout";
    render();
    return;
  }
  const next = structuredClone(state);
  next.active = {
    id: uid(),
    started: new Date().toISOString(),
    index: 0,
    short: short || state.profile.minutes === 15,
    sets: [],
    variants: {},
  };
  await save(next);
  view = "workout";
  render();
}
async function finish() {
  if (!state.active?.sets.length) {
    toast("Log at least one set before finishing.");
    return;
  }
  const next = structuredClone(state),
    a = next.active;
  next.sessions.push({
    ...a,
    title: "Full body strength",
    finished: new Date().toISOString(),
    status: a.index >= exercises.length ? "complete" : "partial",
  });
  next.active = null;
  await save(next);
  view = "progress";
  render();
  showDialog(
    `<div class="summary"><span class="badge">SESSION SAVED</span><h2 class="gap">You showed up.</h2><div class="display lime gap">+100 XP</div><p class="muted gap">${a.sets.length} sets logged. Your next session builds on this one.</p><div class="gap">${button("KEEP GOING", "close", "primary wide")}</div></div>`,
  );
}
function download(data, name, type) {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function updateTimer() {
  const e = document.querySelector("#rest");
  if (e) {
    const seconds = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
    e.textContent = seconds ? `Rest · ${seconds}s` : "Rest as needed";
  }
}
setInterval(updateTimer, 1000);
async function action(e) {
  const b = e.target.closest("[data-action]");
  if (!b || busy) return;
  const a = b.dataset.action;
  try {
    busy = true;
    if (a === "nav") {
      view = b.dataset.view;
      render();
      window.scrollTo(0, 0);
    }
    if (a === "close") modal.close();
    if (a === "edit-goal") {
      view = "you";
      render();
    }
    if (a === "start" || a === "short") await start(a === "short");
    if (a === "checkin") checkinForm();
    if (a === "save-exit") {
      view = "today";
      render();
      toast("Workout saved. Resume anytime.");
    }
    if (a === "finish") await finish();
    if (a === "skip") {
      const n = structuredClone(state);
      if (n.active.index === exercises.length - 1 && !n.active.sets.length) {
        n.active = null;
        await save(n);
        view = "today";
        render();
      } else {
        n.active.index++;
        await save(n);
        if (n.active.index >= exercises.length) await finish();
        else render();
      }
    }
    if (a === "swap") {
      const n = structuredClone(state),
        ex = exercises[n.active.index];
      if (n.active.sets.some((x) => x.exercise === ex.id)) {
        toast(
          "Finish or skip this movement; swap before logging its first set.",
        );
      } else {
        n.active.variants[ex.id] = n.active.variants[ex.id]
          ? undefined
          : ex.alt;
        await save(n);
        render();
      }
    }
    if (a === "record" || a === "upload")
      document.querySelector("#video-" + a).click();
    if (a === "accept" || a === "dismiss") {
      const r = recommendations(state)[Number(b.dataset.index)];
      const n = structuredClone(state);
      if (a === "accept" && r.type === "reps")
        n.targets[r.id] = { reps: r.reps };
      n.decisions.push({
        signature: r.signature,
        action: a,
        date: new Date().toISOString(),
      });
      await save(n);
      render();
      toast(a === "accept" ? "Review saved" : "Current plan kept");
    }
    if (a === "export")
      download(
        JSON.stringify(state, null, 2),
        `showup-backup-${dayKey()}.json`,
        "application/json",
      );
    if (a === "import") document.querySelector("#backup").click();
    if (a === "video-note") {
      const v = videos.find((x) => x.id === b.dataset.id);
      showDialog(
        `<h2>Review your set</h2><p class="muted gap-sm">Add an observation or trainer cue. Include a timestamp if helpful.</p><form id="video-note" data-id="${esc(v.id)}" class="fields gap"><label for="note">Your notes</label><textarea id="note" name="note" maxlength="2000">${esc(v.notes)}</textarea><button class="primary">SAVE NOTE</button></form>`,
      );
    }
    if (a === "video-delete")
      showDialog(
        `<h2>Delete this video?</h2><p class="gap muted">This removes the saved clip from this device. Download it first if you want a copy.</p><div class="gap">${button("DELETE VIDEO", "confirm-video-delete", "danger", `data-id="${b.dataset.id}"`)}</div>`,
      );
    if (a === "confirm-video-delete") {
      await remove("videos", b.dataset.id);
      videos = await all("videos");
      modal.close();
      render();
      toast("Video deleted");
    }
    if (a === "check-delete")
      showDialog(
        `<h2>Delete weigh-in?</h2><p class="gap muted">Your trend and check-in XP will be recalculated.</p><div class="gap">${button("DELETE ENTRY", "confirm-check-delete", "danger", `data-id="${b.dataset.id}"`)}</div>`,
      );
    if (a === "confirm-check-delete") {
      const n = structuredClone(state);
      n.checks = n.checks.filter((x) => x.id !== b.dataset.id);
      await save(n);
      modal.close();
      render();
    }
    if (a === "session") {
      const s = state.sessions.find((x) => x.id === b.dataset.id);
      showDialog(
        `<h2>${esc(s.title)}</h2><p class="muted gap-sm">${new Date(s.finished).toLocaleString()}</p><ul class="list gap">${s.sets.map((x) => `<li>${esc(x.variant || exercises.find((ex) => ex.id === x.exercise)?.name || s.title)}<br><strong>${s.cardio ? `${s.minutes} minutes` : `${x.weight} lb × ${x.reps} reps`}</strong>${s.cardio ? "" : ` · ${x.rir} reps left${x.pain ? " · Pain reported" : ""}`}</li>`).join("")}</ul>`,
      );
    }
    if (a === "cardio")
      showDialog(
        `<h2>Log your movement</h2><form id="cardio" class="fields gap">${select(
          "activity",
          "Activity",
          [
            ["Walking", "Walking"],
            ["Cycling", "Cycling"],
            ["Swimming", "Swimming"],
          ],
          "Cycling",
        )}${num("duration", "Minutes completed", 15, 1, 300)}${select(
          "effort",
          "Effort",
          [
            ["easy", "Easy"],
            ["moderate", "Moderate"],
            ["hard", "Hard"],
          ],
          "moderate",
        )}<button class="primary">COMPLETE SESSION</button></form>`,
      );
  } catch (error) {
    console.error(error);
    toast("Could not save. Check available device storage and try again.");
  } finally {
    busy = false;
  }
}
document.addEventListener("click", action);
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const f = e.target,
    d = new FormData(f);
  try {
    busy = true;
    const n = structuredClone(state);
    if (f.id === "profile") {
      const days = d.getAll("days").map(Number);
      if (!days.length) {
        toast("Choose at least one preferred training day.");
        return;
      }
      const p = {
        name: d.get("name").trim(),
        goal: d.get("goal"),
        start: +d.get("start"),
        target: +d.get("target"),
        weekly: +d.get("weekly"),
        minutes: +d.get("minutes"),
        days,
        experience: d.get("experience"),
        deadline: d.get("deadline"),
        endurance: +d.get("endurance"),
        strength: +d.get("strength"),
      };
      if (!p.name) {
        toast("Enter your name.");
        return;
      }
      if (p.goal === "fat" && p.target > p.start) {
        toast("Choose a fat-loss target at or below the starting weight.");
        return;
      }
      n.profile = p;
      await save(n);
      view = "today";
      render();
      toast("Your plan is ready");
    }
    if (f.id === "checkin") {
      const date = d.get("date");
      if (date > dayKey()) throw Error("Future weigh-in");
      const existing = n.checks.find((x) => x.date === date);
      const check = {
        id: existing?.id ?? uid(),
        date,
        weight: +d.get("weight"),
        energy: +d.get("energy"),
        recovery: +d.get("recovery"),
        waist: d.get("waist") ? +d.get("waist") : null,
        notes: d.get("notes").trim(),
      };
      n.checks = n.checks.filter((x) => x.date !== date);
      n.checks.push(check);
      n.checks.sort((a, b) => a.date.localeCompare(b.date));
      await save(n);
      modal.close();
      render();
      toast(existing ? "Check-in updated" : "Check-in saved · +25 XP");
    }
    if (f.id === "set") {
      const a = n.active,
        ex = exercises[a.index];
      const pain = d.get("pain") === "yes";
      a.sets.push({
        id: uid(),
        exercise: ex.id,
        variant: a.variants[ex.id] ?? ex.name,
        weight: +d.get("load"),
        reps: +d.get("reps"),
        rir: +d.get("rir"),
        pain,
        at: new Date().toISOString(),
      });
      if (
        pain ||
        a.sets.filter((x) => x.exercise === ex.id).length >=
          (a.short ? 1 : ex.sets)
      )
        a.index++;
      await save(n);
      restUntil = Date.now() + 60000;
      if (a.index >= exercises.length) await finish();
      else render();
      if (pain)
        toast("Pain recorded. Stop that movement and seek qualified guidance.");
      else toast("Set saved");
    }
    if (f.id === "video-note") {
      const v = videos.find((x) => x.id === f.dataset.id);
      await put("videos", { ...v, notes: d.get("note").trim() });
      videos = await all("videos");
      modal.close();
      render();
    }
    if (f.id === "cardio") {
      n.sessions.push({
        id: uid(),
        title: d.get("activity"),
        cardio: true,
        minutes: +d.get("duration"),
        effort: d.get("effort"),
        finished: new Date().toISOString(),
        status: "complete",
        sets: [{ id: uid(), exercise: "cardio" }],
      });
      await save(n);
      modal.close();
      view = "progress";
      render();
      toast("Session saved · +100 XP");
    }
  } catch (error) {
    console.error(error);
    toast("Could not save. Please check your entries and device storage.");
  } finally {
    busy = false;
  }
});
document.addEventListener("change", async (e) => {
  const input = e.target;
  if (input.id === "video-record" || input.id === "video-upload") {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast("Choose a video file.");
      return;
    }
    if (file.size > 100 * 1048576) {
      toast("Clip too large. Choose a video under 100 MB.");
      return;
    }
    try {
      toast("Saving video…");
      await put("videos", {
        id: uid(),
        session: input.dataset.session,
        exercise: input.dataset.exercise,
        blob: file,
        name: file.name,
        created: new Date().toISOString(),
        notes: "",
      });
      videos = await all("videos");
      render();
      toast("Video saved on this device");
    } catch (error) {
      toast(
        "Video could not be saved. Free device storage and try a smaller clip.",
      );
    }
    input.value = "";
  }
  if (input.id === "backup") {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!validBackup(data)) throw Error("Invalid backup");
      showDialog(
        `<h2>Restore backup?</h2><p class="gap muted">This replaces your current profile and logs with ${data.sessions.length} sessions and ${data.checks.length} check-ins. Videos stay on this device. Export your current logs first if needed.</p><div class="gap">${button("RESTORE LOGS", "restore", "primary")}</div>`,
      );
      modal.querySelector('[data-action="restore"]').onclick = async () => {
        try {
          await save(data);
          modal.close();
          view = "today";
          render();
          toast("Logs restored");
        } catch {
          toast("Restore failed. Your current data has been kept.");
        }
      };
    } catch {
      toast("That file is not a valid SHOW UP backup.");
    }
    input.value = "";
  }
});
function validBackup(d) {
  const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  return (
    d?.version === 1 &&
    d.profile &&
    typeof d.profile.name === "string" &&
    ["fat", "strength", "endurance", "consistent"].includes(d.profile.goal) &&
    finite(d.profile.start, 50, 1000) &&
    finite(d.profile.target, 50, 1000) &&
    finite(d.profile.weekly, 1, 6) &&
    [15, 35].includes(d.profile.minutes) &&
    Array.isArray(d.profile.days) &&
    d.profile.days.every((x) => Number.isInteger(x) && x >= 0 && x <= 6) &&
    finite(d.profile.endurance, 5, 300) &&
    finite(d.profile.strength, 1, 1000) &&
    Array.isArray(d.checks) &&
    d.checks.every(
      (c) =>
        typeof c.id === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
        finite(c.weight, 50, 1000) &&
        typeof c.notes === "string",
    ) &&
    Array.isArray(d.sessions) &&
    d.sessions.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        Number.isFinite(Date.parse(s.finished)) &&
        Array.isArray(s.sets) &&
        s.sets.every(
          (x) =>
            typeof x.exercise === "string" &&
            (s.cardio ||
              (finite(x.weight, 0, 1500) &&
                finite(x.reps, 1, 100) &&
                finite(x.rir, 0, 3))),
        ),
    ) &&
    d.targets &&
    typeof d.targets === "object" &&
    Object.values(d.targets).every((t) => finite(t.reps, 1, 100)) &&
    Array.isArray(d.decisions) &&
    d.decisions.every((x) => typeof x.signature === "string") &&
    (d.active === null ||
      (d.active &&
        Number.isInteger(d.active.index) &&
        d.active.index >= 0 &&
        d.active.index < exercises.length &&
        Array.isArray(d.active.sets) &&
        d.active.variants &&
        typeof d.active.id === "string"))
  );
}
try {
  await openDB();
  state = (await get("state", "main")) ?? initialState();
  videos = await all("videos");
  if (state.active?.index >= exercises.length) {
    const n = structuredClone(state),
      a = n.active;
    n.sessions.push({
      ...a,
      title: "Full body strength",
      finished: new Date().toISOString(),
      status: "complete",
    });
    n.active = null;
    await save(n);
  }
  render();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
} catch (error) {
  console.error(error);
  app.innerHTML =
    '<main class="content"><h1>Storage is unavailable.</h1><p class="gap">SHOW UP needs browser storage to save your progress. Open it in a regular browser window with site storage enabled, then reload.</p></main>';
}
