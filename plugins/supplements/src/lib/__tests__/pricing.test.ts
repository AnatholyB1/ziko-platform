import { describe, it, expect } from 'vitest';
import {
  toPriceNumber,
  formatPrice,
  formatFromPrice,
  pricePerDay,
  formatPerDay,
  sortOffers,
  lowestPrice,
  bestOfferId,
  isOfferOpenable,
  formatShortDate,
  latestScrapeLabel,
  PRICE_UNAVAILABLE,
} from '../pricing';

describe('toPriceNumber / formatPrice (SUPP-06 : jamais NaN ni 0 pour "inconnu")', () => {
  it('formate un nombre', () => {
    expect(formatPrice(14.9)).toBe('14,90 €');
    expect(formatPrice(9)).toBe('9,00 €');
  });
  it('accepte une chaine numerique (point ou virgule)', () => {
    expect(formatPrice('14.90')).toBe('14,90 €');
    expect(formatPrice('14,90')).toBe('14,90 €');
    expect(formatPrice(' 11.5 ')).toBe('11,50 €');
  });
  it.each([null, undefined, 0, '0', '', '  ', 'abc', NaN, Infinity, -3, 'NaN', 'undefined'])(
    'valeur inconnue %p => Prix indisponible',
    (v) => {
      expect(formatPrice(v as any)).toBe(PRICE_UNAVAILABLE);
      expect(formatFromPrice(v as any)).toBe(PRICE_UNAVAILABLE);
      expect(toPriceNumber(v as any)).toBeNull();
    },
  );
  it('"dès" prefixe un vrai prix', () => {
    expect(formatFromPrice(14.9)).toBe('dès 14,90 €');
  });
  it('ne produit jamais NaN / undefined / 0,00', () => {
    const inputs: any[] = [null, undefined, 0, '0', 'x', NaN, 12.345, '3.1'];
    for (const i of inputs) {
      for (const s of [formatPrice(i), formatFromPrice(i)]) {
        expect(s).not.toMatch(/NaN|undefined|null/);
        expect(s).not.toBe('0,00 €');
      }
    }
  });
});

describe('pricePerDay', () => {
  it('utilise price_per_serving', () => {
    expect(pricePerDay({ price: 14.9, price_per_serving: 0.25 })).toBeCloseTo(0.25);
    expect(pricePerDay({ price: 14.9, price_per_serving: '0.25' }, null, 2)).toBeCloseTo(0.5);
  });
  it('replie sur price / servings_per_container', () => {
    expect(pricePerDay({ price: 15, price_per_serving: null }, 60)).toBeCloseTo(0.25);
  });
  it('null si rien d exploitable', () => {
    expect(pricePerDay({ price: null, price_per_serving: null }, 60)).toBeNull();
    expect(pricePerDay({ price: 15, price_per_serving: 0 }, null)).toBeNull();
    expect(formatPerDay(null)).toBeNull();
    expect(formatPerDay(0.25)).toBe('0,25 € par jour');
  });
});

describe('sortOffers / lowestPrice / bestOfferId', () => {
  const offers = [
    { id: 'a', price: 16.9, in_stock: true },
    { id: 'b', price: null, in_stock: true },
    { id: 'c', price: 14.9, in_stock: true },
    { id: 'd', price: 0, in_stock: true },
    { id: 'e', price: '12.50', in_stock: false },
  ];
  it('trie par prix croissant, offres sans prix a la fin (ordre stable)', () => {
    expect(sortOffers(offers).map((o) => o.id)).toEqual(['e', 'c', 'a', 'b', 'd']);
  });
  it('ne modifie pas l entree', () => {
    const copy = offers.map((o) => o.id);
    sortOffers(offers);
    expect(offers.map((o) => o.id)).toEqual(copy);
  });
  it('lowestPrice ignore les prix inconnus', () => {
    expect(lowestPrice(offers)).toBe(12.5);
    expect(lowestPrice([{ price: null }, { price: 0 }])).toBeNull();
    expect(lowestPrice([])).toBeNull();
  });
  it('MEILLEUR PRIX = moins cher en stock', () => {
    expect(bestOfferId(offers)).toBe('c');
    expect(bestOfferId([{ id: 'x', price: null, in_stock: true }])).toBeNull();
    expect(bestOfferId([{ id: 'y', price: 5, in_stock: false }])).toBeNull();
  });
});

describe('isOfferOpenable', () => {
  it('exige un prix ET une url http(s)', () => {
    expect(isOfferOpenable({ price: 10, source_url: 'https://shop.example/p' })).toBe(true);
    expect(isOfferOpenable({ price: null, source_url: 'https://shop.example/p' })).toBe(false);
    expect(isOfferOpenable({ price: 10, source_url: null })).toBe(false);
    expect(isOfferOpenable({ price: 10, source_url: 'javascript:alert(1)' })).toBe(false);
  });
});

describe('dates de releve', () => {
  it('formatShortDate', () => {
    expect(formatShortDate('2026-11-09T12:00:00')).toBe('9 nov.');
    expect(formatShortDate('2026-03-01T12:00:00')).toBe('1 mars');
    expect(formatShortDate('pas une date')).toBeNull();
    expect(formatShortDate(null)).toBeNull();
  });
  it('latestScrapeLabel prend la plus recente', () => {
    expect(
      latestScrapeLabel([{ scraped_at: '2026-11-02T12:00:00' }, { scraped_at: '2026-11-09T12:00:00' }, { scraped_at: null }]),
    ).toBe('9 nov.');
    expect(latestScrapeLabel([{ scraped_at: null }])).toBeNull();
  });
});
