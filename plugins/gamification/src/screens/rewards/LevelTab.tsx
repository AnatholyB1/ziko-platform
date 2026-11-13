import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '@ziko/plugin-sdk';
import {
  GOLD, formatAmount, historyLabel, relativeDay, xpLine, levelCaption,
  type CoinTx,
} from '../../rewards';
import { Card, EmptyCard, ErrorCard, PrimaryButton, ProgressBar, SkeletonRows } from './ui';

export interface LevelData {
  xp: number;
  level: number;
  title: string;
  nextLevel: number | null;
  nextXp: number | null;
  xpToNext: number;
  xpProgress: number;
  streak: number;
  /** Vrai dernier niveau du catalogue atteint (jamais vrai si le catalogue est vide). */
  isMax: boolean;
}

/** B01 : niveau, XP, serie en cours, succes debloques, derniers gains. Donnees reelles uniquement. */
export function LevelTab({
  data, loading, error, onRetry, unlockedCount, totalAchievements, recent, onSeeAll, onOpenAchievements, theme,
}: {
  data: LevelData | undefined; loading: boolean; error: boolean; onRetry: () => void;
  unlockedCount: number | null; totalAchievements: number | null;
  recent: CoinTx[]; onSeeAll: () => void; onOpenAchievements: () => void; theme: ThemePalette;
}) {
  if (error && !data) {
    return <ErrorCard theme={theme} title="Niveau indisponible" message="Impossible de charger ta progression. Rien n'est perdu : réessaie dans un instant." onRetry={onRetry} />;
  }
  if (loading && !data) return <SkeletonRows count={3} height={96} />;
  if (!data) return null;

  const streakLabel = data.streak > 0 ? `${data.streak} jour${data.streak > 1 ? 's' : ''}` : 'Pas de série en cours';

  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: theme.cardDark, borderRadius: 20, padding: 22, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: theme.cardDarkText + 'CC' }}>NIVEAU · {data.title.toUpperCase()}</Text>
        <Text style={{ fontSize: 56, fontWeight: '900', color: theme.primary, lineHeight: 64 }}>{data.level}</Text>
        <Text style={{ fontSize: 13, color: theme.cardDarkText + 'B3', marginTop: 4 }}>{xpLine(data.xp, data.nextXp)}</Text>
        {data.nextXp !== null ? (
          <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
            <ProgressBar now={Math.round(data.xpProgress * 100)} max={100} color={theme.primary} label={`Niveau ${data.level} : ${Math.round(data.xpProgress * 100)} pour cent`} />
          </View>
        ) : null}
        <Text style={{ fontSize: 12, color: theme.cardDarkText + 'B3', marginTop: 8 }}>
          {levelCaption(data)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Ionicons name="flame" size={20} color={theme.primary} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{streakLabel}</Text>
          <Text style={{ fontSize: 12, color: theme.muted }}>Série en cours</Text>
        </Card>
        <TouchableOpacity style={{ flex: 1 }} onPress={onOpenAchievements} accessibilityRole="button" accessibilityLabel={unlockedCount === null ? 'Succès' : `${unlockedCount} sur ${totalAchievements} succès débloqués`}>
          <Card style={{ gap: 4 }}>
            <Ionicons name="trophy" size={20} color={GOLD} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{unlockedCount === null ? '—' : `${unlockedCount} / ${totalAchievements}`}</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>Succès débloqués</Text>
          </Card>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Derniers gains</Text>
          <TouchableOpacity onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="Tout voir" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text, textDecorationLine: 'underline' }}>Tout voir</Text>
          </TouchableOpacity>
        </View>
        {recent.length === 0 ? (
          <EmptyCard theme={theme} icon="cash" title="Aucun gain pour l'instant" message="Termine une séance ou valide une habitude pour gagner tes premières pièces." />
        ) : (
          <View style={{ gap: 8 }}>
            {recent.map((tx) => <HistoryRow key={tx.id} tx={tx} theme={theme} />)}
          </View>
        )}
      </View>
    </View>
  );
}

export function HistoryRow({ tx, theme }: { tx: CoinTx; theme: ThemePalette }) {
  const positive = tx.amount > 0;
  return (
    <Card
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: positive ? '#FBF1D3' : theme.text + '0D', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={positive ? 'arrow-down' : 'bag-handle'} size={16} color={positive ? GOLD : theme.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{historyLabel(tx)}</Text>
        <Text style={{ fontSize: 12, color: theme.muted }}>{relativeDay(tx.created_at)}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: positive ? GOLD : theme.text }}>{formatAmount(tx.amount)} pièces</Text>
    </Card>
  );
}

/** B10 / B11 : historique complet des gains, pagine. */
export function HistoryView({
  rows, loading, error, hasMore, loadingMore, onLoadMore, onRetry, onBack, theme,
}: {
  rows: CoinTx[]; loading: boolean; error: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; onRetry: () => void; onBack: () => void; theme: ThemePalette;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour aux onglets" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Historique des gains</Text>
      </View>
      {error && rows.length === 0 ? (
        <ErrorCard theme={theme} title="Historique indisponible" message="Impossible de charger tes gains. Rien n'est perdu : réessaie dans un instant." onRetry={onRetry} />
      ) : loading && rows.length === 0 ? (
        <SkeletonRows count={6} height={60} />
      ) : rows.length === 0 ? (
        <EmptyCard theme={theme} icon="cash" title="Aucun gain pour l'instant" message="Termine une séance ou valide une habitude pour gagner tes premières pièces." />
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((tx) => <HistoryRow key={tx.id} tx={tx} theme={theme} />)}
          {hasMore ? (
            <PrimaryButton label={loadingMore ? 'Chargement…' : 'Voir plus'} onPress={onLoadMore} disabled={loadingMore} theme={theme} />
          ) : null}
        </View>
      )}
    </View>
  );
}
