import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '@ziko/plugin-sdk';
import { GOLD } from '../../rewards';
import {
  completedNote, dailyHeading, expiredNote, groupQuests, progressText, questRatio,
  type Quest,
} from '../../quests';
import { Card, EmptyCard, ErrorCard, ProgressBar, SkeletonRows } from './ui';

// Onglet Quetes (maquette B12 / B13) : lecture 100 % base, progression mesuree par `ziko_sync_quests`.
// Aucune quete de secours : erreur = carte B05, vide = « Pas de quête active ».

const WATER = '#1E6FB8';
const WATER_TINT = '#E3EEF9';
const OK_TINT = '#DDF3E4';

function iconColors(q: Quest, theme: ThemePalette) {
  if (q.status === 'completed') return { fg: theme.success, bg: OK_TINT };
  if (q.status === 'expired') return { fg: theme.muted, bg: '#ECEAE4' };
  if (q.metric === 'hydration_ml') return { fg: WATER, bg: WATER_TINT };
  return { fg: theme.primary, bg: theme.primaryLight };
}

function CoinChip({ coins }: { coins: number }) {
  if (coins <= 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="disc" size={14} color={GOLD} />
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#7A5800' }}>{coins}</Text>
    </View>
  );
}

function QuestRow({ q, last, theme }: { q: Quest; last: boolean; theme: ThemePalette }) {
  const { fg, bg } = iconColors(q, theme);
  const done = q.status === 'completed';
  const expired = q.status === 'expired';
  const text = progressText(q);
  const a11y = done
    ? `${q.title}. ${completedNote(q)}`
    : expired
      ? `${q.title}. ${expiredNote()}`
      : `${q.title}. ${text ?? 'En cours'}. Récompense ${q.rewardCoins} pièces`;
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 12, paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: '#E2E0DA',
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={(done ? 'checkmark-circle' : q.icon) as any} size={22} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: expired ? theme.muted : theme.text }}>{q.title}</Text>
          {!done && !expired ? <CoinChip coins={q.rewardCoins} /> : null}
        </View>
        {done || expired ? (
          <Text style={{ fontSize: 12.5, color: theme.muted }}>{done ? completedNote(q) : expiredNote()}</Text>
        ) : (
          <>
            <ProgressBar
              now={Math.round(questRatio(q) * 100)}
              max={100}
              color={theme.primary}
              label={`${q.title} : ${text ?? 'en cours'}`}
            />
            {text ? <Text style={{ fontSize: 12.5, color: theme.muted }}>{text}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

function Section({ heading, quests, theme }: { heading: string; quests: Quest[]; theme: ThemePalette }) {
  if (quests.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.muted, marginBottom: 8 }}
      >
        {heading}
      </Text>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {quests.map((q, i) => (
          <QuestRow key={q.id} q={q} last={i === quests.length - 1} theme={theme} />
        ))}
      </Card>
    </View>
  );
}

export function QuestsTab({
  quests, loading, error, onRetry, theme, now,
}: {
  quests: Quest[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  theme: ThemePalette;
  now?: number;
}) {
  if (error) {
    return (
      <ErrorCard
        title="Quêtes indisponibles"
        message="Impossible de charger tes quêtes. Vérifie ta connexion puis réessaie."
        onRetry={onRetry}
        theme={theme}
      />
    );
  }
  if (loading || !quests) return <SkeletonRows count={4} height={76} />;

  const sections = groupQuests(quests);
  if (sections.daily.length + sections.weekly.length + sections.expired.length === 0) {
    return (
      <EmptyCard
        theme={theme}
        icon="flag"
        title="Pas de quête active"
        message="De nouvelles quêtes arrivent chaque jour. Reviens demain."
      />
    );
  }
  return (
    <View>
      <Section heading={dailyHeading(sections.daily, now)} quests={sections.daily} theme={theme} />
      <Section heading="Cette semaine" quests={sections.weekly} theme={theme} />
      <Section heading="Non terminées" quests={sections.expired} theme={theme} />
    </View>
  );
}
