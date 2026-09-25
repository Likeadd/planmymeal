import { describe, it, expect } from 'vitest';
import { assignerDessertsMidi, DESSERTS_MIDI_PAR_SEMAINE, type Candidate } from '@/lib/rotation-engine';
import type { DayPlan, Meal } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const meal = (id: number): Meal =>
  ({ id, titre: `Dessert ${id}`, type_repas: 'dessert' }) as unknown as Meal;

const candidate = (id: number, score = 1): Candidate => ({ meal: meal(id), score });

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const day = (
  idx: number,
  opts: { dejeuner?: Meal | null; restesDe?: number | null } = {}
): DayPlan => ({
  jour: JOURS[idx],
  jourIndex: idx,
  dejeuner: opts.dejeuner ?? null,
  diner: null,
  dessert: null,
  dessertMidi: null,
  restesDe: opts.restesDe ?? null,
});

/** Semaine meal prep : chaque déjeuner est le reste du dîner de la veille */
const semaineRestes = () =>
  Array.from({ length: 7 }, (_, i) => day(i, { dejeuner: meal(100 + i), restesDe: 50 + i }));

const joursAvecDessert = (days: DayPlan[]) =>
  days.filter(d => d.dessertMidi != null).map(d => d.jourIndex);

// ─── Batch cooking ──────────────────────────────────────────────────────────

describe('assignerDessertsMidi — batch cooking', () => {
  it('attribue des desserts midi aux jours batch même quand le déjeuner est un reste', () => {
    // Batch le dimanche (6) → jours couverts 6, 0, 1, 2
    const result = assignerDessertsMidi(
      semaineRestes(),
      [candidate(1), candidate(2), candidate(3), candidate(4)],
      DESSERTS_MIDI_PAR_SEMAINE,
      [6, 0, 1, 2]
    );
    const jours = joursAvecDessert(result);
    expect(jours.length).toBe(3); // DESSERTS_MIDI_PAR_SEMAINE
    for (const j of jours) expect([6, 0, 1, 2]).toContain(j);
  });

  it('sans batch : les déjeuners en restes ne reçoivent jamais de dessert midi', () => {
    const result = assignerDessertsMidi(
      semaineRestes(),
      [candidate(1), candidate(2), candidate(3)],
      DESSERTS_MIDI_PAR_SEMAINE,
      []
    );
    expect(joursAvecDessert(result)).toEqual([]);
  });

  it('priorise les déjeuners libres avant les jours batch en restes', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      i < 3
        ? day(i, { dejeuner: meal(100 + i) })
        : day(i, { dejeuner: meal(100 + i), restesDe: 50 + i })
    );
    const result = assignerDessertsMidi(days, [candidate(1), candidate(2), candidate(3)], DESSERTS_MIDI_PAR_SEMAINE, [4, 5, 6]);
    expect(joursAvecDessert(result)).toEqual([0, 1, 2]);
  });
});

// ─── Règles générales (hors batch) ──────────────────────────────────────────

describe('assignerDessertsMidi — règles générales', () => {
  it('un jour sans déjeuner n’est jamais éligible', () => {
    const days = [
      day(0), // pas de déjeuner
      ...Array.from({ length: 6 }, (_, i) => day(i + 1, { dejeuner: meal(100 + i) })),
    ];
    const result = assignerDessertsMidi(days, [candidate(9), candidate(10), candidate(11)], DESSERTS_MIDI_PAR_SEMAINE);
    expect(result[0].dessertMidi).toBeNull();
    expect(joursAvecDessert(result)).toEqual([1, 2, 3]);
  });

  it('max 3 desserts midi par semaine, jamais deux fois le même', () => {
    const days = Array.from({ length: 7 }, (_, i) => day(i, { dejeuner: meal(100 + i) }));
    const result = assignerDessertsMidi(days, [1, 2, 3, 4, 5].map(id => candidate(id)), DESSERTS_MIDI_PAR_SEMAINE);
    const ids = result.filter(d => d.dessertMidi != null).map(d => d.dessertMidi!.id);
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pool vide → semaine inchangée', () => {
    const days = Array.from({ length: 7 }, (_, i) => day(i, { dejeuner: meal(100 + i) }));
    const result = assignerDessertsMidi(days, [], DESSERTS_MIDI_PAR_SEMAINE);
    expect(result.every(d => d.dessertMidi == null)).toBe(true);
  });
});
