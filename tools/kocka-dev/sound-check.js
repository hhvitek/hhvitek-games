// Kočka's sounds measured in numbers (developer tool, not deployed): renders every sound of the Input block offline
// (I.sound.render: through the same master gain and limiter as in the game) with Koxa's voice and with the older
// voice of the neighbour cats, and measures each one.
// Run it with the Playwright MCP tool `browser_run_code_unsafe`, parameter filename = tools/kocka-dev/sound-check.js,
// while a local server runs in the repository root: node tools/serve.js (port 8765; the server of a page already open
// in Playwright is used when it is a localhost one).
// Per sound: dur (s, from the first to the last sample above 1 % of the peak), peak (after the limiter: must be
// ≤ 0.9), rms (of that part; ~0 = silent), f0 (Hz at 25 / 50 / 75 % of it, autocorrelation, 0 = unvoiced), cent (the
// spectral centroid in Hz at 10 points over time: the mouth opening and closing shows as a rise and fall), am (the
// amplitude modulation 12–45 Hz over the middle 60 % and its strength 0…1: the rolled "rrr" of chirp / trill and the purr's
// pulses, ~20–30 Hz). Problems (CLIP, SILENT) are listed at the end.
async (page) => {
  const BASE = (/^http:\/\/(localhost|127\.0\.0\.1):\d+\//.exec(page.url()) || ['http://localhost:8765/'])[0];
  await page.goto(BASE + 'tools/kocka-dev/feel.html');
  const rows = await page.evaluate(async () => {
    const S = KockaInput().sound, RATE = 22050;
    function fft(re, im) {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
        for (let i = 0; i < n; i += len) {
          let cr = 1, ci = 0;
          for (let k = 0; k < len / 2; k++) {
            const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
            re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
            const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
          }
        }
      }
    }
    const centroid = (x, s) => {
      const N = 1024, re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = (x[s + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      fft(re, im);
      let num = 0, den = 0;
      for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * k * RATE / N; den += m; }
      return den > 1e-9 ? Math.round(num / den) : 0;
    };
    const f0At = (x, c) => {
      const n = Math.round(0.04 * RATE), s = Math.max(0, Math.round(c - n / 2)), seg = x.subarray(s, s + n);
      let e0 = 0;
      for (const v of seg) e0 += v * v;
      if (e0 < 1e-7) return 0;
      let best = 0, bl = 0;
      for (let lag = Math.floor(RATE / 1600); lag < RATE / 150; lag++) {
        let a = 0;
        for (let i = 0; i + lag < seg.length; i++) a += seg[i] * seg[i + lag];
        a /= e0;
        if (a > best) { best = a; bl = lag; }
      }
      return best > 0.3 ? Math.round(RATE / bl) : 0;
    };
    // the amplitude envelope (rectified, smoothed twice over ~3 ms, sampled at 1 kHz), then the first strong peak of its
    // autocorrelation over 12–45 Hz
    const amRate = (x, a, b) => {
      const step = Math.round(RATE / 1000), k = 1 - Math.exp(-1 / (0.003 * RATE)), env = [];
      let y1 = 0, y2 = 0;
      for (let i = a; i < b; i++) { y1 += (Math.abs(x[i]) - y1) * k; y2 += (y1 - y2) * k; if ((i - a) % step === 0) env.push(y2); }
      // relative to its ~80 ms moving average: the slow shape of the call (onset, end) would hide the flutter
      const pk = Math.max(...env), e = env.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 40); j <= Math.min(env.length - 1, i + 40); j++) { s += env[j]; n++; } return s > n * pk * 0.05 ? env[i] * n / s - 1 : 0; });
      let e0 = 0;
      for (const v of e) e0 += v * v;
      if (e0 < 1e-12) return [0, 0];
      const ac = lag => { let s = 0; for (let i = 0; i + lag < e.length; i++) s += e[i] * e[i + lag]; return s / e0; };
      // the local peaks; the shortest lag within 80 % of the best one (a multiple of the period peaks as high)
      const peaks = [];
      for (let lag = Math.floor(1000 / 45); lag <= Math.ceil(1000 / 12); lag++) { const v = ac(lag); if (v > 0 && v > ac(lag - 1) && v >= ac(lag + 1)) peaks.push([lag, v]); }
      if (!peaks.length) return [0, 0];
      const top = Math.max(...peaks.map(q => q[1])), [bl, best] = peaks.find(q => q[1] >= 0.8 * top);
      return [Math.round(1000 / bl), Math.round(best * 100) / 100];
    };
    const measure = (name, data) => {
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v));
      const th = peak * 0.01;
      let a = 0, b = data.length - 1;
      while (a < b && Math.abs(data[a]) < th) a++;
      while (b > a && Math.abs(data[b]) < th) b--;
      let ss = 0;
      for (let i = a; i <= b; i++) ss += data[i] * data[i];
      const len = b - a + 1, x = data;
      return {
        name, dur: +(len / RATE).toFixed(2), peak: +peak.toFixed(3), rms: +Math.sqrt(ss / Math.max(1, len)).toFixed(4),
        f0: [0.25, 0.5, 0.75].map(c => f0At(x, a + c * len)),
        cent: Array.from({ length: 10 }, (_, i) => centroid(x, Math.round(a + (i + 0.5) / 10 * len - 512))),
        am: amRate(x, Math.round(a + 0.2 * len), Math.round(b - 0.2 * len)),
      };
    };
    const out = [];
    for (const kind of S.KINDS) {
      if (kind === 'purr') continue;
      for (const voice of ['koxa', 'other']) {
        try { const r = await S.render(kind, RATE, { voice }); out.push(measure(`${kind}/${voice}`, r.data)); } catch (e) { out.push({ name: `${kind}/${voice}`, error: e.message }); }
      }
    }
    for (const voice of ['koxa', 'other']) {
      for (const intensity of [0.2, 0.9]) {
        try { const r = await S.render('purr', RATE, { voice, intensity }); out.push(measure(`purr ${intensity}/${voice}`, r.data)); } catch (e) { out.push({ name: `purr/${voice}`, error: e.message }); }
      }
    }
    return out;
  });
  const problems = [];
  const lines = rows.map(r => {
    if (r.error) { problems.push(`${r.name}: ${r.error}`); return `${r.name}: ERROR ${r.error}`; }
    if (r.peak > 0.9) problems.push(`${r.name}: CLIP peak ${r.peak}`);
    if (r.rms < 0.005) problems.push(`${r.name}: SILENT rms ${r.rms}`);
    return `${r.name.padEnd(18)} dur ${r.dur.toFixed(2)}  peak ${r.peak.toFixed(2)}  rms ${r.rms.toFixed(3)}  f0 ${r.f0.join('/')}  am ${r.am[0]}Hz ${r.am[1]}  cent ${r.cent.join(' ')}`;
  });
  return lines.join('\n') + '\n' + (problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no clipping, nothing silent');
}
