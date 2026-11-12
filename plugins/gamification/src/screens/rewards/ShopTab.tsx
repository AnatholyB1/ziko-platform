import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME_REGISTRY, BANNER_REGISTRY, type ThemePalette } from '@ziko/plugin-sdk';
import {
  CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_SINGULAR, EQUIP_NOTE, GOLD, GOLD_BORDER, GOLD_TINT,
  categoryCounts, itemsInCategory, missingCoinsShort, missingCoinsText, ownedByCategory, priceLabel, shopItemState, themeEquipNote,
  type InventoryLite, type ShopCategory, type ShopItemLite, type ShopItemState,
} from '../../rewards';
import { Card, Chip, EmptyCard, ErrorCard, PrimaryButton, SecondaryButton, Sheet, SkeletonRows } from './ui';

export interface ShopData {
  items: ShopItemLite[];
  inventory: InventoryLite[];
}

interface Props {
  data: ShopData | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  coins: number;
  level: number;
  displayName: string;
  coachBrandingActive: boolean;
  onBuy: (item: ShopItemLite) => Promise<{ success: boolean; error?: string }>;
  onEquip: (item: ShopItemLite) => Promise<{ success: boolean; error?: string }>;
  onToast: (message: string) => void;
  onOpenInventory?: () => void;
  theme: ThemePalette;
}

/** Visuel d'un objet : echantillon du theme, bandeau de banniere, sinon icone de categorie. */
function ItemVisual({ item, theme, size = 44 }: { item: ShopItemLite; theme: ThemePalette; size?: number }) {
  if (item.category === 'theme') {
    const pal = THEME_REGISTRY[item.name];
    if (pal) {
      return (
        <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: pal.background, borderWidth: 1, borderColor: pal.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pal.primary }} />
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pal.text }} />
        </View>
      );
    }
  }
  if (item.category === 'banner') {
    const b = BANNER_REGISTRY[item.name];
    if (b) {
      return (
        <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden' }}>
          {b.colors.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
      );
    }
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={CATEGORY_ICON[item.category] as any} size={Math.round(size * 0.45)} color={theme.primary} />
    </View>
  );
}

function StateLabel({ state, theme }: { state: ShopItemState; theme: ThemePalette }) {
  switch (state.kind) {
    case 'owned':
      return (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: state.equipped ? GOLD : theme.muted }}>{state.equipped ? 'ÉQUIPÉ' : 'Possédé'}</Text>
        </View>
      );
    case 'level_locked':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="lock-closed" size={14} color={theme.muted} />
          <Text style={{ fontSize: 13, fontWeight: '800', color: theme.muted }}>Niveau {state.level}</Text>
        </View>
      );
    default:
      return null;
  }
}

function ShopRow({ item, price, state, onPress, theme }: { item: ShopItemLite; price: number; state: ShopItemState; onPress: () => void; theme: ThemePalette }) {
  const owned = state.kind === 'owned';
  const a11y =
    state.kind === 'owned' ? `${item.name}, ${state.equipped ? 'équipé' : 'possédé'}`
    : state.kind === 'level_locked' ? `${item.name}, niveau ${state.level} requis, aperçu`
    : state.kind === 'insufficient' ? `${item.name}, ${price} pièces, ${missingCoinsShort(state.missing)}, aperçu`
    : `${item.name}, ${price} pièces, aperçu`;
  return (
    <TouchableOpacity onPress={owned ? undefined : onPress} disabled={owned} accessibilityRole="button" accessibilityLabel={a11y} activeOpacity={0.8}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, opacity: state.kind === 'level_locked' ? 0.85 : 1 }}>
        <ItemVisual item={item} theme={theme} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{item.name}</Text>
          {item.description ? <Text numberOfLines={2} style={{ fontSize: 12.5, color: theme.muted }}>{item.description}</Text> : null}
          {state.kind === 'insufficient' ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.danger }}>{missingCoinsShort(state.missing)}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {state.kind === 'available' || state.kind === 'insufficient' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cash" size={14} color={GOLD} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: GOLD }}>{price}</Text>
            </View>
          ) : (
            <StateLabel state={state} theme={theme} />
          )}
          {!owned ? <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>Aperçu</Text> : null}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

/** Apercu avant achat : l'objet est montre applique ; achat en 1 tap ; un seul bouton principal. */
function PreviewSheet({
  item, state, coins, displayName, onClose, onBuy, theme,
}: {
  item: ShopItemLite | null; state: ShopItemState | null; coins: number; displayName: string;
  onClose: () => void; onBuy: () => Promise<void>; theme: ThemePalette;
}) {
  const [busy, setBusy] = useState(false);
  if (!item || !state) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const pal = item.category === 'theme' ? THEME_REGISTRY[item.name] : undefined;
  const banner = item.category === 'banner' ? BANNER_REGISTRY[item.name] : undefined;
  const canBuy = state.kind === 'available';
  const after = coins - item.price;

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: theme.muted }}>{CATEGORY_SINGULAR[item.category].toUpperCase()}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{item.name}</Text>
      </View>

      {/* Rendu applique */}
      {pal ? (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: pal.background, borderWidth: 1, borderColor: pal.border, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: pal.muted }}>Aperçu</Text>
          <View style={{ backgroundColor: pal.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: pal.border, gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: pal.text }}>Haut du corps A</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: pal.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: pal.text }}>ACTIF</Text>
            </View>
            <View style={{ height: 40, borderRadius: 10, backgroundColor: pal.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Démarrer la séance</Text>
            </View>
          </View>
        </View>
      ) : banner ? (
        <View style={{ borderRadius: 16, overflow: 'hidden', height: 72, flexDirection: 'row' }}>
          {banner.colors.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
        </View>
      ) : item.category === 'title' ? (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.muted }}>Aperçu sur ton profil</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{displayName} <Text style={{ color: theme.primary }}>{item.name}</Text></Text>
        </View>
      ) : (
        <View style={{ borderRadius: 16, padding: 14, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, alignItems: 'center', gap: 6 }}>
          <ItemVisual item={item} theme={theme} size={56} />
          <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center' }}>{item.description ?? 'Badge affiché sur ton profil.'}</Text>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Prix</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="cash" size={15} color={GOLD} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: GOLD }}>{item.price}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: theme.muted }}>{canBuy ? 'Solde après achat' : 'Ton solde'}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{canBuy ? after : coins} pièces</Text>
        </View>
      </View>

      {state.kind === 'insufficient' ? (
        <>
          <PrimaryButton label="Pièces insuffisantes" onPress={() => {}} disabled theme={theme} />
          <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center' }}>{missingCoinsText(state.missing)}</Text>
        </>
      ) : state.kind === 'level_locked' ? (
        <>
          <PrimaryButton label={`Niveau ${state.level} requis`} onPress={() => {}} disabled theme={theme} />
          <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center' }}>Monte de niveau pour débloquer cet objet.</Text>
        </>
      ) : state.kind === 'owned' ? (
        <SecondaryButton label="Fermer" onPress={onClose} />
      ) : (
        <PrimaryButton
          label={priceLabel(item.price)}
          disabled={busy}
          theme={theme}
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            try { await onBuy(); } finally { setBusy(false); }
          }}
        />
      )}
      {state.kind !== 'owned' ? <SecondaryButton label="Fermer" onPress={onClose} /> : null}
    </Sheet>
  );
}

export function ShopTab(p: Props) {
  const [segment, setSegment] = useState<'shop' | 'mine'>('shop');
  const [category, setCategory] = useState<ShopCategory>('theme');
  const [preview, setPreview] = useState<ShopItemLite | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const { theme } = p;

  if (p.error && !p.data) {
    return <ErrorCard theme={theme} title="Boutique indisponible" message="Impossible de charger la boutique. Rien n'est perdu : réessaie dans un instant." onRetry={p.onRetry} />;
  }
  if (p.loading && !p.data) return <SkeletonRows count={5} />;
  if (!p.data) return null;

  const { items, inventory } = p.data;
  const counts = categoryCounts(items);
  const list = itemsInCategory(items, category);
  const ctx = { coins: p.coins, level: p.level, inventory };
  const previewState = preview ? shopItemState(preview, ctx) : null;

  const buy = async () => {
    if (!preview) return;
    const item = preview;
    const res = await p.onBuy(item);
    if (res.success) {
      setPreview(null);
      p.onToast(`${item.name} acheté. Équipe-le dans Mes objets.`);
    } else {
      p.onToast(res.error ?? "Achat impossible pour l'instant.");
    }
  };

  const owned = ownedByCategory(items, inventory);

  return (
    <View style={{ gap: 12 }}>
      {/* Segment Boutique | Mes objets */}
      <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: 'rgba(28,26,23,0.05)', borderRadius: 12 }} accessibilityRole="tablist">
        {([['shop', 'Boutique'], ['mine', 'Mes objets']] as const).map(([key, label]) => {
          const active = segment === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSegment(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={[{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, active && { backgroundColor: '#FFFFFF' }]}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: active ? theme.text : theme.muted }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {segment === 'shop' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} label={CATEGORY_LABEL[c]} count={counts[c]} active={category === c} onPress={() => setCategory(c)} theme={theme} />
            ))}
          </ScrollView>
          {list.length === 0 ? (
            <EmptyCard theme={theme} icon={CATEGORY_ICON[category]} title="Rien à acheter ici" message="Cette catégorie est vide pour l'instant." />
          ) : (
            <View style={{ gap: 8 }}>
              {list.map((it) => (
                <ShopRow key={it.id} item={it} price={it.price} state={shopItemState(it, ctx)} onPress={() => setPreview(it)} theme={theme} />
              ))}
            </View>
          )}
        </>
      ) : owned.length === 0 ? (
        <EmptyCard theme={theme} icon="bag-handle" title="Tu n'as encore rien" message="Tes achats apparaîtront ici. Tu pourras les équiper en un tap." />
      ) : (
        <View style={{ gap: 14 }}>
          {owned.map((group) => (
            <View key={group.category} style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: theme.muted }}>{CATEGORY_LABEL[group.category].toUpperCase()}</Text>
              {group.items.map((it) => (
                <Card key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                  <ItemVisual item={it} theme={theme} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{it.name}</Text>
                  </View>
                  {it.equipped ? (
                    <View accessible accessibilityLabel={`${it.name}, équipé`} style={{ backgroundColor: GOLD_TINT, borderColor: GOLD_BORDER, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: GOLD }}>ÉQUIPÉ</Text>
                    </View>
                  ) : (
                    <SecondaryButton
                      label="Équiper"
                      style={{ minHeight: 44, paddingHorizontal: 16 }}
                      onPress={async () => {
                        if (equipping) return;
                        setEquipping(it.id);
                        try {
                          const r = await p.onEquip(it);
                          if (!r.success) p.onToast(r.error ?? "Impossible d'équiper pour l'instant.");
                        } finally {
                          setEquipping(null);
                        }
                      }}
                    />
                  )}
                </Card>
              ))}
              <Text style={{ fontSize: 12.5, color: theme.muted }}>{EQUIP_NOTE[group.category]}</Text>
              {group.category === 'theme' && themeEquipNote(p.coachBrandingActive) ? (
                <Text style={{ fontSize: 12.5, color: theme.muted }}>{themeEquipNote(p.coachBrandingActive)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <PreviewSheet item={preview} state={previewState} coins={p.coins} displayName={p.displayName} onClose={() => setPreview(null)} onBuy={buy} theme={theme} />
    </View>
  );
}
