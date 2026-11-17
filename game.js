/* NITRO 5 — neon arkada poyga o'yini
 * Toza JavaScript + Canvas 2D + Web Audio, hech qanday kutubxonasiz.
 *
 * O'yin tizimlari:
 *  - Kombo: ketma-ket "yaqin o'tishlar" ochko multiplikatorini oshiradi (x5 gacha)
 *  - Tramplinlar: sakrab to'siqlar ustidan uchib o'tish
 *  - Bonuslar: nitro, qalqon, magnit
 *  - Zonalar: har 30 soniyada yangi rangli dunyo va tezroq musiqa
 *  - Tangalar, garaj (mashinalar + qobiliyatlar) va yaxshilash do'koni
 *  - Vazifalar, kunlik sovg'a, davom etish imkoniyati, rekordlar jadvali
 */
(() => {
  'use strict';

  // ---------- Asosiy o'lchamlar ----------
  const W = 480, H = 800;
  const ROAD_L = 40, ROAD_R = 440, LANES = 4;
  const LANE_W = (ROAD_R - ROAD_L) / LANES;
  const PW = 44, PH = 80;
  const PLAYER_Y = H - 170;
  const ZONE_TIME = 30;
  const COMBO_TIME = 2.6;
  const NEAR_GAP = 22;
  const KM_PX = 10000;
  const JUMP_TIME = 1.0;
  const REVIVE_COST = 100;
  const REVIVE_WAIT = 5;

  const COLORS = {
    cyan: '#00f0ff', pink: '#ff2bd6', green: '#39ff88', gold: '#ffd23f',
    orange: '#ffb000', purple: '#7a5cff', red: '#ff3b5c', blue: '#4da3ff', violet: '#b26bff',
  };
  const ENEMY_COLORS = [COLORS.pink, COLORS.orange, COLORS.purple, COLORS.red];

  const ZONES = [
    { name: 'NEON SHAHAR',     edge: '#ff2bd6', lane: '#00f0ff', bg1: '#12002b', bg2: '#07021a', road: '#0b0620', post: '#7a5cff' },
    { name: "SINTVEYV CHO'LI", edge: '#ff7b00', lane: '#ffd23f', bg1: '#2b0a1a', bg2: '#0d0210', road: '#140812', post: '#ff2bd6' },
    { name: 'KIBER TUNNEL',    edge: '#00ff9c', lane: '#00b3ff', bg1: '#001a1f', bg2: '#00060a', road: '#02110f', post: '#00ff9c' },
    { name: 'ZAHARLI ZONA',    edge: '#b6ff00', lane: '#7a5cff', bg1: '#0f1a00', bg2: '#050800', road: '#0a0f02', post: '#b6ff00' },
    { name: 'QIZIL SAYYORA',   edge: '#ff3b5c', lane: '#ffb000', bg1: '#2b0005', bg2: '#0a0002', road: '#13040a', post: '#ff3b5c' },
  ];

  const SKINS = [
    { id: 'cyan',    name: "Neon Ko'k", color: '#00f0ff', price: 0,    perk: 'Muvozanatli',             p: {} },
    { id: 'green',   name: 'Zahar',     color: '#39ff88', price: 150,  perk: "Nitro 2x tez to'ladi",    p: { regen: 2 } },
    { id: 'gold',    name: 'Oltin',     color: '#ffd23f', price: 400,  perk: 'Tangalar +50%',           p: { coin: 0.5 } },
    { id: 'violet',  name: 'Binafsha',  color: '#b26bff', price: 800,  perk: 'Boshqaruv +25%',          p: { handling: 1.25 } },
    { id: 'ghost',   name: 'Arvoh',     color: '#ffffff', price: 1500, perk: 'Har poyga qalqon bilan',  p: { shield: true } },
    { id: 'rainbow', name: 'Kamalak',   color: 'rainbow', price: 3000, perk: 'Hamma qobiliyatlar!',     p: { regen: 1.5, coin: 0.5, handling: 1.15, shield: true } },
  ];

  const UPGRADES = {
    nitro:  { name: "Nitro sig'imi",   desc: (l) => l ? `Nitro ${l * 12}% sekinroq tugaydi` : 'Nitro uzoqroq yetadi' },
    magnet: { name: 'Magnit vaqti',    desc: (l) => `Magnit ${8 + l * 2} soniya ishlaydi` },
    luck:   { name: 'Omad',            desc: (l) => l ? `Bonuslar ${l * 15}% ko'proq chiqadi` : "Bonuslar ko'proq chiqadi" },
    boost:  { name: 'Start raketasi',  desc: (l) => l ? `Startda ${(l * 1.5).toFixed(1)} s bepul nitro + himoya` : 'Startda bepul nitro + himoya' },
  };
  const UPGRADE_COST = [100, 250, 500, 1000, 2000];
  const UPGRADE_MAX = UPGRADE_COST.length;

  const MISSION_TYPES = {
    dist:  { label: (t) => `Bir poygada ${t} km yuring`,         base: 1,    step: 1,    reward: 40 },
    near:  { label: (t) => `${t} marta yaqin o'ting`,            base: 3,    step: 3,    reward: 50 },
    coins: { label: (t) => `${t} ta tanga yig'ing`,              base: 15,   step: 15,   reward: 40 },
    nitro: { label: (t) => `Nitroni ${t} soniya ishlating`,      base: 5,    step: 5,    reward: 40 },
    score: { label: (t) => `${t.toLocaleString('uz')} ochko to'plang`, base: 1500, step: 1500, reward: 60 },
    combo: { label: (t) => `x${t} kombo multiplikatorga yeting`, base: 2,    step: 1,    reward: 70, max: 5 },
    jump:  { label: (t) => `Tramplindan ${t} marta sakrang`,     base: 1,    step: 2,    reward: 50 },
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const laneX = (i) => ROAD_L + LANE_W * (i + 0.5);
  const laneOf = (x) => clamp(Math.floor((x - ROAD_L) / LANE_W), 0, LANES - 1);
  const fmt = (n) => Math.floor(n).toLocaleString('uz');
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* yo'q */ } };

  // ---------- Ekran o'lchami ----------
  let scale = 1, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cssW = Math.floor(W * scale), cssH = Math.floor(H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    stage.style.width = cssW + 'px';
    stage.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Saqlash ----------
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* saqlab bo'lmadi */ }
  }

  // ---------- Profil ----------
  const PROFILE_KEY = 'nitro5.profile.v1';
  function defaultProfile() {
    return {
      coins: 0, owned: ['cyan'], selected: 'cyan', runs: 0,
      levels: Object.fromEntries(Object.keys(MISSION_TYPES).map((k) => [k, 0])),
      active: ['dist', 'near', 'coins'],
      upgrades: { nitro: 0, magnet: 0, luck: 0, boost: 0 },
      lastDaily: '', streak: 0,
    };
  }
  function loadProfile() {
    const p = readJSON(PROFILE_KEY, null);
    const d = defaultProfile();
    if (!p || typeof p !== 'object') return d;
    const num = (v, def = 0) => (Number.isFinite(v) ? v : def);
    const out = {
      coins: Math.max(0, num(p.coins)),
      owned: Array.isArray(p.owned) ? p.owned.filter((id) => SKINS.some((s) => s.id === id)) : d.owned,
      selected: typeof p.selected === 'string' ? p.selected : 'cyan',
      runs: num(p.runs),
      levels: Object.assign({}, d.levels, p.levels && typeof p.levels === 'object' ? p.levels : {}),
      active: Array.isArray(p.active) ? p.active.filter((t) => MISSION_TYPES[t]) : d.active,
      upgrades: Object.assign({}, d.upgrades),
      lastDaily: typeof p.lastDaily === 'string' ? p.lastDaily : '',
      streak: num(p.streak),
    };
    if (p.upgrades && typeof p.upgrades === 'object') {
      for (const k of Object.keys(out.upgrades)) out.upgrades[k] = clamp(num(p.upgrades[k]), 0, UPGRADE_MAX);
    }
    if (!out.owned.includes('cyan')) out.owned.unshift('cyan');
    if (!out.owned.includes(out.selected)) out.selected = 'cyan';
    out.active = [...new Set(out.active)];
    for (const t of Object.keys(MISSION_TYPES)) {
      if (out.active.length >= 3) break;
      if (!out.active.includes(t)) out.active.push(t);
    }
    out.active = out.active.slice(0, 3);
    return out;
  }
  let profile = loadProfile();
  const saveProfile = () => writeJSON(PROFILE_KEY, profile);
  const perks = () => (SKINS.find((s) => s.id === profile.selected) || SKINS[0]).p;
  const upg = (k) => profile.upgrades[k] || 0;

  function missionTarget(type) {
    const m = MISSION_TYPES[type];
    const t = m.base + m.step * (profile.levels[type] || 0);
    return m.max ? Math.min(m.max, t) : t;
  }
  function missionReward(type) {
    return MISSION_TYPES[type].reward * ((profile.levels[type] || 0) + 1);
  }
  function missionValue(type) {
    switch (type) {
      case 'dist': return G.dist / KM_PX;
      case 'near': return G.nearMisses;
      case 'coins': return G.coinsCollected;
      case 'nitro': return G.nitroTime;
      case 'score': return G.score;
      case 'combo': return G.maxMult;
      case 'jump': return G.jumps;
      default: return 0;
    }
  }
  function skinColor(id, t) {
    const s = SKINS.find((k) => k.id === id) || SKINS[0];
    return s.color === 'rainbow' ? `hsl(${(t * 140) % 360}, 100%, 60%)` : s.color;
  }

  // Kunlik sovg'a
  function dayStr(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function claimDaily() {
    const now = new Date();
    const today = dayStr(now);
    if (profile.lastDaily === today) return null;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    profile.streak = profile.lastDaily === dayStr(y) ? profile.streak + 1 : 1;
    profile.lastDaily = today;
    const reward = 50 * Math.min(profile.streak, 7);
    profile.coins += reward;
    saveProfile();
    return { reward, streak: profile.streak, next: 50 * Math.min(profile.streak + 1, 7) };
  }

  // ---------- Rekordlar jadvali ----------
  const LB_KEY = 'nitro5.leaderboard.v1';
  function loadLB() {
    const raw = readJSON(LB_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
  function qualifies(score) {
    const lb = loadLB();
    return score > 0 && (lb.length < 10 || score > lb[lb.length - 1].score);
  }
  function addScore(name, score) {
    const entry = { name, score, date: Date.now() };
    const lb = loadLB();
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    writeJSON(LB_KEY, lb.slice(0, 10));
    return entry;
  }
  function renderLB(el, highlight, limit = 10) {
    el.textContent = '';
    const lb = loadLB().slice(0, limit);
    if (!lb.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = "Hali rekord yo'q — birinchi bo'ling!";
      el.appendChild(li);
      return;
    }
    for (const e of lb) {
      const li = document.createElement('li');
      if (highlight && e.date === highlight.date && e.score === highlight.score) li.className = 'me';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name;
      const s = document.createElement('span'); s.className = 's'; s.textContent = fmt(e.score);
      li.append(n, s);
      el.appendChild(li);
    }
  }

  // ---------- Ovoz effektlari ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const Sound = {
    ac: null, master: null, sfx: null, music: null, noiseBuf: null,
    engine: null, engineGain: null, filter: null, muted: readJSON('nitro5.muted', false) === true,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ac.destination);
        this.sfx = this.ac.createGain();
        this.sfx.connect(this.master);
        this.music = this.ac.createGain();
        this.music.gain.value = 0.4;
        this.music.connect(this.master);

        const len = this.ac.sampleRate;
        this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        this.filter = this.ac.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 600;
        this.engineGain = this.ac.createGain();
        this.engineGain.gain.value = 0;
        this.engine = this.ac.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 60;
        this.engine.connect(this.filter).connect(this.engineGain).connect(this.sfx);
        this.engine.start();
        Music.start();
      } catch { this.ac = null; }
    },
    setMuted(m) {
      this.muted = m;
      writeJSON('nitro5.muted', m);
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ac.currentTime, 0.02);
    },
    setEngine(speed, on, nitro) {
      if (!this.ac) return;
      const t = this.ac.currentTime;
      this.engineGain.gain.setTargetAtTime(on ? (nitro ? 0.035 : 0.02) : 0, t, 0.08);
      this.engine.frequency.setTargetAtTime(40 + speed * 0.09, t, 0.1);
      this.filter.frequency.setTargetAtTime(nitro ? 1400 : 700, t, 0.1);
    },
    blip(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
      if (!this.ac) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    jingle(notes, gap = 0.09) {
      notes.forEach((f, i) => this.blip(f, 0.14, 'square', 0.05, 0, i * gap));
    },
    noise(dur, vol, hp = 0, dest = null, at = null) {
      if (!this.ac) return;
      const t = at ?? this.ac.currentTime;
      const src = this.ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = src;
      if (hp) {
        const f = this.ac.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = hp;
        node = node.connect(f);
      }
      node.connect(g).connect(dest || this.sfx);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    },
    crash() { this.noise(0.7, 0.3); this.blip(180, 0.5, 'sawtooth', 0.08, -150); },
  };

  // ---------- Fon musiqasi (protsedura bilan yaratiladi) ----------
  const Music = {
    timer: null, step: 0, nextT: 0, bpm: 108, intensity: 0,
    ROOTS: [57, 53, 48, 55],                       // A3 F3 C3 G3
    CHORDS: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]],
    start() {
      if (!Sound.ac || this.timer) return;
      this.nextT = Sound.ac.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 25);
    },
    tick() {
      const ac = Sound.ac;
      if (!ac || ac.state !== 'running') return;
      if (this.nextT < ac.currentTime - 0.2) this.nextT = ac.currentTime + 0.05;
      const spb = 60 / this.bpm / 4;
      while (this.nextT < ac.currentTime + 0.15) {
        this.play(this.step, this.nextT, spb);
        this.nextT += spb;
        this.step = (this.step + 1) % 64;
      }
    },
    note(freq, t, dur, type, vol, cutoff) {
      const ac = Sound.ac;
      const o = ac.createOscillator();
      const f = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(Sound.music);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    kick(t, vol = 0.5) {
      const ac = Sound.ac;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(Sound.music);
      o.start(t);
      o.stop(t + 0.22);
    },
    play(s, t, spb) {
      const bar = (s >> 4) & 3, i = s & 15;
      const r = this.ROOTS[bar], ch = this.CHORDS[bar];
      // Bas
      if (i % 2 === 0) this.note(mtof(r - 12 + (i % 4 === 2 ? 12 : 0)), t, spb * 1.7, 'sawtooth', 0.11, 420 + this.intensity * 250);
      // Akkord fon
      if (i === 0) for (const c of ch) this.note(mtof(r + c), t, spb * 15, 'triangle', 0.03, 1400);
      // Barabanlar
      if (this.intensity >= 1) {
        if (i % 4 === 0) this.kick(t);
        if (i === 4 || i === 12) Sound.noise(0.14, 0.16, 1500, Sound.music, t);
        if (i % 2 === 1) Sound.noise(0.035, 0.05, 7000, Sound.music, t);
      } else if (i === 0 || i === 8) {
        this.kick(t, 0.25);
      }
      // Arpedjio (nitro yoki yuqori kombo vaqtida)
      if (this.intensity >= 2) {
        const n = r + 12 + ch[i % 3] + (i % 6 >= 3 ? 12 : 0);
        this.note(mtof(n), t, spb * 0.9, 'square', 0.03, 3000);
      }
    },
  };

  // ---------- Kiritish ----------
  const keys = new Set();
  const touch = { left: false, right: false, nitro: false, dragX: null, dragId: null };
  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyA', 'KeyD', 'KeyW'];

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    Sound.init();
    if (e.code === 'KeyP') togglePause();
    else if (e.code === 'Escape') {
      if (state === 'garage') showMenu();
      else if (state === 'revive') showGameOver();
      else togglePause();
    } else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'Enter' || e.code === 'Space') {
      if (state === 'menu') startGame();
      else if (state === 'paused') togglePause();
      else if (state === 'over' && $('nameForm').classList.contains('hidden')) startGame();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    touch.left = touch.right = touch.nitro = false;
    touch.dragX = touch.dragId = null;
  });

  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  for (const b of document.querySelectorAll('.tbtn')) {
    const act = b.dataset.act;
    const on = (e) => { e.preventDefault(); touch[act] = true; b.classList.add('active'); Sound.init(); };
    const off = (e) => { e.preventDefault(); touch[act] = false; b.classList.remove('active'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Barmoq bilan surib boshqarish
  const logicalX = (e) => (e.clientX - canvas.getBoundingClientRect().left) / scale;
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing' && state !== 'countdown') return;
    touch.dragId = e.pointerId;
    touch.dragX = logicalX(e);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* yo'q */ }
    Sound.init();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === touch.dragId) touch.dragX = logicalX(e);
  });
  const endDrag = (e) => { if (e.pointerId === touch.dragId) { touch.dragId = null; touch.dragX = null; } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---------- O'yin holati ----------
  // menu | garage | countdown | playing | paused | crashing | revive | over
  let state = 'menu';
  let G = null;

  function newGame() {
    return {
      t: 0, runT: 0, speed: 260, dist: 0, score: 0,
      nitro: 1, nitroOn: false, nitroTime: 0, boostT: 0,
      px: laneX(1.5), vx: 0, tilt: 0,
      obstacles: [], pickups: [], particles: [], texts: [], toasts: [],
      spawnAcc: 0, nextGap: 380,
      shake: 0, roadOffset: 0, crashT: 0, count: 0, slowT: 0, reviveT: 0, revived: false,
      nearMisses: 0, coins: 0, coinsCollected: 0, missionCoins: 0, jumps: 0,
      flash: 0, flashColor: '57,255,136',
      combo: 0, comboT: 0, mult: 1, maxMult: 1,
      shield: false, invuln: 0, magnetT: 0, magnetMax: 8, jumpT: 0,
      zone: 0, banner: null,
      best: loadLB()[0]?.score || 0, recordAnnounced: false,
      missionsDone: new Set(),
    };
  }
  G = newGame();

  // ---------- Obyektlarni yaratish ----------
  function spawnRow() {
    const diff = Math.min(1, G.runT / 120);

    // Yuqorida hali turgan sekin obyektlar egallagan qatorlar
    const recent = new Set();
    for (const o of G.obstacles) {
      if (o.y - o.h / 2 < 220) {
        recent.add(laneOf(o.x));
        if (o.targetX !== null && o.targetX !== undefined) recent.add(laneOf(o.targetX));
      }
    }
    const open = shuffle([0, 1, 2, 3].filter((l) => !recent.has(l)));
    if (open.length === 0) return;
    const safe = open[0];               // har doim kamida bitta ochiq yo'l qoladi
    const candidates = open.slice(1);

    let count = 1;
    const r = Math.random();
    if (r < 0.18 * diff) count = 3;
    else if (r < 0.35 + diff * 0.35) count = 2;
    count = Math.min(count, candidates.length);
    const busy = candidates.slice(0, count);
    const free = [safe, ...candidates.slice(count)];

    for (const lane of busy) {
      const roll = Math.random();
      const color = ENEMY_COLORS[(Math.random() * ENEMY_COLORS.length) | 0];
      if (diff > 0.15 && roll < 0.14) {
        G.obstacles.push({ type: 'truck', x: laneX(lane), y: -80, w: 50, h: 140, own: rand(90, 170), color, targetX: null, passed: false });
      } else if (diff > 0.3 && roll < 0.26) {
        G.obstacles.push({ type: 'bike', x: laneX(lane), baseX: laneX(lane), y: -40, w: 22, h: 46, own: rand(180, 240), color, phase: rand(0, 6), targetX: null, passed: false });
      } else if (roll < 0.7) {
        const o = { type: 'car', x: laneX(lane), y: -50, w: 44, h: 78, own: rand(110, 250), color, targetX: null, passed: false };
        if (count === 1 && diff > 0.2 && Math.random() < 0.4 * diff) {
          const nb = lane + (Math.random() < 0.5 ? -1 : 1);
          if (nb >= 0 && nb < LANES && nb !== safe) o.targetX = laneX(nb);
        }
        G.obstacles.push(o);
      } else {
        G.obstacles.push({ type: 'barrier', x: laneX(lane), y: -24, w: LANE_W - 22, h: 26, own: 0, targetX: null, passed: false });
      }
    }

    // Bonuslar
    const L = 1 + upg('luck') * 0.15;
    const lane = free[(Math.random() * free.length) | 0];
    const table = [
      ['coins', 0.36],
      ['nitro', 0.12 * L],
      ['shield', G.shield ? 0 : 0.045 * L],
      ['magnet', G.magnetT > 0 ? 0 : 0.045 * L],
      ['ramp', diff > 0.05 ? 0.07 * L : 0],
    ];
    let roll = Math.random(), acc = 0;
    for (const [kind, pr] of table) {
      acc += pr;
      if (roll < acc) { spawnPickup(kind, lane); break; }
    }
    const other = free.find((l) => l !== lane);
    if (other !== undefined && Math.random() < 0.22) spawnPickup('coins', other, 3);
  }

  function spawnPickup(kind, lane, n = 4) {
    const x = laneX(lane);
    if (kind === 'coins') {
      for (let i = 0; i < n; i++) G.pickups.push({ kind: 'coin', x, y: -40 - i * 45, r: 10, spin: i });
    } else if (kind === 'ramp') {
      G.pickups.push({ kind: 'ramp', x, y: -40, r: 26, w: LANE_W - 26, h: 46, spin: 0 });
    } else {
      G.pickups.push({ kind, x, y: -40, r: 17, spin: 0 });
    }
  }

  // ---------- Effektlar ----------
  function addParticle(p) {
    if (G.particles.length < 700) G.particles.push(p);
  }
  function floatText(x, y, text, color, size = 22) {
    G.texts.push({ x, y, text, color, size, life: 1 });
  }
  function toast(text, color = COLORS.green) {
    G.toasts.push({ text, color, life: 2.6 });
  }
  function burst(x, y, color, n = 20, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.4, speed);
      addParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6, size: 3, color });
    }
  }
  function explode(x, y) {
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(80, 520);
      addParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.5, 1.2), max: 1.2, size: rand(2, 5),
        color: [COLORS.cyan, COLORS.pink, '#ffffff', COLORS.orange][i % 4],
      });
    }
  }
  function exhaust(color, n = 1, big = false) {
    for (let i = 0; i < n; i++) {
      addParticle({
        x: G.px + rand(-8, 8), y: PLAYER_Y + PH / 2,
        vx: rand(-30, 30), vy: rand(200, 420) + (big ? 200 : 0),
        life: rand(0.15, 0.4), max: 0.4, size: big ? rand(3, 6) : rand(2, 3), color,
      });
    }
  }

  // ---------- Yangilash ----------
  function update(dt) {
    G.t += dt;
    const playing = state === 'playing';
    const pk = perks();
    const playerColor = skinColor(profile.selected, G.t);

    if (playing) {
      G.runT += dt;
      const left = keys.has('ArrowLeft') || keys.has('KeyA') || touch.left;
      const right = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
      const wantNitro = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') ||
        keys.has('ArrowUp') || keys.has('KeyW') || touch.nitro;

      // Zona almashinuvi
      const zoneLevel = Math.floor(G.runT / ZONE_TIME);
      if (zoneLevel !== G.zone) {
        G.zone = zoneLevel;
        const z = ZONES[zoneLevel % ZONES.length];
        G.banner = { text: z.name, sub: `${zoneLevel + 1}-ZONA · TEZLIK OSHDI`, life: 2.4, color: z.edge };
        G.flash = 0.35; G.flashColor = '255,255,255';
        Sound.jingle([523, 659, 784, 1046]);
      }

      // Tezlik va nitro
      const base = Math.min(420 + G.runT * 7 + G.zone * 40, 1000);
      if (G.boostT > 0) {
        G.boostT -= dt;
        G.nitroOn = true;
        G.invuln = Math.max(G.invuln, 0.3);
      } else {
        G.nitroOn = wantNitro && G.nitro > 0.01;
        const drain = 0.38 * (1 - 0.12 * upg('nitro'));
        if (G.nitroOn) G.nitro = Math.max(0, G.nitro - drain * dt);
        else G.nitro = Math.min(1, G.nitro + 0.025 * (pk.regen || 1) * dt);
      }
      if (G.nitroOn) G.nitroTime += dt;
      const target = base * (G.nitroOn ? 1.65 : 1);
      G.speed += (target - G.speed) * Math.min(1, dt * 3);

      // Boshqaruv
      const handling = pk.handling || 1;
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (dir === 0 && touch.dragX !== null) {
        const want = clamp((touch.dragX - G.px) * 9, -560 * handling, 560 * handling);
        G.vx += (want - G.vx) * Math.min(1, dt * 12 * handling);
      } else {
        G.vx += dir * 2800 * handling * dt;
        G.vx *= Math.pow(0.0006, dt);
      }
      G.vx = clamp(G.vx, -560 * handling, 560 * handling);
      G.px += G.vx * dt;
      const minX = ROAD_L + PW / 2 + 4, maxX = ROAD_R - PW / 2 - 4;
      if (G.px < minX || G.px > maxX) {
        G.px = clamp(G.px, minX, maxX);
        if (Math.abs(G.vx) > 120 && G.jumpT <= 0) {
          for (let i = 0; i < 6; i++) {
            addParticle({
              x: G.px + Math.sign(G.vx) * PW / 2, y: PLAYER_Y + rand(-20, 20),
              vx: -Math.sign(G.vx) * rand(40, 160), vy: rand(100, 300),
              life: rand(0.2, 0.4), max: 0.4, size: 2, color: COLORS.orange,
            });
          }
        }
        G.vx = 0;
      }
      G.tilt += ((G.vx / 560) * 0.25 - G.tilt) * Math.min(1, dt * 10);

      // Sakrash
      if (G.jumpT > 0) {
        G.jumpT -= dt;
        if (G.jumpT <= 0) {
          G.jumpT = 0;
          const bonus = Math.round(100 * G.mult);
          G.score += bonus;
          floatText(G.px, PLAYER_Y - 60, `QO'NISH +${bonus}`, COLORS.violet);
          G.shake = Math.max(G.shake, 0.2);
          burst(G.px, PLAYER_Y + 30, COLORS.violet, 16, 200);
          Sound.blip(90, 0.18, 'sine', 0.2, -40);
        }
      }

      // Kombo
      if (G.comboT > 0) {
        G.comboT -= dt;
        if (G.comboT <= 0) {
          if (G.combo >= 4) floatText(W / 2, 220, 'KOMBO TUGADI', '#9a92c9', 18);
          G.combo = 0;
        }
      }
      G.mult = Math.min(5, 1 + G.combo * 0.25);
      G.maxMult = Math.max(G.maxMult, G.mult);

      // Ochko
      G.dist += G.speed * dt;
      G.score += G.speed * dt * 0.05 * (G.nitroOn ? 2 : 1) * G.mult;

      if (!G.recordAnnounced && G.best > 0 && G.score > G.best) {
        G.recordAnnounced = true;
        G.banner = { text: 'YANGI REKORD!', sub: 'Davom eting!', life: 2.2, color: COLORS.gold };
        Sound.jingle([784, 988, 1175, 1568], 0.07);
      }

      // Vazifalar
      profile.active.forEach((type, i) => {
        if (G.missionsDone.has(i)) return;
        if (missionValue(type) >= missionTarget(type)) {
          G.missionsDone.add(i);
          const rw = missionReward(type);
          G.missionCoins += rw;
          toast(`✔ ${MISSION_TYPES[type].label(missionTarget(type))}  +${rw}🪙`);
          Sound.jingle([660, 880, 1320], 0.08);
        }
      });

      // Yangi to'siqlar
      G.spawnAcc += G.speed * dt;
      if (G.spawnAcc >= G.nextGap) {
        G.spawnAcc = 0;
        spawnRow();
        const diff = Math.min(1, G.runT / 120);
        G.nextGap = rand(360, 520) - diff * 140;
      }

      G.invuln = Math.max(0, G.invuln - dt);
      G.magnetT = Math.max(0, G.magnetT - dt);

      if (G.jumpT <= 0) exhaust(G.nitroOn ? (Math.random() < 0.5 ? playerColor : '#ffffff') : COLORS.pink, G.nitroOn ? 4 : 1, G.nitroOn);

      Music.intensity = G.nitroOn || G.mult >= 2 ? 2 : 1;
      Music.bpm = Math.min(150, 120 + G.zone * 6);
    } else if (state === 'menu' || state === 'garage') {
      G.speed = 260;
      G.px = laneX(1.5) + Math.sin(G.t * 0.8) * 60;
      G.tilt = Math.cos(G.t * 0.8) * 0.08;
      exhaust(COLORS.pink);
      Music.intensity = 0;
      Music.bpm = 108;
    } else if (state === 'countdown') {
      const before = Math.ceil(G.count);
      G.count -= dt;
      const after = Math.ceil(G.count);
      G.speed += (420 - G.speed) * Math.min(1, dt * 2);
      G.px += (laneX(1.5) - G.px) * Math.min(1, dt * 6);
      G.tilt *= 0.9;
      if (after !== before) {
        if (after > 0) Sound.blip(440, 0.15, 'square', 0.06);
        else Sound.blip(880, 0.3, 'square', 0.07);
      }
      if (G.count <= -0.4) {
        state = 'playing';
        if (G.boostT > 0) G.banner = { text: 'RAKETA!', sub: 'Start tezlanishi', life: 1.4, color: COLORS.cyan };
      }
      exhaust(COLORS.pink);
      Music.intensity = 1;
    } else if (state === 'crashing') {
      G.speed *= Math.pow(0.05, dt);
      G.crashT -= dt;
      if (G.crashT <= 0) {
        if (canRevive()) showRevive();
        else showGameOver();
      }
    } else if (state === 'revive') {
      G.speed *= Math.pow(0.05, dt);
      G.reviveT -= dt;
      $('reviveBar').style.width = Math.max(0, (G.reviveT / REVIVE_WAIT) * 100) + '%';
      if (G.reviveT <= 0) showGameOver();
    }

    G.roadOffset = (G.roadOffset + G.speed * dt) % 80;

    // To'siqlar
    const pl = G.px - PW / 2 + 6, pr = G.px + PW / 2 - 6;
    const pt = PLAYER_Y - PH / 2 + 6, pb = PLAYER_Y + PH / 2 - 6;
    const frozen = state === 'crashing' || state === 'revive';
    for (const o of G.obstacles) {
      o.y += (G.speed - (frozen ? 0 : o.own)) * dt;
      if (o.type === 'bike' && !frozen) {
        o.x = o.baseX + Math.sin(G.t * 3 + o.phase) * 28;
      }
      if (o.targetX !== null && o.y > 60) {
        const d = o.targetX - o.x;
        o.x += Math.sign(d) * Math.min(Math.abs(d), 70 * dt);
      }
      if (!playing || o.dead) continue;
      const ol = o.x - o.w / 2, or = o.x + o.w / 2, ot = o.y - o.h / 2, ob = o.y + o.h / 2;
      if (pr > ol && pl < or && pb > ot && pt < ob) {
        if (G.jumpT > 0) {
          if (!o.jumped) {
            o.jumped = true;
            o.passed = true;
            const bonus = Math.round(150 * G.mult);
            G.score += bonus;
            floatText(G.px, PLAYER_Y - 90, `USTIDAN! +${bonus}`, COLORS.violet, 24);
            Sound.blip(1046, 0.12, 'square', 0.05, 500);
          }
          continue;
        }
        if (G.invuln > 0) continue;
        if (G.shield) {
          G.shield = false;
          G.invuln = 1.2;
          G.slowT = 0.5;
          o.dead = true;
          G.shake = 0.5;
          explode(o.x, o.y);
          floatText(G.px, PLAYER_Y - 70, 'QALQON SAQLADI!', COLORS.blue);
          Sound.noise(0.3, 0.15);
          Sound.blip(300, 0.3, 'sine', 0.08, 400);
          vibrate(60);
          continue;
        }
        crash();
        break;
      }
      if (!o.passed && ot > pb) {
        o.passed = true;
        const gap = Math.max(ol - pr, pl - or);
        if (gap < NEAR_GAP) {
          G.combo++;
          G.comboT = COMBO_TIME;
          G.nearMisses++;
          const m = Math.min(5, 1 + G.combo * 0.25);
          const bonus = Math.round(50 * (G.nitroOn ? 2 : 1) * m);
          G.score += bonus;
          floatText(G.px, PLAYER_Y - 60, `YAQIN! +${bonus}`, COLORS.orange);
          if (G.combo % 4 === 0) {
            G.banner = { text: `KOMBO x${m.toFixed(1)}`, sub: `${G.combo} ta ketma-ket!`, life: 1.3, color: COLORS.orange };
            G.slowT = 0.45;
          }
          Sound.blip(600 + Math.min(G.combo, 16) * 60, 0.08, 'square', 0.045);
          vibrate(15);
        }
      }
    }
    G.obstacles = G.obstacles.filter((o) => !o.dead && o.y < H + 160);

    // Bonuslar
    for (const p of G.pickups) {
      p.y += G.speed * dt;
      p.spin += dt * 3;
      if (playing && p.kind === 'coin' && G.magnetT > 0) {
        const dx = G.px - p.x, dy = PLAYER_Y - p.y, d = Math.hypot(dx, dy);
        if (d < 230 && d > 1) {
          const pull = 900 * dt;
          p.x += (dx / d) * pull;
          p.y += (dy / d) * pull;
        }
      }
      if (!playing || p.taken) continue;
      let hit;
      if (p.kind === 'ramp') hit = G.jumpT <= 0 && Math.abs(p.x - G.px) < p.w / 2 && Math.abs(p.y - PLAYER_Y) < PH / 2;
      else hit = Math.hypot(p.x - G.px, p.y - PLAYER_Y) < p.r + 30;
      if (hit) {
        p.taken = true;
        collect(p);
      }
    }
    G.pickups = G.pickups.filter((p) => !p.taken && p.y < H + 60);

    // Zarrachalar va matnlar
    for (const p of G.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
      p.life -= dt;
    }
    G.particles = G.particles.filter((p) => p.life > 0);
    for (const t of G.texts) { t.y -= 60 * dt; t.life -= dt * 0.9; }
    G.texts = G.texts.filter((t) => t.life > 0);
    if (G.toasts.length) {
      G.toasts[0].life -= dt;
      if (G.toasts[0].life <= 0) G.toasts.shift();
    }
    if (G.banner) { G.banner.life -= dt; if (G.banner.life <= 0) G.banner = null; }

    G.shake = Math.max(0, G.shake - dt * 2);
    G.flash = Math.max(0, G.flash - dt);

    Sound.setEngine(G.speed, state === 'playing' && G.jumpT <= 0, G.nitroOn);
  }

  function collect(p) {
    switch (p.kind) {
      case 'coin': {
        const extra = perks().coin && Math.random() < perks().coin ? 1 : 0;
        G.coins += 1 + extra;
        G.coinsCollected++;
        G.score += 10 * G.mult;
        burst(p.x, p.y, COLORS.gold, 8, 120);
        Sound.blip(1200 + (G.coinsCollected % 5) * 80, 0.06, 'square', 0.03);
        break;
      }
      case 'nitro':
        G.nitro = Math.min(1, G.nitro + 0.4);
        G.score += 25;
        G.flash = 0.25; G.flashColor = '57,255,136';
        floatText(p.x, p.y - 20, 'NITRO +40%', COLORS.green);
        burst(p.x, p.y, COLORS.green);
        Sound.blip(440, 0.18, 'sine', 0.08, 660);
        break;
      case 'shield':
        G.shield = true;
        floatText(p.x, p.y - 20, 'QALQON', COLORS.blue);
        burst(p.x, p.y, COLORS.blue);
        Sound.blip(330, 0.25, 'sine', 0.08, 330);
        break;
      case 'magnet':
        G.magnetMax = 8 + upg('magnet') * 2;
        G.magnetT = G.magnetMax;
        floatText(p.x, p.y - 20, `MAGNIT ${G.magnetMax}s`, COLORS.red);
        burst(p.x, p.y, COLORS.red);
        Sound.blip(260, 0.25, 'triangle', 0.08, 520);
        break;
      case 'ramp':
        G.jumpT = JUMP_TIME;
        G.jumps++;
        floatText(G.px, PLAYER_Y - 70, 'SAKRASH!', COLORS.violet, 26);
        Sound.blip(200, 0.5, 'sawtooth', 0.06, 600);
        Sound.noise(0.4, 0.06, 2000);
        break;
    }
  }

  function crash() {
    state = 'crashing';
    G.crashT = 1.0;
    G.shake = 1;
    G.nitroOn = false;
    G.combo = 0;
    explode(G.px, PLAYER_Y);
    Sound.crash();
    Sound.setEngine(0, false, false);
    vibrate([80, 40, 120]);
    Music.intensity = 0;
  }

  // ---------- Chizish ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawBackground(z) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, z.bg1);
    g.addColorStop(1, z.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = z.post;
    ctx.fillStyle = z.post;
    for (let y = -80 + (G.roadOffset * 2) % 160; y < H + 80; y += 160) {
      ctx.fillRect(10, y, 6, 40);
      ctx.fillRect(W - 16, y, 6, 40);
    }
    ctx.restore();

    ctx.fillStyle = z.road;
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = -80 + G.roadOffset; y < H; y += 80) {
      ctx.moveTo(ROAD_L, y); ctx.lineTo(ROAD_R, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = z.lane;
    ctx.shadowColor = z.lane;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 3;
    ctx.setLineDash([36, 44]);
    ctx.lineDashOffset = -G.roadOffset;
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      const x = ROAD_L + LANE_W * i;
      ctx.moveTo(x, -80); ctx.lineTo(x, H + 80);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = z.edge;
    ctx.shadowColor = z.edge;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ROAD_L, 0); ctx.lineTo(ROAD_L, H);
    ctx.moveTo(ROAD_R, 0); ctx.lineTo(ROAD_R, H);
    ctx.stroke();
    ctx.restore();

    if (G.nitroOn) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = rand(ROAD_L, ROAD_R), y = rand(0, H);
        ctx.moveTo(x, y); ctx.lineTo(x, y + rand(40, 120));
      }
      ctx.stroke();
    }
  }

  function drawCar(x, y, w, h, color, tilt, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);

    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#0d0a22';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    rr(-w / 2, -h / 2, w, h, Math.min(10, w / 3));
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const wy = isPlayer ? -h / 2 + 16 : h / 2 - 34;
    rr(-w / 2 + 7, wy, w - 14, 18, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    rr(-w / 2 + 8, isPlayer ? h / 2 - 26 : -h / 2 + 10, w - 16, 12, 3);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 6); ctx.lineTo(0, h / 2 - 6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 12;
    if (isPlayer) {
      ctx.fillStyle = ctx.shadowColor = '#ffffff';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 2, 9, 4);
      ctx.fillRect(w / 2 - 13, -h / 2 + 2, 9, 4);
    }
    ctx.fillStyle = ctx.shadowColor = COLORS.red;
    ctx.fillRect(-w / 2 + 4, h / 2 - 6, 10, 4);
    ctx.fillRect(w / 2 - 14, h / 2 - 6, 10, 4);
    ctx.restore();
  }

  function drawTruck(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.shadowColor = o.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#0d0a22';
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 3;
    // Kabina
    rr(-o.w / 2 + 4, -o.h / 2, o.w - 8, 34, 8);
    ctx.fill(); ctx.stroke();
    // Tirkama
    rr(-o.w / 2, -o.h / 2 + 40, o.w, o.h - 40, 4);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = -o.h / 2 + 58; y < o.h / 2 - 8; y += 18) {
      ctx.moveTo(-o.w / 2 + 6, y); ctx.lineTo(o.w / 2 - 6, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 12;
    ctx.fillStyle = ctx.shadowColor = COLORS.red;
    ctx.fillRect(-o.w / 2 + 4, o.h / 2 - 6, 10, 4);
    ctx.fillRect(o.w / 2 - 14, o.h / 2 - 6, 10, 4);
    ctx.restore();
  }

  function drawBike(o) {
    drawCar(o.x, o.y, o.w, o.h, o.color, Math.cos(G.t * 3 + o.phase) * 0.25, false);
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = o.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(o.x, o.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    if (G.invuln > 0 && G.boostT <= 0 && Math.floor(G.t * 16) % 2 === 0) return;
    const color = skinColor(profile.selected, G.t);
    const h = G.jumpT > 0 ? Math.sin(Math.PI * (1 - G.jumpT / JUMP_TIME)) : 0;

    if (G.magnetT > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,59,92,${0.15 + 0.1 * Math.sin(G.t * 8)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = G.t * 40;
      ctx.beginPath();
      ctx.arc(G.px, PLAYER_Y, 120 + Math.sin(G.t * 6) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (h > 0) {
      // Soya
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.5 - h * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(G.px + h * 18, PLAYER_Y + h * 24, PW * 0.55, PH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    const s = 1 + h * 0.45;
    ctx.translate(G.px, PLAYER_Y);
    ctx.scale(s, s);
    ctx.translate(-G.px, -PLAYER_Y);
    drawCar(G.px, PLAYER_Y, PW, PH, color, G.tilt + h * Math.sin(G.t * 10) * 0.05, true);
    if (G.nitroOn && h === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fl = 18 + Math.random() * 16;
      const grd = ctx.createLinearGradient(0, PLAYER_Y + PH / 2, 0, PLAYER_Y + PH / 2 + fl);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.4, color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      for (const dx of [-12, 12]) {
        ctx.beginPath();
        ctx.moveTo(G.px + dx - 6, PLAYER_Y + PH / 2 - 2);
        ctx.lineTo(G.px + dx + 6, PLAYER_Y + PH / 2 - 2);
        ctx.lineTo(G.px + dx, PLAYER_Y + PH / 2 + fl);
        ctx.fill();
      }
      ctx.restore();
    }
    if (G.shield) {
      ctx.strokeStyle = COLORS.blue;
      ctx.shadowColor = COLORS.blue;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(G.t * 6);
      ctx.beginPath();
      ctx.ellipse(G.px, PLAYER_Y, PW * 0.95, PH * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBarrier(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.shadowColor = COLORS.orange;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#1a0d00';
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 3;
    rr(-o.w / 2, -o.h / 2, o.w, o.h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.clip();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,176,0,0.75)';
    for (let x = -o.w / 2 - o.h; x < o.w / 2; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, o.h / 2);
      ctx.lineTo(x + 10, o.h / 2);
      ctx.lineTo(x + 10 + o.h, -o.h / 2);
      ctx.lineTo(x + o.h, -o.h / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRamp(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = COLORS.violet;
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(178,107,255,0.18)';
    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, p.h / 2);
    ctx.lineTo(p.w / 2, p.h / 2);
    ctx.lineTo(p.w / 2 - 8, -p.h / 2);
    ctx.lineTo(-p.w / 2 + 8, -p.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    const off = (G.t * 30) % 14;
    for (let i = 0; i < 3; i++) {
      const y = p.h / 2 - 8 - i * 14 - off;
      if (y < -p.h / 2 + 4) continue;
      ctx.globalAlpha = 0.4 + i * 0.25;
      ctx.beginPath();
      ctx.moveTo(-12, y + 6); ctx.lineTo(0, y - 2); ctx.lineTo(12, y + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  const PICKUP_STYLE = {
    nitro:  { color: COLORS.green, label: 'N' },
    shield: { color: COLORS.blue,  label: '🛡' },
    magnet: { color: COLORS.red,   label: '🧲' },
  };

  function drawPickup(p) {
    if (p.kind === 'ramp') { drawRamp(p); return; }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'coin') {
      const sx = Math.abs(Math.cos(p.spin * 1.5));
      ctx.scale(0.35 + 0.65 * sx, 1);
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 14;
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a87900';
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const st = PICKUP_STYLE[p.kind];
    const pulse = 1 + Math.sin(p.spin * 2) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = st.color;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = st.color;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = p.spin * 0.5 + (i * Math.PI) / 3;
      const px = Math.cos(a) * p.r, py = Math.sin(a) * p.r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, 1);
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of G.texts) {
      ctx.font = `900 ${t.size}px system-ui, sans-serif`;
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function drawBanner() {
    const b = G.banner;
    if (!b) return;
    const a = clamp(Math.min(b.life * 2, 1), 0, 1);
    const pop = 1 + Math.max(0, b.life - (b.life > 2 ? 2 : 1.1)) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, 300);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-W / 2, -46, W, 84);
    ctx.font = '900 italic 40px system-ui, sans-serif';
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.fillText(b.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = b.color;
    ctx.fillText(b.sub, 0, 26);
    ctx.restore();
  }

  function drawCountdown() {
    const n = Math.ceil(G.count);
    const frac = G.count - Math.floor(G.count);
    const label = n > 0 ? String(n) : 'KETDIK!';
    ctx.save();
    ctx.translate(W / 2, H / 2 - 60);
    const s = 1 + frac * 0.6;
    ctx.scale(s, s);
    ctx.globalAlpha = n > 0 ? 0.4 + frac * 0.6 : clamp(1 + G.count * 2.5, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 italic ${n > 0 ? 110 : 64}px system-ui, sans-serif`;
    ctx.shadowColor = n > 0 ? COLORS.pink : COLORS.green;
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  const HINTS_KEYS = ['← → yoki A D — boshqarish', 'SPACE — NITRO (ochko x2)', "To'siq yonidan YAQIN o'ting — KOMBO!", '🛫 Tramplin — ustidan sakrab o\'ting'];
  const HINTS_TOUCH = ['Barmog\'ingizni suring — boshqarish', 'NITRO tugmasi — ochko x2', "To'siq yonidan YAQIN o'ting — KOMBO!", '🛫 Tramplin — ustidan sakrab o\'ting'];

  function drawHint() {
    if (profile.runs > 0 || state !== 'playing' || G.runT > 16) return;
    const idx = Math.floor(G.runT / 4);
    const list = isTouch ? HINTS_TOUCH : HINTS_KEYS;
    const text = list[idx];
    if (!text) return;
    const local = G.runT - idx * 4;
    ctx.save();
    ctx.globalAlpha = clamp(Math.min(local * 3, (4 - local) * 3), 0, 1);
    ctx.textAlign = 'center';
    ctx.font = '800 17px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 32;
    ctx.fillStyle = 'rgba(7,2,26,0.8)';
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    rr(W / 2 - tw / 2, 204, tw, 36, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, W / 2, 228);
    ctx.restore();
  }

  function drawHUD() {
    const z = ZONES[G.zone % ZONES.length];
    ctx.save();
    ctx.textBaseline = 'top';

    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#9a92c9';
    ctx.fillText('OCHKO', 54, 16);
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = z.lane;
    ctx.shadowBlur = 12;
    ctx.fillText(fmt(G.score), 54, 30);
    ctx.shadowBlur = 0;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = G.recordAnnounced ? COLORS.gold : '#9a92c9';
    ctx.fillText('REKORD ' + fmt(Math.max(G.best, G.score)), 54, 64);

    const bx = 54, by = 84, bw = 150, bh = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(bx, by, bw, bh, 5); ctx.fill();
    ctx.fillStyle = G.boostT > 0 ? COLORS.cyan : (G.nitro < 0.15 ? COLORS.red : COLORS.green);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    rr(bx, by, Math.max(0.001, bw * (G.boostT > 0 ? 1 : G.nitro)), bh, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(G.boostT > 0 ? 'RAKETA' : 'NITRO', bx + bw + 8, by);

    if (G.magnetT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      rr(bx, by + 16, bw, 6, 3); ctx.fill();
      ctx.fillStyle = COLORS.red;
      rr(bx, by + 16, Math.max(0.001, bw * (G.magnetT / G.magnetMax)), 6, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('MAGNIT', bx + bw + 8, by + 14);
    }

    ctx.textAlign = 'right';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 8;
    ctx.fillText('🪙 ' + G.coins, W - 54, 58);
    ctx.shadowBlur = 0;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#9a92c9';
    ctx.fillText('KM/S', W - 54, 84);
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = G.nitroOn ? COLORS.green : '#fff';
    ctx.shadowColor = G.nitroOn ? COLORS.green : z.edge;
    ctx.shadowBlur = 12;
    ctx.fillText(String(Math.round(G.speed * 0.25)), W - 54, 98);

    if (G.combo > 0) {
      ctx.textAlign = 'center';
      const pulse = 1 + Math.max(0, G.comboT - COMBO_TIME + 0.2) * 1.5;
      ctx.save();
      ctx.translate(W / 2, 150);
      ctx.scale(pulse, pulse);
      ctx.font = '900 italic 26px system-ui, sans-serif';
      ctx.fillStyle = COLORS.orange;
      ctx.shadowColor = COLORS.orange;
      ctx.shadowBlur = 16;
      ctx.fillText(`x${G.mult.toFixed(2).replace(/0$/, '')}`, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      rr(W / 2 - 50, 184, 100, 5, 2); ctx.fill();
      ctx.fillStyle = COLORS.orange;
      rr(W / 2 - 50, 184, Math.max(0.001, 100 * (G.comboT / COMBO_TIME)), 5, 2); ctx.fill();
    }

    const t = G.toasts[0];
    if (t) {
      const a = clamp(Math.min(t.life * 2, (2.6 - t.life) * 5), 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = '800 14px system-ui, sans-serif';
      const tw = Math.min(W - 40, ctx.measureText(t.text).width + 28);
      ctx.fillStyle = 'rgba(7,2,26,0.85)';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      rr(W / 2 - tw / 2, H - 120, tw, 32, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, W / 2, H - 112, W - 60);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function draw() {
    const z = ZONES[G.zone % ZONES.length];
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.save();
    if (G.shake > 0) {
      const s = G.shake * 14;
      ctx.translate(rand(-s, s), rand(-s, s));
    }
    drawBackground(z);
    for (const p of G.pickups) if (p.kind === 'ramp') drawPickup(p);
    for (const p of G.pickups) if (p.kind !== 'ramp') drawPickup(p);
    for (const o of G.obstacles) {
      if (o.type === 'car') drawCar(o.x, o.y, o.w, o.h, o.color, 0, false);
      else if (o.type === 'truck') drawTruck(o);
      else if (o.type === 'bike') drawBike(o);
      else drawBarrier(o);
    }
    if (state !== 'crashing' && state !== 'over' && state !== 'revive') drawPlayer();
    drawParticles();
    drawTexts();
    ctx.restore();

    if (G.flash > 0) {
      ctx.fillStyle = `rgba(${G.flashColor},${G.flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (G.slowT > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(255,176,0,${Math.min(0.35, G.slowT)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'countdown') drawCountdown();
    if (state === 'playing' || state === 'paused' || state === 'crashing' || state === 'countdown') {
      drawBanner();
      drawHint();
      drawHUD();
    }
  }

  // ---------- Ekranlar ----------
  const OVERLAYS = ['menu', 'garage', 'pause', 'over', 'revive'];
  function showOnly(id) {
    for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
    $('touch').classList.toggle('hidden', !(isTouch && id === null));
  }

  function renderMissions(el, summary) {
    el.textContent = '';
    const items = summary || profile.active.map((type) => ({
      type, target: missionTarget(type), reward: missionReward(type), value: null, done: false,
    }));
    for (const m of items) {
      const li = document.createElement('li');
      if (m.done) li.classList.add('done');
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = (m.done ? '✔ ' : '') + MISSION_TYPES[m.type].label(m.target);
      if (m.value !== null) {
        const bar = document.createElement('span');
        bar.className = 'bar';
        const fill = document.createElement('i');
        fill.style.width = Math.min(100, (m.value / m.target) * 100) + '%';
        bar.appendChild(fill);
        lbl.appendChild(bar);
      }
      const rw = document.createElement('span');
      rw.className = 'rw';
      rw.textContent = `+${m.reward}🪙`;
      li.append(lbl, rw);
      el.appendChild(li);
    }
  }

  let garageTab = 'skins';
  function renderGarage() {
    $('coinsGarage').textContent = fmt(profile.coins);
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === garageTab);
    $('skins').classList.toggle('hidden', garageTab !== 'skins');
    $('upgrades').classList.toggle('hidden', garageTab !== 'upgrades');

    const wrap = $('skins');
    wrap.textContent = '';
    for (const s of SKINS) {
      const owned = profile.owned.includes(s.id);
      const card = document.createElement('div');
      card.className = 'skin' + (profile.selected === s.id ? ' sel' : '');
      const car = document.createElement('div');
      car.className = 'car' + (s.color === 'rainbow' ? ' rainbow' : '');
      if (s.color !== 'rainbow') car.style.setProperty('--c', s.color);
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = s.name;
      const pk = document.createElement('div');
      pk.className = 'pk';
      pk.textContent = s.perk;
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (profile.selected === s.id) {
        btn.textContent = 'TANLANGAN';
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = 'TANLASH';
        btn.onclick = () => { profile.selected = s.id; saveProfile(); renderGarage(); Sound.init(); Sound.blip(660, 0.1); };
      } else {
        btn.textContent = `🪙 ${fmt(s.price)}`;
        btn.disabled = profile.coins < s.price;
        btn.onclick = () => {
          if (profile.coins < s.price) return;
          profile.coins -= s.price;
          profile.owned.push(s.id);
          profile.selected = s.id;
          saveProfile();
          renderGarage();
          Sound.init();
          Sound.jingle([523, 784, 1046]);
        };
      }
      card.append(car, nm, pk, btn);
      wrap.appendChild(card);
    }

    const up = $('upgrades');
    up.textContent = '';
    for (const [key, u] of Object.entries(UPGRADES)) {
      const lvl = upg(key);
      const row = document.createElement('div');
      row.className = 'upg';
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = u.name;
      const ds = document.createElement('div');
      ds.className = 'ds';
      ds.textContent = u.desc(lvl);
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < UPGRADE_MAX; i++) {
        const pip = document.createElement('i');
        if (i < lvl) pip.className = 'on';
        pips.appendChild(pip);
      }
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (lvl >= UPGRADE_MAX) {
        btn.textContent = 'MAKS';
        btn.disabled = true;
      } else {
        const cost = UPGRADE_COST[lvl];
        btn.textContent = `🪙 ${fmt(cost)}`;
        btn.disabled = profile.coins < cost;
        btn.onclick = () => {
          if (profile.coins < cost) return;
          profile.coins -= cost;
          profile.upgrades[key] = lvl + 1;
          saveProfile();
          renderGarage();
          Sound.init();
          Sound.jingle([523, 659, 784, 1046], 0.06);
        };
      }
      row.append(nm, btn, ds, pips);
      up.appendChild(row);
    }
  }

  function startGame() {
    Sound.init();
    G = newGame();
    G.count = 3;
    G.boostT = upg('boost') * 1.5;
    G.shield = !!perks().shield;
    state = 'countdown';
    showOnly(null);
    keys.clear();
  }

  function canRevive() {
    return !G.revived && profile.coins + G.coins >= REVIVE_COST;
  }

  function showRevive() {
    state = 'revive';
    G.reviveT = REVIVE_WAIT;
    $('reviveBar').style.width = '100%';
    showOnly('revive');
  }

  function doRevive() {
    if (state !== 'revive' || !canRevive()) return;
    let cost = REVIVE_COST;
    const fromRun = Math.min(G.coins, cost);
    G.coins -= fromRun;
    cost -= fromRun;
    profile.coins -= cost;
    saveProfile();
    G.revived = true;
    for (const o of G.obstacles) if (o.y > -100) { o.dead = true; burst(o.x, o.y, COLORS.cyan, 12, 200); }
    G.obstacles = G.obstacles.filter((o) => !o.dead);
    G.invuln = 2.5;
    G.speed = Math.max(G.speed, 380);
    G.banner = { text: 'DAVOM!', sub: 'Ikkinchi imkoniyat', life: 1.6, color: COLORS.gold };
    state = 'playing';
    showOnly(null);
    keys.clear();
    Sound.jingle([392, 523, 659, 784], 0.08);
  }

  function finishRun() {
    const summary = profile.active.map((type, i) => ({
      type,
      target: missionTarget(type),
      reward: missionReward(type),
      value: missionValue(type),
      done: G.missionsDone.has(i),
    }));
    const earned = G.coins + G.missionCoins;
    profile.coins += earned;
    profile.runs++;
    summary.forEach((m, i) => {
      if (!m.done) return;
      profile.levels[m.type] = (profile.levels[m.type] || 0) + 1;
      const pool = Object.keys(MISSION_TYPES).filter((t) => !profile.active.includes(t));
      if (pool.length && Math.random() < 0.6) profile.active[i] = pool[(Math.random() * pool.length) | 0];
    });
    saveProfile();
    return { summary, earned };
  }

  function nextGoalText() {
    const skin = SKINS.find((s) => !profile.owned.includes(s.id));
    if (skin) {
      const need = skin.price - profile.coins;
      return need > 0 ? `${skin.name} mashinasigacha yana ${fmt(need)} 🪙` : `${skin.name} mashinasini sotib olsa bo'ladi! 🚗`;
    }
    return '';
  }

  function countUp(el, to) {
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 800);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && state === 'over') requestAnimationFrame(step);
      else el.textContent = fmt(to);
    };
    requestAnimationFrame(step);
  }

  function showGameOver() {
    state = 'over';
    const score = Math.floor(G.score);
    const { summary, earned } = finishRun();
    countUp($('finalScore'), score);
    $('finalStats').textContent =
      `${(G.dist / KM_PX).toFixed(1)} km · ${G.nearMisses} yaqin o'tish · ${G.jumps} sakrash · maks. kombo x${G.maxMult.toFixed(2).replace(/0$/, '')} · ${G.zone + 1}-zona`;
    const goal = nextGoalText();
    $('earned').textContent = `+${earned} 🪙 tanga` +
      (G.missionCoins ? ` (vazifalardan ${G.missionCoins})` : '') + ` · Jami: ${fmt(profile.coins)}` +
      (goal ? `\n${goal}` : '');
    renderMissions($('missionsOver'), summary);
    renderLB($('lbOver'), null, 5);
    if (qualifies(score)) {
      $('nameForm').classList.remove('hidden');
      const input = $('nameInput');
      input.value = readJSON('nitro5.lastName', '') || '';
      showOnly('over');
      if (!isTouch) setTimeout(() => input.focus(), 50);
    } else {
      $('nameForm').classList.add('hidden');
      showOnly('over');
    }
  }

  function showMenu() {
    state = 'menu';
    G = newGame();
    const daily = claimDaily();
    const dEl = $('daily');
    if (daily) {
      dEl.textContent = `🎁 Kunlik sovg'a: +${daily.reward} tanga · ${daily.streak}-kun ketma-ket! Ertaga: +${daily.next}`;
      dEl.classList.remove('hidden');
    } else {
      dEl.classList.add('hidden');
    }
    $('coinsMenu').textContent = fmt(profile.coins);
    renderMissions($('missionsMenu'));
    renderLB($('lbMenu'), null, 5);
    showOnly('menu');
  }

  function showGarage() {
    state = 'garage';
    renderGarage();
    showOnly('garage');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      Sound.setEngine(0, false, false);
      Music.intensity = 0;
      showOnly('pause');
    } else if (state === 'paused') {
      state = 'playing';
      showOnly(null);
      keys.clear();
    }
  }

  function toggleMute() {
    Sound.setMuted(!Sound.muted);
    $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';
  }
  $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';

  $('nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nameInput').value.trim().slice(0, 12) || 'Poygachi';
    writeJSON('nitro5.lastName', name);
    const entry = addScore(name, Math.floor(G.score));
    $('nameForm').classList.add('hidden');
    $('nameInput').blur();
    renderLB($('lbOver'), entry, 5);
  });
  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', showMenu);
  $('garageBtn').addEventListener('click', () => { Sound.init(); showGarage(); });
  $('garageBack').addEventListener('click', showMenu);
  $('resumeBtn').addEventListener('click', togglePause);
  $('quitBtn').addEventListener('click', showMenu);
  $('reviveBtn').addEventListener('click', doRevive);
  $('skipBtn').addEventListener('click', () => { if (state === 'revive') showGameOver(); });
  $('muteBtn').addEventListener('click', (e) => { e.currentTarget.blur(); Sound.init(); toggleMute(); });
  for (const t of document.querySelectorAll('.tab')) {
    t.addEventListener('click', () => { garageTab = t.dataset.tab; renderGarage(); });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  // ---------- Asosiy sikl ----------
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.slowT > 0) { G.slowT -= dt; dt *= 0.35; }
    if (state !== 'paused' && state !== 'over') update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  showMenu();
  requestAnimationFrame(frame);
})();
