# SHOW UP.

A mobile-first, installable fitness web app in black, off-white and electric lime. Built for a simple loop: set a goal, complete a workout, check in, review the next step.

## Run locally

Requires Python 3; Node 22+ is only needed for validation.

```sh
python3 -m http.server 5173
```

Open http://localhost:5173. No package installation, build step, API key or account is required.

```sh
npm run check
npm test
```

## Put it on your phone

The source is static and can be hosted on any HTTPS static host. For GitHub Pages:

1. In this repository, open **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/(root)**, then Save.
4. Wait for GitHub's deployment and open the URL shown in Pages settings.
5. On iPhone, open that URL in Safari and use **Share → Add to Home Screen**. On Android, use the browser's Install app option.

A Pages URL is not live until Pages is enabled and its deployment finishes. No Pages settings have been changed by this commit. The repository is public, but individual workout logs and videos are never committed or sent to GitHub.

## Working features

- First-run setup with editable goals: fat loss + muscle, strength, endurance or consistency. Rob's initial values (315 lb / 230 lb) are form defaults, not fictional weigh-ins.
- Weekly workout target, preferred days, session length and optional target date.
- Weekly weigh-ins with energy, recovery, optional waist measurements and notes. Saving the same date updates it without extra XP. Delete entries to correct mistakes.
- Three-movement general strength template, a shortened session, substitutions before logging, editable load/reps, effort and pain check-ins, rest timer and resumed workouts after reload.
- Walking/cycling/swimming completion logging.
- 100 XP per logged session, 25 XP per weigh-in date, levels, weekly target and milestones. No penalty for planned rest days.
- Device camera/file picker for videos, persistent local clip storage, playback, manual review notes, individual download and deletion. Native recording availability depends on browser/device.
- Explainable repetition suggestions after two comparable sessions at the same load, meeting all rep targets with at least two reps remaining. Pain flags block progression. Shortened sessions do not meet the full-session progression gate. Accept or dismiss reviews explicitly.
- Weight-trend feedback only after three measurements spanning at least two weeks. No automatic calorie prescriptions or load changes from body weight.
- Device-local IndexedDB storage, log backup export/restore and offline app shell after the first online load.

## Limits that matter

This is a local-first MVP, not an App Store binary or a cloud service. There is no cross-device sync, login, wearable integration, background health tracking, notifications or AI form analysis. Videos are personal review evidence; the app never fabricates a form score or claims to know a safe load from a clip. Instructional exercise videos and professionally individualized training plans are not included. Exercise text describes general templates; the experience preference does not change the template yet.

The 315 → 230 target describes weight change, not a promise of a particular body composition. Strength, waist measurements, nutrition and recovery provide additional context. Target dates are preferences, not guaranteed forecasts. Reported pain stops progression for that movement and directs the user to qualified help.

Browser storage can be cleared or evicted. Export logs regularly and download important clips separately. JSON backups exclude video blobs. Restoring a backup replaces logs/profile with explicit confirmation; existing local videos are kept. Every browser/profile/origin has a separate store.

## Structure

- `app.js`: views, forms, workout flows, video and backup controls.
- `model.js`: dates, statistics, weight trends and deterministic progression rules.
- `db.js`: IndexedDB storage wrapper.
- `styles.css`: responsive interface and accessibility states.
- `sw.js`: same-origin offline cache. Increment its cache version when changing assets.
- `tests/model.test.js`: meaningful progression, pain, trend and calendar tests.
- `.github/workflows/validate.yml`: syntax validation and model tests on pushes and PRs.

## Next production capabilities

Add authenticated cloud storage and per-user authorization before promising sync. For automated video feedback, integrate an exercise-specific validated pose-analysis pipeline with camera setup, quality/confidence gates, low-confidence rejection and explicit user consent before uploading clips. Keep logged load and effort separate from visual observations. Never use a generic text-model response as proof of safe form.
