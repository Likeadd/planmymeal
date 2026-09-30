// Écriture du profil depuis le navigateur : un seul point d'entrée, l'API
// serveur /api/profil (validation + liste blanche), plus d'écriture directe.

export interface EnregistrementProfil {
  profil?: Record<string, unknown>;
  corps?: { sexe: 'homme' | 'femme' | null; age: number | null; taille_cm: number | null; poids_kg: number | null };
  exclusions?: { allergies: string[]; detestes: string[] };
  regimes?: { liste: string[]; mode?: 'remplacer' | 'ajouter' };
}

export async function enregistrerProfil(payload: EnregistrementProfil): Promise<void> {
  const res = await fetch('/api/profil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
    throw new Error(error || `Erreur ${res.status}`);
  }
}
