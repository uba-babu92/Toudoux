# Todo ⚡

To-do ludique et déculpabilisante pour les personnes avec un TDAH (ados et adultes).
Mascotte : **Spiky**, un petit éclair.

> Todo n'est ni un médecin, ni un outil de diagnostic. C'est un compagnon du quotidien.

## Lancer l'app
Ouvre `index.html` dans un navigateur, ou :
```
python3 -m http.server 8000
```
puis va sur http://localhost:8000 (sur téléphone : même Wi-Fi, IP de l'ordi).
La dictée vocale marche sur Chrome et Safari (HTTPS ou localhost).

## Fonctions
- Splash + onboarding : blocage du moment, passions, batterie mentale.
- **Vide-Tête** : micro (Web Speech API) ou texte → découpage en tâches.
- **Œillères** : une carte à la fois, chrono selon la batterie, Plus tard, Découper.
- **Boss Slicer** : grosses tâches découpées en mini-étapes, barre de vie du Boss.
- **Roulette à dopamine** (« Je bloque ») et **roue bonus** liée aux passions (XP x2).
- **Frigo** : une tâche reportée 3 fois y va, sans message négatif.
- XP, niveaux (Spiky évolue), jours actifs sans punition, 12 badges, sons, vibrations.
- Données stockées uniquement sur l'appareil.

## Brancher l'IA Grok (Cloudflare Worker)
1. Crée un compte gratuit sur cloudflare.com.
2. Installe l'outil : `npm install -g wrangler`, puis `wrangler login`.
3. Dans le dossier `worker/` : `wrangler secret put XAI_API_KEY` et colle ta clé xAI.
4. Toujours dans `worker/` : `wrangler deploy`. Tu obtiens une adresse `https://todo-ai.xxx.workers.dev`.
5. Dans l'app : **Réglages → IA** → colle cette adresse.

Sans adresse ou si Grok ne répond pas, l'app découpe en local (règles simples).
Vérifie le nom du modèle sur docs.x.ai et change `GROK_MODEL` dans `worker/wrangler.toml` si besoin.
Pour la sécurité, mets l'adresse de ton app dans `ALLOWED_ORIGIN`.

## Pourquoi vert menthe + beige ?
Peu de couleurs = moins de surcharge. Plusieurs petites études montrent une discrimination
bleu-jaune plus faible chez les TDAH (ex. Banaschewski et al., 2006), donc pas de jaune/bleu
pour les actions. Preuves limitées (petits échantillons).

## V2 (idées)
Suivi parent, compte et synchro cloud, app installable (PWA), icônes monochromes.
