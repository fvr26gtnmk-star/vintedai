export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clé API non configurée.' });

  const { images } = req.body;
  if (!images || !images.length) return res.status(400).json({ error: 'Aucune image fournie.' });

  const blocks = [{
    type: 'text',
    text: `Tu es un expert en revente de vêtements sur Vinted en France. Analyse ce vêtement et génère une annonce Vinted complète.\n\nRéponds UNIQUEMENT avec un objet JSON valide (aucun texte avant ou après), avec exactement ces clés :\n{\n  "titre": "titre accrocheur max 60 caractères",\n  "categorie": "catégorie Vinted ex T-shirts Pantalons Robes",\n  "marque": "marque identifiée ou Sans marque",\n  "taille": "taille estimée M L 38 etc",\n  "etat": "Neuf avec étiquette ou Neuf sans étiquette ou Très bon état ou Bon état ou Satisfaisant",\n  "couleur": "couleur principale",\n  "matiere": "matière estimée si visible",\n  "description": "description vendeuse 150-200 mots style naturel détails coupe style occasions usage appel action final",\n  "prix_min": 0,\n  "prix_recommande": 0,\n  "prix_max": 0,\n  "tags": ["tag1","tag2","tag3","tag4","tag5"]\n}\nBase tes prix sur le marché Vinted français actuel.`
  }];

  images.forEach(img => blocks.push({
    type: 'image',
    source: { type: 'base64', media_type: img.mime, data: img.base64 }
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: blocks }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || `Erreur API (${response.status})` });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.type === 'text' ? b.text : '').join('');

    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
      else return res.status(500).json({ error: 'Réponse IA invalide. Réessayez.' });
    }

    return res.status(200).json({ result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
}
