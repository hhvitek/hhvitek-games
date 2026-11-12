// Screenshot pass for the games: the agent LOOKS at every game instead of only checking numbers.
// Run it with the Playwright MCP tool `browser_run_code_unsafe`, parameter filename = tools/shots.js,
// while a local server runs in the repository root:  node tools/serve.js  (port 8765)
// Only some games: first write .playwright-mcp/shots.json = {"ids": ["zavri-cisla"]} (the Write tool), then run this
// file; without that file every game of games/registry.js is shot (about 3 minutes). Delete the file afterwards.
// For each game, at 393×873: start, after a few real taps (`play` below), settings, help; at 393×760: start.
// Then .playwright-mcp/sheet-<id>.png puts the five side by side (open it and look at it), and
// .playwright-mcp/sheet-overview.png shows the start of every game shot. The result lists console errors,
// steps that found nothing to tap, side margins other than 12 px, and (at 393×760, 360×640, 745×527 and
// 1024×768) a play area that reaches under the bars, a cut or broken title, or a scrolling page.
// A new game adds its own entry to `play` (a move, the hint, a tap on the hinted piece and on its place).
async (page) => {
  const BASE = 'http://localhost:8765/';
  const OUT = '.playwright-mcp/';
  const errors = [];
  page.on('pageerror', e => errors.push(`${page.url().split('/').slice(-2)[0]}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !page.url().includes('/tools/') && !/vibrate|service ?worker|favicon/i.test(m.text())) errors.push(`${page.url().split('/').slice(-2)[0]} console: ${m.text()}`); });
  // the card games deal with an animation: their start picture waits for it
  const START_WAIT = { soliter: 2600, freecell: 2600, pyramida: 2600, pavouk: 2800, 'cesta-ven': 1800 };
  const wait = ms => page.waitForTimeout(ms);
  const tap = async (sel, note) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) { errors.push(`${note || sel}: nothing to tap (${sel})`); return false; }
    await el.click({ force: true, timeout: 3000 }).catch(e => errors.push(`${note || sel}: ${e.message.split('\n')[0]}`));
    return true;
  };
  const tapButton = async (re) => {
    const el = page.getByRole('button', { name: re }).first();
    if (await el.count()) { await el.click({ force: true, timeout: 3000 }).catch(() => {}); return true; }
    errors.push(`no button ${re}`); return false;
  };
  const HINTED = '.hint, .hl, .hinted, .dst';
  // measures the left/right margins (px) of the top-bar buttons, the bottom buttons and the painted play area
  const GUTTER = () => {
    const vw = innerWidth, out = {};
    const edges = (els, k) => {
      const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
      out[k + 'L'] = rs.length ? Math.round(Math.min(...rs.map(r => r.left))) : -1;
      out[k + 'R'] = rs.length ? Math.round(vw - Math.max(...rs.map(r => r.right))) : -1;
      return rs;
    };
    const bar = document.querySelector('.topbar, header');
    const top = bar ? bar.getBoundingClientRect().bottom : 60;
    edges(bar ? [...bar.querySelectorAll('button, a')].filter(b => !b.hidden) : [], 'bar');
    const low = [...document.querySelectorAll('button')].filter(b => !b.closest('.screen, #modal, .topbar, header') && b.getBoundingClientRect().top > innerHeight * .7);
    const rs = edges(low, 'tray');
    const bottom = rs.length ? Math.min(...rs.map(r => r.top)) : innerHeight;
    let L = 1e9, R = -1e9;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.topbar, header, .screen, #modal, #toast, .toast')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top < top || r.bottom > bottom + 2 || r.width >= vw - 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && !(parseFloat(cs.borderLeftWidth) > 0) && cs.boxShadow === 'none' && !/^(svg|IMG)$/.test(el.tagName)) continue;
      L = Math.min(L, r.left); R = Math.max(R, r.right);
    }
    out.boardL = L < 1e9 ? Math.round(L) : -1; out.boardR = R > -1e9 ? Math.round(vw - R) : -1;
    return out;
  };
  // other window shapes (a small phone, a short wide browser window): nothing of the play area may reach under
  // the top bar or the bottom controls, and the title must be whole (wrapped only between words, never cut)
  const FIT = () => {
    const probs = [], vw = innerWidth;
    const bar = document.querySelector('.topbar, header'), col = bar.parentElement;
    const kids = [...col.children].filter(k => k !== bar && !k.matches('.screen, #modal, #toast, .toast, script, style') && k.getBoundingClientRect().height > 0);
    const tray = [...kids].reverse().find(k => k.querySelector('button') || k.matches('button'));
    const top = bar.getBoundingClientRect().bottom, bottom = tray ? tray.getBoundingClientRect().top : innerHeight;
    for (const k of kids) if (k !== tray && k.getBoundingClientRect().top < bottom) for (const el of [k, ...k.querySelectorAll('*')]) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      if (r.top < top - 1 || r.bottom > bottom + 1 || r.left < -1 || r.right > vw + 1) { probs.push(`play area goes outside (${el.className || el.tagName} ${Math.round(r.top - top)}/${Math.round(bottom - r.bottom)})`); break; }
    }
    const h1 = bar.querySelector('h1');
    if (h1) {
      // cut: the text is wider than its box, or reaches over the buttons next to it (glyphs may overhang the
      // box a little vertically with a small line-height, so only the width counts)
      const rg = document.createRange(); rg.selectNodeContents(h1);
      const tr = [...rg.getClientRects()], hb = h1.getBoundingClientRect();
      const prev = h1.previousElementSibling, next = h1.nextElementSibling;
      const tl = Math.min(...tr.map(r => r.left)), trr = Math.max(...tr.map(r => r.right));
      if (h1.scrollWidth > h1.clientWidth + 1 || tl < hb.left - 1 || trr > hb.right + 1
        || (prev && tl < prev.getBoundingClientRect().right) || (next && trr > next.getBoundingClientRect().left)) probs.push('title cut off');
      const tn = h1.firstChild, words = (h1.textContent.match(/\S+/g) || []);
      let at = 0;
      if (tn && tn.nodeType === 3) for (const w of words) {
        const i = tn.textContent.indexOf(w, at), rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + w.length); at = i + w.length;
        if (new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size > 1) probs.push(`title word "${w}" broken`);
      }
    }
    if (document.documentElement.scrollWidth > vw + 1 || document.documentElement.scrollHeight > innerHeight + 1) probs.push('page scrolls');
    return [...new Set(probs)];
  };
  // a few real taps per game (a move, a hint and a tap on what the hint shows)
  const play = {
    'logik': async () => {
      for (let i = 0; i < 4; i++) {
        const a = await page.locator('#palette .pbtn').nth(i).boundingBox(), b = await page.locator('.slot.act').nth(i).boundingBox();
        if (!a || !b) break;
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); await wait(150);
      }
      await tapButton(/Zkontrolovat/); await wait(600);
    },
    'sudoku': async () => { await tapButton(/Poradit/); await wait(800); },
    'skladani-kostek': async () => { await tap('#tray .piece, #tray [data-i], .tray > *'); await wait(300); await page.locator('#board > *, #board .cell').nth(27).click({ force: true }).catch(() => {}); await wait(600); },
    'padajici-tvary': async () => { await tapButton(/^Hrát$/); await wait(500); await tapButton(/Shodit/); await wait(1500); },
    'barevne-kostky': async () => { const b = await page.locator('#board, #field, .board').first().boundingBox(); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height - 20); await wait(900); },
    'mahjong': async () => { await tap('[data-a="hint"]'); await wait(1500); await tap('.t.hl'); await wait(900); },
    'pexeso': async () => {
      // a found pair (card 0 and its twin), then two different cards that stay face up
      const [a, b, c, d] = await page.evaluate(() => { const f = window.Pexeso.state.G.faces, t = f.indexOf(f[0], 1), o = f.findIndex((x, i) => i > 0 && i !== t), p = f.findIndex((x, i) => i > 0 && i !== t && x !== f[o]); return [0, t, o, p]; });
      for (const i of [a, b, c, d]) { await tap(`.pc[data-i="${i}"]`); await wait(450); }
    },
    'spoj-tri': async () => { await tap('#btnHint'); await wait(500); await tap('.hinted'); await wait(2500); },
    'prelevani': async () => { const t = page.locator('.tube'); await t.nth(0).click({ force: true }); await wait(300); await t.nth(3).click({ force: true }); await wait(1200); },
    'hanojske-veze': async () => { await tap('[data-r="0"]'); await wait(300); await tap('[data-r="2"]'); await wait(500); await tap('#btnHint'); await wait(500); },
    'spojovani-cisel': async () => { for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) { await page.keyboard.press(k); await wait(250); } },
    'cesta-ven': async () => { await tap('#btnGo'); await wait(500); await tap(HINTED); await wait(800); await tap('#btnGo'); await wait(500); },
    // a mirror turned, then the hint, a tap on the hinted mirror, and the next hint shown
    'paprsek': async () => { await tap('#taps .cell[aria-label^="Zrcadlo"]'); await wait(400); await tapButton(/Poradit/); await wait(600); await tap(HINTED); await wait(600); await tapButton(/Poradit/); await wait(600); },
    // the hint (dotted way, the next arrow framed), a tap on the framed arrow, the hint again
    'kulicka': async () => { await tap('#btnHint'); await wait(400); await tap('.arrow.hint'); await wait(1200); await tap('#btnHint'); await wait(500); },
    'patnactka': async () => { await page.evaluate(() => { const P = window.Patnactka, G = P.state.G, n = G.rules.n, z = G.board.indexOf(0); P.tryMove(z % n ? z - 1 : z + 1); }); await wait(500); },
    'kostky': async () => { await tap('#btnRoll'); await wait(1200); await tap('#roll .die:not(.dead)'); await wait(400); },
    // the advised move (its piece, then its square), the opponent's reply, then the next advice and its piece chosen
    'dama': async () => { await tap('#btnHint'); await wait(1200); await tap('.sq.hint:has(.pc)'); await wait(300); await tap('.sq.hint.to'); await wait(4000); await tap('#btnHint'); await wait(1200); await tap('.sq.hint:has(.pc)'); await wait(300); },
    'zavri-cisla': async () => { await tapButton(/Hodit kostk/); await wait(1800); await tap('#rails .plate:not(.dim):not(.down)'); await wait(400); },
    'soliter': async () => { await tap('[data-a="hint"]'); await wait(900); await tap('.cd.hint'); await wait(800); },
    'freecell': async () => { await tap('[data-a="hint"]'); await wait(900); await tap('.cd.hint'); await wait(800); },
    'pyramida': async () => { await tap('[data-a="hint"]'); await wait(900); await tap('.hint'); await wait(800); },
    'pavouk': async () => { await tap('[data-a="hint"]'); await wait(900); await tap('.cd.hint'); await wait(800); },
    'oko-bere': async () => { await tap('[data-a="take"]'); await wait(550); await tap('[data-a="stand"]'); await wait(4200); },
    'oko-bere-plus-minus': async () => { await tap('[data-a="take"]'); await wait(450); await tap('#chipsYou .chip'); await wait(550); await tap('[data-a="stand"]'); await wait(400); await page.evaluate(() => { const m = document.getElementById('modal'); if (!m.hidden) m.querySelector('[data-i="0"]').click(); }); await wait(4500); },
    // a card that fits (or Líznout), then the opponents' turns
    'prsi': async () => { await tap((await page.locator('#hand .cd.ok').count()) ? '#hand .cd.ok' : '#btnMain'); await wait(400); await page.evaluate(() => { const m = document.getElementById('modal'); if (!m.hidden) m.querySelector('[data-suit]').click(); }); await wait(3200); },
  };
  // a game without its own entry: the hint button, then what it highlights, then the middle of the board
  const fallback = async (id) => {
    errors.push(`${id}: no play steps in tools/shots.js yet (add them); used the generic taps`);
    const hintBtn = page.getByRole('button', { name: /Poradit|Rada|Nápověda/ }).first();
    if (await hintBtn.count()) { await hintBtn.click({ force: true }).catch(() => {}); await wait(900); await tap(HINTED, `${id} hint`); await wait(800); }
    const vp = page.viewportSize(); await page.mouse.click(vp.width / 2, vp.height / 2); await wait(600);
  };

  // games: .playwright-mcp/shots.json {"ids": [...]} if it is there, otherwise every game of the registry
  const reg = await (await page.request.get(BASE + 'games/registry.js')).text();
  const all = [...reg.matchAll(/id: '([^']+)'/g)].map(m => m[1]);
  let ids = all;
  const pick = await page.request.get(BASE + OUT + 'shots.json');
  if (pick.ok()) { try { const j = await pick.json(); if (Array.isArray(j.ids) && j.ids.length) ids = j.ids; } catch (e) { errors.push('shots.json is not valid JSON: every game shot'); } }

  // clean start: no service worker (it would serve old files from its cache), no caches, no saved games
  await page.setViewportSize({ width: 393, height: 873 });
  await page.goto(BASE + 'tools/sheet.html');
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    localStorage.clear();
  });
  const open = async (id, w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}games/${id}/index.html?menu&v=${Date.now()}`); // never the launcher: it installs the service worker
    await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(START_WAIT[id] || 1200);
  };
  // margins that differ on purpose (CLAUDE.md, "Decisions for single games"): Logik's colours sit under the holes
  const MARGIN_OK = { logik: ['trayL', 'trayR'] };
  for (const id of ids) {
    await open(id, 393, 873);
    await page.screenshot({ path: `${OUT}${id}-1start.png` });
    // one side margin everywhere: top-bar buttons, the board and the bottom buttons start 12 px from the edges
    const m = await page.evaluate(GUTTER);
    const bad = Object.entries(m).filter(([k, v]) => !(MARGIN_OK[id] || []).includes(k) && v >= 0 && (k.startsWith('board') ? v < 11 : Math.abs(v - 12) > 1));
    if (bad.length) errors.push(`${id}: side margins should be 12 px: ${bad.map(([k, v]) => `${k} ${v}`).join(', ')}`);
    await (play[id] ? play[id]() : fallback(id));
    await page.screenshot({ path: `${OUT}${id}-2play.png` });
    await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.hidden = true; });
    await tap('#btnSettings', `${id} settings`); await wait(500);
    await page.screenshot({ path: `${OUT}${id}-3settings.png` });
    await page.evaluate(() => { document.getElementById('screenSettings').hidden = true; });
    await tap('#btnHelp', `${id} help`); await wait(500);
    await page.screenshot({ path: `${OUT}${id}-4help.png` });
    await open(id, 393, 760);
    await page.screenshot({ path: `${OUT}${id}-5short.png` });
    for (const [w, h] of [[393, 760], [360, 640], [745, 527], [1024, 768]]) {
      if (w !== 393) await open(id, w, h);
      for (const p of await page.evaluate(FIT)) errors.push(`${id} ${w}×${h}: ${p}`);
    }
  }
  // the sheets
  await page.setViewportSize({ width: 1400, height: 640 });
  for (const id of ids) {
    await page.goto(`${BASE}tools/sheet.html?id=${id}`); await wait(400);
    await page.screenshot({ path: `${OUT}sheet-${id}.png`, fullPage: true });
  }
  await page.goto(`${BASE}tools/sheet.html?all=${ids.join(',')}`); await wait(600);
  await page.screenshot({ path: `${OUT}sheet-overview.png`, fullPage: true });
  await page.evaluate(() => localStorage.clear());
  return `shot: ${ids.join(', ')}\nlook at: ${ids.map(id => `${OUT}sheet-${id}.png`).join(', ')}, ${OUT}sheet-overview.png\n` +
    (errors.length ? `PROBLEMS:\n${errors.join('\n')}` : 'no console errors, every step found what to tap');
}
