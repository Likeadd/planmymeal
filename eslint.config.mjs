import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// ============================================================================
// Charte graphique — interdiction des couleurs brutes hors palette.
// La charte (landing + dashboard) n'utilise que : brand (terracotta), accent
// (lavande), sauge, sable, creme, gray (re-mappé chaud) et red (danger).
// Tout green/orange/blue/... brut échappe à la charte → erreur.
// Chaque occurrence existante est listée dans allowedFiles : le fichier est
// soit converti, soit ajouté ici explicitement (dette visible et bornée).
// ============================================================================
const OFF_PALETTE_PATTERN =
  '\\b(blue|indigo|purple|violet|pink|rose|yellow|amber|lime|emerald|teal|cyan|sky|fuchsia|green|orange|slate|zinc|stone|neutral|black)-[0-9]{2,4}\\b';

const allowedFiles = [
  // Landing : source de la charte — pastels de démo et étoiles de
  // témoignages. Convertir ici = toucher la page de référence.
  'src/app/page.tsx',
];

const noOffPaletteColors = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Interdit les classes Tailwind de couleurs brutes hors charte (ex. green, orange, blue avec nuance numérique). Utiliser brand/accent/sauge/sable/creme/gray.',
    },
    schema: [],
    messages: {
      offPalette:
        "Couleur brute « {{cls}} » hors charte — utiliser brand (terracotta), accent (lavande), sauge, sable, creme ou gray (déjà chaud). Si le fichier est légitimement hors charte, l'ajouter à allowedFiles dans eslint.config.mjs.",
    },
  },
  create(context) {
    // context.filename est absolu → normaliser en chemin relatif au projet
    // (séparateurs / + troncature avant « /src/ ») pour matcher allowedFiles.
    const norm = context.filename.replace(/\\/g, '/');
    const srcIdx = norm.lastIndexOf('/src/');
    const filename = srcIdx >= 0 ? norm.slice(srcIdx + 1) : norm;
    if (allowedFiles.includes(filename)) return {};
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const re = new RegExp(OFF_PALETTE_PATTERN);
        const m = re.exec(node.value);
        if (m) {
          context.report({
            node,
            messageId: 'offPalette',
            data: { cls: m[0] },
          });
        }
      },
    'TemplateElement'(node) {
      const raw = node.value.raw || '';
      const re = new RegExp(OFF_PALETTE_PATTERN);
      const m = re.exec(raw);
      if (m) {
        context.report({
          node,
          messageId: 'offPalette',
          data: { cls: m[0] },
        });
      }
    },
    };
  },
};

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // ESLint 10 a retiré `context.getFilename()` (remplacé par `context.filename`).
    // eslint-plugin-react (dépendance d'eslint-config-next) l'utilise encore pour
    // DÉTECTER automatiquement la version de React depuis le package.json le plus
    // proche → plante avec ESLint 10. Fixer la version explicitement court-circuite
    // cette détection (le plugin ne l'appelle plus) : plus besoin d'attendre la
    // correction en amont d'eslint-plugin-react.
    settings: { react: { version: '19.2.7' } },
  },
  {
    plugins: { charte: { rules: { 'no-off-palette-colors': noOffPaletteColors } } },
    rules: {
      // Fin de la dette « any » : tous les appels Supabase sont typés via les
      // types Database générés (supabase/database.types.ts) + src/lib/db-rows.ts.
      // Interdiction d'introduire de nouveaux casts any (CI bloquante).
      '@typescript-eslint/no-explicit-any': 'error',
      'charte/no-off-palette-colors': 'error',
    },
  },
  {
    // Edge Functions Supabase : runtime Deno isolé (déployées indépendamment de
    // l'app Next). On y tolère `any` + `let` pour couper le bruit de lint qui
    // masquait les vraies régressions côté app.
    files: ['supabase/functions/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'scripts/**', 'marketing/**'],
  },
];

export default eslintConfig;
