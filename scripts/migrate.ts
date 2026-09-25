// ============================================================================
// Guide d'application des migrations SQL
// Usage : npm run db:migrate
// ============================================================================

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(import.meta.dirname || __dirname, '..', 'supabase', 'migrations');
// Filtre optionnel : npm run db:migrate -- 00004
const filter = process.argv[2];
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .filter(f => (filter ? f.includes(filter) : true))
  .sort();

if (files.length === 0) {
  console.log('ℹ️  Aucune migration trouvée.');
  process.exit(0);
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  📦 APPLICATION DES MIGRATIONS SUPABASE                     ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║                                                              ║');
console.log('║  Méthode recommandée :                                       ║');
console.log('║  1. Ouvre le dashboard Supabase                              ║');
console.log('║  2. Va dans SQL Editor                                       ║');
console.log('║  3. Exécute les fichiers .sql un par un                      ║');
console.log('║     dans l\'ordre ci-dessous                                  ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf-8');
  const lines = sql.split('\n').filter(l => !l.startsWith('--')).length;

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📄 ${file}  (${lines} lignes de SQL)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('');
  console.log(sql);
  console.log('');
}

console.log('✅ Prêt ! Copie chaque bloc SQL dans le SQL Editor de Supabase.');
console.log('   Une fois les migrations appliquées, lance : npm run seed');