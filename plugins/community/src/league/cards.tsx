import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COPY,
  DIVISIONS,
  FACTIONS,
  TRACK_LABEL,
  collectiveView,
  divisionName,
  entryView,
  factionByKey,
  historyLine,
  memberCountLabel,
  weekDot,
  weekView,
  type CollectiveProgress,
  type FactionKey,
  type LeagueState,
} from './rules';

// Cartes PRESENTATIONNELLES de la Ligue (26-UI-SPEC) : aucune I/O, aucun store ; l'ecran (LeagueScreen) les alimente.
// Couleurs passees en props (themes + branding coach) ; bouton plein = `actionColor` (getActionPrimary) + texte blanc.

export interface LeagueColors {
  surface: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  /** getActionPrimary(theme) : fond des boutons pleins. */
  action: string;
  success: string;
}

const card = (c: LeagueColors) => ({
  backgroundColor: c.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: c.border,
  padding: 16,
  marginBottom: 12,
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
});

const FilledButton = ({ label, onPress, color, disabled }: { label: string; onPress: () => void; color: string; disabled?: boolean }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    disabled={disabled}
    style={{ minHeight: 44, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, opacity: disabled ? 0.6 : 1 }}
  >
    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>
);

const TextButton = ({ label, onPress, color }: { label: string; onPress: () => void; color: string }) => (
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
    <Text style={{ color, fontSize: 14, fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

const ProgressBar = ({ ratio, c }: { ratio: number; c: LeagueColors }) => (
  <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden', marginTop: 8 }}>
    <View style={{ height: 8, width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`, backgroundColor: c.primary }} />
  </View>
);

// ── Carte d'entree (E1..E4) ────────────────────────────────────────────

export function LeagueEntryCard({ state, c, onPress }: { state: LeagueState | null; c: LeagueColors; onPress: () => void }) {
  const v = entryView(state);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={COPY.openLeague}
      onPress={onPress}
      style={{ ...card(c), minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="trophy" size={24} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{COPY.title}</Text>
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{v.subtitle}</Text>
      </View>
      {v.badge ? (
        <View style={{ backgroundColor: c.action, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{v.badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Etats : verrouille, erreur, chargement ─────────────────────────────

export function LockedCard({ c }: { c: LeagueColors }) {
  // Aucun compteur ni barre de progression (S2) : pas de pression.
  return (
    <View style={{ ...card(c), alignItems: 'center' }}>
      <Ionicons name="lock-closed" size={32} color={c.muted} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginTop: 8 }}>{COPY.lockedTitle}</Text>
      <Text style={{ fontSize: 14, color: c.muted, marginTop: 4, textAlign: 'center' }}>{COPY.lockedBody}</Text>
    </View>
  );
}

export function ErrorCard({ c, onRetry }: { c: LeagueColors; onRetry: () => void }) {
  return (
    <View style={card(c)}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{COPY.errorTitle}</Text>
      <View style={{ height: 12 }} />
      <FilledButton label={COPY.retry} onPress={onRetry} color={c.action} />
    </View>
  );
}

export function SkeletonCards({ c }: { c: LeagueColors }) {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} accessibilityLabel="Chargement" style={{ ...card(c), height: 96, backgroundColor: c.border + '55' }} />
      ))}
    </View>
  );
}

// ── Faction (S4/S5) ────────────────────────────────────────────────────

export interface FactionCardProps {
  c: LeagueColors;
  mine: FactionKey | null;
  suggested: FactionKey;
  memberCount: number | null;
  onPick: (key: FactionKey) => void;
  onChange: () => void;
}

export function FactionCard({ c, mine, suggested, memberCount, onPick, onChange }: FactionCardProps) {
  const f = factionByKey(mine);
  if (f) {
    const count = memberCountLabel(memberCount);
    return (
      <View style={{ ...card(c), flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={f.icon as any} size={24} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{f.label}</Text>
          {count ? <Text style={{ fontSize: 12, color: c.muted }}>{count}</Text> : null}
        </View>
        <TextButton label={COPY.change} onPress={onChange} color={c.primary} />
      </View>
    );
  }
  return (
    <View style={card(c)}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 }}>{COPY.pickFaction}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FACTIONS.map((fd) => (
          <TouchableOpacity
            key={fd.key}
            accessibilityRole="button"
            accessibilityLabel={fd.label}
            onPress={() => onPick(fd.key)}
            style={{ width: '48%', minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: fd.key === suggested ? c.primary : c.border, padding: 12, justifyContent: 'center' }}
          >
            <Ionicons name={fd.icon as any} size={22} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginTop: 4 }}>{fd.label}</Text>
            {fd.key === suggested ? <Text style={{ fontSize: 12, color: c.primary, fontWeight: '600' }}>{COPY.suggested}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Piste et palier (S6/S8) + Cette semaine (S7) ───────────────────────

export function TrackCard({ c, state }: { c: LeagueColors; state: LeagueState }) {
  const track = state.track ?? 'habits';
  const div = state.division ?? 1;
  const hist = historyLine(state);
  return (
    <View style={card(c)}>
      <Text style={{ fontSize: 13, color: c.muted, fontWeight: '600' }}>{TRACK_LABEL[track]}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginTop: 2 }}>{divisionName(div)}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }} accessibilityLabel={`Palier ${div} sur ${DIVISIONS.length}`}>
        {DIVISIONS.map((_, i) => (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < div ? c.primary : c.border }} />
        ))}
      </View>
      <Text style={{ fontSize: 13, color: c.muted, marginTop: 10, lineHeight: 18 }}>{COPY.trackHelp}</Text>
      {hist ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 8 }}>{hist}</Text> : null}
    </View>
  );
}

export function WeekCard({ c, state }: { c: LeagueColors; state: LeagueState }) {
  const w = weekView(state);
  return (
    <View style={card(c)}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{w.label}</Text>
      <ProgressBar ratio={w.ratio} c={c} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {(state.recent_weeks ?? []).map((wk) => {
          const d = weekDot(wk.score);
          return <Ionicons key={wk.week_start} name={d.icon} size={20} color={d.tone === 'success' ? c.success : c.muted} />;
        })}
      </View>
    </View>
  );
}

// ── Defis de groupe (S9) ───────────────────────────────────────────────

export interface CollectiveCardProps {
  c: LeagueColors;
  item: CollectiveProgress;
  busy: boolean;
  onJoin: () => void;
  onDecline: () => void;
  onLeave: () => void;
}

export function CollectiveCard({ c, item, busy, onJoin, onDecline, onLeave }: CollectiveCardProps) {
  const v = collectiveView(item);
  return (
    <View style={card(c)}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{item.title}</Text>
      <Text style={{ fontSize: 14, color: c.text, marginTop: 6 }}>{v.groupLine}</Text>
      <ProgressBar ratio={v.ratio} c={c} />
      <Text style={{ fontSize: 12, color: c.muted, marginTop: 8 }}>{v.participantsLine}</Text>
      {v.mineLine ? <Text style={{ fontSize: 13, color: c.text, marginTop: 4 }}>{v.mineLine}</Text> : null}
      {item.my_status === 'invited' ? (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <FilledButton label={COPY.join} onPress={onJoin} color={c.action} disabled={busy} />
          </View>
          <TextButton label={COPY.decline} onPress={onDecline} color={c.muted} />
        </View>
      ) : null}
      {item.my_status === 'joined' ? <TextButton label={COPY.leave} onPress={onLeave} color={c.muted} /> : null}
    </View>
  );
}

export function NoCollective({ c }: { c: LeagueColors }) {
  return (
    <View style={{ ...card(c), alignItems: 'center' }}>
      <Ionicons name="people-outline" size={28} color={c.muted} />
      <Text style={{ fontSize: 14, color: c.muted, marginTop: 6 }}>{COPY.noCollective}</Text>
    </View>
  );
}

// ── Celebration (C1..C3) ───────────────────────────────────────────────

export function CelebrationCard({ c, reason, onContinue }: { c: LeagueColors; reason: string; onContinue: () => void }) {
  return (
    <View style={{ ...card(c), alignItems: 'center', padding: 24 }}>
      <Ionicons name="ribbon" size={56} color={c.primary} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginTop: 12, textAlign: 'center' }}>{COPY.celebrationTitle}</Text>
      <Text style={{ fontSize: 15, color: c.text, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{COPY.celebrationBody}</Text>
      {reason ? (
        <Text numberOfLines={4} style={{ fontSize: 14, color: c.muted, marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
          {`« ${reason} »`}
        </Text>
      ) : null}
      <View style={{ height: 16 }} />
      <View style={{ alignSelf: 'stretch' }}>
        <FilledButton label={COPY.continue} onPress={onContinue} color={c.action} />
      </View>
    </View>
  );
}
