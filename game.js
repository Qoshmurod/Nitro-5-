/* NITRO 5 — neon arkada poyga o'yini
 * Toza JavaScript + Canvas 2D, hech qanday kutubxonasiz.
 *
 * O'yinni qiziqarli qiluvchi tizimlar:
 *  - Kombo: ketma-ket "yaqin o'tishlar" ochko multiplikatorini oshiradi (x5 gacha)
 *  - Tangalar + Garaj: yig'ilgan tangalar saqlanadi, yangi mashinalar ochiladi
 *  - Vazifalar: 3 ta faol vazifa, bajarilsa tanga beriladi va qiyinroq vazifa keladi
 *  - Bonuslar: nitro, qalqon (bir urilishdan himoya), magnit (tangalarni tortadi)
 *  - Zonalar: har 30 soniyada yangi rangli dunyo va tezlik oshadi
 */
(() => {
  'use strict';

  // ---------- Asosiy o'lchamlar ----------
  const W = 480, H = 800;
  const ROAD_L = 40, ROAD_R = 440, LANES = 4;
  const LANE_W = (ROAD_R - ROAD_L) / LANES;
  const PW = 44, PH = 80;
  const PLAYER_Y = H - 170;
  const ZONE_TIME = 30;           // har bir zona necha soniya
  const COMBO_TIME = 2.6;         // kombo saqlanib turadigan vaqt
  const NEAR_GAP = 22;            // "yaqin o'tish" masofasi (px)
  const KM_PX = 10000;            // 1 "km" necha piksel

  const COLORS = {
    cyan: '#00f0ff', pink: '#ff2bd6', green: '#39ff88', gold: '#ffd23f',
    orange: '#ffb000', purple: '#7a5cff', red: '#ff3b5c', blue: '#4da3ff',
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
    { id: 'cyan',    name: "Neon Ko'k", color: '#00f0ff', price: 0 },
    { id: 'green',   name: 'Zahar',     color: '#39ff88', price: 150 },
    { id: 'gold',    name: 'Oltin',     color: '#ffd23f', price: 400 },
    { id: 'violet',  name: 'Binafsha',  color: '#b26bff', price: 800 },
    { id: 'ghost',   name: 'Arvoh',     color: '#ffffff', price: 1500 },
    { id: 'rainbow', name: 'Kamalak',   color: 'rainbow', price: 3000 },
  ];

  const MISSION_TYPES = {
    dist:  { label: (t) => `Bir poygada ${t} km yuring`,        base: 1,    step: 1,    reward: 40 },
    near:  { label: (t) => `${t} marta yaqin o'ting`,           base: 3,    step: 3,    reward: 50 },
    coins: { label: (t) => `${t} ta tanga yig'ing`,             base: 15,   step: 15,   reward: 40 },
    nitro: { label: (t) => `Nitroni ${t} soniya ishlating`,     base: 5,    step: 5,    reward: 40 },
    score: { label: (t) => `${t.toLocaleString('uz')} ochko to'plang`, base: 1500, step: 1500, reward: 60 },
    combo: { label: (t) => `x${t} kombo multiplikatorga yeting`, base: 2,   step: 1,    reward: 70, max: 5 },
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const laneX = (i) => ROAD_L + LANE_W * (i + 0.5);
  const fmt = (n) => Math.floor(n).toLocaleString('uz');

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

  // ---------- Saqlash (localStorage, xatolarga chidamli) ----------
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* saqlab bo'lmadi */ }
  }

  // ---------- Profil: tangalar, mashinalar, vazifalar ----------
  const PROFILE_KEY = 'nitro5.profile.v1';
  function defaultProfile() {
    return {
      coins: 0, owned: ['cyan'], selected: 'cyan', runs: 0,
      levels: { dist: 0, near: 0, coins: 0, nitro: 0, score: 0, combo: 0 },
      active: ['dist', 'near', 'coins'],
    };
  }
  function loadProfile() {
    const p = readJSON(PROFILE_KEY, null);
    const d = defaultProfile();
    if (!p || typeof p !== 'object') return d;
    const out = {
      coins: Number.isFinite(p.coins) ? Math.max(0, p.coins) : 0,
      owned: Array.isArray(p.owned) ? p.owned.filter((id) => SKINS.some((s) => s.id === id)) : d.owned,
      selected: typeof p.selected === 'string' ? p.selected : 'cyan',
      runs: Number.isFinite(p.runs) ? p.runs : 0,
      levels: Object.assign({}, d.levels, p.levels && typeof p.levels === 'object' ? p.levels : {}),
      active: Array.isArray(p.active) ? p.active.filter((t) => MISSION_TYPES[t]) : d.active,
    };
    if (!out.owned.includes('cyan')) out.owned.unshift('cyan');
    if (!out.owned.includes(out.selected)) out.selected = 'cyan';
    for (const t of Object.keys(MISSION_TYPES)) {
      if (out.active.length >= 3) break;
      if (!out.active.includes(t)) out.active.push(t);
    }
    out.active = [...new Set(out.active)].slice(0, 3);
    return out;
  }
  let profile = loadProfile();
  const saveProfile = () => writeJSON(PROFILE_KEY, profile);

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
      case 'coins': return G.coins;
      case 'nitro': return G.nitroTime;
      case 'score': return G.score;
      case 'combo': return G.maxMult;
      default: return 0;
    }
  }
  function skinColor(id, t) {
    const s = SKINS.find((k) => k.id === id) || SKINS[0];
    return s.color === 'rainbow' ? `hsl(${(t * 140) % 360}, 100%, 60%)` : s.color;
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

  // ---------- Ovoz (Web Audio) ----------
  const Sound = {
    ac: null, engine: null, engineGain: null, filter: null, muted: false,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.filter = this.ac.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 600;
        this.engineGain = this.ac.createGain();
        this.engineGain.gain.value = 0;
        this.engine = this.ac.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 60;
        this.engine.connect(this.filter).connect(this.engineGain).connect(this.ac.destination);
        this.engine.start();
      } catch { this.ac = null; }
    },
    setEngine(speed, on, nitro) {
      if (!this.ac) return;
      const t = this.ac.currentTime;
      const vol = on && !this.muted ? (nitro ? 0.05 : 0.03) : 0;
      this.engineGain.gain.setTargetAtTime(vol, t, 0.08);
      this.engine.frequency.setTargetAtTime(40 + speed * 0.09, t, 0.1);
      this.filter.frequency.setTargetAtTime(nitro ? 1400 : 700, t, 0.1);
    },
    blip(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ac.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    jingle(notes, gap = 0.09) {
      notes.forEach((f, i) => this.blip(f, 0.14, 'square', 0.05, 0, i * gap));
    },
    noise(dur = 0.6, vol = 0.25) {
      if (!this.ac || this.muted) return;
      const len = Math.floor(this.ac.sampleRate * dur);
      const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = this.ac.createBufferSource();
      src.buffer = buf;
      const g = this.ac.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.ac.destination);
      src.start();
    },
    crash() { this.noise(0.6, 0.25); this.blip(180, 0.5, 'sawtooth', 0.08, -150); },
  };

  // ---------- Kiritish ----------
  const keys = new Set();
  const touch = { left: false, right: false, nitro: false };
  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyA', 'KeyD', 'KeyW'];

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyP') togglePause();
    else if (e.code === 'Escape') {
      if (state === 'garage') showMenu();
      else togglePause();
    } else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'Enter' || e.code === 'Space') {
      if (state === 'menu') startGame();
      else if (state === 'paused') togglePause();
      else if (state === 'over' && $('nameForm').classList.contains('hidden')) startGame();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); touch.left = touch.right = touch.nitro = false; });

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

  // ---------- O'yin holati ----------
  // menu | garage | countdown | playing | paused | crashing | over
  let state = 'menu';
  let G = null;

  function newGame() {
    return {
      t: 0, runT: 0, speed: 260, dist: 0, score: 0,
      nitro: 1, nitroOn: false, nitroTime: 0,
      px: laneX(1.5), vx: 0, tilt: 0,
      obstacles: [], pickups: [], particles: [], texts: [], toasts: [],
      spawnAcc: 0, nextGap: 380,
      shake: 0, roadOffset: 0, crashT: 0, count: 0,
      nearMisses: 0, coins: 0, missionCoins: 0, pickupsTaken: 0, flash: 0, flashColor: '57,255,136',
      combo: 0, comboT: 0, mult: 1, maxMult: 1,
      shield: false, invuln: 0, magnetT: 0,
      zone: 0, banner: null,
      best: loadLB()[0]?.score || 0, recordAnnounced: false,
      missionsDone: new Set(),
    };
  }
  G = newGame();

  // ---------- Obyektlarni yaratish ----------
  function spawnRow() {
    const diff = Math.min(1, G.runT / 120);
    let count = 1;
    const r = Math.random();
    if (r < 0.18 * diff) count = 3;
    else if (r < 0.35 + diff * 0.35) count = 2;

    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const busy = lanes.slice(0, count);
    const free = lanes.slice(count);

    for (const lane of busy) {
      if (Math.random() < 0.62) {
        const o = {
          type: 'car', lane, x: laneX(lane), y: -60,
          w: 44, h: 78, own: rand(110, 250),
          color: ENEMY_COLORS[(Math.random() * ENEMY_COLORS.length) | 0],
          targetX: null, passed: false,
        };
        if (count === 1 && diff > 0.2 && Math.random() < 0.4 * diff) {
          const nb = lane + (Math.random() < 0.5 ? -1 : 1);
          if (nb >= 0 && nb < LANES) o.targetX = laneX(nb);
        }
        G.obstacles.push(o);
      } else {
        G.obstacles.push({
          type: 'barrier', lane, x: laneX(lane), y: -30,
          w: LANE_W - 22, h: 26, own: 0, passed: false,
        });
      }
    }

    // Bo'sh qatorlarga bonuslar
    const shuffledFree = free.sort(() => Math.random() - 0.5);
    const lane = shuffledFree[0];
    if (lane === undefined) return;
    const roll = Math.random();
    if (roll < 0.38) {
      for (let i = 0; i < 4; i++) G.pickups.push({ kind: 'coin', x: laneX(lane), y: -40 - i * 45, r: 10, spin: i });
    } else if (roll < 0.52) {
      G.pickups.push({ kind: 'nitro', x: laneX(lane), y: -40, r: 16, spin: 0 });
    } else if (roll < 0.57 && !G.shield) {
      G.pickups.push({ kind: 'shield', x: laneX(lane), y: -40, r: 17, spin: 0 });
    } else if (roll < 0.62 && G.magnetT <= 0) {
      G.pickups.push({ kind: 'magnet', x: laneX(lane), y: -40, r: 17, spin: 0 });
    }
    // Ikkinchi bo'sh qatorda ham ba'zan tangalar
    if (shuffledFree[1] !== undefined && Math.random() < 0.2) {
      const l2 = shuffledFree[1];
      for (let i = 0; i < 3; i++) G.pickups.push({ kind: 'coin', x: laneX(l2), y: -40 - i * 45, r: 10, spin: i });
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

  // ---------- Yangilash ----------
  function update(dt) {
    G.t += dt;
    const playing = state === 'playing';
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
      G.nitroOn = wantNitro && G.nitro > 0.01;
      if (G.nitroOn) { G.nitro = Math.max(0, G.nitro - 0.38 * dt); G.nitroTime += dt; }
      else G.nitro = Math.min(1, G.nitro + 0.025 * dt);
      const target = base * (G.nitroOn ? 1.65 : 1);
      G.speed += (target - G.speed) * Math.min(1, dt * 3);

      // Boshqaruv
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      G.vx += dir * 2800 * dt;
      G.vx *= Math.pow(0.0006, dt);
      G.vx = clamp(G.vx, -560, 560);
      G.px += G.vx * dt;
      const minX = ROAD_L + PW / 2 + 4, maxX = ROAD_R - PW / 2 - 4;
      if (G.px < minX || G.px > maxX) {
        G.px = clamp(G.px, minX, maxX);
        if (Math.abs(G.vx) > 120) {
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

      // Kombo
      if (G.comboT > 0) {
        G.comboT -= dt;
        if (G.comboT <= 0) {
          if (G.combo >= 4) floatText(W / 2, 200, 'KOMBO TUGADI', '#9a92c9', 18);
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

      // Chiqindi gaz / nitro olovi
      const n = G.nitroOn ? 4 : 1;
      for (let i = 0; i < n; i++) {
        addParticle({
          x: G.px + rand(-8, 8), y: PLAYER_Y + PH / 2,
          vx: rand(-30, 30), vy: rand(200, 420) + (G.nitroOn ? 200 : 0),
          life: rand(0.15, 0.4), max: 0.4, size: G.nitroOn ? rand(3, 6) : rand(2, 3),
          color: G.nitroOn ? (Math.random() < 0.5 ? playerColor : '#ffffff') : COLORS.pink,
        });
      }
    } else if (state === 'menu' || state === 'garage') {
      G.speed = 260;
      G.px = laneX(1.5) + Math.sin(G.t * 0.8) * 60;
      G.tilt = Math.cos(G.t * 0.8) * 0.08;
      addParticle({
        x: G.px + rand(-6, 6), y: PLAYER_Y + PH / 2, vx: rand(-20, 20), vy: rand(200, 300),
        life: 0.3, max: 0.3, size: 2, color: COLORS.pink,
      });
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
      if (G.count <= -0.4) state = 'playing';
      addParticle({
        x: G.px + rand(-6, 6), y: PLAYER_Y + PH / 2, vx: rand(-20, 20), vy: rand(200, 300),
        life: 0.3, max: 0.3, size: 2, color: COLORS.pink,
      });
    } else if (state === 'crashing') {
      G.speed *= Math.pow(0.05, dt);
      G.crashT -= dt;
      if (G.crashT <= 0) showGameOver();
    }

    G.roadOffset = (G.roadOffset + G.speed * dt) % 80;

    // To'siqlar
    const pl = G.px - PW / 2 + 6, pr = G.px + PW / 2 - 6;
    const pt = PLAYER_Y - PH / 2 + 6, pb = PLAYER_Y + PH / 2 - 6;
    for (const o of G.obstacles) {
      o.y += (G.speed - (state === 'crashing' ? 0 : o.own)) * dt;
      if (o.targetX !== null && o.y > 60) {
        const d = o.targetX - o.x;
        o.x += Math.sign(d) * Math.min(Math.abs(d), 70 * dt);
      }
      if (!playing || o.dead) continue;
      const ol = o.x - o.w / 2, or = o.x + o.w / 2, ot = o.y - o.h / 2, ob = o.y + o.h / 2;
      if (pr > ol && pl < or && pb > ot && pt < ob) {
        if (G.invuln > 0) continue;
        if (G.shield) {
          G.shield = false;
          G.invuln = 1.2;
          o.dead = true;
          G.shake = 0.5;
          explode(o.x, o.y);
          floatText(G.px, PLAYER_Y - 70, 'QALQON SAQLADI!', COLORS.blue);
          Sound.noise(0.3, 0.15);
          Sound.blip(300, 0.3, 'sine', 0.08, 400);
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
          }
          Sound.blip(600 + Math.min(G.combo, 16) * 60, 0.08, 'square', 0.045);
        }
      }
    }
    G.obstacles = G.obstacles.filter((o) => !o.dead && o.y < H + 120);

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
      if (Math.hypot(p.x - G.px, p.y - PLAYER_Y) < p.r + 30) {
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

    Sound.setEngine(G.speed, state === 'playing', G.nitroOn);
  }

  function collect(p) {
    switch (p.kind) {
      case 'coin':
        G.coins++;
        G.score += 10 * G.mult;
        burst(p.x, p.y, COLORS.gold, 8, 120);
        Sound.blip(1200 + (G.coins % 5) * 80, 0.06, 'square', 0.03);
        break;
      case 'nitro':
        G.nitro = Math.min(1, G.nitro + 0.4);
        G.score += 25;
        G.pickupsTaken++;
        G.flash = 0.25; G.flashColor = '57,255,136';
        floatText(p.x, p.y - 20, 'NITRO +40%', COLORS.green);
        burst(p.x, p.y, COLORS.green);
        Sound.blip(440, 0.18, 'sine', 0.08, 660);
        break;
      case 'shield':
        G.shield = true;
        G.pickupsTaken++;
        floatText(p.x, p.y - 20, 'QALQON', COLORS.blue);
        burst(p.x, p.y, COLORS.blue);
        Sound.blip(330, 0.25, 'sine', 0.08, 330);
        break;
      case 'magnet':
        G.magnetT = 8;
        G.pickupsTaken++;
        floatText(p.x, p.y - 20, 'MAGNIT 8s', COLORS.red);
        burst(p.x, p.y, COLORS.red);
        Sound.blip(260, 0.25, 'triangle', 0.08, 520);
        break;
    }
  }

  function crash() {
    state = 'crashing';
    G.crashT = 1.1;
    G.shake = 1;
    G.nitroOn = false;
    explode(G.px, PLAYER_Y);
    Sound.crash();
    Sound.setEngine(0, false, false);
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
    rr(-w / 2, -h / 2, w, h, 10);
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

  function drawPlayer() {
    if (G.invuln > 0 && Math.floor(G.t * 16) % 2 === 0) return; // miltillash
    const color = skinColor(profile.selected, G.t);
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
    drawCar(G.px, PLAYER_Y, PW, PH, color, G.tilt, true);
    if (G.shield) {
      ctx.save();
      ctx.strokeStyle = COLORS.blue;
      ctx.shadowColor = COLORS.blue;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(G.t * 6);
      ctx.beginPath();
      ctx.ellipse(G.px, PLAYER_Y, PW * 0.95, PH * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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

  const PICKUP_STYLE = {
    nitro:  { color: COLORS.green, label: 'N' },
    shield: { color: COLORS.blue,  label: '🛡' },
    magnet: { color: COLORS.red,   label: '🧲' },
  };

  function drawPickup(p) {
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
    const pop = 1 + Math.max(0, b.life - 1.8) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, 290);
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

  function drawHUD() {
    const z = ZONES[G.zone % ZONES.length];
    ctx.save();
    ctx.textBaseline = 'top';

    // Ochko
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

    // Nitro shkalasi
    const bx = 54, by = 84, bw = 150, bh = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(bx, by, bw, bh, 5); ctx.fill();
    ctx.fillStyle = G.nitro < 0.15 ? COLORS.red : COLORS.green;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    rr(bx, by, Math.max(0.001, bw * G.nitro), bh, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('NITRO', bx + bw + 8, by);

    // Magnit taymeri
    if (G.magnetT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      rr(bx, by + 16, bw, 6, 3); ctx.fill();
      ctx.fillStyle = COLORS.red;
      rr(bx, by + 16, Math.max(0.001, bw * (G.magnetT / 8)), 6, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('MAGNIT', bx + bw + 8, by + 14);
    }

    // O'ng tomon: tangalar va tezlik
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

    // Kombo
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

    // Vazifa bildirishnomasi
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
      rr(W / 2 - tw / 2, H - 92, tw, 32, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, W / 2, H - 84, W - 60);
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
    for (const p of G.pickups) drawPickup(p);
    for (const o of G.obstacles) {
      if (o.type === 'car') drawCar(o.x, o.y, o.w, o.h, o.color, 0, false);
      else drawBarrier(o);
    }
    if (state !== 'crashing' && state !== 'over') drawPlayer();
    drawParticles();
    drawTexts();
    ctx.restore();

    if (G.flash > 0) {
      ctx.fillStyle = `rgba(${G.flashColor},${G.flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'countdown') drawCountdown();
    if (state === 'playing' || state === 'paused' || state === 'crashing' || state === 'countdown') {
      drawBanner();
      drawHUD();
    }
  }

  // ---------- Ekranlar ----------
  const OVERLAYS = ['menu', 'garage', 'pause', 'over'];
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

  function renderGarage() {
    $('coinsGarage').textContent = fmt(profile.coins);
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
      card.append(car, nm, btn);
      wrap.appendChild(card);
    }
  }

  function startGame() {
    Sound.init();
    G = newGame();
    G.count = 3;
    state = 'countdown';
    showOnly(null);
    keys.clear();
  }

  function finishRun() {
    // Vazifalar natijasini yig'ish va yangilarini tanlash
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

  function showGameOver() {
    state = 'over';
    const score = Math.floor(G.score);
    const { summary, earned } = finishRun();
    $('finalScore').textContent = fmt(score);
    $('finalStats').textContent =
      `${(G.dist / KM_PX).toFixed(1)} km · ${G.nearMisses} yaqin o'tish · maks. kombo x${G.maxMult.toFixed(2).replace(/0$/, '')} · ${G.zone + 1}-zona`;
    $('earned').textContent = `+${earned} 🪙 tanga` +
      (G.missionCoins ? ` (vazifalardan ${G.missionCoins})` : '') + ` · Jami: ${fmt(profile.coins)}`;
    renderMissions($('missionsOver'), summary);
    renderLB($('lbOver'), null, 5);
    if (qualifies(score)) {
      $('nameForm').classList.remove('hidden');
      const input = $('nameInput');
      input.value = readJSON('nitro5.lastName', '') || '';
      showOnly('over');
      setTimeout(() => input.focus(), 50);
    } else {
      $('nameForm').classList.add('hidden');
      showOnly('over');
    }
  }

  function showMenu() {
    state = 'menu';
    G = newGame();
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
      showOnly('pause');
    } else if (state === 'paused') {
      state = 'playing';
      showOnly(null);
      keys.clear();
    }
  }

  function toggleMute() {
    Sound.muted = !Sound.muted;
    $('muteBtn').textContent = Sound.muted ? '🔇' : '🔊';
    if (Sound.muted) Sound.setEngine(0, false, false);
  }

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
  $('garageBtn').addEventListener('click', showGarage);
  $('garageBack').addEventListener('click', showMenu);
  $('resumeBtn').addEventListener('click', togglePause);
  $('quitBtn').addEventListener('click', showMenu);
  $('muteBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggleMute(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  // ---------- Asosiy sikl ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state !== 'paused' && state !== 'over') update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  showMenu();
  requestAnimationFrame(frame);

  // Test uchun (konsoldan holatni ko'rish)
  window.__nitro = { get state() { return state; }, get game() { return G; }, get profile() { return profile; } };
})();
