// SUPP-03 / SUPP-06 : formatage et tri des offres, sans jamais afficher NaN ni 0 pour "inconnu".
// Colonnes reelles de ziko_supplement_prices : price, price_per_serving (PAS price_eur / per_serving_eur,
// la cause du "NaN€" historique).

export type PriceInput = number | string | null | undefined;

export const PRICE_UNAVAILABLE = 'Prix indisponible';
export const PRICE_NOT_COMMUNICATED = 'Prix non communiqué';

export interface Offer {
  id: string;
  source: string;
  source_url: string | null;
  price: PriceInput;
  price_per_serving?: PriceInput;
  in_stock?: boolean | null;
  scraped_at?: string | null;
}

/** Nombre > 0 et fini, sinon null. Accepte "14.90" et "14,90". 0 = inconnu, jamais un vrai prix. */
export function toPriceNumber(value: PriceInput): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    const cleaned = String(value).trim().replace(/\s/g, '').replace('€', '').replace(',', '.');
    if (cleaned === '') return null;
    n = Number(cleaned);
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function euros(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

/** "14,90 €" ou "Prix indisponible". */
export function formatPrice(value: PriceInput): string {
  const n = toPriceNumber(value);
  return n === null ? PRICE_UNAVAILABLE : euros(n);
}

/** "dès 14,90 €" ou "Prix indisponible". */
export function formatFromPrice(value: PriceInput): string {
  const n = toPriceNumber(value);
  return n === null ? PRICE_UNAVAILABLE : `dès ${euros(n)}`;
}

/**
 * Prix par jour pour `servingsPerDay` prises (defaut 1). Utilise price_per_serving, sinon
 * price / servingsPerContainer si connu. null si rien d'exploitable.
 */
export function pricePerDay(
  offer: Pick<Offer, 'price' | 'price_per_serving'>,
  servingsPerContainer?: number | null,
  servingsPerDay = 1,
): number | null {
  const perDay = Number.isFinite(servingsPerDay) && servingsPerDay > 0 ? servingsPerDay : 1;
  const perServing = toPriceNumber(offer.price_per_serving);
  if (perServing !== null) return perServing * perDay;
  const price = toPriceNumber(offer.price);
  if (price !== null && servingsPerContainer && servingsPerContainer > 0) {
    return (price / servingsPerContainer) * perDay;
  }
  return null;
}

/** "0,25 € par jour" ou null. */
export function formatPerDay(perDay: number | null): string | null {
  return perDay === null ? null : `${euros(perDay)} par jour`;
}

/** Offres a prix d'abord (croissant, stable), puis offres sans prix. N'altere pas l'entree. */
export function sortOffers<T extends Pick<Offer, 'price'>>(offers: readonly T[]): T[] {
  return offers
    .map((o, i) => ({ o, i, p: toPriceNumber(o.price) }))
    .sort((a, b) => {
      if (a.p === null && b.p === null) return a.i - b.i;
      if (a.p === null) return 1;
      if (b.p === null) return -1;
      return a.p - b.p || a.i - b.i;
    })
    .map((x) => x.o);
}

/** Prix le plus bas parmi les offres a prix (en stock ou non), pour "dès X €". */
export function lowestPrice(offers: ReadonlyArray<Pick<Offer, 'price'>>): number | null {
  let best: number | null = null;
  for (const o of offers) {
    const p = toPriceNumber(o.price);
    if (p !== null && (best === null || p < best)) best = p;
  }
  return best;
}

/** Id de l'offre "MEILLEUR PRIX" : la moins chere parmi celles a prix ET en stock. */
export function bestOfferId(offers: ReadonlyArray<Pick<Offer, 'id' | 'price' | 'in_stock'>>): string | null {
  let bestId: string | null = null;
  let best: number | null = null;
  for (const o of offers) {
    if (o.in_stock === false) continue;
    const p = toPriceNumber(o.price);
    if (p !== null && (best === null || p < best)) {
      best = p;
      bestId = o.id;
    }
  }
  return bestId;
}

/** Une offre n'est cliquable que si elle a un prix ET une URL http(s). */
export function isOfferOpenable(offer: Pick<Offer, 'price' | 'source_url'>): boolean {
  return toPriceNumber(offer.price) !== null && /^https?:\/\//i.test(offer.source_url ?? '');
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** "9 nov." depuis une date ISO ; null si invalide. */
export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Date de releve la plus recente parmi les offres, formatee, ou null. */
export function latestScrapeLabel(offers: ReadonlyArray<Pick<Offer, 'scraped_at'>>): string | null {
  let latest: number | null = null;
  for (const o of offers) {
    if (!o.scraped_at) continue;
    const t = new Date(o.scraped_at).getTime();
    if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
  }
  return latest === null ? null : formatShortDate(new Date(latest).toISOString());
}
