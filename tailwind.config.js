/** @type {import('tailwindcss').Config} */
//
// ─── SYSTÈME DE DESIGN — PlanMyMeal (audit #19) ──────────────────────────────
// CINQ couleurs, pas davantage. Chacune a UN rôle ; si un écran a besoin
// d'autre chose, c'est la palette qu'il faut étendre (ici), jamais un
// one-off dans le JSX.
//
//  brand   Terracotta  → action principale (CTA, lien actif, plat principal)
//  creme   Crème       → fond (la page respire, la carte ressort)
//  accent  Lavande     → intelligence/suggestions (batch, filtres avancés)
//  sauge   Vert doux   → succès/terminé/anti-gaspillage (cuit, économies)
//  sable   Beige       → intermédiaire (restes, jauges, filets discrets)
//  gray    Brun chaud  → textes (du 900 au 400, jamais de gris froid)
//
// Ombres : « card » repose la carte du fond, « pop » la SOULÈVE au survol —
// c'est tout (audit #20 : l'intensité des ombres a été réduite ; une ombre
// de plus serait de la décoration). Rayons : 14/18/24px, pill pour les
// actions. Typographie : serif display = titres/identité, Inter = tout le
// reste — les DONNÉES (chiffres, KPI, onglets) restent en sans-serif pour
// la lisibilité (audit #21).
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Terracotta — couleur dominante (boutons, liens, accents)
        brand: {
          50: '#FAF0E9',
          100: '#F3DED1',
          200: '#E7BCA3',
          300: '#D9946E',
          400: '#CF7040',
          500: '#C2532A', // contraste texte blanc 4,6:1 (WCAG AA)
          600: '#A84422',
          700: '#8A351A',
          800: '#6F2B15',
          900: '#5A2412',
          950: '#31110A',
        },
        // Violet doux / lavande — accent secondaire (pastilles, badges)
        accent: {
          50: '#F5F2FB',
          100: '#EBE5F6',
          200: '#D6CBEC',
          300: '#B8A6DD',
          400: '#997CCB',
          500: '#7C5FBF',
          600: '#6A4DAB',
          700: '#583E90',
          800: '#493474',
          900: '#3C2B5E',
          950: '#251834',
        },
        // Sauge — vert pastel chaud (accents secondaires, étiquettes accompagnements/desserts)
        // 100 = #E2F1E7 : le vert pastel de la charte landing
        sauge: {
          50: '#F2F9F5',
          100: '#E2F1E7',
          200: '#C5E2CF',
          300: '#9ECBAC',
          400: '#74AF85',
          500: '#549266',
          600: '#3F7551',
          700: '#335E42',
          800: '#2B4C37',
          900: '#253F2E',
          950: '#12221A',
        },
        // Sable — beige chaud (badges « restes », fonds discrets, filets)
        sable: {
          50: '#FCFAF4',
          100: '#F3EBDD',
          200: '#E8DCC4',
          300: '#D9C6A2',
          400: '#C5AB7E',
          500: '#B39463',
          600: '#A07F52',
          700: '#856744',
          800: '#6C5338',
          900: '#59452F',
          950: '#322519',
        },
        // Crème — blanc chaud de la landing (fonds de cartes alternatifs)
        creme: {
          50: '#FDFAF3',
        },
        // Vert amande — accents naturels résiduels
        forest: {
          50: '#F2F5EC',
          100: '#E2E8D3',
          200: '#C6D3A8',
          300: '#A4B97B',
          400: '#859E55',
          500: '#6A823F',
          600: '#546832',
          700: '#435228',
          800: '#374122',
          900: '#2E371D',
          950: '#181D0E',
        },
        // Crème & brun — fonds et texte (remplace les gris froids)
        gray: {
          50: '#FBF8F1',
          100: '#F6F0E4',
          200: '#ECE2CE',
          300: '#DDCFB3',
          400: '#9C8A6B', // icônes, placeholders, grands textes (≥ 3:1)
          500: '#7A6850', // texte secondaire (≥ 4,5:1 sur tous les fonds — AA)
          600: '#6A5A44',
          700: '#605242',
          800: '#483C2F',
          900: '#332A1E',
          950: '#241D14',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
        pill: '999px',
      },
      boxShadow: {
        // Ombres douces et chaudes (brun, jamais de gris froid), dosage
        // volontairement discret (audit #20 : « premium » > « décoratif ») :
        // card = la carte existe à peine au-dessus du fond ; pop = soulève
        // au survol ; cta = la seule ombre colorée, réservée aux actions.
        card: '0 1px 2px rgba(51, 42, 30, 0.03), 0 1px 4px rgba(51, 42, 30, 0.04)',
        pop: '0 10px 28px -12px rgba(51, 42, 30, 0.12), 0 2px 6px rgba(51, 42, 30, 0.05)',
        cta: '0 6px 16px -6px rgba(196, 85, 44, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
