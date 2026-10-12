// Lien public d'un menu de la semaine (/menu/[token], lecture seule, sans compte)
export async function lienPublicMenu(semaineDebut: string): Promise<string> {
  const res = await fetch('/api/planning/partager', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semaine_debut: semaineDebut }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) throw new Error(json.error || 'Partage impossible pour le moment.');
  return json.url as string;
}
