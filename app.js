/* Todo — to-do ludique et déculpabilisante pour les TDAH.
   Tout est stocké sur l'appareil (localStorage). */
(() => {
'use strict';

/* ================= CONFIG ================= */
// URL du Cloudflare Worker (Grok). Vide = découpage local uniquement.
// Modifiable aussi dans Réglages.
const DEFAULT_API_URL = '';

const STORE_KEY = 'todo.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= ÉTAT ================= */
const defaultState = () => ({
  onboarded: false,
  profile: null,          // montagne | brouillard | panne
  passions: [],
  battery: 3,             // 1..5
  batteryDay: null,
  tasks: [],              // {id,title,steps:[{id,t,mins,done}],later,status:'active'|'fridge'|'done',createdAt}
  xp: 0,
  days: [],               // jours actifs (une pause ne casse rien)
  badges: [],
  stats: { done: 0, steps: 0, slices: 0, roulette: 0, voice: 0, rescued: 0, bonus: 0 },
  boost: 1,               // multiplicateur XP de la prochaine tâche (bonus)
  settings: { sound: true, vibe: true, apiUrl: DEFAULT_API_URL },
});

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = defaultState(), p = JSON.parse(raw);
      return { ...d, ...p, stats: { ...d.stats, ...p.stats }, settings: { ...d.settings, ...p.settings } };
    }
  } catch (e) { /* stockage indisponible : on continue en mémoire */ }
  return defaultState();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }

/* ================= DONNÉES ================= */
const PROFILES = {
  montagne: { emo: '⛰️', name: 'La Montagne', desc: 'Les grosses tâches me paralysent.' },
  brouillard: { emo: '🌫️', name: 'Le Brouillard', desc: 'Je ne sais pas par où commencer.' },
  panne: { emo: '🪫', name: 'La Panne Sèche', desc: "Je n'ai aucune motivation, zéro dopamine." },
};
const PASSIONS = ['🎵 Musique', '🎮 Jeux vidéo', '⚽ Sport', '🎨 Dessin', '🐶 Animaux', '📺 Séries / mangas', '🍳 Cuisine', '💃 Danse', '🌿 Nature', '💻 Tech / code', '📚 Lecture', '📸 Photo / vidéo'];
const BATTERY = [
  { lab: 'Presque à plat', emo: '🪫', mins: 2 },
  { lab: 'Faible', emo: '🔋', mins: 3 },
  { lab: 'Moyenne', emo: '🔋', mins: 5 },
  { lab: 'Bonne', emo: '⚡', mins: 7 },
  { lab: 'À fond !', emo: '🚀', mins: 10 },
];
const BADGES = [
  { id: 'first', emo: '🌱', name: 'Premier pas', test: () => S.stats.done >= 1 },
  { id: 'five', emo: '🔥', name: '5 tâches', test: () => S.stats.done >= 5 },
  { id: 'twentyfive', emo: '💎', name: '25 tâches', test: () => S.stats.done >= 25 },
  { id: 'steps50', emo: '👣', name: '50 étapes', test: () => S.stats.steps >= 50 },
  { id: 'slicer', emo: '🔪', name: 'Découpeur', test: () => S.stats.slices >= 1 },
  { id: 'boss', emo: '🐉', name: 'Boss battu', test: () => S.stats.bossDown >= 1 },
  { id: 'roulette', emo: '🎰', name: 'Joueur', test: () => S.stats.roulette >= 1 },
  { id: 'voice', emo: '🎤', name: 'Vide-tête', test: () => S.stats.voice >= 1 },
  { id: 'rescue', emo: '🧊', name: 'Sauveteur', test: () => S.stats.rescued >= 1 },
  { id: 'bonus', emo: '🎁', name: 'Chanceux', test: () => S.stats.bonus >= 1 },
  { id: 'days3', emo: '📅', name: '3 jours', test: () => S.days.length >= 3 },
  { id: 'days7', emo: '🌈', name: '7 jours', test: () => S.days.length >= 7 },
];
const MICRO_TASKS = [
  'Bois un grand verre d\'eau', 'Range 3 objets autour de toi', 'Ouvre la fenêtre 1 minute',
  'Jette un papier qui traîne', 'Étire-toi 30 secondes', 'Mets ton téléphone en mode silencieux 5 min',
  'Écris une seule idée sur un papier', 'Prépare ta tenue de demain', 'Fais ton lit en mode rapide',
];
const SAMPLE_DUMPS = [
  "faut que je fasse mes devoirs de maths et aussi appeler mamie, ranger ma chambre parce que c'est le chaos, puis réviser l'histoire pour jeudi, et racheter du dentifrice",
  "répondre au mail du prof, préparer mon sac pour demain, laver mes baskets, faire le dossier d'inscription, sortir le chien",
  "je dois payer la facture d'électricité, faire le ménage dans la cuisine, écrire mon exposé sur les volcans, prendre rendez-vous chez le dentiste",
];

/* ================= SPIKY (mascotte) ================= */
const SPIKY_SVG = `
<svg class="spiky" viewBox="0 0 100 100" aria-hidden="true">
  <g class="body">
    <path d="M58 4 L22 54 L44 54 L36 96 L78 40 L55 40 L66 4 Z" fill="#4FD1A5" stroke="#2A2925" stroke-width="4" stroke-linejoin="round"/>
    <path d="M56 12 L32 47" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
    <ellipse class="eye" cx="44" cy="44" rx="3.6" ry="5" fill="#2A2925"/>
    <ellipse class="eye" cx="58" cy="44" rx="3.6" ry="5" fill="#2A2925"/>
    <circle cx="39" cy="52" r="3" fill="#F4A3A3" opacity=".7"/>
    <circle cx="63" cy="52" r="3" fill="#F4A3A3" opacity=".7"/>
    <path class="mouth-smile" d="M46 53 Q51 58 56 53" stroke="#2A2925" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path class="mouth-happy" d="M45 52 Q51 62 57 52 Z" fill="#2A2925"/>
    <ellipse class="mouth-o" cx="51" cy="55" rx="3" ry="3.6" fill="#2A2925"/>
    <g class="acc acc-spark"><path d="M84 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#4FD1A5" stroke="#2A2925" stroke-width="2"/></g>
    <g class="acc acc-crown"><path d="M48 2 l4 -8 5 6 5 -6 3 9 z" fill="#4FD1A5" stroke="#2A2925" stroke-width="2.5" stroke-linejoin="round"/></g>
  </g>
</svg>`;
function mountSpiky() { $$('[data-spiky]').forEach(el => { el.innerHTML = SPIKY_SVG; }); refreshSpikyLevel(); }
function refreshSpikyLevel() {
  const lv = levelInfo().level;
  $$('.spiky').forEach(s => { s.classList.toggle('lv3', lv >= 3); s.classList.toggle('lv5', lv >= 5); });
}
let moodTimer;
function mood(m, ms = 2500) {
  $$('.spiky').forEach(s => { s.classList.remove('listen', 'think', 'cheer', 'calm'); if (m) { void s.offsetWidth; s.classList.add(m); } });
  clearTimeout(moodTimer);
  if (m && ms) moodTimer = setTimeout(() => mood(null), ms);
}
function say(txt, m) { $$('[data-bubble]').forEach(b => { b.textContent = txt; }); if (m) mood(m); }

/* ================= SONS / VIBRATIONS ================= */
let actx;
function beep(notes = [660], dur = 0.09, type = 'sine') {
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * dur;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch (e) {}
}
const sfx = {
  tap: () => beep([520], 0.05),
  step: () => beep([660, 880], 0.08),
  win: () => beep([523, 659, 784, 1047], 0.1, 'triangle'),
  spin: () => beep([440], 0.03, 'square'),
  soft: () => beep([392, 330], 0.1),
};
function buzz(p = 15) { if (S.settings.vibe && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

/* ================= CONFETTIS ================= */
const cv = $('#confetti'), cx = cv.getContext('2d');
let parts = [], raf;
function confetti(n = 90) {
  const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
  const cols = ['#4FD1A5', '#146B50', '#D5F3E7', '#2A2925', '#FFFBF4'];
  for (let i = 0; i < n; i++) parts.push({
    x: cv.width / 2, y: cv.height * 0.45, vx: (Math.random() - .5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 4) * devicePixelRatio,
    s: (5 + Math.random() * 6) * devicePixelRatio, c: pick(cols), r: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 120,
  });
  if (!raf) tick();
}
function tick() {
  cx.clearRect(0, 0, cv.width, cv.height);
  parts.forEach(p => { p.vy += 0.5 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= .98; p.r += p.vr; p.life--;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.globalAlpha = Math.min(1, p.life / 40); cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6); cx.restore(); });
  parts = parts.filter(p => p.life > 0 && p.y < cv.height + 40);
  raf = parts.length ? requestAnimationFrame(tick) : (cx.clearRect(0, 0, cv.width, cv.height), null);
}

/* ================= TOAST / MODALE ================= */
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }
function openModal(html) { $('#modal-card').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal-card').innerHTML = ''; }

/* ================= XP / NIVEAUX / BADGES ================= */
function levelInfo(xp = S.xp) {
  let level = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; level++; need += 50; }
  return { level, rest, need };
}
function addXp(n) {
  const before = levelInfo().level;
  S.xp += n;
  const after = levelInfo().level;
  markDay();
  if (after > before) {
    setTimeout(() => {
      sfx.win(); confetti(140); buzz([30, 40, 30]);
      say(`NIVEAU ${after} ! Je me sens plus fort, grâce à toi ⚡`, 'cheer');
      refreshSpikyLevel();
    }, 600);
  }
  checkBadges(); renderHeader(); save();
}
function markDay() { const d = today(); if (!S.days.includes(d)) S.days.push(d); }
function checkBadges() {
  BADGES.forEach(b => {
    if (!S.badges.includes(b.id) && b.test()) {
      S.badges.push(b.id);
      setTimeout(() => toast(`Badge débloqué : ${b.emo} ${b.name}`), 900);
    }
  });
}

/* ================= DÉCOUPAGE (règles locales) ================= */
const FILLERS = /^(alors|bon|euh+|donc|et|puis|aussi|ensuite|après|enfin|ah|oh|ouais|genre|du coup|faut aussi|faudrait|faut que je|il faut que je|il faudrait que je|je dois|je devrais|je vais|il faut|faut|penser à|ne pas oublier de|oublier pas de|n'oublie pas de|j'ai|que je|de)\s+/i;
const HEAVY = /(ranger|nettoyer|ménage|menage|réviser|reviser|révision|dossier|projet|préparer|preparer|organiser|écrire|ecrire|exposé|expose|devoirs?|rapport|impôts|impots|déménag|demenag|trier|chambre|cuisine|cv|candidature|lessive|courses|mémoire|memoire)/i;

// "faut que je fasse" -> "faire"
const VERB_FIX = { fasse: 'faire', aille: 'aller', prenne: 'prendre', appelle: 'appeler', range: 'ranger', écrive: 'écrire', ecrive: 'écrire', finisse: 'finir', rende: 'rendre', envoie: 'envoyer', paie: 'payer', paye: 'payer', lise: 'lire', voie: 'voir', mette: 'mettre', sorte: 'sortir', achète: 'acheter', réponde: 'répondre', reponde: 'répondre', révise: 'réviser', revise: 'réviser', nettoie: 'nettoyer', prépare: 'préparer', prepare: 'préparer', lave: 'laver', fais: 'faire', vais: 'aller' };
function cleanChunk(s) {
  let t = s.trim().replace(/\s+/g, ' ');
  for (let i = 0; i < 4; i++) t = t.replace(FILLERS, '');
  t = t.replace(/\s*(parce que|car|vu que|comme ça).*$/i, '').replace(/[.,;!?]+$/, '').trim();
  if (t.length < 3) return null;
  t = t.replace(/^(\S+)/, w => VERB_FIX[w.toLowerCase()] || w);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function splitDump(text) {
  return text
    .replace(/\n+/g, '. ')
    .split(/[.;!?]+|,\s*|\s+(?:et puis|et aussi|et après|et ensuite|puis|ensuite|après ça|aussi|et)\s+/i)
    .map(cleanChunk).filter(Boolean)
    .filter((t, i, a) => a.findIndex(x => x.toLowerCase() === t.toLowerCase()) === i);
}
function stepCount() {
  // batterie basse ou profil Montagne → plus d'étapes, plus petites
  let n = S.battery <= 2 ? 5 : S.battery >= 4 ? 3 : 4;
  if (S.profile === 'montagne') n++;
  return n;
}
function slicedSteps(title) {
  const t = title.toLowerCase();
  const n = stepCount();
  let tpl;
  if (/ranger|chambre|trier|nettoyer|ménage|menage|cuisine/.test(t)) tpl = [
    'Mets une musique qui te plaît', 'Ramasse juste les vêtements', 'Jette les déchets visibles', 'Range ce qui est sur le bureau / la table', 'Remets 5 objets à leur place', 'Passe un petit coup rapide sur une surface'];
  else if (/réviser|reviser|révision|apprendre|contrôle|controle|exam/.test(t)) tpl = [
    'Sors le cahier et pose-le devant toi', 'Lis seulement le titre et les sous-titres', 'Relis un seul paragraphe', 'Écris 3 mots-clés de mémoire', 'Explique-le à voix haute comme à un ami', 'Fais une mini-pause bien méritée'];
  else if (/devoir|exercice|maths|math/.test(t)) tpl = [
    'Ouvre ton sac et sors le bon cahier', 'Lis juste la consigne du 1er exercice', 'Écris la première ligne, même imparfaite', 'Finis ce premier exercice', 'Lis la consigne du suivant', 'Coche ce qui est fait dans l\'agenda'];
  else if (/écrire|ecrire|exposé|expose|rapport|mémoire|memoire|cv|lettre/.test(t)) tpl = [
    'Ouvre un document vide', 'Écris le titre', 'Note 3 idées en vrac, sans juger', 'Choisis l\'idée la plus facile', 'Écris 3 phrases sur cette idée', 'Relis et souris, c\'est commencé'];
  else if (/dossier|impôts|impots|facture|papier|administratif|inscription|candidature/.test(t)) tpl = [
    'Trouve le papier ou le site concerné', 'Ouvre-le, juste l\'ouvrir', 'Remplis la première case', 'Note ce qui te manque', 'Remplis 3 cases de plus', 'Envoie ou range dans un endroit visible'];
  else if (/courses|acheter|racheter/.test(t)) tpl = [
    'Ouvre une note sur ton téléphone', 'Écris ce qu\'il te faut', 'Prends ton sac et tes clés', 'Vas-y (ou commande en ligne)'];
  else if (/préparer|preparer|organiser/.test(t)) tpl = [
    'Écris ce dont tu as besoin', 'Rassemble la première chose', 'Rassemble le reste', 'Vérifie rapidement, c\'est prêt'];
  else tpl = [
    `Prépare ce qu'il te faut`, 'Fais juste le tout premier geste', 'Continue 2 minutes, pas plus', 'Fais encore un petit bout', 'Regarde ce qui reste et note-le'];
  return tpl.slice(0, Math.max(3, Math.min(n, tpl.length))).map(s => mkStep(s, S.battery <= 2 ? 1 : 2));
}
function mkStep(t, mins = 2) { return { id: uid(), t, mins, done: false }; }
function mkTask(title, steps) {
  return { id: uid(), title, steps: steps || [], later: 0, status: 'active', createdAt: Date.now() };
}
function localSegment(text) {
  return splitDump(text).map(title => {
    const heavy = HEAVY.test(title) || title.split(' ').length > 7;
    return mkTask(title, heavy ? slicedSteps(title) : []);
  });
}

/* ================= DÉCOUPAGE (IA via Cloudflare Worker) ================= */
async function aiSegment(text) {
  const url = (S.settings.apiUrl || '').trim();
  if (!url) return null;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/segment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ text, battery: S.battery, profile: S.profile, passions: S.passions }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data.tasks) || !data.tasks.length) throw new Error('vide');
    return data.tasks.slice(0, 30).map(t => mkTask(
      String(t.title || '').slice(0, 120) || 'Tâche',
      (Array.isArray(t.steps) ? t.steps : []).slice(0, 8).map(s => typeof s === 'string' ? mkStep(s.slice(0, 120)) : mkStep(String(s.t || s.title || '').slice(0, 120), Math.min(5, Math.max(1, +s.mins || 2))))
    ));
  } catch (e) { console.warn('IA indisponible, découpage local', e); return null; }
  finally { clearTimeout(to); }
}

/* ================= NAVIGATION ================= */
function showScreen(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
function showView(id) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  const tab = id === 'v-preview' ? 'v-dump' : id;
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (id === 'v-focus') renderFocus();
  if (id === 'v-fridge') renderFridge();
  if (id === 'v-profile') renderProfile();
  if (id === 'v-settings') renderSettings();
  if (id === 'v-dump') say(pick(['Vas-y, vide ta tête. Je m\'occupe du tri 🧠', 'Dis tout en vrac, même le bazar.', 'Parle-moi, je découpe !']));
}

/* ================= ONBOARDING ================= */
let ob = 0;
const OB_STEPS = [
  () => ({
    say: 'Salut ! Moi c\'est Spiky ⚡ Je vais t\'aider à avancer, une mini-étape à la fois.',
    html: `<h2>Bienvenue dans Todo</h2>
      <p>Ici, pas de liste qui fait peur. Pas de texte rouge. Pas de « en retard ». Juste toi, une tâche, et des petites victoires.</p>
      <div class="notice">🩺 <b>Important :</b> Todo n'est ni un médecin, ni un outil de diagnostic. C'est un compagnon du quotidien pour t'aider avec les blocages du TDAH. Pour toute question de santé, parle à un professionnel.</div>`,
    ok: () => true,
  }),
  () => ({
    say: 'Ton cerveau bloque comment, en ce moment ? Pas de mauvaise réponse.',
    html: `<h2>Ton blocage du moment</h2><p>Tu pourras changer à tout moment.</p>
      ${Object.entries(PROFILES).map(([k, p]) => `<button class="choice ${S.profile === k ? 'on' : ''}" data-profile="${k}"><span class="emo">${p.emo}</span><span><b>${p.name}</b><small>${p.desc}</small></span></button>`).join('')}`,
    ok: () => !!S.profile,
  }),
  () => ({
    say: 'Dis-moi ce que tu aimes. Je m\'en servirai pour rendre les tâches plus fun 💚',
    html: `<h2>Tes passions</h2><p>Ton cerveau s'allume quand c'est intéressant. On va s'en servir.</p>
      <div class="chips">${PASSIONS.map(p => `<button class="chip ${S.passions.includes(p) ? 'on' : ''}" data-passion="${esc(p)}">${p}</button>`).join('')}</div>
      <input class="field" id="passion-free" placeholder="Autre chose ? (ex : Pokémon, basket…)" value="${esc(S.passions.find(p => !PASSIONS.includes(p)) || '')}">`,
    ok: () => true,
  }),
  () => ({
    say: 'Dernière question : ta batterie mentale aujourd\'hui ?',
    html: `<h2>Ta batterie du jour</h2><p>J'adapte la taille des étapes et la durée du chrono.</p>
      <div class="battery">${BATTERY.map((b, i) => `<button data-bat="${i + 1}" class="${S.battery >= i + 1 ? 'on' : ''}">${b.emo}</button>`).join('')}</div>
      <div class="battery-label" id="bat-label">${BATTERY[S.battery - 1].lab} · chrono de ${BATTERY[S.battery - 1].mins} min</div>`,
    ok: () => true,
  }),
];
function renderOnboard() {
  const st = OB_STEPS[ob]();
  say(st.say, 'cheer');
  $('#ob-dots').innerHTML = OB_STEPS.map((_, i) => `<i class="${i === ob ? 'on' : ''}"></i>`).join('');
  $('#ob-body').innerHTML = st.html;
  $('#ob-back').style.visibility = ob ? 'visible' : 'hidden';
  $('#ob-next').textContent = ob === OB_STEPS.length - 1 ? 'Commencer ⚡' : 'Suivant';
  $('#ob-next').disabled = !st.ok();
}
function saveFreePassion() {
  const el = $('#passion-free'); if (!el) return;
  S.passions = S.passions.filter(p => PASSIONS.includes(p));
  const v = el.value.trim(); if (v) S.passions.push(v.slice(0, 40));
}
$('#ob-body').addEventListener('click', e => {
  const pr = e.target.closest('[data-profile]'), pa = e.target.closest('[data-passion]'), bt = e.target.closest('[data-bat]');
  if (pr) { S.profile = pr.dataset.profile; sfx.tap(); renderOnboard(); }
  if (pa) { saveFreePassion(); const v = pa.dataset.passion; S.passions = S.passions.includes(v) ? S.passions.filter(x => x !== v) : [...S.passions, v]; sfx.tap(); renderOnboard(); }
  if (bt) { S.battery = +bt.dataset.bat; S.batteryDay = today(); sfx.tap(); buzz(); renderOnboard(); }
  save();
});
$('#ob-next').onclick = () => {
  saveFreePassion(); sfx.tap();
  if (ob < OB_STEPS.length - 1) { ob++; renderOnboard(); return; }
  S.onboarded = true; S.batteryDay = today(); save();
  enterMain();
};
$('#ob-back').onclick = () => { saveFreePassion(); if (ob > 0) { ob--; renderOnboard(); } };

/* ================= MAIN ================= */
function enterMain() {
  showScreen('s-main');
  renderHeader();
  showView('v-dump');
  // Nouvelle journée : on redemande gentiment la batterie
  if (S.batteryDay !== today()) setTimeout(askBattery, 600);
}
function renderHeader() {
  const li = levelInfo();
  $('#xp-pill').textContent = `Niv ${li.level} · ${li.rest}/${li.need}`;
}
function askBattery() {
  openModal(`<h3>Nouvelle journée ☀️</h3><p>Ta batterie mentale aujourd'hui ?</p>
    <div class="battery">${BATTERY.map((b, i) => `<button data-mbat="${i + 1}">${b.emo}</button>`).join('')}</div>
    <p style="font-size:13px">${BATTERY.map((b, i) => `${i + 1} = ${b.lab}`).join(' · ')}</p>`);
}

/* ---------- Vide-Tête ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false, baseText = '';
$('#mic').onclick = () => {
  sfx.tap(); buzz();
  if (!SR) { toast('Dictée non dispo ici, je mets un exemple'); simulate(); return; }
  if (recOn) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
  baseText = $('#dump-text').value.trim(); baseText = baseText ? baseText + ', ' : '';
  rec.onstart = () => { recOn = true; $('#mic').classList.add('rec'); $('#mic-label').textContent = 'Je t\'écoute… appuie pour arrêter'; say('J\'écoute… vas-y, en vrac !', 'listen'); mood('listen', 0); };
  rec.onresult = ev => {
    let fin = '', tmp = '';
    for (let i = 0; i < ev.results.length; i++) (ev.results[i].isFinal ? (fin += ev.results[i][0].transcript + ' ') : (tmp += ev.results[i][0].transcript));
    $('#dump-text').value = baseText + fin + tmp;
  };
  rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Autorise le micro dans ton navigateur'); };
  rec.onend = () => {
    recOn = false; $('#mic').classList.remove('rec'); $('#mic-label').textContent = 'Appuie et parle'; mood(null);
    if ($('#dump-text').value.trim()) { S.stats.voice++; save(); say('Top ! Appuie sur « Découper » quand tu as fini.', 'cheer'); }
  };
  try { rec.start(); } catch (e) { simulate(); }
};
function simulate() {
  const t = pick(SAMPLE_DUMPS); const ta = $('#dump-text'); ta.value = ''; let i = 0;
  say('Mode simulation : je fais comme si tu parlais 🎙️', 'listen'); mood('listen', 0);
  const iv = setInterval(() => { ta.value = t.slice(0, i += 3); if (i >= t.length) { clearInterval(iv); ta.value = t; mood(null); S.stats.voice++; save(); } }, 25);
}
$('#btn-sim').onclick = () => { sfx.tap(); simulate(); };

let preview = [];
$('#btn-segment').onclick = async () => {
  const text = $('#dump-text').value.trim();
  if (!text) { say('Dis-moi au moins une chose, même minuscule 😊', 'think'); return; }
  if (recOn) rec.stop();
  const btn = $('#btn-segment'); btn.disabled = true; btn.textContent = 'Je découpe…';
  say('Je découpe ton chaos en petits morceaux… ✂️', 'think'); mood('think', 0);
  let tasks = await aiSegment(text);
  const viaAI = !!tasks;
  if (!tasks) { await new Promise(r => setTimeout(r, 700)); tasks = localSegment(text); }
  btn.disabled = false; btn.textContent = 'Découper ⚡'; mood(null);
  if (!tasks.length) { say('Hmm, je n\'ai rien trouvé. Essaie de séparer avec des virgules ?', 'think'); return; }
  preview = tasks;
  renderPreview(viaAI);
  showView('v-preview');
  say(`${tasks.length} tâche${tasks.length > 1 ? 's' : ''} ! Les grosses sont déjà découpées 🔪`, 'cheer'); sfx.step();
};
function renderPreview(viaAI) {
  $('#preview-hint').textContent = (viaAI ? 'Découpé par l\'IA. ' : '') + 'Touche ✕ pour enlever ce qui ne va pas.';
  $('#preview-list').innerHTML = preview.map(t => `<li><div class="grow"><b>${esc(t.title)}</b>${t.steps.length ? `<small>🐉 Boss : ${t.steps.length} mini-étapes</small>` : '<small>⚡ Rapide</small>'}</div><button class="x" data-del="${t.id}">✕</button></li>`).join('');
}
$('#preview-list').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { preview = preview.filter(t => t.id !== d.dataset.del); renderPreview(); sfx.tap(); } };
$('#btn-preview-back').onclick = () => showView('v-dump');
$('#btn-preview-ok').onclick = () => {
  if (!preview.length) { showView('v-dump'); return; }
  S.tasks.push(...preview); preview = []; $('#dump-text').value = ''; save();
  sfx.win(); confetti(60); addXp(5);
  showView('v-focus');
};

/* ---------- Œillères (une seule carte) ---------- */
let timer = null;
function activeTasks() { return S.tasks.filter(t => t.status === 'active'); }
function renderFocus() {
  const zone = $('#card-zone'); const list = activeTasks();
  stopTimer(true);
  if (!list.length) {
    zone.innerHTML = `<div class="task-card"><div class="empty"><div style="font-size:54px">🌤️</div><b>Rien sur ta pile.</b><br>Profite, ou vide ta tête pour ajouter des idées.<br><br><button class="btn primary" data-go="v-dump">Vider ma tête</button></div></div>`;
    say('Pile vide. Tu as le droit de souffler 😌', 'calm');
    return;
  }
  const t = list[0];
  const total = t.steps.length, done = t.steps.filter(s => s.done).length;
  const curIdx = t.steps.findIndex(s => !s.done);
  // Brouillard : on ne montre que l'étape en cours + la suivante
  const fog = S.profile === 'brouillard';
  const hp = total ? Math.round(100 * (total - done) / total) : 100;
  zone.innerHTML = `
    <div class="task-card" id="card">
      <div class="stack-shadow"></div>
      ${list.length > 1 ? `<div class="hint">Encore ${list.length - 1} autre${list.length > 2 ? 's' : ''} dans la pile, mais on ne les regarde pas 🙈</div>` : ''}
      <h3 class="task-title">${esc(t.title)}</h3>
      ${total ? `<div class="boss">🐉 BOSS <div class="hp"><div style="width:${hp}%"></div></div> ${total - done}/${total}</div>` : ''}
      <div id="timer-slot"></div>
      ${total ? `<ul class="steps">${t.steps.map((s, i) => `
        <li class="${s.done ? 'done' : ''} ${i === curIdx ? 'current' : ''} ${!s.done && i > curIdx + (fog ? 1 : 2) ? 'hidden-step' : ''} ${s.done && i < curIdx - 1 ? 'hidden-step' : ''}" data-step="${s.id}">
          <span class="check">${s.done ? '✓' : ''}</span><span>${esc(s.t)}</span><span class="mins">${s.mins} min</span></li>`).join('')}</ul>
        ${t.steps.filter((s, i) => !s.done && i > curIdx + (fog ? 1 : 2)).length ? `<div class="more-steps">+ ${t.steps.filter((s, i) => !s.done && i > curIdx + (fog ? 1 : 2)).length} étape(s) cachée(s). Une chose à la fois 🙈</div>` : ''}`
      : `<div class="empty" style="font-size:15px">Une seule action. Tu peux le faire ⚡</div>`}
      <div class="card-actions">
        <button class="btn primary" id="act-now">⏱️ Je le fais maintenant · ${BATTERY[S.battery - 1].mins} min</button>
        ${total ? '' : `<button class="btn primary" id="act-done" style="grid-column:1/-1">✅ C'est fait !</button>`}
        <button class="btn ghost" id="act-later">⏭️ Plus tard</button>
        <button class="btn ghost" id="act-slice">🔪 ${total ? 'Couper en 2' : 'Découper'}</button>
      </div>
    </div>`;
  if (!timer) say(total ? (done ? 'Le Boss faiblit, continue 💪' : 'Juste la première étape. Rien d\'autre.') : 'Une seule chose. Go ?', 'calm');
}
$('#card-zone').addEventListener('click', e => {
  const go = e.target.closest('[data-go]'); if (go) { showView(go.dataset.go); return; }
  const t = activeTasks()[0]; if (!t) return;
  const st = e.target.closest('[data-step]');
  if (st) return toggleStep(t, st.dataset.step);
  if (e.target.closest('#act-now')) return startTimer(t);
  if (e.target.closest('#act-done')) return completeTask(t);
  if (e.target.closest('#act-later')) return later(t);
  if (e.target.closest('#act-slice')) return slice(t);
});
function toggleStep(t, sid) {
  const s = t.steps.find(x => x.id === sid); if (!s) return;
  s.done = !s.done;
  if (s.done) {
    S.stats.steps++; sfx.step(); buzz(20); confetti(25); addXp(10 * S.boost);
    say(pick(['Paf ! Une de moins 💥', 'Le Boss a mal 🐉', 'Trop fort !', 'Et une victoire ⚡', 'Continue comme ça !']), 'cheer');
  }
  save();
  if (t.steps.every(x => x.done)) return completeTask(t);
  const keep = !!timer; const saved = timer && { ...timer };
  renderFocus();
  if (keep) resumeTimer(saved);
}
function completeTask(t) {
  stopTimer(true);
  t.status = 'done'; t.doneAt = Date.now(); S.stats.done++;
  if (t.steps.length >= 3) S.stats.bossDown = (S.stats.bossDown || 0) + 1;
  const gain = Math.round((30 + t.steps.length * 2) * S.boost);
  const wasBoost = S.boost > 1; S.boost = 1;
  sfx.win(); buzz([40, 50, 40]); confetti(160);
  say(t.steps.length >= 3 ? 'BOSS VAINCU ! 🐉💥 Tu l\'as fait sans même t\'en rendre compte.' : 'Tâche terminée ! Je suis fier de toi ⚡', 'cheer');
  toast(`+${gain} XP${wasBoost ? ' (bonus x2 !)' : ''}`);
  addXp(gain);
  const card = $('#card'); if (card) card.classList.add('out');
  // Roulette bonus de temps en temps (plus souvent en Panne Sèche)
  const chance = S.profile === 'panne' ? 0.4 : 0.25;
  setTimeout(() => { renderFocus(); if (Math.random() < chance || S.stats.done === 1) bonusWheel(); }, 900);
}
function later(t) {
  stopTimer(true);
  t.later++; sfx.soft();
  S.tasks = S.tasks.filter(x => x !== t);
  if (t.later >= 3) {
    t.status = 'fridge'; S.tasks.push(t);
    say('Je la mets au frais 🧊 Elle t\'attend, sans pression.', 'calm');
    toast('Rangée dans le Frigo, rien n\'est perdu');
  } else {
    S.tasks.push(t);
    say(pick(['Ok, on la garde pour plus tard 👌', 'Pas de souci, on passe à autre chose.', 'Bonne idée de changer !']), 'calm');
  }
  save();
  const card = $('#card'); if (card) { card.classList.add('out'); setTimeout(renderFocus, 280); } else renderFocus();
}
function slice(t) {
  S.stats.slices++; sfx.step(); buzz();
  if (!t.steps.length) {
    t.steps = slicedSteps(t.title);
  } else {
    const i = t.steps.findIndex(s => !s.done);
    const s = t.steps[i];
    const a = mkStep(`Commence : ${s.t.charAt(0).toLowerCase() + s.t.slice(1)} (juste le début)`, Math.max(1, Math.ceil(s.mins / 2)));
    const b = mkStep(`Termine : ${s.t.charAt(0).toLowerCase() + s.t.slice(1)}`, Math.max(1, Math.ceil(s.mins / 2)));
    t.steps.splice(i, 1, a, b);
  }
  say('Tchac ! ✂️ Plus petit = plus facile.', 'cheer');
  checkBadges(); save(); renderFocus();
}

/* ---------- Chrono ---------- */
function startTimer(t) {
  stopTimer(true);
  const total = BATTERY[S.battery - 1].mins * 60;
  resumeTimer({ taskId: t.id, total, left: total });
  sfx.tap(); buzz();
  say(pick(['C\'est parti, je reste avec toi 👀', 'Chrono lancé ! On y va ensemble.', 'Je travaille à côté de toi ⚡']), 'listen');
}
function resumeTimer(st) {
  timer = st;
  const slot = $('#timer-slot'); if (!slot) return;
  const draw = () => {
    const m = Math.floor(timer.left / 60), s = String(timer.left % 60).padStart(2, '0');
    slot.innerHTML = `<div class="timer-row"><span>⏱️ ${m}:${s}</span><button class="btn ghost sm" id="timer-stop">Stop</button></div><div class="timer-bar"><div style="width:${100 * timer.left / timer.total}%"></div></div>`;
    $('#timer-stop').onclick = () => { stopTimer(); say('Ok, pause. Tu as déjà commencé, c\'est le plus dur 💚', 'calm'); };
  };
  draw();
  const nb = $('#act-now'); if (nb) nb.style.display = 'none';
  timer.iv = setInterval(() => {
    timer.left--;
    if (timer.left <= 0) {
      stopTimer(); sfx.win(); buzz([60, 60, 60]); confetti(50);
      addXp(15);
      openModal(`<div class="lever">⏰</div><h3>Chrono fini !</h3><p>Bravo, tu as tenu le coup. +15 XP</p>
        <button class="btn primary" data-close>Je continue</button><button class="btn ghost" data-close>Petite pause</button>`);
      return;
    }
    draw();
  }, 1000);
}
function stopTimer(silent) {
  if (timer && timer.iv) clearInterval(timer.iv);
  timer = null;
  if (!silent) { const slot = $('#timer-slot'); if (slot) slot.innerHTML = ''; const nb = $('#act-now'); if (nb) nb.style.display = ''; }
}

/* ---------- Roulette à dopamine ---------- */
$('#btn-roulette').onclick = () => {
  sfx.tap();
  const small = activeTasks().map(t => {
    if (!t.steps.length) return { label: t.title, task: t };
    const s = t.steps.find(x => !x.done); return s ? { label: s.t, task: t } : null;
  }).filter(Boolean);
  const pool = small.length ? small : MICRO_TASKS.map(m => ({ label: m }));
  openModal(`<div class="lever">🎰</div><h3>Roulette à dopamine</h3><p>Je tire une mini-tâche de moins de 5 min pour toi.</p>
    <div class="wheel" id="wheel">?</div><button class="btn primary" id="spin">Tirer le levier</button>`);
  $('#spin').onclick = () => spin(pool.map(p => p.label), idx => {
    const r = pool[idx]; S.stats.roulette++; addXp(5);
    $('#spin').outerHTML = `<button class="btn primary" id="roul-go">On y va !</button>`;
    $('#roul-go').onclick = () => {
      closeModal();
      if (r.task) { S.tasks = [r.task, ...S.tasks.filter(t => t !== r.task)]; save(); }
      else { S.tasks.unshift(mkTask(r.label)); save(); }
      showView('v-focus');
    };
  });
};
function spin(labels, done) {
  const w = $('#wheel'); w.classList.add('spin'); let n = 0, delay = 50;
  const target = Math.floor(Math.random() * labels.length);
  const step = () => {
    w.textContent = labels[n % labels.length]; sfx.spin(); buzz(5);
    n++;
    if (delay > 260 && (n - 1) % labels.length === target) {
      w.classList.remove('spin'); w.textContent = labels[target]; sfx.win(); confetti(40); buzz([30, 30]); done(target); return;
    }
    delay *= 1.12; setTimeout(step, delay);
  };
  step();
}

/* ---------- Roulette bonus (liée aux passions) ---------- */
const BONUS_BY_PASSION = {
  musique: ['Mets ton son préféré : finis la prochaine étape avant la fin du morceau 🎵', 'Fais ta prochaine étape en chantant dans ta tête 🎤'],
  jeux: ['Mode speedrun : bats ton record sur la prochaine étape 🎮', 'Imagine que c\'est une quête secondaire : +XP doublé 🗡️'],
  sport: ['Échauffement : 10 sauts sur place, puis la prochaine étape ⚽', 'Mode chrono comme à l\'entraînement 🏃'],
  dessin: ['Dessine un petit gribouillis de victoire après la prochaine étape 🎨', 'Colore une case de ta feuille à chaque étape finie ✏️'],
  animaux: ['Fais la prochaine étape comme si ton animal préféré te regardait 🐶', 'Va faire un câlin à ton animal juste après 🐱'],
  séries: ['Après la prochaine étape : 1 épisode court en récompense 📺', 'Fais-la comme ton perso préféré le ferait 🦸'],
  cuisine: ['Prépare ton snack préféré pour après la prochaine étape 🍳', 'Mode chef : chaque étape = un ingrédient 👨‍🍳'],
  danse: ['Petite danse de 20 secondes, puis la prochaine étape 💃', 'Mets une musique et bouge en même temps 🕺'],
  nature: ['Fais la prochaine étape près d\'une fenêtre ouverte 🌿', 'Récompense : 5 min dehors après 🌳'],
  tech: ['Mode debug : chaque étape = un bug corrigé 💻', 'Imagine que tu codes un niveau de jeu 👾'],
  lecture: ['Récompense : 1 chapitre après la prochaine étape 📚', 'Imagine que tu es le héros de ton livre 🧙'],
  photo: ['Prends une photo « avant/après » de ta prochaine étape 📸', 'Filme un mini timelapse pendant que tu bosses 🎬'],
};
const GENERIC_BONUS = ['Mode chuchotement : fais la prochaine étape en silence total 🤫', 'Défi : finis la prochaine étape en moins de 2 min ⏱️', 'Spiky travaille à côté de toi 5 min 👀', 'Lève-toi et fais-la debout 🧍'];
function bonusIdeas() {
  const out = [];
  S.passions.forEach(p => {
    const key = Object.keys(BONUS_BY_PASSION).find(k => p.toLowerCase().includes(k));
    if (key) out.push(...BONUS_BY_PASSION[key]);
    else if (!PASSIONS.includes(p)) out.push(`Pense à ${p} : fais la prochaine étape comme si c'était pour ça 💚`, `Après la prochaine étape : 5 min de ${p} en récompense 🎁`);
  });
  return out.length ? out : GENERIC_BONUS;
}
function bonusWheel() {
  const ideas = bonusIdeas();
  openModal(`<div class="lever">🎁</div><h3>Roue bonus !</h3><p>Surprise ! Tire un bonus lié à ce que tu aimes. Ta prochaine tâche rapporte double XP.</p>
    <div class="wheel" id="wheel">🎁</div><button class="btn primary" id="spin">Tourner</button>`);
  $('#spin').onclick = () => spin(ideas, () => {
    S.boost = 2; S.stats.bonus++; checkBadges(); save();
    $('#spin').outerHTML = `<button class="btn primary" data-close>Défi accepté ⚡</button>`;
    say('Bonus actif : prochaine tâche x2 XP 🎁', 'cheer');
  });
}

/* ---------- Frigo ---------- */
function renderFridge() {
  const f = S.tasks.filter(t => t.status === 'fridge');
  $('#fridge-list').innerHTML = f.length ? f.map(t => `
    <li><div class="grow"><b>${esc(t.title)}</b><small>Au frais, prête quand tu l'es</small></div>
    <button class="btn ghost sm" data-out="${t.id}">Ressortir</button><button class="x" data-trash="${t.id}" aria-label="Retirer">✕</button></li>`).join('')
    : `<li class="empty" style="border:0;background:none;display:block">Le frigo est vide 🧊<br>Les tâches reportées 3 fois arrivent ici, sans jugement.</li>`;
  say(f.length ? 'Tu reprends une idée quand tu te sens prêt 💚' : 'Frigo vide, tout roule ✨', 'calm');
}
$('#fridge-list').onclick = e => {
  const o = e.target.closest('[data-out]'), tr = e.target.closest('[data-trash]');
  if (o) {
    const t = S.tasks.find(x => x.id === o.dataset.out); t.status = 'active'; t.later = 0;
    S.tasks = [t, ...S.tasks.filter(x => x !== t)]; S.stats.rescued++; addXp(5); sfx.step();
    toast('Ressortie ! Elle est en haut de ta pile'); renderFridge();
  }
  if (tr) { S.tasks = S.tasks.filter(x => x.id !== tr.dataset.trash); save(); sfx.soft(); toast('Retirée. Pas besoin de tout faire 👌'); renderFridge(); }
};

/* ---------- Profil ---------- */
function renderProfile() {
  const li = levelInfo();
  $('#stats').innerHTML = `
    <div class="stat"><b>${li.level}</b><small>Niveau</small></div>
    <div class="stat"><b>${S.stats.done}</b><small>Tâches finies</small></div>
    <div class="stat"><b>⚡${S.days.length}</b><small>Jours actifs</small></div>`;
  $('#xpbar-fill').style.width = (100 * li.rest / li.need) + '%';
  $('#xp-text').textContent = `${li.rest} / ${li.need} XP avant le niveau ${li.level + 1} · Une pause ne fait jamais perdre tes jours ⚡`;
  $('#badges').innerHTML = BADGES.map(b => `<div class="badge ${S.badges.includes(b.id) ? 'on' : ''}"><span>${b.emo}</span>${b.name}</div>`).join('');
  say(`${S.badges.length} badge${S.badges.length > 1 ? 's' : ''} sur ${BADGES.length}. Chaque petit pas compte !`, 'cheer');
}

/* ---------- Réglages ---------- */
function renderSettings() {
  $('#settings').innerHTML = `
    <div class="set"><div class="set-row"><b>🔊 Sons</b><button class="toggle ${S.settings.sound ? 'on' : ''}" data-tog="sound"></button></div></div>
    <div class="set"><div class="set-row"><b>📳 Vibrations</b><button class="toggle ${S.settings.vibe ? 'on' : ''}" data-tog="vibe"></button></div></div>
    <div class="set"><b>🔋 Batterie du jour</b>
      <div class="battery" style="height:60px">${BATTERY.map((b, i) => `<button data-sbat="${i + 1}" class="${S.battery >= i + 1 ? 'on' : ''}">${b.emo}</button>`).join('')}</div>
      <small>${BATTERY[S.battery - 1].lab} · chrono ${BATTERY[S.battery - 1].mins} min</small></div>
    <div class="set"><b>🧭 Blocage du moment</b><div class="chips">${Object.entries(PROFILES).map(([k, p]) => `<button class="chip ${S.profile === k ? 'on' : ''}" data-sprof="${k}">${p.emo} ${p.name}</button>`).join('')}</div></div>
    <div class="set"><b>💚 Passions</b><div class="chips">${PASSIONS.map(p => `<button class="chip ${S.passions.includes(p) ? 'on' : ''}" data-spass="${esc(p)}">${p}</button>`).join('')}</div></div>
    <div class="set"><b>🤖 IA (Cloudflare Worker)</b><small>Adresse de ton Worker Grok. Vide = découpage local, hors-ligne.</small>
      <input class="field" id="api-url" placeholder="https://todo-ai.ton-nom.workers.dev" value="${esc(S.settings.apiUrl)}"></div>
    <div class="set"><small>🩺 Todo n'est ni un médecin, ni un outil de diagnostic. C'est un compagnon du quotidien. Pour toute question de santé, parle à un professionnel.</small></div>
    <div class="set"><button class="btn ghost sm" id="reset">Tout remettre à zéro</button></div>`;
  say('Règle tout comme tu veux 🔧', 'calm');
}
$('#settings').addEventListener('click', e => {
  const tg = e.target.closest('[data-tog]'), b = e.target.closest('[data-sbat]'), p = e.target.closest('[data-sprof]'), ps = e.target.closest('[data-spass]');
  if (tg) S.settings[tg.dataset.tog] = !S.settings[tg.dataset.tog];
  if (b) { S.battery = +b.dataset.sbat; S.batteryDay = today(); }
  if (p) S.profile = p.dataset.sprof;
  if (ps) { const v = ps.dataset.spass; S.passions = S.passions.includes(v) ? S.passions.filter(x => x !== v) : [...S.passions, v]; }
  if (e.target.id === 'reset') {
    if (confirm('Effacer toutes tes données Todo sur cet appareil ?')) { try { localStorage.removeItem(STORE_KEY); } catch (er) {} location.reload(); }
    return;
  }
  if (tg || b || p || ps) { sfx.tap(); save(); renderSettings(); }
});
$('#settings').addEventListener('change', e => { if (e.target.id === 'api-url') { S.settings.apiUrl = e.target.value.trim(); save(); toast(S.settings.apiUrl ? 'IA branchée ⚡' : 'IA débranchée, mode local'); } });

/* ---------- Modale (clics globaux) ---------- */
$('#modal').addEventListener('click', e => {
  if (e.target.closest('[data-close]') || e.target.id === 'modal') { closeModal(); return; }
  const mb = e.target.closest('[data-mbat]');
  if (mb) { S.battery = +mb.dataset.mbat; S.batteryDay = today(); save(); closeModal(); sfx.tap(); say(`Ok ! Chrono de ${BATTERY[S.battery - 1].mins} min aujourd'hui.`, 'cheer'); }
});

/* ---------- Barre du bas ---------- */
$$('.tabbar button').forEach(b => b.onclick = () => { sfx.tap(); buzz(8); showView(b.dataset.tab); });

/* ================= DÉMARRAGE ================= */
mountSpiky();
$('#btn-start').onclick = () => {
  sfx.win(); buzz();
  if (S.onboarded) enterMain(); else { showScreen('s-onboard'); ob = 0; renderOnboard(); }
};
// Si déjà inscrit, le splash passe tout seul
if (S.onboarded) setTimeout(() => { if ($('#s-splash').classList.contains('active')) enterMain(); }, 1400);
})();
