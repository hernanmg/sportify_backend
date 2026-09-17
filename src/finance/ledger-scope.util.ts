import { LedgerCategory } from './finance.enums';

export type LedgerScope = 'all' | 'team' | 'events';

const EVENT_REFERENCE_TYPES = new Set([
  'sport_event',
  'event_expense',
  'social_event',
  'training_expense',
]);

const EVENT_CATEGORIES = new Set<string>([
  LedgerCategory.TRAINING,
  LedgerCategory.EVENT,
  LedgerCategory.MATCH,
  'social',
]);

/** Clasificación canónica equipo vs evento (reportes, summary y API). */
export function isEventRelatedLedgerEntry(entry: {
  referenceType?: string | null;
  category?: string | null;
}): boolean {
  const ref = (entry.referenceType ?? '').toLowerCase().trim();
  if (ref && EVENT_REFERENCE_TYPES.has(ref)) return true;
  const cat = (entry.category ?? '').toLowerCase().trim();
  return EVENT_CATEGORIES.has(cat);
}

export function matchesLedgerScope(
  entry: { referenceType?: string | null; category?: string | null },
  scope: LedgerScope = 'all',
): boolean {
  if (scope === 'all') return true;
  const isEvent = isEventRelatedLedgerEntry(entry);
  return scope === 'events' ? isEvent : !isEvent;
}

export function parseLedgerScope(raw?: string): LedgerScope {
  const v = (raw ?? 'all').toLowerCase().trim();
  if (v === 'team' || v === 'events' || v === 'event') {
    return v === 'event' ? 'events' : (v as LedgerScope);
  }
  return 'all';
}
