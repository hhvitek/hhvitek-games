// KockaInput(): gestures, tilt, microphone, synthesized sounds and vibration for Kočka (SPEC §7).
// One global factory, no DOM access at load time; the DOM is touched only inside the functions it returns.
//
// const I = KockaInput();
//
// Gestures:  const g = I.attach(el, opts)   g() or g.detach() removes it; g.setMode(m), g.mode(), g.cancel()
//   The caller sets `touch-action:none` (and user-select:none) on el. Pointer Events; mouse and pen = one finger.
//   Pointers that start on `opts.ignore` elements inside el (default buttons, links, inputs, [data-no-gesture])
//   are left alone, so ordinary buttons in the scene keep working.
//   opts.mode          'care' (default: items, Koxa, taps) | 'laser' (only the dot) | 'drag' (items and taps only) |
//                      'train' (tricks: tap (with region, e.g. paws), swipe, doubleSwipe, circle; no strokes, no
//                      pickup, no items) | 'minigame' (raw pdown / pmove / pup for every pointer, nothing recognized)
//   opts.hitRegion(x,y)   → { id, fur: [dx, dy] } or null; x, y are el's CSS px (the caller maps them to the art)
//   opts.hitCat(x,y)      → bool (default: hitRegion is not null)
//   opts.hitItem(x,y)     → draggable item id or null (checked before Koxa)
//   opts.hitTarget(x,y,item) → drop target id or null; item is 'cat' while carrying Koxa
//   opts.canFlick(item)   → bool (default true): may this item be flicked
//   opts.catWidth         number or getter: Koxa's drawn width in px; the stroke step is then
//                         clamp(STROKE_STEP_REL × width, STROKE_STEP_MIN, STROKE_STEP) (without it STROKE_STEP)
//   opts.strokeStep       number or getter: overrides that step (px)
//   opts.time(e)          → ms of a pointer event (default e.timeStamp; tests may pass their own clock)
//   opts.on(ev)           receives { type, ... }:
//     tap        { x, y, item, region, cat }       released before LONG_MS, moved < SLOP px and did not rub
//     longpress  { x, y }                          LONG_MS still, not on Koxa and not on an item
//     pickup     { x, y }                          LONG_MS still on Koxa (rubbing over HOLD_PATH px or turning back
//                                                  HOLD_REVERSALS times is not still); then:
//     carry      { x, y, target }                  … while she is carried
//     drop       { x, y, target }                  … released (target from hitTarget(x, y, 'cat'))
//     stroke     { region, along, speed, rough, x, y, dx, dy }   'care' only, every stroke step of path (and the
//                rest ≥ STROKE_TAIL px on release); region = the one most of the segment went over; speed ≥
//                STROKE_SLOW px/s; along = 'along' | 'against' | 'sideways'; rough = too fast
//     swipe      { dir: 'up'|'down'|'left'|'right', dx, dy, x, y }   a quick straight one-finger move that did not
//                start on Koxa and did not stroke her (tricks)
//     scratchStart { region, fingers }, scratch { region, seconds: 1, fingers, x, y } (once per second), scratchEnd { fingers }
//                two fingers, both on Koxa, moving back and forth (≥ SCRATCH_REVERSALS reversals in SCRATCH_WINDOW
//                ms); region: an ear if a finger is on one, else a finger's region, else their midpoint's. fingers: 1 =
//                one finger that started on Koxa rubbing on the spot (isRub: those reversals within RUB_MAX px; no
//                tap, no pickup, no strokes meanwhile). A stroke segment that went back and forth (straightness <
//                STROKE_STRAIGHT) is never a stroke.
//   Several fingers: a finger that only rests (a thumb holding the phone) is ignored and the next finger runs as a
//   normal gesture; while a gesture runs, another finger is ignored unless both are on Koxa (then a scratch; if one
//   of them rests and the other moves one way it turns back into a stroke). After a scratch the finger left may
//   start a new gesture.
//     dragStart  { item, x, y }, dragMove { item, x, y, target }
//     dragEnd    { item, x, y, target }            a drag ends with exactly one of dragEnd, flick or cancel
//     flick      { item, x, y, vx, vy }            released faster than FLICK_MIN px/s and not over a target
//     laser      { x, y, on }                      'laser' mode: on = true while the finger is down (use follow())
//     doubleSwipe { dir, x, y }                    two swipes the same way, the 2nd starting ≤ DOUBLE_SWIPE_MS after (after the second
//                                                  swipe event; a UI waiting for a single swipe waits that long)
//     circle     { dir: 'cw'|'ccw', radius, x, y }  'train' only: a roughly circular path ≥ TRAIN_CIRCLE_DEG° within
//                                                  TRAIN_CIRCLE_MS, radius CIRCLE_R_MIN…CIRCLE_R_MAX (x, y = its centre)
//     trainMiss  { reason, dx, dy, x, y }          'train' only: a moved gesture that was no cue; reason 'slow' |
//                                                  'short' | 'notStraight' | 'notRound' | 'tooSmall' (dx, dy = net move)
//   In 'train' a swipe may take up to TRAIN_SWIPE_MS (elsewhere SWIPE_MS).
//     pdown / pmove / pup { id, x, y, t }           'minigame' only (pup has cancel: true when the browser took it)
//     cancel     { what: 'drag'|'carry', item }    the browser took the pointer, or setMode/detach mid-gesture
//
// Tilt:   I.tilt.start(onTilt, onState), stop(), level(), askPermission() → Promise(state), state()
//   onTilt({ ax, ay }) on every sensor reading: −1…1 in screen axes (x right, y down; the sine of the tilt from the
//   levelled position), corrected for screen.orientation.angle, with a dead zone. onState('off'|'wait'|'ok'|'none'|
//   'ask'): 'ask' = iOS needs askPermission() from a tap; 'none' = no sensor (it still switches to 'ok' if readings
//   come late). The position at start, at level() and on coming back to the page counts as level (like Kulička).
// Microphone:  I.mic.start(onLevel, onCall, onState, { maxMs }), stop(), state(), threshold (0…1, settable)
//   Call it from a tap. Loudness only (RMS of an AnalyserNode), nothing is recorded, stored or sent. onLevel(0…1)
//   every MIC_POLL_MS; onCall() when the level stays ≥ threshold for MIC_CALL_MS (then MIC_COOLDOWN_MS pause).
//   States 'off'|'ask'|'ok'|'denied'|'none'. The tracks are released on stop(), on maxMs and when the page hides.
// Sound:  I.sound.meow(mood) → variant, say(kind) → kind|null, purr(on, intensity 0…1), nom(), hiss(), chirp(),
//   setEnabled(bool), unlock(), KINDS, last(). meow() picks a variant fitting the mood ('happy'|'calm'|'grumpy'|'sad'|
//   'want'|'offended'), never the same twice in a row; kinds: mew, meow, demand, plaintive, chirp, trill, question,
//   yowl, hiss, purr, nom, lap; every call is randomized (pitch ±15 %, length, contour, loudness). purr(true, x) while
//   purring only changes the intensity. WebAudio, no files: formant synthesis (SPEC §12a). The AudioContext is created on the first user gesture (attach() calls unlock() on taps;
//   call it from your own buttons too). Silent when disabled, before any gesture and while the page is hidden.
// Vibration:  I.vibrate(pattern) (ms, an array or a name from I.BUZZ), I.setVibrate(bool)
// Pure helpers (tests): classifyStroke(fur, dx, dy, dt, path?), reversals(samples), isScratch(samples),
//   flickVelocity(samples) → { vx, vy, speed }, follow(p, target, dtMs, lagMs?), stepToy(b, dtS, w, h),
//   strokeStepFor(catWidth), holdMoved(samples), majorityRegion([region|null]), isRub(samples), isCircle(samples),
//   isDoubleSwipe([{ dir, t }]), classifyCue(samples, t0?) → { type: 'circle'|'swipe'|'miss', dir?, reason?, dx, dy },
//   voiceParams(kind, rnd?) (one randomized call), pickKind(mood, last, rnd?)
//   samples = [{ x, y, t }] with t in ms. I.T = all thresholds.
function KockaInput() {
  'use strict';
  /* SPEC §7 thresholds (px are CSS px, times ms, speeds px/s) */
  const T = {
    SLOP: 10, LONG_MS: 450, HOLD_PATH: 25, HOLD_JITTER: 3, HOLD_REVERSALS: 2,
    STROKE_STEP: 40, STROKE_STEP_MIN: 24, STROKE_STEP_REL: 0.12, STROKE_TAIL: 20,
    STROKE_SLOW: 120, STROKE_FAST: 900, ALONG_COS: 0.5,
    SCRATCH_WINDOW: 1200, SCRATCH_REVERSALS: 3, SCRATCH_EMIT_MS: 1000, REVERSAL_MIN: 5, SCRATCH_IDLE_MS: 400,
    RUB_MAX: 50, STROKE_STRAIGHT: 0.6,
    FLICK_MIN: 600, FLICK_WINDOW: 100, SAMPLE_KEEP: 250,
    SWIPE_MIN: 60, SWIPE_MS: 600, SWIPE_STRAIGHT: 0.8, DOUBLE_SWIPE_MS: 1000,
    TRAIN_SWIPE_MS: 1200, TRAIN_CIRCLE_MS: 3000, TRAIN_CIRCLE_DEG: 270, CUE_TURN_DEG: 180,
    CIRCLE_DEG: 300, CIRCLE_MS: 1500, CIRCLE_R_MIN: 40, CIRCLE_R_MAX: 200, CIRCLE_DEV: 0.25, CIRCLE_STEADY: 0.8,
    LASER_LAG_MS: 80,
    TOY_FRICTION: 1.2, TOY_BOUNCE: 0.6,
    TILT_DEAD: 0.025, TILT_WAIT_MS: 1000, TILT_LEVEL_MS: 300, TILT_SMOOTH: 0.4,
    MIC_CALL_LEVEL: 0.6, MIC_CALL_MS: 250, MIC_COOLDOWN_MS: 1500, MIC_POLL_MS: 50, MIC_FLOOR_DB: -60,
  };
  const BUZZ = { tap: 10, purr: [6, 60, 6, 60, 6, 60, 6], bite: 70, call: [20, 80, 20] };
  const IGNORE = 'button,a,input,select,textarea,label,[data-no-gesture]';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Pure helpers ---------- */
  // direction of a stroke against the region's fur, and its speed
  function classifyStroke(fur, dx, dy, dt, path) {
    const len = Math.hypot(dx, dy), dist = path > 0 ? path : len;
    const speed = dist / (Math.max(1, dt) / 1000);
    const fl = fur ? Math.hypot(fur[0], fur[1]) : 0;
    const cos = len && fl ? (dx * fur[0] + dy * fur[1]) / (len * fl) : 0;
    const along = cos >= T.ALONG_COS ? 'along' : cos <= -T.ALONG_COS ? 'against' : 'sideways';
    return { along, cos, speed, slow: speed < T.STROKE_SLOW, rough: speed > T.STROKE_FAST };
  }
  // how many times a finger turned back along its main axis (jitter under REVERSAL_MIN px ignored)
  function reversals(samples) {
    const n = samples ? samples.length : 0;
    if (n < 3) return 0;
    let mx = 0, my = 0;
    for (const s of samples) { mx += s.x; my += s.y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const s of samples) { const a = s.x - mx, b = s.y - my; sxx += a * a; syy += b * b; sxy += a * b; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
    const proj = s => s.x * ux + s.y * uy;
    let dir = 0, ext = proj(samples[0]), lo = ext, hi = ext, count = 0;
    for (let i = 1; i < n; i++) {
      const p = proj(samples[i]);
      if (!dir) {
        lo = Math.min(lo, p); hi = Math.max(hi, p);
        if (p - lo >= T.REVERSAL_MIN) { dir = 1; ext = p; } else if (hi - p >= T.REVERSAL_MIN) { dir = -1; ext = p; }
      } else if ((p - ext) * dir > 0) ext = p;
      else if ((ext - p) * dir >= T.REVERSAL_MIN) { count++; dir = -dir; ext = p; }
    }
    return count;
  }
  // one finger rubbing on the spot: a scratch (reversals) whose swing stays within RUB_MAX px along its main axis
  function isRub(samples) {
    if (!isScratch(samples)) return false;
    const end = samples[samples.length - 1].t, w = samples.filter(s => s.t >= end - T.SCRATCH_WINDOW);
    let mx = 0, my = 0;
    for (const s of w) { mx += s.x; my += s.y; }
    mx /= w.length; my /= w.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const s of w) { const a = s.x - mx, b = s.y - my; sxx += a * a; syy += b * b; sxy += a * b; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
    let lo = Infinity, hi = -Infinity;
    for (const s of w) { const p = s.x * ux + s.y * uy; lo = Math.min(lo, p); hi = Math.max(hi, p); }
    return hi - lo <= T.RUB_MAX;
  }
  // a roughly circular path (the last CIRCLE_MS ms): ≥ CIRCLE_DEG degrees around a fitted centre, radius
  // CIRCLE_R_MIN…CIRCLE_R_MAX px, mean distance from the circle ≤ CIRCLE_DEV × radius, turning one way (net turn ≥
  // CIRCLE_STEADY × all turning); → { dir: 'cw'|'ccw' (as seen on the screen), radius, cx, cy, deg } or null
  function isCircle(samples, o = {}) {
    const f = circleFit(samples, o.ms || T.CIRCLE_MS);
    if (!f || f.radius < T.CIRCLE_R_MIN || f.radius > T.CIRCLE_R_MAX) return null;
    if (f.dev > T.CIRCLE_DEV * f.radius || f.deg < (o.deg || T.CIRCLE_DEG) || !f.steady) return null;
    return { dir: f.dir, radius: f.radius, cx: f.cx, cy: f.cy, deg: f.deg };
  }
  // the circle that fits the last ms of a path best: { radius, cx, cy, dev (mean distance from it), deg (turned
  // around its centre), dir, steady (turning one way) } or null
  function circleFit(samples, ms) {
    if (!samples || samples.length < 8) return null;
    const end = samples[samples.length - 1].t, w = samples.filter(s => s.t >= end - ms), n = w.length;
    if (n < 8) return null;
    let mx = 0, my = 0;
    for (const s of w) { mx += s.x; my += s.y; }
    mx /= n; my /= n;
    // Kasa fit: x² + y² + a·x + b·y + c = 0 (least squares, around the mean for precision)
    let xx = 0, yy = 0, xy = 0, sx = 0, sy = 0, xz = 0, yz = 0, sz = 0;
    for (const s of w) {
      const x = s.x - mx, y = s.y - my, z = x * x + y * y;
      xx += x * x; yy += y * y; xy += x * y; sx += x; sy += y; xz += x * z; yz += y * z; sz += z;
    }
    const M = [[xx, xy, sx], [xy, yy, sy], [sx, sy, n]], v = [-xz, -yz, -sz];
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M);
    if (!(Math.abs(D) > 1e-6)) return null;
    const col = k => M.map((row, i) => row.map((x, j) => (j === k ? v[i] : x)));
    const a = det(col(0)) / D, b = det(col(1)) / D, c = det(col(2)) / D;
    const cx = -a / 2, cy = -b / 2, r2 = cx * cx + cy * cy - c;
    if (!(r2 > 0)) return null;
    const radius = Math.sqrt(r2);
    let dev = 0, net = 0, all = 0, prev = null;
    for (const s of w) {
      const x = s.x - mx - cx, y = s.y - my - cy;
      dev += Math.abs(Math.hypot(x, y) - radius);
      const ang = Math.atan2(y, x);
      if (prev !== null) { let d = ang - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; net += d; all += Math.abs(d); }
      prev = ang;
    }
    return { radius, cx: cx + mx, cy: cy + my, dev: dev / n, deg: Math.abs(net) * 180 / Math.PI,
      dir: net > 0 ? 'cw' : 'ccw', steady: Math.abs(net) >= T.CIRCLE_STEADY * all };      // y grows downwards: + = clockwise
  }
  // how far the path's own heading turned (degrees, signed), from points at least 4 px apart
  function headingTurn(samples) {
    let turn = 0, prev = null, last = samples[0];
    for (const s of samples) {
      if (Math.hypot(s.x - last.x, s.y - last.y) < 4) continue;
      const h = Math.atan2(s.y - last.y, s.x - last.x);
      if (prev !== null) { let d = h - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turn += d; }
      prev = h; last = s;
    }
    return turn * 180 / Math.PI;
  }
  // a training cue from a whole moved path (t0 = when the finger went down): circle (≤ TRAIN_CIRCLE_MS, ≥
  // TRAIN_CIRCLE_DEG), swipe (≤ TRAIN_SWIPE_MS) or a miss with the reason the player can fix:
  // 'slow' | 'short' | 'notStraight' | 'notRound' | 'tooSmall'
  function classifyCue(samples, t0) {
    if (!samples || samples.length < 2) return { type: 'miss', reason: 'short', dx: 0, dy: 0 };
    const a = samples[0], z = samples[samples.length - 1], dur = z.t - (t0 != null ? t0 : a.t);
    const dx = z.x - a.x, dy = z.y - a.y, net = Math.hypot(dx, dy);
    let path = 0;
    for (let i = 1; i < samples.length; i++) path += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    const c = isCircle(samples, { ms: T.TRAIN_CIRCLE_MS, deg: T.TRAIN_CIRCLE_DEG });
    if (c) return Object.assign({ type: 'circle' }, c);
    const miss = reason => ({ type: 'miss', reason, dx, dy });
    const straight = net >= T.SWIPE_STRAIGHT * path;
    if (net >= T.SWIPE_MIN && straight && dur <= T.TRAIN_SWIPE_MS) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      return { type: 'swipe', dir, dx, dy };
    }
    if (Math.abs(headingTurn(samples)) >= T.CUE_TURN_DEG) {            // it was meant as a circle
      const f = circleFit(samples, Infinity);
      if (f && f.radius < T.CIRCLE_R_MIN) return miss('tooSmall');
      if (dur > T.TRAIN_CIRCLE_MS) return miss('slow');
      if (f && f.steady && f.deg < T.TRAIN_CIRCLE_DEG && f.dev <= T.CIRCLE_DEV * f.radius) return miss('short');
      return miss('notRound');
    }
    if (net < T.SWIPE_MIN) return miss(path >= 1.5 * T.SWIPE_MIN ? 'notStraight' : 'short');
    return miss(straight ? 'slow' : 'notStraight');
  }
  // two swipes the same way, the second starting within DOUBLE_SWIPE_MS after the first ended: swipes =
  // [{ dir, t (end), t0 (start, optional) }, …] (the last two count) → dir or null
  function isDoubleSwipe(swipes) {
    if (!swipes || swipes.length < 2) return null;
    const a = swipes[swipes.length - 2], b = swipes[swipes.length - 1];
    const gap = (b && b.t0 != null ? b.t0 : b && b.t) - (a && a.t);
    return a && b && a.dir === b.dir && gap >= 0 && gap <= T.DOUBLE_SWIPE_MS ? b.dir : null;
  }
  function isScratch(samples) {
    if (!samples || samples.length < 3) return false;
    const end = samples[samples.length - 1].t;
    return reversals(samples.filter(s => s.t >= end - T.SCRATCH_WINDOW)) >= T.SCRATCH_REVERSALS;
  }
  // release velocity from the last FLICK_WINDOW ms (a finger that stopped before lifting gives ~0)
  function flickVelocity(samples) {
    const n = samples ? samples.length : 0;
    if (n < 2) return { vx: 0, vy: 0, speed: 0 };
    const last = samples[n - 1];
    let i = n - 1;
    while (i > 0 && last.t - samples[i - 1].t <= T.FLICK_WINDOW) i--;
    if (i === n - 1) i--;                                         // at least two samples
    while (i > 0 && last.t - samples[i].t < 8) i--;               // too short a span is only noise
    const a = samples[i], dt = (last.t - a.t) / 1000;
    if (!(dt > 0)) return { vx: 0, vy: 0, speed: 0 };
    const vx = (last.x - a.x) / dt, vy = (last.y - a.y) / dt;
    return { vx, vy, speed: Math.hypot(vx, vy) };
  }
  // moves p toward target with a lag (laser dot, a chasing cat); frame-rate independent
  function follow(p, target, dtMs, lagMs = T.LASER_LAG_MS) {
    const k = 1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, lagMs));
    p.x += (target.x - p.x) * k; p.y += (target.y - p.y) * k;
    return p;
  }
  // a flicked toy: b = { x, y, vx, vy, r } in px and px/s inside 0…w × 0…h; returns true when it hit a wall
  function stepToy(b, dt, w, h, friction = T.TOY_FRICTION, bounce = T.TOY_BOUNCE) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    const f = Math.exp(-friction * dt); b.vx *= f; b.vy *= f;
    let hit = false;
    const r = b.r || 0;
    if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * bounce; hit = true; }
    if (b.x > w - r) { b.x = w - r; b.vx = -Math.abs(b.vx) * bounce; hit = true; }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * bounce; hit = true; }
    if (b.y > h - r) { b.y = h - r; b.vy = -Math.abs(b.vy) * bounce; hit = true; }
    if (Math.hypot(b.vx, b.vy) < 5) b.vx = b.vy = 0;
    return hit;
  }

  /* ---------- Gestures ---------- */
  // stroke step for a cat drawn w px wide: short enough for the chin and the ears, at most SPEC's 40 px
  const strokeStepFor = w => (w > 0 ? clamp(T.STROKE_STEP_REL * w, T.STROKE_STEP_MIN, T.STROKE_STEP) : T.STROKE_STEP);
  // a held finger that rubs (wanders over HOLD_PATH px, jitter under HOLD_JITTER ignored, or turns back
  // HOLD_REVERSALS times) is not a long press
  function holdMoved(samples) {
    if (!samples || samples.length < 2) return false;
    let path = 0, ax = samples[0].x, ay = samples[0].y;
    for (const s of samples) {
      const d = Math.hypot(s.x - ax, s.y - ay);
      if (d >= T.HOLD_JITTER) { path += d; ax = s.x; ay = s.y; }
    }
    return path > T.HOLD_PATH || reversals(samples) >= T.HOLD_REVERSALS;
  }
  // the region most of a stroke segment went over; null when it was mostly off Koxa (ties: the earlier one)
  function majorityRegion(regs) {
    const n = {};
    let best = null, bestN = 0, nulls = 0;
    for (const r of regs) {
      if (!r) { nulls++; continue; }
      const c = n[r.id] = (n[r.id] || 0) + 1;
      if (c > bestN) { bestN = c; best = r; }
    }
    return best && regs.length - nulls >= nulls ? best : null;
  }
  function attach(el, opts = {}) {
    let mode = opts.mode || 'care';
    const on = typeof opts.on === 'function' ? opts.on : () => {};
    const time = typeof opts.time === 'function' ? opts.time : (e => e.timeStamp || performance.now());
    const ignore = opts.ignore === undefined ? IGNORE : opts.ignore;
    const emit = (type, d) => on(Object.assign({ type }, d));
    const region = (x, y) => (opts.hitRegion && opts.hitRegion(x, y)) || null;
    const onCat = (x, y) => (opts.hitCat ? !!opts.hitCat(x, y) : !!region(x, y));
    const itemAt = (x, y) => (opts.hitItem && opts.hitItem(x, y)) || null;
    const target = (x, y, item) => (opts.hitTarget && opts.hitTarget(x, y, item)) || null;
    const canFlick = item => (opts.canFlick ? !!opts.canFlick(item) : true);
    const val = v => (typeof v === 'function' ? v() : v);
    const stepLen = () => { const s = Number(val(opts.strokeStep)); return s > 0 ? s : strokeStepFor(Number(val(opts.catWidth))); };
    const ptrs = new Map();   // pointerId → P
    let scr = null;           // two-finger scratch: { acc, last, on, region, lastActive }
    let swipes = [];          // the last swipes, for doubleSwipe
    const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const keep = (P, x, y, t) => {
      P.samples.push({ x, y, t });
      while (P.samples.length > 2 && t - P.samples[0].t > T.SAMPLE_KEEP) P.samples.shift();
    };
    // a finger that does nothing yet (or any more): another finger may start a gesture next to it
    const passive = P => P.kind === 'idle' || P.kind === 'held' || (P.kind === 'pending' && !P.moved);
    const rest = P => { clearTimeout(P.timer); P.timer = 0; P.kind = 'idle'; };
    const wantsScratch = (A, x, y) => mode === 'care' && !A.item && (A.kind === 'pending' || A.kind === 'stroke') &&
      onCat(A.x, A.y) && onCat(x, y);
    // (re)start P as a fresh one-finger gesture at x, y
    function begin(P, x, y, t, again) {
      Object.assign(P, { kind: 'pending', x0: x, y0: y, t0: t, x, y, t, samples: [{ x, y, t }], hold: [{ x, y, t }],
        item: null, cat: false, moved: false, rubbed: false, noTap: !!again, timer: 0, path: 0, seg: null, strokes: 0, pts: [],
        rub: [{ x, y, t }], rs: null, trail: [{ x, y, t }] });
      if (again) { P.cat = mode === 'care' && onCat(x, y); return; }                                    // a finger left over from a scratch: no tap, no long press
      if (mode === 'laser') { P.kind = 'laser'; emit('laser', { x, y, on: true }); return; }
      if (mode === 'train') return;                         // training: taps, swipes and circles only
      P.item = itemAt(x, y);
      if (!P.item) {
        P.cat = mode === 'care' && onCat(x, y);
        P.timer = setTimeout(() => longPress(P), T.LONG_MS);
      }
    }

    function down(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (ignore && e.target && e.target.closest) {
        const hit = e.target.closest(ignore);
        if (hit && hit !== el && el.contains(hit)) return;
      }
      sound.unlock();
      if (ptrs.size >= 5) return;
      const { x, y } = pos(e), t = time(e);
      if (mode === 'minigame') {                             // raw pointers, no recognition
        ptrs.set(e.pointerId, { id: e.pointerId, kind: 'raw', x, y, t, samples: [] });
        capture(e);
        emit('pdown', { id: e.pointerId, x, y, t });
        return;
      }
      const P = { id: e.pointerId };
      begin(P, x, y, t, true);
      ptrs.set(e.pointerId, P);
      capture(e);
      const others = [...ptrs.values()].filter(o => o !== P);
      const busy = others.filter(o => !passive(o)), fresh = others.filter(o => o.kind === 'pending' && !o.moved);
      if (scr) { P.kind = 'idle'; return; }                  // a third finger during a scratch
      if (busy.length) {
        // a gesture is running: a second finger joins it only for a two-finger scratch on Koxa
        if (busy.length === 1 && !fresh.length && wantsScratch(busy[0], x, y)) startScratch(busy[0], P, t);
        else P.kind = 'idle';
        return;
      }
      // the other fingers only rest (a thumb holding the phone): two fresh fingers on Koxa scratch, otherwise the
      // resting ones are ignored from now on and this finger runs as a normal one-finger gesture
      if (fresh.length === 1 && wantsScratch(fresh[0], x, y)) { startScratch(fresh[0], P, t); return; }
      for (const o of fresh) rest(o);
      begin(P, x, y, t, false);
    }
    function startScratch(A, B, t) {
      for (const p of [A, B]) {
        endRub(p);
        clearTimeout(p.timer); p.timer = 0;
        p.kind = 'scratch'; p.pts = [{ x: p.x, y: p.y, t }]; p.s0 = { x: p.x, y: p.y };
      }
      scr = { acc: 0, last: t, on: false, region: null, lastActive: t };
    }
    function capture(e) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    function longPress(P) {
      if (ptrs.get(P.id) !== P || P.kind !== 'pending' || P.moved || P.rubbed) return;
      if (P.cat) { P.kind = 'carry'; emit('pickup', { x: P.x, y: P.y }); }
      else { P.kind = 'held'; emit('longpress', { x: P.x, y: P.y }); }
    }
    function move(e) {
      const P = ptrs.get(e.pointerId);
      if (!P) return;
      const { x, y } = pos(e), t = time(e), step = Math.hypot(x - P.x, y - P.y);
      P.x = x; P.y = y; P.t = t;
      if (P.kind === 'raw') { emit('pmove', { id: P.id, x, y, t }); return; }
      keep(P, x, y, t);
      P.trail.push({ x, y, t });
      if (mode === 'train') { if (P.trail.length > 1000) P.trail.shift(); }
      else while (P.trail.length > 2 && t - P.trail[0].t > T.CIRCLE_MS) P.trail.shift();
      if (P.kind === 'laser') { emit('laser', { x, y, on: true }); return; }
      if ((P.kind === 'pending' || P.kind === 'stroke') && P.cat && mode === 'care') rubStep(P, x, y, t, step);
      if (P.kind === 'pending') {
        if (P.timer) {
          if (P.hold.length < 400) P.hold.push({ x, y, t });
          if (holdMoved(P.hold)) { clearTimeout(P.timer); P.timer = 0; P.rubbed = true; } // rubbing is not holding
        }
        if (Math.hypot(x - P.x0, y - P.y0) < T.SLOP) return;
        clearTimeout(P.timer); P.timer = 0; P.moved = true;
        if (P.item) { P.kind = 'drag'; emit('dragStart', { item: P.item, x: P.x0, y: P.y0 }); }
        else {
          P.kind = 'stroke'; P.path = Math.hypot(x - P.x0, y - P.y0);
          P.seg = { x: P.x0, y: P.y0, t: P.t0, path: P.path, regs: mode === 'care' ? [region(P.x0, P.y0)] : [] };
        }
      } else if (P.kind === 'stroke') { P.path += step; P.seg.path += step; }
      if (P.kind === 'stroke') {
        if (mode === 'care') P.seg.regs.push(region(x, y));
        if (P.rs) P.seg = { x, y, t, path: 0, regs: [] };   // rubbing: no strokes meanwhile
        else if (P.seg.path >= stepLen()) strokeEnd(P, x, y, t);
      } else if (P.kind === 'drag') emit('dragMove', { item: P.item, x, y, target: target(x, y, P.item) });
      else if (P.kind === 'carry') emit('carry', { x, y, target: target(x, y, 'cat') });
      else if (P.kind === 'scratch') {
        P.pts.push({ x, y, t });
        while (P.pts.length > 2 && t - P.pts[0].t > T.SCRATCH_WINDOW) P.pts.shift();
        scratchStep(P, t, step);
      }
    }
    // closes the current stroke segment at x, y and emits it; the region is the one most of the segment went over
    function strokeEnd(P, x, y, t) {
      const s = P.seg;
      P.seg = { x, y, t, path: 0, regs: mode === 'care' ? [s.regs[s.regs.length - 1] || null] : [] };
      if (mode !== 'care') return;
      const reg = majorityRegion(s.regs.concat([region((s.x + x) / 2, (s.y + y) / 2)]));
      if (!reg) return;
      if (Math.hypot(x - s.x, y - s.y) < T.STROKE_STRAIGHT * s.path) return; // went back and forth: not a stroke
      const c = classifyStroke(reg.fur, x - s.x, y - s.y, t - s.t, s.path);
      if (c.slow) return;                                     // too slow: nothing (SPEC §7)
      P.strokes++;
      P.rub = [{ x, y, t }];                                  // a rub is looked for from here on
      emit('stroke', { region: reg, along: c.along, speed: Math.round(c.speed), rough: c.rough, x, y, dx: x - s.x, dy: y - s.y });
    }
    // one finger rubbing Koxa on the spot scratches her too (fingers: 1); no tap, no long press, no strokes meanwhile
    function rubStep(P, x, y, t, step) {
      P.rub.push({ x, y, t });
      while (P.rub.length > 2 && t - P.rub[0].t > T.SCRATCH_WINDOW) P.rub.shift();
      // the finger left the spot it rubbed: the rub ends at once and that move may be a stroke
      if (P.rs && Math.hypot(x - P.rs.cx, y - P.rs.cy) > T.RUB_MAX) { endRub(P); P.rub = [{ x, y, t }]; return; }
      const reg = step > 0.5 && isRub(P.rub) ? region(x, y) : null;
      if (reg) {
        if (!P.rs) {
          clearTimeout(P.timer); P.timer = 0; P.rubbed = true;
          P.rs = { acc: 0, last: t, lastActive: t, cx: x, cy: y };
          emit('scratchStart', { region: reg, fingers: 1 });
        }
        P.rs.cx += (x - P.rs.cx) * 0.1; P.rs.cy += (y - P.rs.cy) * 0.1;   // the middle of the rub
        P.rs.lastActive = t;
        P.rs.acc += clamp(t - P.rs.last, 0, 150);
        if (P.rs.acc >= T.SCRATCH_EMIT_MS) { P.rs.acc -= T.SCRATCH_EMIT_MS; emit('scratch', { region: reg, seconds: 1, fingers: 1, x, y }); }
      } else if (P.rs && t - P.rs.lastActive > T.SCRATCH_IDLE_MS) { endRub(P); P.rub = [{ x, y, t }]; }
      if (P.rs) P.rs.last = t;
    }
    function endRub(P) { if (P.rs) { P.rs = null; emit('scratchEnd', { fingers: 1 }); } }
    function scratchStep(P, t, step) {
      if (!scr) return;
      const fingers = [...ptrs.values()].filter(p => p.kind === 'scratch');
      // one finger rests while the other strokes in one direction: that is a stroke, not a scratch
      if (!scr.on && fingers.length === 2) {
        const other = fingers[0] === P ? fingers[1] : fingers[0];
        const net = Math.hypot(P.x - P.s0.x, P.y - P.s0.y);
        if (net >= stepLen() && reversals(P.pts) === 0 && Math.hypot(other.x - other.s0.x, other.y - other.s0.y) < T.SLOP) {
          scr = null; rest(other);
          P.kind = 'stroke'; P.moved = true; P.cat = true; P.noTap = true; P.x0 = P.s0.x; P.y0 = P.s0.y; P.path = 0;
          P.seg = { x: P.x, y: P.y, t, path: 0, regs: [region(P.x, P.y)] };
          return;
        }
      }
      const active = step > 0.5 && fingers.some(p => isScratch(p.pts));
      let reg = null;
      if (active) {
        // the fingers' own regions first (an ear wins: fingers behind both ears are on the ears), the middle last
        const rs = fingers.map(p => region(p.x, p.y));
        reg = rs.find(r => r && r.id === 'ears') || rs.find(Boolean) || null;
        if (!reg && fingers.length === 2) reg = region((fingers[0].x + fingers[1].x) / 2, (fingers[0].y + fingers[1].y) / 2);
      }
      if (active && reg) {
        if (!scr.on) { scr.on = true; scr.acc = 0; emit('scratchStart', { region: reg, fingers: 2 }); }
        scr.region = reg; scr.lastActive = t;
        scr.acc += clamp(t - scr.last, 0, 150);
        if (scr.acc >= T.SCRATCH_EMIT_MS) {
          scr.acc -= T.SCRATCH_EMIT_MS;
          emit('scratch', { region: reg, seconds: 1, fingers: 2, x: P.x, y: P.y });
        }
      } else if (scr.on && t - scr.lastActive > T.SCRATCH_IDLE_MS) { scr.on = false; emit('scratchEnd', { fingers: 2 }); }
      scr.last = t;
    }
    // a scratch ends when a finger lifts; the finger left may start a new gesture (no tap, no long press)
    function endScratch(t) {
      if (scr && scr.on) emit('scratchEnd', { fingers: 2 });
      scr = null;
      for (const p of ptrs.values()) if (p.kind === 'scratch') begin(p, p.x, p.y, t, true);
    }
    function up(e) {
      const P = ptrs.get(e.pointerId);
      if (!P) return;
      const { x, y } = pos(e), t = time(e);
      if (P.kind === 'raw') {
        ptrs.delete(e.pointerId);
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        emit('pup', { id: P.id, x, y, t });
        return;
      }
      if (P.kind === 'stroke') { const d = Math.hypot(x - P.x, y - P.y); P.path += d; P.seg.path += d; if (mode === 'care') P.seg.regs.push(region(x, y)); }
      P.x = x; P.y = y; P.t = t; keep(P, x, y, t);
      ptrs.delete(e.pointerId);
      clearTimeout(P.timer);
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      sound.unlock();
      endRub(P);
      if (P.kind === 'laser') emit('laser', { x, y, on: false });
      else if (P.kind === 'pending') {
        // any press that did not move, did not rub and was not a long press is a tap
        if (!P.moved && !P.rubbed && !P.noTap && t - P.t0 < T.LONG_MS) emit('tap', { x, y, item: P.item, region: mode === 'care' || mode === 'train' ? region(x, y) : null, cat: P.cat });
      } else if (P.kind === 'stroke') {
        if (P.seg.path >= T.STROKE_TAIL) strokeEnd(P, x, y, t);  // the rest of the stroke counts too
        // tricks: a quick straight move that did not start on Koxa and did not stroke her
        P.trail.push({ x, y, t });
        const dx = x - P.x0, dy = y - P.y0, net = Math.hypot(dx, dy);
        if (mode === 'train') {
          // training: slower cues count, and a miss says why (the UI tells the player what to change)
          const cue = classifyCue(P.trail, P.t0);
          if (cue.type === 'circle') emit('circle', { dir: cue.dir, radius: Math.round(cue.radius), x: cue.cx, y: cue.cy });
          else if (cue.type === 'swipe') swiped(cue.dir, cue.dx, cue.dy, x, y, t, P.t0);
          else emit('trainMiss', { reason: cue.reason, dx: cue.dx, dy: cue.dy, x, y });
        } else if (!P.cat && !P.strokes && net >= T.SWIPE_MIN && t - P.t0 <= T.SWIPE_MS && net >= T.SWIPE_STRAIGHT * Math.max(net, P.path)) {
          swiped(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), dx, dy, x, y, t, P.t0);
        }
      } else if (P.kind === 'drag') {
        const tg = target(x, y, P.item), v = flickVelocity(P.samples);
        if (!tg && v.speed > T.FLICK_MIN && canFlick(P.item)) emit('flick', { item: P.item, x, y, vx: v.vx, vy: v.vy });
        else emit('dragEnd', { item: P.item, x, y, target: tg });
      } else if (P.kind === 'carry') emit('drop', { x, y, target: target(x, y, 'cat') });
      else if (P.kind === 'scratch') endScratch(t);
    }
    function swiped(dir, dx, dy, x, y, t, t0) {
      emit('swipe', { dir, dx, dy, x, y });
      swipes = swipes.concat([{ dir, t, t0 }]).slice(-2);
      const two = isDoubleSwipe(swipes);
      if (two) { swipes = []; emit('doubleSwipe', { dir: two, x, y }); }
    }
    // the browser took the pointer (a system gesture, a scroll) or the mode changed: nothing is applied
    function drop(P) {
      ptrs.delete(P.id);
      if (P.kind === 'raw') { emit('pup', { id: P.id, x: P.x, y: P.y, t: P.t, cancel: true }); return; }
      clearTimeout(P.timer);
      endRub(P);
      if (P.kind === 'drag') emit('cancel', { what: 'drag', item: P.item });
      else if (P.kind === 'carry') emit('cancel', { what: 'carry', item: 'cat' });
      else if (P.kind === 'laser') emit('laser', { x: P.x, y: P.y, on: false });
      else if (P.kind === 'scratch') endScratch(P.t);
    }
    function cancelEv(e) { const P = ptrs.get(e.pointerId); if (P) drop(P); }
    function cancelAll() { for (const P of [...ptrs.values()]) drop(P); ptrs.clear(); scr = null; }
    const noMenu = e => e.preventDefault();                  // Android shows a menu after a long press
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancelEv);
    el.addEventListener('lostpointercapture', cancelEv);     // after pointerup the pointer is already gone
    el.addEventListener('contextmenu', noMenu);
    function detach() {
      cancelAll();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancelEv);
      el.removeEventListener('lostpointercapture', cancelEv);
      el.removeEventListener('contextmenu', noMenu);
    }
    detach.detach = detach;
    detach.setMode = m => { if (m !== mode) { cancelAll(); mode = m; } };
    detach.mode = () => mode;
    detach.cancel = cancelAll;
    detach.strokeStep = stepLen;
    return detach;
  }

  /* ---------- Tilt (after Kulička's sensor code) ---------- */
  const tilt = (() => {
    let state = 'off', onT = null, onS = null, listening = false, waitT = 0, token = 0, bound = false;
    let grav = null, levelR = null, leveling = 0, sum = [0, 0, 0], n = 0;
    const set = s => { if (s !== state) { state = s; if (onS) onS(s); } };
    // Rodrigues: the rotation that turns the unit vector v into (0, 0, -1)
    function rotationToFlat(v) {
      const len = Math.hypot(v[0], v[1], v[2]) || 1, a = v.map(x => x / len);
      const c = -a[2];
      let k = [-a[1], a[0], 0];
      const s = Math.hypot(k[0], k[1]);
      if (s < 1e-6) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1];
      k = k.map(x => x / s);
      const t = 1 - c, [x, y, z] = k;
      return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
              t * x * y + s * z, t * y * y + c, t * y * z - s * x,
              t * x * z - s * y, t * y * z + s * x, t * z * z + c];
    }
    const angle = () => { try { return ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180; } catch (e) { return 0; } };
    const dz = v => clamp(Math.abs(v) < T.TILT_DEAD ? 0 : v - Math.sign(v) * T.TILT_DEAD, -1, 1); // a hand never holds still
    function onOrient(e) {
      if (e.beta == null || e.gamma == null) return;
      const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
      const v = [Math.sin(g) * Math.cos(b), -Math.sin(b), -Math.cos(g) * Math.cos(b)];
      grav = grav ? grav.map((x, i) => x * (1 - T.TILT_SMOOTH) + v[i] * T.TILT_SMOOTH) : v;
      if (state !== 'ok') { clearTimeout(waitT); set('ok'); }
      if (leveling) {
        for (let i = 0; i < 3; i++) sum[i] += v[i];
        n++;
        if (performance.now() >= leveling) { leveling = 0; levelR = rotationToFlat(n ? sum : grav); }
      } else if (!levelR) levelR = rotationToFlat(v);
      if (!onT) return;
      if (leveling || !levelR) { onT({ ax: 0, ay: 0 }); return; }
      const R = levelR, q = grav;
      const dx = R[0] * q[0] + R[1] * q[1] + R[2] * q[2], dy = R[3] * q[0] + R[4] * q[1] + R[5] * q[2];
      const th = angle(), sx = dx * Math.cos(th) - dy * Math.sin(th), sy = dx * Math.sin(th) + dy * Math.cos(th);
      onT({ ax: dz(sx), ay: dz(-sy) });
    }
    function level() { leveling = performance.now() + T.TILT_LEVEL_MS; sum = [0, 0, 0]; n = 0; }
    function listen() {
      listening = true;
      if (!('DeviceOrientationEvent' in window)) { set('none'); return; }
      addEventListener('deviceorientation', onOrient);
      if (state !== 'ok') set('wait');
      clearTimeout(waitT);
      waitT = setTimeout(() => { if (state === 'wait') set('none'); }, T.TILT_WAIT_MS);
      level();
    }
    function bind() {
      if (bound) return;
      bound = true;
      document.addEventListener('visibilitychange', () => { if (!document.hidden && listening) level(); }); // back: level again
    }
    function needsAsk() { return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'; }
    function start(onTilt, onState) {
      onT = onTilt || null; onS = onState || null;
      if (listening || state === 'ask') { if (onS) onS(state); return; }
      bind();
      // iOS 13+ (and newer Chrome) have requestPermission: Chrome answers "granted" by itself, iOS refuses without
      // a tap, and then the caller shows a button that calls askPermission()
      if (needsAsk()) {
        const my = ++token;
        set('wait');
        const ask = () => { if (my === token) set('ask'); };
        try { DeviceOrientationEvent.requestPermission().then(r => { if (my !== token) return; if (r === 'granted') listen(); else ask(); }).catch(ask); } catch (e) { ask(); }
        return;
      }
      listen();
    }
    function askPermission() {
      if (!needsAsk()) { if (!listening) listen(); return Promise.resolve(state); }
      const my = ++token;
      const refused = () => { if (my === token) { listening = false; set('none'); } return state; };
      try {
        return DeviceOrientationEvent.requestPermission().then(r => { if (my !== token) return state; if (r === 'granted') { listen(); return state; } return refused(); }).catch(refused);
      } catch (e) { return Promise.resolve(refused()); }
    }
    function stop() {
      token++;
      if (listening) removeEventListener('deviceorientation', onOrient);
      listening = false; clearTimeout(waitT); grav = null; levelR = null; leveling = 0;
      set('off');
      onT = null; onS = null;
    }
    return { start, stop, level, askPermission, state: () => state };
  })();

  /* ---------- Audio context (shared by the sounds and the microphone) ---------- */
  let ctx = null, master = null, noiseBuf = null, ctxBound = false;
  const activated = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !activated()) return null;                  // Chrome warns about a context made before a tap
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.8;
        const lim = ctx.createDynamicsCompressor();          // a loud yowl over a purr never clips
        lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15;
        master.connect(lim); lim.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
      if (!ctxBound) {
        ctxBound = true;
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) { sound.purr(false); ctx.suspend().catch(() => {}); }
        });
      }
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    return ctx;
  }
  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    return s;
  }

  /* ---------- Sounds (synthesized, SPEC §12a) ---------- */
  // Vowels of a cat's "m-i-a-u" (an adult female, voice F0 about 400–700 Hz): F1, F2, F3 in Hz and the cutoff of the
  // "mouth" low-pass (a closed mouth = m / rr is dark, an open a is bright)
  const VOWEL = {
    m: [420, 1500, 2900, 650],
    r: [560, 1550, 2700, 1500],
    i: [720, 2400, 3300, 5200],
    e: [850, 2100, 3100, 5200],
    a: [1100, 1700, 2900, 6500],
    o: [820, 1350, 2700, 3600],
    u: [720, 1150, 2600, 2300],
  };
  // The variants: f0 (Hz), d (s), amp, contour [[time 0…1, pitch factor]], vowels [[time, vowel]], vib [rate Hz, depth],
  // breath (noise), roll [rate Hz, depth, from, to] (the rolled r: amplitude flutter), harsh (rough second voice),
  // waver (slow pitch wobble), cut (ends abruptly, like "mrrp")
  const VARIANT = {
    mew: { f0: 760, d: 0.32, amp: 0.45, contour: [[0, 0.9], [0.35, 1.12], [1, 0.86]],
      vowels: [[0, 'm'], [0.15, 'i'], [0.7, 'e'], [1, 'u']], vib: [6.5, 0.01], breath: 0.04 },
    meow: { f0: 580, d: 0.7, amp: 0.55, contour: [[0, 0.85], [0.35, 1.1], [0.6, 1.04], [1, 0.75]],
      vowels: [[0, 'm'], [0.1, 'i'], [0.3, 'a'], [0.65, 'a'], [0.88, 'o'], [1, 'u']], vib: [5.5, 0.012], breath: 0.05 },
    demand: { f0: 620, d: 1.1, amp: 0.7, contour: [[0, 0.8], [0.25, 1.12], [0.7, 1.08], [1, 0.8]],
      vowels: [[0, 'm'], [0.08, 'r'], [0.17, 'a'], [0.75, 'a'], [0.9, 'o'], [1, 'u']], vib: [6, 0.015], breath: 0.08,
      roll: [28, 0.5, 0.04, 0.16], harsh: 0.15 },
    plaintive: { f0: 600, d: 1.0, amp: 0.45, contour: [[0, 1], [0.2, 1.08], [1, 0.62]],
      vowels: [[0, 'm'], [0.1, 'i'], [0.35, 'a'], [0.7, 'o'], [1, 'u']], vib: [5, 0.02], breath: 0.1 },
    chirp: { f0: 600, d: 0.22, amp: 0.5, contour: [[0, 0.85], [0.6, 1.05], [1, 1.3]],
      vowels: [[0, 'm'], [0.2, 'r'], [0.75, 'e'], [1, 'e']], vib: [6, 0.008], breath: 0.03, roll: [28, 0.7, 0.1, 0.65], cut: true },
    trill: { f0: 560, d: 0.45, amp: 0.45, contour: [[0, 0.85], [0.8, 1.15], [1, 1.25]],
      vowels: [[0, 'm'], [0.15, 'r'], [0.85, 'r'], [1, 'e']], vib: [6, 0.008], breath: 0.03, roll: [30, 0.8, 0.1, 0.95], cut: true },
    question: { f0: 560, d: 0.4, amp: 0.45, contour: [[0, 0.9], [0.5, 0.95], [1, 1.4]],
      vowels: [[0, 'm'], [0.15, 'r'], [0.5, 'r'], [0.8, 'a'], [1, 'e']], vib: [6, 0.01], breath: 0.04, roll: [27, 0.6, 0.1, 0.55] },
    yowl: { f0: 470, d: 1.8, amp: 0.75, contour: [[0, 0.8], [0.15, 1.1], [0.4, 0.95], [0.6, 1.12], [0.85, 0.9], [1, 0.7]],
      vowels: [[0, 'm'], [0.08, 'a'], [0.3, 'o'], [0.45, 'a'], [0.7, 'u'], [0.85, 'a'], [1, 'u']], vib: [4, 0.03],
      breath: 0.12, harsh: 0.35, waver: [2.5, 0.06] },
    lap: { f0: 380, d: 0.45, amp: 0.75, contour: [[0, 0.95], [0.5, 1.05], [1, 0.9]],
      vowels: [[0, 'm'], [0.3, 'r'], [0.6, 'o'], [1, 'm']], vib: [5, 0.01], breath: 0.02, roll: [24, 0.5, 0.2, 0.8] },
  };
  const VOICE_GAIN = 1.6;   // the formant filters swallow much of the source: brings a meow to about −6 dBFS
  const KINDS = ['mew', 'meow', 'demand', 'plaintive', 'chirp', 'trill', 'question', 'yowl', 'hiss', 'purr', 'nom', 'lap'];
  // which variants fit a mood (weights); never the same one twice in a row
  const MOOD_KINDS = {
    happy: { mew: 3, chirp: 3, trill: 2, question: 2, meow: 2 },
    calm: { meow: 4, question: 2, mew: 2, chirp: 1 },
    grumpy: { demand: 4, meow: 2, yowl: 1 },
    sad: { plaintive: 4, meow: 1, mew: 1 },
    want: { demand: 4, meow: 2, plaintive: 1 },
    offended: { yowl: 2, demand: 1, plaintive: 1 },
  };
  // the voice parameters for one call: the variant randomized (pitch ±15 %, length, contour, loudness); pure (rnd)
  function voiceParams(kind, rnd = Math.random) {
    const v = VARIANT[kind] || VARIANT.meow, r = (a, b) => a + (b - a) * rnd();
    const pitch = r(0.85, 1.15), len = r(0.8, 1.25), size = r(0.95, 1.05);
    const jitter = list => list.map(([t, x], i) => [i === 0 || i === list.length - 1 ? t : clamp(t + r(-0.05, 0.05), 0.02, 0.98), x])
      .sort((a, b) => a[0] - b[0]);
    return {
      kind, f0: v.f0 * pitch, d: v.d * len, amp: v.amp * r(0.8, 1.1),
      contour: jitter(v.contour).map(([t, f]) => [t, f * r(0.95, 1.05)]),
      vowels: jitter(v.vowels).map(([t, k]) => [t, VOWEL[k].slice(0, 3).map(f => f * size).concat(VOWEL[k][3])]),
      vib: [v.vib[0] * r(0.85, 1.15), v.vib[1]], breath: v.breath * r(0.7, 1.3),
      roll: v.roll ? [v.roll[0] * r(0.9, 1.1), v.roll[1], v.roll[2], v.roll[3]] : null,
      harsh: v.harsh || 0, waver: v.waver || null, cut: !!v.cut,
    };
  }
  // picks a variant for a mood: weighted, never the previous one
  function pickKind(mood, last, rnd = Math.random) {
    const w = Object.assign({}, MOOD_KINDS[mood] || MOOD_KINDS.calm);
    if (last && Object.keys(w).length > 1) delete w[last];
    let sum = 0;
    for (const k in w) sum += w[k];
    let x = rnd() * sum;
    for (const k in w) { x -= w[k]; if (x < 0) return k; }
    return Object.keys(w)[0];
  }

  const sound = (() => {
    let enabled = true, purrNodes = null, lastKind = null, lastSaid = null;
    const ready = () => (enabled && !document.hidden ? getCtx() : null);
    const r = (a, b) => a + (b - a) * Math.random();
    // one meow-like call: a sawtooth (+ a little pulse) voice through three formant band-passes and a "mouth" low-pass
    function voice(c, p, t, dest = master) {
      const d = p.d, end = t + d, stopT = end + 0.08, amp = p.amp * VOICE_GAIN;
      const out = c.createGain(), g = out.gain;
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(amp * 0.6, t + Math.min(0.06, d * 0.2));             // the nasal "m" is soft
      g.linearRampToValueAtTime(amp, t + d * 0.3);
      if (p.cut) { g.setValueAtTime(amp, end - 0.02); g.linearRampToValueAtTime(0, end); }
      else { g.setValueAtTime(amp, t + d * 0.7); g.linearRampToValueAtTime(0, end); }
      const src = c.createGain(); src.gain.value = 1;
      const oscs = [], add = (type, gain, detune) => {
        const o = c.createOscillator(), og = c.createGain();
        o.type = type; o.detune.value = detune || 0; og.gain.value = gain;
        o.frequency.setValueAtTime(p.f0 * p.contour[0][1], t);
        for (const [tt, f] of p.contour.slice(1)) o.frequency.exponentialRampToValueAtTime(p.f0 * f, t + tt * d);
        o.connect(og); og.connect(src); oscs.push(o);
        return o;
      };
      add('sawtooth', 1);
      add('square', 0.25);
      if (p.harsh) add('sawtooth', p.harsh, r(18, 30));                              // a rough, slightly off voice
      const lfos = [], mod = (rate, depth) => {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = rate; lg.gain.value = p.f0 * depth;
        l.connect(lg); for (const o of oscs) lg.connect(o.frequency); lfos.push(l);
      };
      mod(p.vib[0], p.vib[1]);
      if (p.waver) mod(p.waver[0], p.waver[1]);
      // formants F1–F3 (Q = frequency / bandwidth) and a dry part for body
      const mouth = c.createBiquadFilter(); mouth.type = 'lowpass'; mouth.Q.value = 0.7;
      const v0 = p.vowels[0][1];
      mouth.frequency.setValueAtTime(v0[3], t);
      for (const [tt, v] of p.vowels.slice(1)) mouth.frequency.linearRampToValueAtTime(v[3], t + tt * d);
      [[7, 1.1], [10, 0.75], [12, 0.3]].forEach(([q, gain], k) => {
        const bp = c.createBiquadFilter(), bg = c.createGain();
        bp.type = 'bandpass'; bp.Q.value = q; bg.gain.value = gain;
        bp.frequency.setValueAtTime(v0[k], t);
        for (const [tt, v] of p.vowels.slice(1)) bp.frequency.linearRampToValueAtTime(v[k], t + tt * d);
        src.connect(bp); bp.connect(bg); bg.connect(mouth);
      });
      const dry = c.createGain(); dry.gain.value = 0.08; src.connect(dry); dry.connect(mouth);
      // breath: soft noise through the same mouth
      const nz = noise(c), nb = c.createBiquadFilter(), ng = c.createGain();
      nb.type = 'bandpass'; nb.frequency.value = 3000; nb.Q.value = 0.8; ng.gain.value = p.breath;
      nz.connect(nb); nb.connect(ng); ng.connect(mouth);
      // the rolled r: a fast flutter of the loudness between "from" and "to"
      let last = mouth;
      if (p.roll) {
        const [rate, depth, from, to] = p.roll, am = c.createGain(), l = c.createOscillator(), lg = c.createGain();
        am.gain.value = 1 - depth / 2; l.type = 'triangle'; l.frequency.value = rate;
        lg.gain.setValueAtTime(0, t);
        lg.gain.setValueAtTime(depth / 2, t + from * d);
        lg.gain.setValueAtTime(depth / 2, t + to * d);
        lg.gain.linearRampToValueAtTime(0, t + Math.min(1, to + 0.05) * d);
        l.connect(lg); lg.connect(am.gain); mouth.connect(am); last = am; lfos.push(l);
      }
      last.connect(out); out.connect(dest);
      for (const s of [...oscs, ...lfos, nz]) { s.start(t); s.stop(stopT); }
    }
    function hissAt(c, t, dest = master) {
      const d = r(0.6, 1.1), nz = noise(c), hp = c.createBiquadFilter(), bp = c.createBiquadFilter(), g = c.createGain();
      hp.type = 'highpass'; hp.frequency.value = r(1600, 2200);
      bp.type = 'peaking'; bp.frequency.value = r(3500, 5500); bp.Q.value = 1; bp.gain.value = 9;
      const a = r(0.2, 0.28);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * 1.4, t + 0.02);                               // the spit at the start
      g.gain.linearRampToValueAtTime(a, t + 0.09);
      g.gain.setValueAtTime(a, t + d * 0.6);
      g.gain.linearRampToValueAtTime(0, t + d);
      nz.connect(hp); hp.connect(bp); bp.connect(g); g.connect(dest); nz.start(t); nz.stop(t + d + 0.05);
    }
    function nomAt(c, t0, dest = master) {
      const n = 2 + Math.floor(Math.random() * 3);
      let t = t0;
      for (let i = 0; i < n; i++) {
        // the crunch: a short band of noise; the bite: a low thump
        const nz = noise(c), bp = c.createBiquadFilter(), g = c.createGain(), dk = r(0.04, 0.07);
        bp.type = 'bandpass'; bp.frequency.value = r(1200, 2600); bp.Q.value = 1.5;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(r(0.35, 0.5), t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + dk);
        nz.connect(bp); bp.connect(g); g.connect(dest); nz.start(t); nz.stop(t + dk + 0.02);
        const o = c.createOscillator(), og = c.createGain();
        o.frequency.setValueAtTime(r(130, 160), t); o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.3, t + 0.005); og.gain.linearRampToValueAtTime(0, t + 0.07);
        o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.08);
        t += r(0.14, 0.24);
      }
    }
    // say(kind): one sound of that variant, randomized every time; returns the kind (or null when silent)
    function say(kind, o = {}) {
      if (!KINDS.includes(kind)) kind = 'meow';
      lastSaid = kind;
      if (kind === 'purr') {                                  // a short purr
        if (!purrNodes && ready()) { purr(true, o.intensity); setTimeout(() => purr(false), (o.seconds || 2.5) * 1000); }
        return purrNodes ? kind : null;
      }
      const c = ready(); if (!c) return null;
      const t = c.currentTime + 0.02;
      if (kind === 'hiss') hissAt(c, t);
      else if (kind === 'nom') nomAt(c, t);
      else voice(c, voiceParams(kind), t);
      return kind;
    }
    // meow(mood): a variant that fits the mood ('happy'|'calm'|'grumpy'|'sad'|'want'|'offended'), never the same
    // variant twice in a row; returns the variant chosen
    function meow(mood) {
      const kind = pickKind(mood, lastKind);
      lastKind = kind;
      say(kind);
      return kind;
    }
    // purr(on, intensity 0…1): a low buzz at ~25 Hz with its harmonics (audible on a phone speaker) plus a chopped
    // noise layer, breathing in (quieter, slower) and out (louder) about every 2.5 s
    function purr(onOff, intensity = 0.6) {
      const lvl = 0.25 + 0.75 * clamp(Number(intensity) || 0, 0, 1);
      if (!onOff) {
        if (!purrNodes) return;
        const nodes = purrNodes; purrNodes = null;
        clearTimeout(nodes.timer);
        try {
          const t = nodes.c.currentTime;
          nodes.out.gain.cancelScheduledValues(t);
          nodes.out.gain.setValueAtTime(nodes.out.gain.value, t);
          nodes.out.gain.linearRampToValueAtTime(0, t + 0.3);
          for (const s of nodes.src) s.stop(t + 0.35);
        } catch (e) {}
        return;
      }
      if (purrNodes) {                                        // already purring: only the intensity changes
        const t = purrNodes.c.currentTime;
        purrNodes.out.gain.cancelScheduledValues(t);
        purrNodes.out.gain.setValueAtTime(purrNodes.out.gain.value, t);
        purrNodes.out.gain.linearRampToValueAtTime(lvl, t + 0.4);
        return;
      }
      const c = ready(); if (!c) return;
      const t0 = c.currentTime;
      const buzz = c.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = 25;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
      const gA = c.createGain(); gA.gain.value = 0.55;
      buzz.connect(lp); lp.connect(gA);
      const nz = noise(c), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 350; bp.Q.value = 0.7;
      const am = c.createGain(); am.gain.value = 0.5;
      const chop = c.createOscillator(); chop.frequency.value = 25;
      const depth = c.createGain(); depth.gain.value = 0.45;
      chop.connect(depth); depth.connect(am.gain);
      const gB = c.createGain(); gB.gain.value = 0.9;
      nz.connect(bp); bp.connect(am); am.connect(gB);
      const breath = c.createGain(); breath.gain.value = 0;
      gA.connect(breath); gB.connect(breath);
      const out = c.createGain();
      out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(lvl, t0 + 0.4);
      breath.connect(out); out.connect(master);
      buzz.start(t0); nz.start(t0); chop.start(t0);
      const nodes = { c, out, src: [buzz, nz, chop], timer: 0 };
      purrNodes = nodes;
      // one breath at a time, scheduled a little ahead
      (function cycle(t) {
        if (purrNodes !== nodes) return;
        const tin = r(0.9, 1.2), tout = r(1.1, 1.5), gap1 = 0.1, gap2 = r(0.12, 0.25);
        const b = breath.gain, f = [buzz.frequency, chop.frequency];
        b.setValueAtTime(0.05, t);
        b.linearRampToValueAtTime(0.55, t + 0.25); b.setValueAtTime(0.55, t + tin - 0.2); b.linearRampToValueAtTime(0.05, t + tin);
        const to = t + tin + gap1;
        b.linearRampToValueAtTime(1, to + 0.2); b.setValueAtTime(1, to + tout - 0.25); b.linearRampToValueAtTime(0.05, to + tout);
        for (const p of f) { p.setValueAtTime(r(21, 23), t); p.setValueAtTime(r(25, 28), to); }
        const next = to + tout + gap2;
        nodes.timer = setTimeout(() => cycle(next), Math.max(0, (next - c.currentTime - 0.3) * 1000));
      })(t0 + 0.05);
    }
    // tests and tuning: renders one call of a kind offline → Promise({ data: Float32Array, rate, params })
    function render(kind, rate = 22050) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
      const p = voiceParams(kind), oc = new OAC(1, Math.ceil(rate * ((p.d || 1) + 1.3)), rate);
      if (kind === 'hiss') hissAt(oc, 0.01, oc.destination);
      else if (kind === 'nom') nomAt(oc, 0.01, oc.destination);
      else voice(oc, p, 0.01, oc.destination);
      return oc.startRendering().then(b => ({ data: b.getChannelData(0), rate, params: p }));
    }
    const nom = () => say('nom'), hiss = () => say('hiss'), chirp = () => say('chirp');
    function setEnabled(b) { enabled = !!b; if (!enabled) purr(false); }
    function unlock() { if (enabled) getCtx(); }
    return { meow, say, purr, nom, hiss, chirp, setEnabled, unlock, render, KINDS,
      enabled: () => enabled, purring: () => !!purrNodes, last: () => lastSaid };
  })();

  /* ---------- Microphone (loudness only) ---------- */
  const mic = (() => {
    let state = 'off', stream = null, src = null, an = null, buf = null, timer = 0, maxT = 0, token = 0, bound = false;
    let over = 0, quietUntil = 0, lastT = 0, cb = {};
    const api = { threshold: T.MIC_CALL_LEVEL };
    const set = s => { if (s !== state) { state = s; if (cb.state) cb.state(s); } };
    function release() {
      clearInterval(timer); clearTimeout(maxT); timer = maxT = 0;
      if (stream) for (const tr of stream.getTracks()) { try { tr.stop(); } catch (e) {} }
      try { if (src) src.disconnect(); } catch (e) {}
      stream = src = an = null;
    }
    function poll() {
      if (!an) return;
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length), db = 20 * Math.log10(rms + 1e-9);
      const lv = clamp((db - T.MIC_FLOOR_DB) / -T.MIC_FLOOR_DB, 0, 1);
      const t = performance.now(), dt = lastT ? t - lastT : T.MIC_POLL_MS;
      lastT = t;
      if (cb.level) cb.level(lv);
      if (lv >= api.threshold) {
        over += dt;
        if (over >= T.MIC_CALL_MS && t >= quietUntil) { over = 0; quietUntil = t + T.MIC_COOLDOWN_MS; if (cb.call) cb.call(); }
      } else over = 0;
    }
    function bind() {
      if (bound) return;
      bound = true;
      const hide = () => { if (state === 'ok' || state === 'ask') api.stop(); };
      document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
      addEventListener('pagehide', hide);
    }
    api.start = (onLevel, onCall, onState, o = {}) => {
      release();
      const my = ++token;
      cb = { level: onLevel, call: onCall, state: onState };
      bind();
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') { state = ''; set('none'); return; }
      state = ''; set('ask');
      let p;
      try { p = md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch (e) { set('none'); return; }
      p.then(s => {
        if (my !== token) { for (const tr of s.getTracks()) tr.stop(); return; } // stopped meanwhile
        stream = s;
        const c = getCtx();
        if (!c) { release(); set('none'); return; }
        src = c.createMediaStreamSource(s);
        an = c.createAnalyser(); an.fftSize = 1024;
        buf = new Float32Array(an.fftSize);
        src.connect(an);                                      // never to the speakers: nothing is played back
        over = 0; lastT = 0;
        timer = setInterval(poll, T.MIC_POLL_MS);
        if (o.maxMs > 0) maxT = setTimeout(() => { if (my === token) api.stop(); }, o.maxMs);
        set('ok');
      }).catch(e => {
        if (my !== token) return;
        release();
        set(e && /NotAllowed|Security|PermissionDenied/.test(e.name) ? 'denied' : 'none');
      });
    };
    api.stop = () => {
      token++;
      release();
      set('off');
    };
    api.state = () => state;
    return api;
  })();

  /* ---------- Vibration ---------- */
  let vib = true;
  function vibrate(pattern = 12) {
    // Chrome refuses vibration (with a console error) before the first real tap
    if (!vib || !navigator.vibrate || !activated()) return false;
    const p = typeof pattern === 'string' ? BUZZ[pattern] : pattern;
    if (p == null) return false;
    try { return navigator.vibrate(p); } catch (e) { return false; }
  }
  const setVibrate = b => { vib = !!b; };

  return { attach, tilt, mic, sound, vibrate, setVibrate, BUZZ, T,
    classifyStroke, reversals, isScratch, flickVelocity, follow, stepToy, strokeStepFor, holdMoved, majorityRegion, isRub, isCircle, isDoubleSwipe, classifyCue,
    voiceParams, pickKind, VOWEL, VARIANT };
}
