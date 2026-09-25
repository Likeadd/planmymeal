// ============================================================================
// template.tsx — transition de page : fade 150 ms à chaque navigation.
// Roadmap animation n°3 : donne le feel « app native » cohérent avec la PWA.
// (template.tsx se remonte à CHAQUE navigation, contrairement à layout.tsx.)
// La règle globale prefers-reduced-motion de globals.css neutralise l'effet.
// ============================================================================

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
