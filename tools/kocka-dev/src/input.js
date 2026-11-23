// KockaInput(): gestures, tilt, microphone, synthesized sounds and vibration for Kočka (SPEC §7).
// One global factory, no DOM access at load time; the DOM is touched only inside the functions it returns.
//
// const I = KockaInput();
//
// Gestures:  const g = I.attach(el, opts)   g() or g.detach() removes it; g.setMode(m), g.mode(), g.cancel(), g.active()
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
//     tap        { x, y, item, region, cat, t, pat }   released before LONG_MS, moved < SLOP px and did not rub;
//                t = ms of the release (opts.time); pat only in 'care' (the key is absent in other modes): the run of
//                taps on a cat this tap belongs to (Škádlení, SPEC §13.1), { n, ms, cv, region, fast } when the tap is on a cat
//                (cat, a region hit, no item), else null. n = taps in the run including this one; ms, cv = rhythm() of
//                the run's last PAT_WINDOW tap times; region = the hit region's id; fast below. A pat continues the run when it
//                comes ≤ PAT_GAP ms after the previous one and hits the same region id, or the same cat (Koxa: no
//                'v:' prefix; a visitor: the same 'v:<id>:' prefix) ≤ PAT_NEAR px from the previous tap; otherwise a
//                new run starts (n = 1). fast = the quick taps in a row on the same cat, any region, each ≤ PESTER_GAP
//                ms after the one before (pestering; 1 = not quick). The run is cleared by a tap with pat null, every other emitted event, every
//                pointer released (or taken by the browser) without a tap (fingers that were only ignored, a resting
//                thumb or a third finger, do not count), setMode(), cancel() and detach(). Two fingers that overlap in
//                time on Koxa are a scratch (no taps) as before; taps that do not overlap form a run like any taps.
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
//   fx(name) → name|null, FX, setEnabled(bool), unlock(), KINDS, last(), purring(), enabled(), hush() (stops every
//   purr), render(kind, rate?, { voice, intensity, raw }) → Promise({ data, rate, params }) (offline, for tests).
//   meow() picks a variant fitting the mood ('happy'|'calm'|'grumpy'|'sad'|'want'|'offended'), never the same twice in
//   a row; kinds: mew, meow, demand, plaintive, chirp, trill, question, yowl, hiss, purr, nom, lap; every call is
//   randomized (pitch, length, contour, articulation, loudness). purr(true, x) while purring only changes the
//   intensity. WebAudio, no files: Koxa's voice is computed sample by sample (a glottal source through a nasal
//   pole-zero pair and four moving formants, SPEC §12a). I.sound.other is the neighbour cats' voice (the older node
//   synthesis, so a visitor never sounds like Koxa): other.meow(mood or kind, { pitch }) → kind, other.say(kind,
//   { pitch }) → kind|null, other.purr(on, intensity), other.purring(), other.render(kind, rate?, o); its purr runs
//   beside Koxa's. fx(name): one Škádlení effect (SPEC §13.1), FX = ['sneeze', 'splash', 'shake', 'clink'],
//   randomized a little every time; they are not meow kinds (never in KINDS); null when the name is unknown or the
//   sound is silent (the same gates as say). The AudioContext is created on the first user gesture (attach() calls
//   unlock() on taps; call it from your own buttons too). Silent when disabled, before any gesture and while the page
//   is hidden.
// Vibration:  I.vibrate(pattern) (ms, an array or a name from I.BUZZ), I.setVibrate(bool)
// Pure helpers (tests): classifyStroke(fur, dx, dy, dt, path?), reversals(samples), isScratch(samples),
//   flickVelocity(samples) → { vx, vy, speed }, follow(p, target, dtMs, lagMs?), stepToy(b, dtS, w, h),
//   strokeStepFor(catWidth), holdMoved(samples), majorityRegion([region|null]), isRub(samples), isCircle(samples),
//   isDoubleSwipe([{ dir, t }]), classifyCue(samples, t0?) → { type: 'circle'|'swipe'|'miss', dir?, reason?, dx, dy },
//   voiceParams(kind, rnd?) (one randomized call of the older voice), pickKind(mood, last, rnd?), callParams(kind, rnd?)
//   and synthCall(p, rate?, rnd?) → Float32Array (one call of Koxa's voice), synthPurr(rate?, rnd?, cycles?) →
//   { smooth, rough, seconds }, synthHiss(rate?, rnd?) → Float32Array,
//   rhythm(times) → { n, ms, cv } (ascending tap times in ms: n = count, ms = the mean interval rounded, cv = its
//   population standard deviation / mean rounded to 0.01; fewer than 2 times → ms 0, cv 0)
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
    PAT_GAP: 900, PAT_NEAR: 24, PAT_WINDOW: 6, PESTER_GAP: 250,
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
  // the tempo of a run of taps: times = ascending ms → { n, ms (mean interval), cv (its population standard
  // deviation / mean, to 0.01) }; fewer than 2 times → ms 0, cv 0
  function rhythm(times) {
    const list = Array.isArray(times) ? times : [], n = list.length;
    if (n < 2) return { n, ms: 0, cv: 0 };
    let sum = 0;
    for (let i = 1; i < n; i++) sum += list[i] - list[i - 1];
    const mean = sum / (n - 1);
    let sq = 0;
    for (let i = 1; i < n; i++) { const d = list[i] - list[i - 1] - mean; sq += d * d; }
    const cv = mean ? Math.sqrt(sq / (n - 1)) / mean : 0;
    return { n, ms: Math.round(mean), cv: Math.round(cv * 100) / 100 };
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
    let run = null;           // the pat run ('care'): { n, times, id, who, x, y, t } of its last tap (SPEC §13.1)
    const emit = (type, d) => { if (type !== 'tap') run = null; on(Object.assign({ type }, d)); };
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
      // any press that did not move, did not rub and was not a long press is a tap; every other release ends a pat run
      // (a finger that was only ignored does not)
      const isTap = P.kind === 'pending' && !P.moved && !P.rubbed && !P.noTap && t - P.t0 < T.LONG_MS;
      if (!isTap && P.kind !== 'idle') run = null;
      if (P.kind === 'laser') emit('laser', { x, y, on: false });
      else if (P.kind === 'pending') {
        if (isTap) tapped(P, x, y, t);
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
    function tapped(P, x, y, t) {
      const reg = mode === 'care' || mode === 'train' ? region(x, y) : null;
      const ev = { x, y, item: P.item, region: reg, cat: P.cat, t };
      if (mode === 'care') ev.pat = patOf(P, reg, x, y, t);   // set before the event: a cancel() in the handler wins
      emit('tap', ev);
    }
    // which cat a region id belongs to: '' = Koxa, 'v:<id>:' = a visitor
    const whoOf = id => { const m = /^v:[^:]*:/.exec(id); return m ? m[0] : ''; };
    // the pat of a tap: continues the run or starts a new one; null (and no run) off the cat or on an item
    function patOf(P, reg, x, y, t) {
      if (!P.cat || P.item || !reg || reg.id == null) { run = null; return null; }
      const id = String(reg.id), who = whoOf(id), dt = run ? t - run.t : -1;
      const goOn = run && dt >= 0 && dt <= T.PAT_GAP &&
        (id === run.id || (who === run.who && Math.hypot(x - run.x, y - run.y) <= T.PAT_NEAR));
      // quick taps anywhere on the same cat (pestering): counted across regions, each ≤ PESTER_GAP after the last
      const fast = run && dt >= 0 && dt <= T.PESTER_GAP && who === run.who ? (run.fast || 1) + 1 : 1;
      if (!goOn) run = { n: 0, times: [] };
      run.fast = fast;
      run.n++;
      run.times.push(t);
      if (run.times.length > T.PAT_WINDOW) run.times.shift();
      Object.assign(run, { id, who, x, y, t });
      const r = rhythm(run.times);
      return { n: run.n, ms: r.ms, cv: r.cv, region: reg.id, fast };
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
      if (P.kind !== 'idle') run = null;                      // taken without a tap: the pat run ends
      if (P.kind === 'raw') { emit('pup', { id: P.id, x: P.x, y: P.y, t: P.t, cancel: true }); return; }
      clearTimeout(P.timer);
      endRub(P);
      if (P.kind === 'drag') emit('cancel', { what: 'drag', item: P.item });
      else if (P.kind === 'carry') emit('cancel', { what: 'carry', item: 'cat' });
      else if (P.kind === 'laser') emit('laser', { x: P.x, y: P.y, on: false });
      else if (P.kind === 'scratch') endScratch(P.t);
    }
    function cancelEv(e) { const P = ptrs.get(e.pointerId); if (P) drop(P); }
    function cancelAll() { for (const P of [...ptrs.values()]) drop(P); ptrs.clear(); scr = null; run = null; }
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
    detach.setMode = m => { if (m !== mode) { cancelAll(); mode = m; } run = null; };
    detach.mode = () => mode;
    detach.cancel = cancelAll;                              // also ends the pat run (the next pat is n = 1)
    detach.active = () => ptrs.size > 0;                    // a finger is down (a gesture may be under way)
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
  // the master gain and a limiter on c (a loud yowl over a purr never clips); render() builds the same offline
  function chain(c) {
    const m = c.createGain(); m.gain.value = 0.8;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15;
    m.connect(lim); lim.connect(c.destination);
    return m;
  }
  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !activated()) return null;                  // Chrome warns about a context made before a tap
      try {
        ctx = new AC();
        master = chain(ctx);
      } catch (e) { ctx = null; return null; }
      if (!ctxBound) {
        ctxBound = true;
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) { sound.hush(); ctx.suspend().catch(() => {}); }
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
  // Two voices, both made in code (no recordings). Koxa's voice (the default) computes every call sample by sample
  // into a buffer: a source-filter model of a real meow (callParams → synthCall, synthPurr, synthHiss). The older
  // formant voice made of WebAudio nodes (VOWEL, VARIANT, voiceParams) stays for the neighbour cats (sound.other), so a
  // visitor never sounds like Koxa.

  /* The older voice (neighbour cats) */
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
  // the older voice's parameters for one call: the variant randomized (pitch ±15 %, length, contour, loudness); pure (rnd)
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

  /* Koxa's voice: computed sample by sample (pure functions, the same in the game, offline and in Node) */
  const TAU = Math.PI * 2;
  // A cat's vocal tract is short (about 8–10 cm), so its formants sit higher than a person's. Per articulation:
  // F1–F4 (Hz), open (0 = lips closed: dark and quiet, 1 = wide open: bright and loud), nasal (1 = the "m": a nasal
  // anti-resonance swallows the F2 region)
  const CAT_VOWEL = {
    m: { f: [480, 1650, 3500, 4700], open: 0.05, nasal: 1 },
    n: { f: [520, 1900, 3600, 4800], open: 0.2, nasal: 0.7 },
    r: { f: [580, 1700, 3400, 4600], open: 0.3, nasal: 0.25 },
    i: { f: [700, 2650, 4000, 5200], open: 0.55, nasal: 0 },
    e: { f: [920, 2300, 3800, 5100], open: 0.75, nasal: 0 },
    a: { f: [1250, 2050, 3700, 5000], open: 1, nasal: 0 },
    o: { f: [960, 1550, 3500, 4800], open: 0.7, nasal: 0 },
    u: { f: [660, 1200, 3300, 4600], open: 0.32, nasal: 0.1 },
  };
  const CAT_BW = [160, 230, 280, 350];       // formant bandwidths (Hz); wider while the mouth is closed
  // The calls: f0 (Hz), d (s, the voiced part), amp (relative loudness), contour [[time 0…1, pitch factor]],
  // vowels [[time, articulation or [choices]]], vib [rate Hz, depth, from (0…1)], breath (breathy noise),
  // tilt (Hz: the voice's brightness, higher = tenser), rough (cycle-to-cycle jitter, shimmer and subharmonics),
  // roll [rate Hz, depth, from, to, chance?] (the rolled "rrr": a pulsed voice), waver [rate Hz, depth] (a slow
  // wobble), att / rel (s: the onset and the end; a short rel ends abruptly like "mrrp"), tail (s: breath after the
  // voice), size (formant scale: a kitten's short tract is > 1)
  const CALL = {
    mew: { f0: 900, d: 0.3, amp: 0.55, size: 1.12, contour: [[0, 0.86], [0.3, 1.1], [0.65, 1.04], [1, 0.82]],
      vowels: [[0, 'm'], [0.16, ['i', 'e']], [0.55, 'e'], [0.82, ['e', 'a']], [1, 'u']], vib: [6.5, 0.012, 0.3],
      breath: 0.12, tilt: 3200, att: 0.03, rel: 0.08, tail: 0.06 },
    meow: { f0: 640, d: 0.7, amp: 0.6, contour: [[0, 0.84], [0.32, 1.12], [0.6, 1.05], [1, 0.76]],
      vowels: [[0, 'm'], [0.12, ['i', 'e', 'e']], [0.36, 'a'], [0.62, 'a'], [0.84, 'o'], [1, 'u']], vib: [5.5, 0.012, 0.35],
      breath: 0.08, tilt: 3800, roll: [26, 0.45, 0.03, 0.14, 0.25], att: 0.05, rel: 0.12, tail: 0.1 },
    demand: { f0: 700, d: 1.1, amp: 0.75, contour: [[0, 0.8], [0.22, 1.14], [0.65, 1.1], [1, 0.82]],
      vowels: [[0, 'm'], [0.07, 'r'], [0.18, 'a'], [0.72, 'a'], [0.88, 'o'], [1, 'u']], vib: [6, 0.015, 0.3],
      breath: 0.1, tilt: 5000, rough: 0.18, roll: [27, 0.5, 0.03, 0.15], att: 0.04, rel: 0.14, tail: 0.12 },
    plaintive: { f0: 660, d: 1.0, amp: 0.5, contour: [[0, 1], [0.15, 1.08], [0.55, 0.86], [1, 0.62]],
      vowels: [[0, 'm'], [0.1, 'i'], [0.32, 'a'], [0.65, 'o'], [1, 'u']], vib: [5, 0.022, 0.25],
      breath: 0.22, tilt: 2600, att: 0.07, rel: 0.2, tail: 0.16 },
    chirp: { f0: 640, d: 0.2, amp: 0.66, contour: [[0, 0.8], [0.55, 1], [1, 1.3]],
      vowels: [[0, 'm'], [0.25, 'r'], [0.75, 'e'], [1, 'e']], vib: [6, 0.008, 1], breath: 0.05, tilt: 3500,
      roll: [26, 0.75, 0.08, 0.7], att: 0.015, rel: 0.015, tail: 0.03 },
    trill: { f0: 580, d: 0.45, amp: 0.68, contour: [[0, 0.86], [0.75, 1.14], [1, 1.24]],
      vowels: [[0, 'm'], [0.15, 'r'], [0.82, 'r'], [1, 'e']], vib: [6, 0.008, 1], breath: 0.05, tilt: 3200,
      roll: [27, 0.92, 0.08, 0.9], att: 0.02, rel: 0.03, tail: 0.04 },
    question: { f0: 600, d: 0.42, amp: 0.6, contour: [[0, 0.9], [0.5, 0.94], [1, 1.42]],
      vowels: [[0, 'm'], [0.15, 'r'], [0.5, 'r'], [0.8, 'a'], [1, 'e']], vib: [6, 0.01, 0.6], breath: 0.06, tilt: 3500,
      roll: [26, 0.6, 0.08, 0.5], att: 0.025, rel: 0.06, tail: 0.06 },
    yowl: { f0: 500, d: 1.9, amp: 0.8, contour: [[0, 0.8], [0.14, 1.1], [0.38, 0.95], [0.58, 1.14], [0.82, 0.9], [1, 0.7]],
      vowels: [[0, 'm'], [0.08, 'a'], [0.28, 'o'], [0.44, 'a'], [0.66, 'u'], [0.82, 'a'], [1, 'u']], vib: [4.2, 0.03, 0.15],
      waver: [2.6, 0.05], breath: 0.14, tilt: 4500, rough: 0.35, att: 0.08, rel: 0.25, tail: 0.15 },
    lap: { f0: 400, d: 0.5, amp: 0.66, contour: [[0, 0.95], [0.45, 1.06], [1, 0.88]],
      vowels: [[0, 'm'], [0.3, 'r'], [0.62, 'o'], [1, 'm']], vib: [5, 0.01, 0.5], breath: 0.06, tilt: 2200,
      roll: [23, 0.55, 0.15, 0.85], att: 0.04, rel: 0.1, tail: 0.08 },
  };
  // one call of a kind, randomized (pitch, length, loudness, the contour and vowel timing, the articulation, the cat's
  // size); pure (rnd). Unknown kinds give a meow.
  function callParams(kind, rnd = Math.random) {
    const v = CALL[kind] || CALL.meow, r = (a, b) => a + (b - a) * rnd();
    const pick = k => (Array.isArray(k) ? k[Math.floor(rnd() * k.length) % k.length] : k);
    const jit = list => list.map(([t, x], i) => [i === 0 || i === list.length - 1 ? t : clamp(t + r(-0.04, 0.04), 0.02, 0.98), x])
      .sort((a, b) => a[0] - b[0]);
    const size = (v.size || 1) * r(0.94, 1.06);
    const roll = v.roll && (v.roll[4] == null || rnd() < v.roll[4]) ? v.roll : null;
    return {
      kind: CALL[kind] ? kind : 'meow', f0: v.f0 * r(0.88, 1.13), d: v.d * r(0.85, 1.2), amp: v.amp * r(0.85, 1.05),
      contour: jit(v.contour).map(([t, f]) => [t, f * r(0.96, 1.04)]),
      vowels: jit(v.vowels).map(([t, k]) => { const w = CAT_VOWEL[pick(k)]; return [t, { f: w.f.map(f => f * size * r(0.97, 1.03)), open: w.open, nasal: w.nasal }]; }),
      vib: [v.vib[0] * r(0.85, 1.15), v.vib[1] * r(0.6, 1.4), v.vib[2]], breath: v.breath * r(0.7, 1.3), tilt: v.tilt * r(0.85, 1.15),
      rough: (v.rough || 0) * r(0.7, 1.3), roll: roll ? [roll[0] * r(0.9, 1.1), roll[1] * r(0.85, 1.1), roll[2], roll[3]] : null,
      waver: v.waver ? [v.waver[0] * r(0.8, 1.2), v.waver[1] * r(0.7, 1.3)] : null,
      att: v.att, rel: v.rel, tail: v.tail,
    };
  }
  const ease = x => x * x * (3 - 2 * x);
  // a value along [[t, v]] (sorted by t), eased between the points like a moving tongue
  function track(list, x) {
    if (x <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      if (x <= list[i][0]) { const [t0, a] = list[i - 1], [t1, b] = list[i]; return a + (b - a) * ease(t1 > t0 ? (x - t0) / (t1 - t0) : 1); }
    }
    return list[list.length - 1][1];
  }
  // a two-pole resonator with unity gain at 0 Hz (Klatt): the cascade of them gives a vowel's natural formant levels
  function resCoef(s, f, bw, R) {
    if (f >= 0.45 * R) { s.a = 1; s.b = 0; s.c = 0; return s; }   // above what the rate can hold: let it through
    s.c = -Math.exp(-TAU * bw / R); s.b = 2 * Math.exp(-Math.PI * bw / R) * Math.cos(TAU * f / R); s.a = 1 - s.b - s.c;
    return s;
  }
  // Biquads (RBJ) for the fixed filters: lowpass | highpass | bandpass (0 dB at the peak)
  function biquad(type, f, q, R) {
    const w = TAU * Math.min(f, 0.45 * R) / R, cw = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b = type === 'lowpass' ? [(1 - cw) / 2, 1 - cw, (1 - cw) / 2] : type === 'highpass' ? [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2] : [al, 0, -al];
    return [b[0] / a0, b[1] / a0, b[2] / a0, -2 * cw / a0, (1 - al) / a0];
  }
  // filters x and adds gain × the result into `into` (a new array when not given)
  function filt(x, k, gain = 1, into = null) {
    const [b0, b1, b2, a1, a2] = k, y = into || new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] += gain * v;
    }
    return y;
  }
  // soft saturation (tanh) of a signal normalized to 1: tames the peaks of pulses, so it is louder at the same peak
  function soft(x, drive) {
    normalize(x, 1);
    const k = 1 / Math.tanh(drive);
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(drive * x[i]) * k;
    return x;
  }
  function normalize(x, peak) {
    let m = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
    if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; }
    return x;
  }
  // synthCall(p, rate, rnd) → Float32Array: one call (p from callParams), peak = p.amp × 1.15 (the limiter follows).
  // Source: the harmonics of F0 up to ~10 kHz (a glottal pulse: −6 dB per octave, steeper above p.tilt), F0 from the
  // contour with vibrato, a slow random drift, the waver and cycle-by-cycle jitter; shimmer per cycle, every other
  // cycle weaker in a rough voice (subharmonics, the growl of a yowl); breath noise louder while the glottis is open,
  // and a breathy tail after the voice. Filter: a nasal pole-zero pair (the "m"), four formant resonators following
  // the vowels, the lips (a one-pole low-pass from 1.3 kHz closed to 10 kHz open), a lift of the highs, a DC block.
  // Last, the loudness is levelled to the planned envelope (the filters' gain differs a lot between a closed "m" or
  // "rrr" and an open "a"; the plan keeps a closed mouth quieter, but not lost).
  function synthCall(p, R = 22050, rnd = Math.random) {
    const d = p.d, tail = p.tail || 0, n = Math.ceil((d + tail + 0.02) * R), out = new Float32Array(n);
    const plan = new Float32Array(Math.ceil(n / 16) + 1);
    const B = 16, T = 1 / R, KMAX = 64, amps = new Float64Array(KMAX + 1);
    const fmax = Math.min(0.45 * R, 10500), fade0 = fmax * 0.8;
    const F = [0, 1, 2, 3].map(k => p.vowels.map(([t, w]) => [t, w.f[k]]));
    const OPEN = p.vowels.map(([t, w]) => [t, w.open]), NAS = p.vowels.map(([t, w]) => [t, w.nasal]);
    const res = [0, 1, 2, 3].map(() => ({ a: 1, b: 0, c: 0, y1: 0, y2: 0 }));
    const np = resCoef({ a: 1, b: 0, c: 0, y1: 0, y2: 0 }, 450, 150, R), nz = { a: 1, b: 0, c: 0, x1: 0, x2: 0 }, zc = { a: 1, b: 0, c: 0 };
    const rough = p.rough || 0, J = 0.005 + rough * 0.03, S = 0.06 + rough * 0.3;
    const rho = Math.exp(-B / (0.12 * R)), sig = 0.009 * Math.sqrt(1 - rho * rho);   // drift: ±0.9 %, ~0.12 s
    const hpk = Math.exp(-TAU * 70 / R), pre = Math.exp(-TAU * 1500 / R);   // DC block; two zeros lift the highs (a small head radiates them)
    let theta = 0, cyc = 1, shim = 1, flip = false, K = 1, f0 = p.f0, drift = 0;
    let av = 0, ahV = 0, ahT = 0, alpha = 1, lp1 = 0, px = 0, px2 = 0, hx = 0, hy = 0;
    let vibPh = rnd() * TAU, wavPh = rnd() * TAU, rollPh = 0;
    const att = Math.max(0.005, p.att || 0.03), rel = Math.max(0.008, Math.min(p.rel || 0.1, d * 0.5));
    for (let i = 0; i < n; i++) {
      if (i % B === 0) {
        const t = i * T, x = clamp(t / d, 0, 1);
        // the pitch
        drift = drift * rho + sig * (rnd() * 2 - 1) * 1.7;
        vibPh += TAU * p.vib[0] * B * T;
        const vibOn = clamp((x - p.vib[2]) * d / 0.15, 0, 1);
        let fac = track(p.contour, x) * (1 + p.vib[1] * vibOn * Math.sin(vibPh)) * (1 + drift);
        if (p.waver) { wavPh += TAU * p.waver[0] * B * T; fac *= 1 + p.waver[1] * Math.sin(wavPh); }
        f0 = p.f0 * fac;
        // the harmonics: −6 dB per octave, another −6 above the tilt, faded out towards fmax
        K = Math.min(KMAX, Math.floor(fmax / f0));
        for (let k = 1; k <= K; k++) {
          const f = k * f0, q = f / p.tilt;
          amps[k] = Math.pow(k, -0.8) / Math.sqrt(1 + q * q) * (f > fade0 ? (fmax - f) / (fmax - fade0) : 1);
        }
        // loudness: the onset, the end, a little declination; the mouth's opening adds loudness
        let open = track(OPEN, x);
        const env = t < att ? ease(t / att) : t < d - rel ? 1 : t < d ? 1 - ease((t - (d - rel)) / rel) : 0;
        let am = 1;
        if (p.roll) {
          const [rate, depth, from, to] = p.roll;
          rollPh += TAU * rate * B * T;
          const w = clamp(Math.min((x - from) / 0.06, (to - x) / 0.06), 0, 1), pulse = Math.pow(0.5 + 0.5 * Math.cos(rollPh), 2);
          am = 1 - depth * w * (1 - pulse);
          open *= 1 - 0.5 * w * (1 - pulse);
        }
        const loud = (0.25 + 0.75 * Math.pow(open, 0.8)) * (1 - 0.15 * x);
        av = env * loud * am;
        plan[i / B] = av;
        ahV = p.breath * env * (0.5 + 0.5 * loud) * am;
        ahT = t < d - rel ? 0 : t < d ? p.breath * 1.4 * ease((t - (d - rel)) / rel) : tail > 0 ? p.breath * 1.4 * Math.pow(Math.max(0, 1 - (t - d) / tail), 2) : 0;
        // the vocal tract
        const nas = track(NAS, x), bwk = 1 + 1.2 * nas + 0.6 * (1 - open);
        for (let k = 0; k < 4; k++) resCoef(res[k], track(F[k], x) * (p.roll && k === 0 ? 1 - 0.08 * (1 - am) : 1), CAT_BW[k] * bwk, R);
        resCoef(zc, 450 + nas * 850, 150, R);
        nz.a = 1 / zc.a; nz.b = -zc.b / zc.a; nz.c = -zc.c / zc.a;
        alpha = 1 - Math.exp(-TAU * Math.min(0.45 * R, 1300 * Math.pow(8, open)) / R);
      }
      // the glottis
      theta += TAU * f0 * cyc * T;
      if (theta >= TAU) {
        theta -= TAU;
        cyc = 1 + (rnd() * 2 - 1) * J; shim = 1 + (rnd() * 2 - 1) * S; flip = !flip;
      }
      const s1 = Math.sin(theta), c2 = 2 * Math.cos(theta);
      let sk = s1, skm = 0, src = 0;
      for (let k = 1; k <= K; k++) { src += amps[k] * sk; const nx = c2 * sk - skm; skm = sk; sk = nx; }
      if (flip) src *= 1 - rough * 0.6;
      const wn = rnd() * 2 - 1;
      let v = src * shim * av + wn * (ahV * (0.35 + 0.65 * Math.max(0, s1)) + ahT);
      // nasal pole, then its zero (they cancel when nas = 0)
      const y = np.a * v + np.b * np.y1 + np.c * np.y2; np.y2 = np.y1; np.y1 = y;
      v = nz.a * y + nz.b * nz.x1 + nz.c * nz.x2; nz.x2 = nz.x1; nz.x1 = y;
      for (let k = 0; k < 4; k++) { const s = res[k], o = s.a * v + s.b * s.y1 + s.c * s.y2; s.y2 = s.y1; s.y1 = o; v = o; }
      lp1 += alpha * (v - lp1);
      const e0 = lp1 - pre * px; px = lp1; const e = e0 - pre * px2; px2 = e0;
      const o = e - hx + hpk * hy; hx = e; hy = o;
      out[i] = o;
    }
    // levelling: per 10 ms block, the gain that brings the block's RMS to the plan (only where the voice is clearly on;
    // elsewhere the nearest such gain), limited to ×4 around the median and smoothed
    const L = Math.max(B, Math.round(0.01 * R / B) * B), nb = Math.ceil(n / L), g = new Float64Array(nb);
    let valid = 0;
    for (let b = 0; b < nb; b++) {
      let ss = 0, w = 0, cnt = 0;
      for (let i = b * L; i < Math.min(n, (b + 1) * L); i++) ss += out[i] * out[i];
      for (let j = b * L / B; j < Math.min(plan.length, (b + 1) * L / B); j++) { w += plan[j]; cnt++; }
      w /= cnt || 1;
      const rms = Math.sqrt(ss / L);
      g[b] = w > 0.12 && rms > 1e-9 ? w / rms : NaN;
      if (g[b] === g[b]) valid++;
    }
    if (valid) {
      for (let b = 1; b < nb; b++) if (g[b] !== g[b]) g[b] = g[b - 1];
      for (let b = nb - 2; b >= 0; b--) if (g[b] !== g[b]) g[b] = g[b + 1];
      const med = Array.from(g).sort((a, b) => a - b)[nb >> 1];
      for (let b = 0; b < nb; b++) g[b] = clamp(g[b], med / 4, med * 4);
      for (let pass = 0; pass < 2; pass++) for (let b = 1; b < nb - 1; b++) g[b] = (g[b - 1] + 2 * g[b] + g[b + 1]) / 4;
      for (let i = 0; i < n; i++) {
        const x = i / L - 0.5, b0 = clamp(Math.floor(x), 0, nb - 1), b1 = Math.min(nb - 1, b0 + 1), u = clamp(x - b0, 0, 1);
        out[i] *= g[b0] + (g[b1] - g[b0]) * u;
      }
    }
    // a short fade at the very end (filter tails)
    const f = Math.min(n, Math.round(0.01 * R));
    for (let i = 0; i < f; i++) out[n - 1 - i] *= i / f;
    return normalize(out, p.amp * 1.15);
  }
  // synthPurr(rate, rnd, cycles) → { smooth, rough, seconds }: `cycles` breaths of purring, two layers of the same
  // pulses (play them looped together; the mix follows the intensity). A purr is a train of short pulses, ~26 Hz while
  // breathing in (quieter) and ~23 Hz while breathing out (louder, a little lower), each pulse a click and a short
  // burst of noise from the larynx; the smooth layer through the chest (~260 Hz) and the throat (~700 Hz) under a
  // 1.1 kHz low-pass, the rough one noisier and a little brighter (under 2.6 kHz). Both start and end in a pause, so the loop has no seam.
  function synthPurr(R = 22050, rnd = Math.random, cycles = 3) {
    const r = (a, b) => a + (b - a) * rnd(), ph = [];
    let t = 0.02;
    for (let c = 0; c < cycles; c++) {
      const tin = r(0.85, 1.15), tout = r(1.0, 1.4);
      ph.push({ t0: t, d: tin, rate: r(25, 27.5), lvl: r(0.55, 0.7), tau: 0.0045 }); t += tin + r(0.06, 0.14);
      ph.push({ t0: t, d: tout, rate: r(21.5, 24), lvl: 1, tau: 0.0065 }); t += tout + r(0.16, 0.26);
    }
    const n = Math.ceil(t * R), eS = new Float32Array(n), eR = new Float32Array(n);
    for (const P of ph) {
      for (let tt = P.t0 + r(0, 0.01); tt < P.t0 + P.d; tt += (1 / P.rate) * (1 + (rnd() * 2 - 1) * 0.04)) {
        const u = tt - P.t0, env = P.lvl * ease(clamp(u / 0.2, 0, 1)) * ease(clamp((P.d - u) / 0.25, 0, 1));
        const a = env * (1 + (rnd() * 2 - 1) * 0.15), i0 = Math.round(tt * R), tau = P.tau * r(0.8, 1.2) * R, len = Math.ceil(tau * 5);
        if (i0 >= n) break;
        eS[i0] += a; eR[i0] += a * 0.5;
        for (let j = 0; j < len && i0 + j < n; j++) { const w = (rnd() * 2 - 1) * a * Math.exp(-j / tau); eS[i0 + j] += w * 0.35; eR[i0 + j] += w; }
      }
    }
    const smooth = filt(eS, biquad('bandpass', 260, 1.2, R), 1);
    filt(eS, biquad('bandpass', 700, 2, R), 0.6, smooth);
    filt(eS, biquad('bandpass', 1400, 2, R), 0.12, smooth);
    const sm = filt(smooth, biquad('lowpass', 1100, 0.7, R));
    const rough = filt(eR, biquad('bandpass', 550, 1, R), 0.8);
    filt(eR, biquad('bandpass', 1200, 1.5, R), 0.4, rough);
    filt(eR, biquad('bandpass', 2400, 1.2, R), 0.08, rough);
    return { smooth: soft(sm, 3), rough: soft(filt(rough, biquad('lowpass', 2600, 0.7, R)), 3), seconds: n / R };
  }
  // synthHiss(rate, rnd) → Float32Array: a hiss of 0.6–1 s: breath through bared teeth, noise above ~2.5 kHz with a
  // peak at 4.5–6.5 kHz, a fast attack, a short hold and a decay, turbulent; mostly with a short spit (a burst and a
  // pop) at the start
  function synthHiss(R = 22050, rnd = Math.random) {
    const r = (a, b) => a + (b - a) * rnd(), d = r(0.6, 1.0), spit = rnd() < 0.75, t0 = spit ? r(0.02, 0.035) : 0;
    const n = Math.ceil((t0 + d + 0.03) * R), wn = new Float32Array(n);
    for (let i = 0; i < n; i++) wn[i] = rnd() * 2 - 1;
    const hp = filt(wn, biquad('highpass', r(2200, 2800), 0.7, R));
    const h = filt(hp, biquad('bandpass', r(4500, 6500), 1.2, R), 1.4);
    filt(hp, biquad('highpass', 6000, 0.7, R), 0.5, h);
    const out = new Float32Array(n), hold = d * r(0.15, 0.25), tau = d * 0.35;
    let turb = 0;
    const rho = Math.exp(-1 / (0.03 * R));
    for (let i = 0; i < n; i++) {
      const t = i / R - t0;
      if (t < 0) continue;
      turb = turb * rho + (rnd() * 2 - 1) * Math.sqrt(1 - rho * rho) * 1.7;
      const env = (t < 0.015 ? ease(t / 0.015) : t < hold ? 1 : Math.exp(-(t - hold) / tau)) * clamp((d - t) / (0.1 * d), 0, 1);
      out[i] = h[i] * env * (1 + 0.22 * turb);
    }
    normalize(out, 1);
    if (spit) {
      const bp = filt(wn, biquad('highpass', 700, 0.7, R)), len = Math.round(0.03 * R), f = r(180, 260);
      let m = 0;
      for (let i = 0; i < len; i++) m = Math.max(m, Math.abs(bp[i]));
      for (let i = 0; i < len && i < n; i++) {
        const t = i / R, e = Math.exp(-t / 0.006);
        out[i] += (bp[i] / (m || 1)) * 1.3 * e + 0.5 * Math.sin(TAU * f * t) * Math.exp(-t / 0.008);
      }
    }
    return normalize(soft(out, 2), 0.8);
  }

  const sound = (() => {
    let enabled = true, lastKind = null, lastSaid = null, otherLast = null, purrCache = null;
    const ready = () => { const c = enabled && !document.hidden ? getCtx() : null; if (c) warm(c); return c; };
    const r = (a, b) => a + (b - a) * Math.random();
    // Koxa's sounds are computed at half the device rate (all of them lie below 10.5 kHz; the browser resamples)
    const rateOf = c => { const s = Math.round(c.sampleRate) || 44100; return s >= 44100 ? Math.round(s / 2) : clamp(s, 8000, 48000); };
    const purrRate = c => Math.min(16000, rateOf(c));
    const idle = f => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 80));
    // plays a computed buffer at t
    function playBuf(c, data, rate, t, dest = master, gain = 1) {
      const b = c.createBuffer(1, data.length, rate);
      b.getChannelData(0).set(data);
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; g.gain.value = gain; s.connect(g); g.connect(dest); s.start(t);
      return s;
    }
    // One computed call of every kind waits ready, so a call plays at once; the next one is computed when the page is
    // idle (a call takes a few ms; the first ones also warm up the JIT)
    const pre = {};
    const make = (kind, R) => {
      if (kind === 'hiss') return { p: null, data: synthHiss(R), rate: R };
      const p = callParams(kind);
      return { p, data: synthCall(p, R), rate: R };
    };
    function refill(kind, R) { idle(() => { if (enabled && !(pre[kind] && pre[kind].rate === R)) pre[kind] = make(kind, R); }); }
    function take(kind, R) {
      let x = pre[kind];
      pre[kind] = null;
      if (!x || x.rate !== R) x = make(kind, R);
      refill(kind, R);
      return x;
    }
    let warmed = false;
    function warm(c) {
      if (warmed) return;
      warmed = true;
      const R = rateOf(c), list = ['meow', 'chirp', 'trill', 'mew', 'purr', 'question', 'demand', 'plaintive', 'lap', 'hiss', 'yowl'];
      (function next(i) {
        if (i >= list.length) return;
        idle(() => {
          if (list[i] === 'purr') { if (!purrCache) purrCache = Object.assign(synthPurr(purrRate(c)), { rate: purrRate(c) }); }
          else if (!pre[list[i]]) pre[list[i]] = make(list[i], R);
          next(i + 1);
        });
      })(0);
    }
    // Koxa: one call (or her hiss)
    function callAt(c, kind, t, dest = master) {
      const x = take(kind, rateOf(c));
      playBuf(c, x.data, x.rate, t, dest);
      return x.p;
    }

    /* the older voice (neighbour cats) */
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
    /* Škádlení effects (SPEC §13.1): short, not loud, a little different every time */
    // a falling exponential envelope on a gain: silent → peak after `attack` s → silent after `decay` more s
    function ping(g, t, peak, attack, decay) {
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(peak, t + attack);
      g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    // "hapčí" (~0.35 s): a soft breath in, a tiny voiced "a", then a sharp noise burst with a high formant
    function sneezeAt(c, t, dest = master) {
      const inhale = r(0.09, 0.13), tb = t + inhale + r(0.02, 0.04);
      const n1 = noise(c), b1 = c.createBiquadFilter(), g1 = c.createGain();
      b1.type = 'bandpass'; b1.Q.value = 1.2;
      b1.frequency.setValueAtTime(r(900, 1300), t); b1.frequency.linearRampToValueAtTime(r(1600, 2200), t + inhale);
      g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(r(0.05, 0.08), t + inhale); g1.gain.linearRampToValueAtTime(0, t + inhale + 0.03);
      n1.connect(b1); b1.connect(g1); g1.connect(dest); n1.start(t); n1.stop(t + inhale + 0.05);
      const f = r(560, 720), o = c.createOscillator(), vb = c.createBiquadFilter(), og = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.1, tb - 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.85, tb + 0.01);
      vb.type = 'bandpass'; vb.frequency.value = r(1000, 1250); vb.Q.value = 4;
      og.gain.setValueAtTime(0, tb - 0.05); og.gain.linearRampToValueAtTime(r(0.12, 0.18), tb - 0.035); og.gain.linearRampToValueAtTime(0, tb + 0.005);
      o.connect(vb); vb.connect(og); og.connect(dest); o.start(tb - 0.05); o.stop(tb + 0.02);
      const n2 = noise(c), hp = c.createBiquadFilter(), pk = c.createBiquadFilter(), g2 = c.createGain(), d = r(0.16, 0.22);
      hp.type = 'highpass'; hp.frequency.value = r(1800, 2400);
      pk.type = 'peaking'; pk.frequency.value = r(3800, 5200); pk.Q.value = 2; pk.gain.value = 10;
      ping(g2.gain, tb, r(0.2, 0.28), 0.006, d);
      n2.connect(hp); hp.connect(pk); pk.connect(g2); g2.connect(dest); n2.start(tb); n2.stop(tb + d + 0.03);
    }
    // water poured on fur (~0.5 s): a noise burst getting duller as it decays, a bubbly flutter, droplet ticks
    function splashAt(c, t, dest = master) {
      const d = r(0.4, 0.55), nz = noise(c), lp = c.createBiquadFilter(), am = c.createGain(), g = c.createGain();
      lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(r(3500, 4500), t); lp.frequency.exponentialRampToValueAtTime(r(700, 1000), t + d);
      const l = c.createOscillator(), lg = c.createGain();
      am.gain.value = 0.75; l.type = 'triangle'; l.frequency.value = r(18, 26); lg.gain.value = 0.25;
      l.connect(lg); lg.connect(am.gain);
      ping(g.gain, t, r(0.22, 0.3), 0.012, d);
      nz.connect(lp); lp.connect(am); am.connect(g); g.connect(dest);
      nz.start(t); nz.stop(t + d + 0.05); l.start(t); l.stop(t + d + 0.05);
      const drops = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < drops; i++) {
        const tt = t + r(0.04, d), f = r(700, 1600), o = c.createOscillator(), og = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * r(1.6, 2.3), tt + r(0.02, 0.04));
        ping(og.gain, tt, r(0.04, 0.09), 0.003, 0.05);
        o.connect(og); og.connect(dest); o.start(tt); o.stop(tt + 0.07);
      }
    }
    // a quick whole-body shake (~0.6 s): fluttering fur noise, amplitude modulated ~12 Hz and slowing a little, a low flap
    function shakeAt(c, t, dest = master) {
      const d = r(0.5, 0.65), rate = r(11, 13), peak = r(0.18, 0.25);
      const nz = noise(c), bp = c.createBiquadFilter(), low = c.createBiquadFilter(), lowG = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = r(900, 1500); bp.Q.value = 0.7;
      low.type = 'lowpass'; low.frequency.value = r(250, 350); lowG.gain.value = 1.2;
      const am = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      am.gain.value = 0.5; l.type = 'triangle'; lg.gain.value = 0.5;
      l.frequency.setValueAtTime(rate, t); l.frequency.linearRampToValueAtTime(rate * 0.8, t + d);
      l.connect(lg); lg.connect(am.gain);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.06);
      g.gain.setValueAtTime(peak, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
      nz.connect(bp); bp.connect(am); nz.connect(low); low.connect(lowG); lowG.connect(am); am.connect(g); g.connect(dest);
      nz.start(t); nz.stop(t + d + 0.05); l.start(t); l.stop(t + d + 0.05);
    }
    // an enamel mug hitting tiles: a few inharmonic partials (1.2–3.5 kHz) with a fast decay and a click, then a
    // smaller clink ~120 ms later (it bounces)
    function clinkAt(c, t, dest = master) {
      const base = r(1200, 1260);
      const ding = (tt, a, f0) => {
        const out = c.createGain(); out.gain.value = 1; out.connect(dest);
        const parts = [[1, 1, 0.18], [1.47, 0.6, 0.12], [2.09, 0.45, 0.09], [2.76, 0.3, 0.06]];
        for (const [ratio, w, dk] of parts) {
          const o = c.createOscillator(), og = c.createGain(), dec = dk * r(0.8, 1.2);
          o.type = 'sine'; o.frequency.value = Math.min(3500, f0 * ratio * r(0.98, 1.02));
          ping(og.gain, tt, a * w / 2.35, 0.002, dec);
          o.connect(og); og.connect(out); o.start(tt); o.stop(tt + dec + 0.03);
        }
        const nz = noise(c), hp = c.createBiquadFilter(), ng = c.createGain();
        hp.type = 'highpass'; hp.frequency.value = 3000;
        ping(ng.gain, tt, a * 0.4, 0.001, 0.008);
        nz.connect(hp); hp.connect(ng); ng.connect(out); nz.start(tt); nz.stop(tt + 0.02);
      };
      const a = r(0.18, 0.24);
      ding(t, a, base);
      ding(t + r(0.1, 0.14), a * r(0.4, 0.55), base * r(0.97, 1.03));
    }
    const FX_AT = { sneeze: sneezeAt, splash: splashAt, shake: shakeAt, clink: clinkAt };
    const FX = Object.keys(FX_AT);
    // fx(name): one Škádlení effect; returns the name, or null when unknown or silent (off, before a gesture, hidden)
    function fx(name) {
      if (!FX.includes(name)) return null;
      const c = ready(); if (!c) return null;
      FX_AT[name](c, c.currentTime + 0.02);
      return name;
    }

    // ramps a param from wherever its automation is at t (also in the middle of a ramp: no click) to val in dur s
    function rampTo(g, t, val, dur) {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      g.linearRampToValueAtTime(val, t + dur);
    }
    /* Purring: one controller per voice; build(c, x, dest) → { level(x), stop(t?) } */
    function purrer(build) {
      let nodes = null;
      function purr(onOff, intensity = 0.6) {
        const x = clamp(Number(intensity) || 0, 0, 1);
        if (!onOff) { if (!nodes) return; const n = nodes; nodes = null; try { n.stop(); } catch (e) {} return; }
        if (nodes) { nodes.level(x); return; }                 // already purring: only the intensity changes
        const c = ready(); if (!c) return;
        nodes = build(c, x, master);
      }
      return { purr, on: () => !!nodes };
    }
    // Koxa's purr: the two layers of synthPurr looped together; the intensity sets the loudness and how rough it is
    function koxaPurr(c, x, dest, offset) {
      const R = purrRate(c);
      if (!purrCache || purrCache.rate !== R) purrCache = Object.assign(synthPurr(R), { rate: R });
      const buf = purrCache;
      const t0 = c.currentTime, out = c.createGain(), at = offset != null ? offset : Math.random() * buf.seconds;
      out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + 0.35); out.connect(dest);
      const layer = data => {
        const b = c.createBuffer(1, data.length, R); b.getChannelData(0).set(data);
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = b; s.loop = true; s.connect(g); g.connect(out); s.start(t0, at);
        return { s, g };
      };
      const S = layer(buf.smooth), Rg = layer(buf.rough);
      const gains = v => { const lvl = 0.45 + 0.55 * v; return [lvl * 0.75, lvl * 0.55 * (0.15 + 0.85 * v)]; };
      const [a0, b0] = gains(x);
      S.g.gain.value = a0; Rg.g.gain.value = b0;
      return {
        level(v) {
          const t = c.currentTime, [a, b] = gains(v);
          rampTo(S.g.gain, t, a, 0.4); rampTo(Rg.g.gain, t, b, 0.4);
        },
        stop(t = c.currentTime) {
          rampTo(out.gain, t, 0, 0.3);
          S.s.stop(t + 0.35); Rg.s.stop(t + 0.35);
          // now and then the next purr gets new breaths
          if (c === ctx && Math.random() < 0.5) idle(() => { if (purrCache === buf) purrCache = Object.assign(synthPurr(R), { rate: R }); });
        },
      };
    }
    // the older purr (neighbour cats): a low buzz at ~25 Hz with its harmonics plus a chopped noise layer, breathing
    // in (quieter, slower) and out (louder) about every 2.5 s
    function oldPurr(c, x, dest) {
      const lvlOf = v => 0.25 + 0.75 * v;
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
      out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(lvlOf(x), t0 + 0.4);
      breath.connect(out); out.connect(dest);
      const src = [buzz, nz, chop];
      for (const s of src) s.start(t0);
      let dead = false, timer = 0;
      // one breath at a time, scheduled a little ahead
      (function cycle(t) {
        if (dead) return;
        const tin = r(0.9, 1.2), tout = r(1.1, 1.5), gap1 = 0.1, gap2 = r(0.12, 0.25);
        const b = breath.gain, f = [buzz.frequency, chop.frequency];
        b.setValueAtTime(0.05, t);
        b.linearRampToValueAtTime(0.55, t + 0.25); b.setValueAtTime(0.55, t + tin - 0.2); b.linearRampToValueAtTime(0.05, t + tin);
        const to = t + tin + gap1;
        b.linearRampToValueAtTime(1, to + 0.2); b.setValueAtTime(1, to + tout - 0.25); b.linearRampToValueAtTime(0.05, to + tout);
        for (const p of f) { p.setValueAtTime(r(21, 23), t); p.setValueAtTime(r(25, 28), to); }
        const next = to + tout + gap2;
        timer = setTimeout(() => cycle(next), Math.max(0, (next - c.currentTime - 0.3) * 1000));
      })(t0 + 0.05);
      return {
        level(v) { rampTo(out.gain, c.currentTime, lvlOf(v), 0.4); },
        stop(t = c.currentTime) {
          dead = true; clearTimeout(timer);
          rampTo(out.gain, t, 0, 0.3);
          for (const s of src) s.stop(t + 0.35);
        },
      };
    }
    const koxaP = purrer(koxaPurr), otherP = purrer(oldPurr);
    // purr(on, intensity 0…1): Koxa's purr; purr(true, x) while purring only changes the intensity
    const purr = koxaP.purr;

    // say(kind): one sound of that variant in Koxa's voice, randomized every time; returns the kind (or null when silent)
    function say(kind, o = {}) {
      if (!KINDS.includes(kind)) kind = 'meow';
      lastSaid = kind;
      if (kind === 'purr') {                                  // a short purr
        if (!koxaP.on() && ready()) { purr(true, o.intensity); setTimeout(() => purr(false), (o.seconds || 2.5) * 1000); }
        return koxaP.on() ? kind : null;
      }
      const c = ready(); if (!c) return null;
      const t = c.currentTime + 0.02;
      if (kind === 'nom') nomAt(c, t);
      else callAt(c, kind, t);
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
    // the neighbour cats' voice (the older synthesis): other.meow(mood or kind, { pitch }), other.say(kind, { pitch,
    // intensity, seconds }), other.purr(on, intensity), other.purring(), other.render(kind, rate, o)
    const other = {
      say(kind, o = {}) {
        if (!KINDS.includes(kind)) kind = 'meow';
        if (kind === 'purr') {
          if (!otherP.on() && ready()) { otherP.purr(true, o.intensity); setTimeout(() => otherP.purr(false), (o.seconds || 2.5) * 1000); }
          return otherP.on() ? kind : null;
        }
        const c = ready(); if (!c) return null;
        const t = c.currentTime + 0.02;
        if (kind === 'hiss') hissAt(c, t);
        else if (kind === 'nom') nomAt(c, t);
        else { const p = voiceParams(kind); if (o.pitch > 0) p.f0 *= clamp(o.pitch, 0.5, 2); voice(c, p, t); }
        return kind;
      },
      meow(moodOrKind, o = {}) {
        const kind = KINDS.includes(moodOrKind) ? moodOrKind : pickKind(moodOrKind, otherLast);
        otherLast = kind;
        other.say(kind, o);
        return kind;
      },
      purr: otherP.purr,
      purring: () => otherP.on(),
      render: (kind, rate, o = {}) => render(kind, rate, Object.assign({}, o, { voice: 'other' })),
    };

    // tests and tuning: renders one sound offline through the same master and limiter →
    // Promise({ data: Float32Array, rate, params }). kind: a KINDS name or an fx name; o.voice 'other' = the older
    // voice; o.intensity for 'purr' (4 s); o.raw = without the master and limiter
    function render(kind, rate = 22050, o = {}) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
      const old = o.voice === 'other';
      let p = null, secs = 1.5;
      if (kind === 'purr') secs = 4.5;
      else if (!FX.includes(kind) && kind !== 'hiss' && kind !== 'nom') { p = old ? voiceParams(kind) : callParams(kind); secs = p.d + 1.3; }
      const oc = new OAC(1, Math.ceil(rate * secs), rate), dest = o.raw ? oc.destination : chain(oc);
      if (FX.includes(kind)) FX_AT[kind](oc, 0.01, dest);
      else if (kind === 'nom') nomAt(oc, 0.01, dest);
      else if (kind === 'hiss') { if (old) hissAt(oc, 0.01, dest); else playBuf(oc, synthHiss(rate), rate, 0.01, dest); }
      else if (kind === 'purr') {
        const x = o.intensity != null ? clamp(+o.intensity || 0, 0, 1) : 0.6;
        const nd = old ? oldPurr(oc, x, dest) : koxaPurr(oc, x, dest, 0);
        nd.stop(4.0);
      } else if (old) voice(oc, p, 0.01, dest);
      else playBuf(oc, synthCall(p, rate), rate, 0.01, dest);
      return oc.startRendering().then(b => ({ data: b.getChannelData(0), rate, params: p }));
    }
    const nom = () => say('nom'), hiss = () => say('hiss'), chirp = () => say('chirp');
    // stops both purrs (sound off, the page hidden)
    function hush() { koxaP.purr(false); otherP.purr(false); }
    function setEnabled(b) { enabled = !!b; if (!enabled) hush(); }
    function unlock() { if (enabled) ready(); }
    return { meow, say, purr, nom, hiss, chirp, fx, FX, setEnabled, unlock, render, KINDS, other, hush,
      enabled: () => enabled, purring: () => koxaP.on(), last: () => lastSaid };
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
    rhythm, voiceParams, pickKind, VOWEL, VARIANT, callParams, synthCall, synthPurr, synthHiss, CALL, CAT_VOWEL };
}
