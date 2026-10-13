// ============================================================================
// Ustensiles — icônes, détection et helpers partagés
// ============================================================================

/** Icônes emoji par nom d'ustensile (correspondance exacte ou partielle). */
export const USTENSILE_ICONS: Record<string, string> = {
  'Poêle': '🍳', 'Wok': '🍜', 'Casserole': '🥘', 'Cocotte': '🍲',
  'Four': '🔥', 'Air fryer': '💨', 'Grille-pain': '🍞', 'Micro-ondes': '📡',
  'Fouet': '🥢', 'Batteur électrique': '⚡', 'Mixeur': '🥤', 'Blender': '🌀',
  'Mandoline': '🥒', 'Râpe': '🧀', 'Couteau de chef': '🔪', 'Économe': '🥔',
  'Plan de travail': '🪵', 'Rouleau à pâtisserie': '🥖',
  'Moule à tarte': '🥧', 'Moule à manqué': '🎂', 'Moule à muffins': '🧁',
  'Ramequins': '🍥', 'Plat à gratin': '🥘', 'Papier cuisson': '📄',
  'Saladier': '🥣', 'Passoire': '💧', 'Cuillère en bois': '🥄',
  'Spatule': '🔪', 'Pinceau de cuisine': '🖌️', 'Ciseaux': '✂️',
  'Thermomètre': '🌡️', 'Presse-ail': '🧄', 'Écumoire': '🫕', 'Friteuse': '🫧',
};

/** Mots-clés → ustensile, pour détecter l'ustensile d'une étape de recette. */
const USTENSILE_KEYWORDS: [RegExp, string][] = [
  [/\b(four|enfourner|cuisson au four|rôtir|gratiner|au grille)\b/i, 'Four'],
  [/\bair ?fryer\b/i, 'Air fryer'],
  [/\bpo[êe]le\b/i, 'Poêle'],
  [/\bwok\b/i, 'Wok'],
  [/\bcasserole\b/i, 'Casserole'],
  [/\bcocotte\b/i, 'Cocotte'],
  [/\b(fouet(ter|tez)?|battre (les œufs|les blancs|énergiquement))\b/i, 'Fouet'],
  [/\b(batteur|monter les blancs)\b/i, 'Batteur électrique'],
  [/\b(mixer|mixeur|blender)\b/i, 'Mixeur'],
  [/\bmicro-ondes\b/i, 'Micro-ondes'],
  [/\bgrille-pain\b|\btoaster\b/i, 'Grille-pain'],
  [/\b(éplucher|épluchez|peler|pelez|éponger)\b/i, 'Économe'],
  [/\b(émincer|émincez|trancher|couper en (dés|fines lamelles|julienne)|cisel(er|ez))\b/i, 'Couteau de chef'],
  [/\b(râper|râpez|parmesan râpé)\b/i, 'Râpe'],
  [/\bmandoline\b/i, 'Mandoline'],
  [/\b(rouleau|étaler la pâte|abaisser)\b/i, 'Rouleau à pâtisserie'],
  [/\b(moule à tarte|foncer un moule)\b/i, 'Moule à tarte'],
  [/\bmoule\b/i, 'Moule à manqué'],
  [/\b(ramequin|ramequins)\b/i, 'Ramequins'],
  [/\b(plat à gratin|gratin?)\b/i, 'Plat à gratin'],
  [/\bpapier (cuisson|sulfurisé)\b/i, 'Papier cuisson'],
  [/\bsaladier\b/i, 'Saladier'],
  [/\b(passoire|égoutter|rincer|blanchir)\b/i, 'Passoire'],
  [/\bcuillère en bois\b/i, 'Cuillère en bois'],
  [/\bspatule\b/i, 'Spatule'],
  [/\bbain-marie\b/i, 'Thermomètre'],
  [/\bpresse-ail\b|\bail pressé\b/i, 'Presse-ail'],
];

/** Détecte l'ustensile principal mentionné dans une étape de recette. */
export function detecterUstensile(etape: string): string | null {
  for (const [regex, ustensile] of USTENSILE_KEYWORDS) {
    if (regex.test(etape)) return ustensile;
  }
  return null;
}
