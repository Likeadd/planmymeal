// Préchauffe l'index du catalogue au démarrage du serveur : le premier visiteur
// de /recettes n'attend pas la construction de l'index (≈ 7 s à froid).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { getIndex } = await import('@/lib/catalogue-index');
  getIndex().catch(() => { /* rechargé à la première requête */ });
}
