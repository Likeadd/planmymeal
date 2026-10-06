'use client';

// ============================================================================
// FamilleSettings — « Pour qui je cuisine ? »
//
// Le foyer n'a pas un seul goût. Ici on décrit les autres convives : leur nom,
// l'importance de leurs goûts, ce qu'ils aiment ou ne supportent pas, et les
// recettes qu'ils refusent.
//
// C'est un écran de PONDÉRATION, pas une liste au feeling :
//   • `poids` (1 → 5) — combien ses goûts comptent dans le compromis ;
//   • aliments ❤️ / 👎 / 🚫 — « 🚫 » est une exclusion DURE (allergie, éthique) ;
//   • recettes — la note du membre et « ne plus proposer » (veto) ;
//   • curseur global — part du compromis familial dans le score.
//
// Chaque membre est enregistré EN ENTIER (PUT /api/famille) : la RPC
// save_family_member réécrit ses aliments et ses recettes dans une seule
// transaction. L'écran ne peut donc pas laisser un membre « à moitié enregistré ».
// ============================================================================

import { ouvrirPaywall } from '@/lib/paywall';
import { useAuth } from '@/components/AuthProvider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, Loader2, Plus, Trash2, Save, ChevronDown, Search, Scale, X, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EMOJIS_MEMBRE, POIDS_MEMBRE, RELATIONS_INGREDIENT,
  type Ingredient, type RelationIngredient,
} from '@/types';
import { NOTES_REPAS } from '@/lib/memoire';
import { createBrowserClient } from '@/lib/supabase';
import { invaliderFamille } from '@/lib/useFamille';
import { errorMessage, cn } from '@/lib/utils';

interface AlimentChoisi {
  ingredient_id: number;
  nom: string;
  relation: RelationIngredient;
}

interface RecetteChoisie {
  meal_id: number;
  titre: string;
  note: number | null;
  ne_plus_proposer: boolean;
}

interface MembreDraft {
  /** null = pas encore enregistré */
  id: number | null;
  nom: string;
  emoji: string;
  poids: number;
  age: string;
  aliments: AlimentChoisi[];
  recettes: RecetteChoisie[];
}

interface ReponseFamille {
  membres: {
    id: number; nom: string; emoji: string; poids: number; age: number | null;
    aliments: { ingredient_id: number; relation: RelationIngredient; nom?: string }[];
    recettes: { meal_id: number; note: number | null; ne_plus_proposer: boolean; titre?: string }[];
  }[];
  poids_famille: number;
  nb_personnes: number;
  max_membres: number;
}

/** Fiche vide pour un nouveau membre */
function nouveauMembre(): MembreDraft {
  return { id: null, nom: '', emoji: '👤', poids: 3, age: '', aliments: [], recettes: [] };
}

/** Nombre de résultats affichés dans une recherche (catalogue volumineux) */
const MAX_RESULTATS = 8;

export function FamilleSettings() {
  const { profile } = useAuth();
  const supabase = createBrowserClient();

  const [membres, setMembres] = useState<MembreDraft[]>([]);
  const [poidsFamille, setPoidsFamille] = useState(70);
  const [nbPersonnes, setNbPersonnes] = useState(2);
  const [maxMembres, setMaxMembres] = useState(12);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recettes, setRecettes] = useState<{ id: number; titre: string }[]>([]);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [enregistrement, setEnregistrement] = useState<number | null>(null);
  const [savingPoids, setSavingPoids] = useState(false);
  const [ajout, setAjout] = useState<MembreDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Chargement : membres + catalogues (aliments, recettes) ────────────────
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [familleRes, catalogue, repas] = await Promise.all([
          fetch('/api/famille').then(r => r.json().then(j => ({ ok: r.ok, j }))),
          supabase.from('ingredients').select('id, nom').order('nom'),
          supabase.from('meals').select('id, titre').eq('is_public', true).order('titre'),
        ]);
        if (!alive) return;

        if (!familleRes.ok) throw new Error(familleRes.j?.error || 'Erreur de chargement');
        const data = familleRes.j as ReponseFamille;

        setMembres(data.membres.map(m => ({
          id: m.id,
          nom: m.nom,
          emoji: m.emoji,
          poids: m.poids,
          age: m.age == null ? '' : String(m.age),
          aliments: m.aliments.map(a => ({
            ingredient_id: a.ingredient_id,
            nom: a.nom ?? `Ingrédient #${a.ingredient_id}`,
            relation: a.relation,
          })),
          recettes: m.recettes.map(r => ({
            meal_id: r.meal_id,
            titre: r.titre ?? `Recette #${r.meal_id}`,
            note: r.note,
            ne_plus_proposer: r.ne_plus_proposer,
          })),
        })));
        setPoidsFamille(data.poids_famille ?? 70);
        setNbPersonnes(data.nb_personnes ?? 2);
        setMaxMembres(data.max_membres ?? 12);
        setIngredients((catalogue.data ?? []) as unknown as Ingredient[]);
        setRecettes((repas.data ?? []) as { id: number; titre: string }[]);
      } catch (e) {
        if (alive) setError(errorMessage(e, 'Impossible de charger les profils du foyer'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [supabase]);

  /** Enregistre un membre entier (création ou remplacement complet) */
  const enregistrerMembre = useCallback(async (membre: MembreDraft, index: number) => {
    if (!membre.nom.trim()) {
      toast.error('Donne un prénom à ce membre');
      return;
    }
    setEnregistrement(index);
    try {
      const res = await fetch('/api/famille', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membre: {
            id: membre.id ?? undefined,
            nom: membre.nom.trim(),
            emoji: membre.emoji,
            poids: membre.poids,
            age: membre.age === '' ? null : Number(membre.age),
            aliments: membre.aliments.map(a => ({ ingredient_id: a.ingredient_id, relation: a.relation })),
            recettes: membre.recettes.map(r => ({
              meal_id: r.meal_id, note: r.note, ne_plus_proposer: r.ne_plus_proposer,
            })),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      if (json.membre_id != null) {
        setMembres(prev => prev.map((m, i) => i === index ? { ...m, id: json.membre_id } : m));
      }
      if (typeof json.nb_personnes === 'number') setNbPersonnes(json.nb_personnes);
      // Le planning affiche l'avis de chaque membre : son cache doit être
      // périmé dès qu'un goût change, sinon le dashboard montrerait l'ancien.
      invaliderFamille();
      toast.success(
        json.liste_recalculee
          ? `Enregistré — portions ajustées à ${json.nb_personnes} et liste de courses recalculée`
          : 'Enregistré'
      );
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'enregistrer ce membre"));
    } finally {
      setEnregistrement(null);
    }
  }, []);

  /** Ajoute un nouveau membre (il doit exister côté base pour recevoir ses aliments) */
  const ajouterMembre = async () => {
    if (!ajout) return;
    setEnregistrement(-1);
    try {
      const res = await fetch('/api/famille', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membre: {
            nom: ajout.nom.trim(),
            emoji: ajout.emoji,
            poids: ajout.poids,
            age: ajout.age === '' ? null : Number(ajout.age),
            aliments: [],
            recettes: [],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      setMembres(prev => [...prev, { ...ajout, id: json.membre_id, nom: ajout.nom.trim() }]);
      if (typeof json.nb_personnes === 'number') setNbPersonnes(json.nb_personnes);
      invaliderFamille();
      setOuvert(membres.length);
      setAjout(null);
      toast.success(`${ajout.nom.trim()} ajouté au foyer`);
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'ajouter ce membre"));
    } finally {
      setEnregistrement(null);
    }
  };

  const supprimerMembre = async (membre: MembreDraft, index: number) => {
    if (membre.id == null) {
      setMembres(prev => prev.filter((_, i) => i !== index));
      return;
    }
    try {
      const res = await fetch(`/api/famille?membre_id=${membre.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Erreur ${res.status}`);
      }
      setMembres(prev => prev.filter((_, i) => i !== index));
      invaliderFamille();
      if (ouvert === index) setOuvert(null);
      toast.success(`${membre.nom} retiré du foyer`);
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible de retirer ce membre'));
    }
  };

  const enregistrerPoids = async () => {
    setSavingPoids(true);
    try {
      const res = await fetch('/api/famille', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poids_famille: poidsFamille }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      invaliderFamille();
      toast.success('Pondération du foyer enregistrée');
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible d\'enregistrer la pondération'));
    } finally {
      setSavingPoids(false);
    }
  };

  /** Met à jour le brouillon d'un membre (immuable) */
  const majMembre = (index: number, patch: Partial<MembreDraft>) => {
    setMembres(prev => prev.map((m, i) => i === index ? { ...m, ...patch } : m));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    );
  }

  // Ce que le curseur change réellement dans le score (lib/famille.ts)
  const descriptionPoids = poidsFamille <= 20
    ? 'Priorité à tes goûts : la famille ne pèse qu\'en cas de conflit.'
    : poidsFamille >= 80
      ? 'Priorité au foyer : le score reflète surtout le compromis entre membres.'
      : 'Équilibre : tes goûts et ceux du foyer pèsent d\'un poids comparable.';

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
      <div className="flex items-start gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-accent-100 text-accent-600 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">Pour qui je cuisine ?</h2>
          <p className="text-sm text-gray-500">
            Le moteur cherche le <strong className="font-semibold text-gray-700">meilleur compromis</strong> :
            un plat détesté par un membre est fortement pénalisé, même si les autres l&apos;adorent.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* ── Membres enregistrés ── */}
      {membres.length === 0 && !ajout && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center">
          <p className="text-sm text-gray-600 font-medium">Pour l&apos;instant, le moteur cuisine pour toi seul.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Ajoute les personnes à table : leurs goûts, leurs allergies et leurs refus entreront
            dans chaque génération de planning.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {membres.map((membre, index) => (
          <CarteMembre
            key={membre.id ?? `nouveau-${index}`}
            membre={membre}
            index={index}
            ouvert={ouvert === index}
            enregistrement={enregistrement === index}
            ingredients={ingredients}
            recettes={recettes}
            onOuvrir={() => setOuvert(ouvert === index ? null : index)}
            onMaj={patch => majMembre(index, patch)}
            onEnregistrer={() => enregistrerMembre(membre, index)}
            onSupprimer={() => supprimerMembre(membre, index)}
          />
        ))}
      </div>

      {/* ── Ajout d'un membre ── */}
      {ajout ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Nouveau membre</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ajout.emoji}
              onChange={e => setAjout({ ...ajout, emoji: e.target.value })}
              aria-label="Emoji du membre"
              className="px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg"
            >
              {EMOJIS_MEMBRE.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              autoFocus
              value={ajout.nom}
              onChange={e => setAjout({ ...ajout, nom: e.target.value })}
              placeholder="Prénom"
              maxLength={40}
              aria-label="Prénom du membre"
              className="flex-1 min-w-[120px] px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300"
            />
            <div className="flex items-center gap-1">
              {POIDS_MEMBRE.map(p => (
                <button
                  key={p.value}
                  type="button"
                  title={`${p.label} — ${p.description}`}
                  aria-label={`Poids ${p.label}`}
                  aria-pressed={ajout.poids === p.value}
                  onClick={() => setAjout({ ...ajout, poids: p.value })}
                  className={cn(
                    'w-7 h-7 text-xs font-semibold rounded-lg border transition-colors',
                    ajout.poids === p.value
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-brand-300'
                  )}
                >
                  {p.value}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={ajouterMembre}
              disabled={enregistrement === -1}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {enregistrement === -1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
            <button
              onClick={() => setAjout(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-full transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        membres.length < maxMembres && (
          <button
            onClick={() => (profile?.plan === 'famille' ? setAjout(nouveauMembre()) : ouvrirPaywall('famille'))}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter un membre
          </button>
        )
      )}

      {/* ── Pondération globale ── */}
      <section className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
          <Scale className="w-4 h-4 text-brand-500" /> Poids du compromis familial
        </h3>
        <input
          type="range" min={0} max={100} step={5} value={poidsFamille}
          onChange={e => setPoidsFamille(Number(e.target.value))}
          aria-label="Poids du compromis familial"
          className="w-full accent-brand-500"
        />
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mt-1">
          <span>🍽️ Mes goûts d&apos;abord</span>
          <span className="text-brand-600">{poidsFamille} %</span>
          <span>Tout le monde 💛</span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-gray-500" />
          {poidsFamille === 0
            ? 'À 0 %, la famille n\'influence plus le score : tu gardes exactement le planning d\'avant.'
            : `${descriptionPoids} Les aliments « 🚫 interdit » et les allergies restent exclus dans tous les cas.`}
        </p>
        <button
          onClick={enregistrerPoids}
          disabled={savingPoids}
          className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {savingPoids ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la pondération
        </button>
        <p className="mt-3 text-[11px] text-gray-500">
          Quantités prévues : <strong className="text-gray-600">{nbPersonnes} personnes</strong>
          {' '}(ajouter un membre ajuste automatiquement les portions et la liste de courses).
        </p>
      </section>
    </div>
  );
}

// ─── Carte d'un membre ──────────────────────────────────────────────────────

interface CarteMembreProps {
  membre: MembreDraft;
  index: number;
  ouvert: boolean;
  enregistrement: boolean;
  ingredients: Ingredient[];
  recettes: { id: number; titre: string }[];
  onOuvrir: () => void;
  onMaj: (patch: Partial<MembreDraft>) => void;
  onEnregistrer: () => void;
  onSupprimer: () => void;
}

function CarteMembre({
  membre, ouvert, enregistrement, ingredients, recettes,
  onOuvrir, onMaj, onEnregistrer, onSupprimer,
}: CarteMembreProps) {
  const palier = POIDS_MEMBRE.reduce((best, p) =>
    Math.abs(p.value - membre.poids) < Math.abs(best.value - membre.poids) ? p : best
  );

  const interdits = membre.aliments.filter(a => a.relation === 'interdit').length;
  const vetoes = membre.recettes.filter(r => r.ne_plus_proposer).length;

  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      ouvert ? 'border-brand-200 bg-brand-50/20' : 'border-gray-100'
    )}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-xl" aria-hidden>{membre.emoji}</span>
        <button
          onClick={onOuvrir}
          aria-expanded={ouvert}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-semibold text-gray-800 truncate">
            {membre.nom || 'Nouveau membre'}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            Poids {membre.poids}/5 ({palier.label})
            {membre.aliments.length > 0 && ` · ${membre.aliments.length} aliment${membre.aliments.length > 1 ? 's' : ''}`}
            {interdits > 0 && ` · ${interdits} interdit${interdits > 1 ? 's' : ''}`}
            {vetoes > 0 && ` · ${vetoes} refus`}
          </p>
        </button>
        <button
          onClick={onSupprimer}
          aria-label={`Retirer ${membre.nom || 'ce membre'}`}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onOuvrir}
          aria-label={ouvert ? 'Replier' : 'Déplier'}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-600 transition-colors shrink-0"
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', ouvert && 'rotate-180')} />
        </button>
      </div>

      {ouvert && (
        <div className="px-3 pb-4 space-y-4">
          {/* Identité + pondération */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={membre.emoji}
              onChange={e => onMaj({ emoji: e.target.value })}
              aria-label="Emoji du membre"
              className="px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg"
            >
              {EMOJIS_MEMBRE.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              value={membre.nom}
              onChange={e => onMaj({ nom: e.target.value })}
              placeholder="Prénom"
              maxLength={40}
              aria-label="Prénom du membre"
              className="flex-1 min-w-[120px] px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300"
            />
            <input
              value={membre.age}
              onChange={e => onMaj({ age: e.target.value.replace(/[^0-9]/g, '') })}
              placeholder="Âge"
              inputMode="numeric"
              maxLength={3}
              aria-label="Âge du membre"
              className="w-16 px-2 py-1.5 text-sm text-center bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300"
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Poids de ses goûts
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {POIDS_MEMBRE.map(p => (
                <button
                  key={p.value}
                  type="button"
                  title={p.description}
                  aria-pressed={membre.poids === p.value}
                  onClick={() => onMaj({ poids: p.value })}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                    membre.poids === p.value
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'
                  )}
                >
                  {p.value} · {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aliments */}
          <PickAliments
            choix={membre.aliments}
            ingredients={ingredients}
            onAjouter={a => onMaj({ aliments: [...membre.aliments, a] })}
            onSupprimer={id => onMaj({ aliments: membre.aliments.filter(a => a.ingredient_id !== id) })}
            onRelation={(id, relation) => onMaj({
              aliments: membre.aliments.map(a => a.ingredient_id === id ? { ...a, relation } : a),
            })}
          />

          {/* Recettes */}
          <PickRecettes
            choix={membre.recettes}
            recettes={recettes}
            onAjouter={r => onMaj({ recettes: [...membre.recettes, r] })}
            onSupprimer={id => onMaj({ recettes: membre.recettes.filter(r => r.meal_id !== id) })}
            onNote={(id, note) => onMaj({
              recettes: membre.recettes.map(r => r.meal_id === id ? { ...r, note } : r),
            })}
            onVeto={(id, veto) => onMaj({
              recettes: membre.recettes.map(r => r.meal_id === id ? { ...r, ne_plus_proposer: veto } : r),
            })}
          />

          <button
            onClick={onEnregistrer}
            disabled={enregistrement}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer {membre.nom || 'ce membre'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sélecteur d'aliments ───────────────────────────────────────────────────

interface PickAlimentsProps {
  choix: AlimentChoisi[];
  ingredients: Ingredient[];
  onAjouter: (a: AlimentChoisi) => void;
  onSupprimer: (ingredientId: number) => void;
  onRelation: (ingredientId: number, relation: RelationIngredient) => void;
}

function PickAliments({ choix, ingredients, onAjouter, onSupprimer, onRelation }: PickAlimentsProps) {
  const [recherche, setRecherche] = useState('');

  const dejaChoisis = useMemo(() => new Set(choix.map(a => a.ingredient_id)), [choix]);

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return ingredients
      .filter(i => !dejaChoisis.has(i.id) && i.nom.toLowerCase().includes(q))
      .slice(0, MAX_RESULTATS);
  }, [recherche, ingredients, dejaChoisis]);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        Ses aliments
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Chercher un aliment (2 lettres min.)…"
          aria-label="Chercher un aliment"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {resultats.length > 0 && (
        <ul className="mt-1.5 space-y-1 max-h-56 overflow-y-auto">
          {resultats.map(i => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-gray-700">{i.nom}</span>
              {RELATIONS_INGREDIENT.map(r => (
                <button
                  key={r.value}
                  type="button"
                  title={`${i.nom} — ${r.label}`}
                  aria-label={`${i.nom} : ${r.label}`}
                  onClick={() => {
                    onAjouter({ ingredient_id: i.id, nom: i.nom, relation: r.value });
                    setRecherche('');
                  }}
                  className="px-1.5 py-0.5 text-xs rounded-md border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <span aria-hidden>{r.emoji}</span>
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {choix.length === 0 ? (
        <p className="mt-2 text-[11px] text-gray-500">
          Aucun aliment renseigné — le moteur traite ce membre comme neutre.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {choix.map(a => (
            <li key={a.ingredient_id}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
              <span className="flex-1 truncate text-xs text-gray-700">{a.nom}</span>
              <div className="flex items-center gap-1">
                {RELATIONS_INGREDIENT.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    title={r.label}
                    aria-label={`${a.nom} : ${r.label}`}
                    aria-pressed={a.relation === r.value}
                    onClick={() => onRelation(a.ingredient_id, r.value)}
                    className={cn(
                      'px-1.5 py-0.5 text-xs rounded-md border transition-colors',
                      a.relation === r.value
                        ? 'bg-brand-500 border-brand-500'
                        : 'bg-white border-gray-200 hover:border-brand-300'
                    )}
                  >
                    <span aria-hidden>{r.emoji}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onSupprimer(a.ingredient_id)}
                aria-label={`Retirer ${a.nom}`}
                className="p-1 rounded-sm text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Sélecteur de recettes ──────────────────────────────────────────────────

interface PickRecettesProps {
  choix: RecetteChoisie[];
  recettes: { id: number; titre: string }[];
  onAjouter: (r: RecetteChoisie) => void;
  onSupprimer: (mealId: number) => void;
  onNote: (mealId: number, note: number | null) => void;
  onVeto: (mealId: number, veto: boolean) => void;
}

function PickRecettes({ choix, recettes, onAjouter, onSupprimer, onNote, onVeto }: PickRecettesProps) {
  const [recherche, setRecherche] = useState('');

  const dejaChoisies = useMemo(() => new Set(choix.map(r => r.meal_id)), [choix]);

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return recettes
      .filter(r => !dejaChoisies.has(r.id) && r.titre.toLowerCase().includes(q))
      .slice(0, MAX_RESULTATS);
  }, [recherche, recettes, dejaChoisies]);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        Ses recettes <span className="font-normal normal-case">(note et refus)</span>
      </p>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Chercher une recette (2 lettres min.)…"
          aria-label="Chercher une recette"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {resultats.length > 0 && (
        <ul className="mt-1.5 space-y-1 max-h-56 overflow-y-auto">
          {resultats.map(r => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onAjouter({ meal_id: r.id, titre: r.titre, note: null, ne_plus_proposer: false });
                  setRecherche('');
                }}
                className="w-full text-left px-2 py-1 text-xs text-gray-700 rounded-lg hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                {r.titre}
              </button>
            </li>
          ))}
        </ul>
      )}

      {choix.length === 0 ? (
        <p className="mt-2 text-[11px] text-gray-500">
          Aucune recette renseignée — « 🚫 » n&apos;est appliqué en dur que si la majorité du foyer refuse.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {choix.map(r => (
            <li key={r.meal_id}
              className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="flex-1 min-w-[140px] text-xs text-gray-700">{r.titre}</span>
              <div className="flex items-center gap-1">
                {NOTES_REPAS.map(n => (
                  <button
                    key={n.value}
                    type="button"
                    title={`${r.titre} — ${n.label}`}
                    aria-label={`${r.titre} : ${n.label}`}
                    aria-pressed={r.note === n.value}
                    onClick={() => onNote(r.meal_id, r.note === n.value ? null : n.value)}
                    className={cn(
                      'px-1.5 py-0.5 text-xs rounded-md border transition-colors',
                      r.note === n.value
                        ? 'bg-brand-500 border-brand-500'
                        : 'bg-white border-gray-200 hover:border-brand-300'
                    )}
                  >
                    <span aria-hidden>{n.emoji}</span>
                  </button>
                ))}
                <button
                  type="button"
                  title="Ne plus proposer"
                  aria-label={`${r.titre} : ne plus proposer`}
                  aria-pressed={r.ne_plus_proposer}
                  onClick={() => onVeto(r.meal_id, !r.ne_plus_proposer)}
                  className={cn(
                    'px-1.5 py-0.5 text-xs rounded-md border transition-colors',
                    r.ne_plus_proposer
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-red-300'
                  )}
                >
                  <span aria-hidden>🚫</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSupprimer(r.meal_id)}
                aria-label={`Retirer ${r.titre}`}
                className="p-1 rounded-sm text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
