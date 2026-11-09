// Cloudflare Worker : découpe le "vide-tête" en micro-tâches avec Grok (xAI).
// La clé API reste ici (secret XAI_API_KEY), jamais dans l'app.

const SYSTEM = `Tu aides une personne avec un TDAH (ado ou adulte) à transformer un texte dicté en vrac en tâches.
Règles :
- Extrais chaque tâche distincte. Titre court, en français, à l'infinitif ou impératif, sans "je dois".
- Si une tâche est lourde (ranger, réviser, écrire, dossier, projet...), ajoute 3 à 6 étapes ridiculement faciles de 1 à 3 minutes chacune. Sinon "steps" est vide.
- Batterie basse (1-2) : étapes plus nombreuses et plus petites. Batterie haute (4-5) : moins d'étapes.
- Ton bienveillant, jamais culpabilisant. Pas de date, pas de "en retard".
- Tu peux rendre une étape fun en lien avec les passions données, sans en abuser.
Réponds UNIQUEMENT en JSON : {"tasks":[{"title":"...","steps":[{"t":"...","mins":2}]}]}`;

function cors(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed.includes('*') ? '*' : origin) : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    const h = cors(env, req.headers.get('Origin') || '');
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/segment') return json({ error: 'not found' }, 404, h);
    if (!env.XAI_API_KEY) return json({ error: 'clé manquante' }, 500, h);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'json invalide' }, 400, h); }
    const text = String(body.text || '').slice(0, 4000).trim();
    if (!text) return json({ error: 'texte vide' }, 400, h);
    const battery = Math.min(5, Math.max(1, Number(body.battery) || 3));
    const profile = String(body.profile || '').slice(0, 20);
    const passions = (Array.isArray(body.passions) ? body.passions : []).slice(0, 10).map(p => String(p).slice(0, 40));

    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.GROK_MODEL || 'grok-3-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Batterie: ${battery}/5. Profil: ${profile || 'inconnu'}. Passions: ${passions.join(', ') || 'aucune'}.\nTexte dicté :\n${text}` },
        ],
      }),
    });
    if (!r.ok) return json({ error: 'grok', status: r.status }, 502, h);

    try {
      const out = await r.json();
      const content = out.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content.replace(/^```json\s*|```$/g, ''));
      const tasks = (parsed.tasks || []).slice(0, 30).map(t => ({
        title: String(t.title || '').slice(0, 120),
        steps: (t.steps || []).slice(0, 8).map(s => ({ t: String(s.t || s).slice(0, 120), mins: Math.min(5, Math.max(1, Number(s.mins) || 2)) })),
      })).filter(t => t.title);
      return json({ tasks }, 200, h);
    } catch {
      return json({ error: 'réponse illisible' }, 502, h);
    }
  },
};
