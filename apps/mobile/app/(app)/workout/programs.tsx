import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import {
  FILTER_LABELS,
  FILTER_ORDER,
  PROGRAM_RULE_TEXT,
  activationToast,
  countByFilter,
  deleteConfirmationText,
  filterPrograms,
  menuActionsFor,
  needsCoachConfirmation,
  type MenuAction,
  type ProgramFilter,
  type ProgramItem,
} from '../../../src/lib/programs';
import {
  deleteProgram,
  duplicateProgram,
  loadAllPrograms,
  renameProgram,
  setActiveProgram,
} from '../../../src/lib/programsService';

// Maquette lot A (A01-A08). Sheets = Modal bottom sheets, scrim rgba(28,26,23,.45).
const SCRIM = 'rgba(28,26,23,0.45)';
const SKELETON = '#ECEAE4';
const DANGER = '#B5301F';

type Sheet =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'menu'; item: ProgramItem }
  | { type: 'conflict'; item: ProgramItem; coachName: string }
  | { type: 'rename'; item: ProgramItem };

function SheetFrame({ theme, children, onClose }: { theme: any; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: SCRIM, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 10 }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 4 }} />
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProgramsScreen() {
  const theme = useThemeStore((s) => s.theme);
  const actionBg = getActionPrimary(theme);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<ProgramFilter>('all');
  const [sheet, setSheet] = useState<Sheet>({ type: 'none' });
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: items, isLoading, isError, refetch } = useQuery<ProgramItem[]>({
    queryKey: ['programs', userId],
    queryFn: () => loadAllPrograms(supabase as any, userId!),
    enabled: !!userId,
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (userId) refetch();
    }, [userId, refetch]),
  );
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const refreshAll = async () => {
    const keys = [['programs'], ['program', 'active'], ['active-program'], ['ai_programs'], ['ai_program_active']];
    await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k })));
  };

  const list = items ?? [];
  const counts = countByFilter(list);
  const shown = filterPrograms(list, filter);
  const hero = shown.find((i) => i.isActive) ?? null;
  const others = shown.filter((i) => !i.isActive);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: unknown) {
      showAlert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  };

  const doActivate = (item: ProgramItem) =>
    run(async () => {
      await setActiveProgram(supabase as any, item.kind, item.id);
      setSheet({ type: 'none' });
      await refreshAll();
      showToast(activationToast(item.name));
    });

  const requestActivate = (item: ProgramItem) => {
    if (needsCoachConfirmation(list, item)) {
      const coach = list.find((i) => i.isActive && i.source === 'coach');
      setSheet({ type: 'conflict', item, coachName: coach?.name ?? 'Programme du coach' });
      return;
    }
    doActivate(item);
  };

  const onMenuAction = (item: ProgramItem, action: MenuAction) => {
    if (action === 'activate') return requestActivate(item);
    if (action === 'rename') {
      setRenameValue(item.name);
      setSheet({ type: 'rename', item });
      return;
    }
    if (action === 'duplicate') {
      setSheet({ type: 'none' });
      return void run(async () => {
        const copy = await duplicateProgram(supabase as any, userId!, item, list.map((i) => i.name));
        await refreshAll();
        showToast(`Copie créée : ${copy.name}`);
      });
    }
    // delete
    setSheet({ type: 'none' });
    showAlert(item.name, deleteConfirmationText(item.name), [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await deleteProgram(supabase as any, item);
            await refreshAll();
            showToast('Programme supprimé');
          }),
      },
    ]);
  };

  const openProgram = (item: ProgramItem) => {
    if (item.kind === 'ai') router.push(`/(app)/(plugins)/ai-programs/${item.id}` as any);
    else router.push(`/(app)/workout/${item.id}` as any);
  };

  // ── Building blocks ────────────────────────────────────────────

  const Badge = ({ label, filled }: { label: string; filled?: boolean }) => (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: filled ? actionBg : theme.background,
        borderWidth: filled ? 0 : 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: filled ? '#FFFFFF' : theme.muted }}>{label}</Text>
    </View>
  );

  const MenuButton = ({ item }: { item: ProgramItem }) => (
    <TouchableOpacity
      onPress={() => setSheet({ type: 'menu', item })}
      accessibilityRole="button"
      accessibilityLabel={`Options du programme ${item.name}`}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
    </TouchableOpacity>
  );

  const sourceBadge = (item: ProgramItem) =>
    item.source === 'coach' ? <Badge label="COACH" /> : item.source === 'ai' ? <Badge label="IA" /> : null;

  const Card = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: active ? 2 : 1,
        borderColor: active ? theme.primary : theme.border,
        shadowColor: '#1C1A17',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      {children}
    </View>
  );

  const renderHero = (item: ProgramItem) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted, marginBottom: 8, textTransform: 'uppercase' }}>
        Programme actif
      </Text>
      <Card active>
        <TouchableOpacity
          onPress={() => openProgram(item)}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${item.name}, programme actif`}
          style={{ padding: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'flex-start' }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Badge label="ACTIF" filled />
              {sourceBadge(item)}
            </View>
            <Text numberOfLines={2} style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{item.name}</Text>
            <Text numberOfLines={2} style={{ fontSize: 14, color: theme.muted, marginTop: 4 }}>{item.subtitle}</Text>
            {item.progress ? (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: theme.text }}>Semaine {item.progress.week} sur {item.progress.total}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{item.progress.percent} %</Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: theme.border }}>
                  <View style={{ height: 6, borderRadius: 999, width: `${item.progress.percent}%`, backgroundColor: theme.primary }} />
                </View>
              </View>
            ) : null}
          </View>
          <MenuButton item={item} />
        </TouchableOpacity>
      </Card>
    </View>
  );

  const renderRow = (item: ProgramItem, last: boolean) => (
    <View
      key={`${item.kind}-${item.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.border }}
    >
      <TouchableOpacity
        onPress={() => openProgram(item)}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir ${item.name}`}
        style={{ flex: 1, paddingVertical: 14, paddingLeft: 16, minHeight: 64 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 16, fontWeight: '700', color: theme.text }}>{item.name}</Text>
          {sourceBadge(item)}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{item.subtitle}</Text>
      </TouchableOpacity>
      <MenuButton item={item} />
    </View>
  );

  const Skeleton = () => (
    <View accessibilityLabel="Chargement des programmes">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: i === 0 ? 120 : 64, borderRadius: 16, backgroundColor: SKELETON, marginBottom: 12 }} />
      ))}
    </View>
  );

  const FullButton = ({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: actionBg,
        opacity: disabled ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const OutlineButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
    >
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  const goWizard = () => {
    setSheet({ type: 'none' });
    router.push('/(app)/workout/program-builder' as any);
  };
  const goAtelier = () => {
    setSheet({ type: 'none' });
    router.push('/(app)/workout/atelier' as any); // v1.20 P23 : atelier IA conversationnel
  };

  // ── Body ───────────────────────────────────────────────────────

  let body: React.ReactNode;
  if (isLoading || (!items && !isError)) {
    body = <Skeleton />;
  } else if (isError) {
    body = (
      <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={theme.muted} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Impossible de charger tes programmes</Text>
        <Text style={{ fontSize: 16, color: theme.muted, textAlign: 'center' }}>Vérifie ta connexion puis réessaie. Tes programmes ne sont pas perdus.</Text>
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <FullButton label="Réessayer" onPress={() => refetch()} icon="refresh" />
        </View>
      </View>
    );
  } else if (list.length === 0) {
    body = (
      <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
        <Ionicons name="barbell-outline" size={44} color={theme.muted} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Aucun programme pour l'instant</Text>
        <Text style={{ fontSize: 16, color: theme.muted, textAlign: 'center' }}>
          Crée ton premier programme en 2 minutes, ou construis-le en discutant avec l'IA.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
          <FullButton label="Assistant en 4 étapes" onPress={goWizard} icon="list-outline" />
          <OutlineButton label="Ouvrir l'atelier IA" onPress={goAtelier} />
        </View>
        <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', marginTop: 8 }}>Ton coach t'assignera ici ses programmes.</Text>
      </View>
    );
  } else {
    body = (
      <>
        {/* Rule banner, always visible (D-02) */}
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 16 }}>
          <Ionicons name="information-circle-outline" size={20} color={theme.muted} />
          <Text style={{ flex: 1, fontSize: 14, color: theme.text }}>{PROGRAM_RULE_TEXT}</Text>
        </View>
        {hero ? renderHero(hero) : null}
        {shown.length === 0 ? (
          <Text style={{ fontSize: 16, color: theme.muted, textAlign: 'center', paddingVertical: 24 }}>Aucun programme dans cette catégorie.</Text>
        ) : null}
        {!hero && !list.some((i) => i.isActive) && shown.length > 0 ? (
          <Text style={{ fontSize: 14, color: theme.muted, marginBottom: 12 }}>Aucun programme actif. Choisis-en un dans la liste.</Text>
        ) : null}
        {others.length > 0 ? (
          <>
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.muted, marginBottom: 8, textTransform: 'uppercase' }}>
              {hero ? 'Autres programmes' : 'Programmes'}
            </Text>
            <Card>{others.map((it, i) => renderRow(it, i === others.length - 1))}</Card>
          </>
        ) : null}
      </>
    );
  }

  // ── Sheets ─────────────────────────────────────────────────────

  const closeSheet = () => setSheet({ type: 'none' });

  let sheetNode: React.ReactNode = null;
  if (sheet.type === 'create') {
    sheetNode = (
      <SheetFrame theme={theme} onClose={closeSheet}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Créer un programme</Text>
        <Text style={{ fontSize: 16, color: theme.muted, marginBottom: 6 }}>Choisis la méthode qui te convient.</Text>
        <TouchableOpacity onPress={goWizard} accessibilityRole="button" accessibilityLabel="Assistant en 4 étapes" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border }}>
          <Ionicons name="list-outline" size={24} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Assistant en 4 étapes</Text>
            <Text style={{ fontSize: 14, color: theme.muted }}>Objectif, niveau, jours, matériel. Gratuit, 2 minutes.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={goAtelier} accessibilityRole="button" accessibilityLabel="Atelier IA" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border }}>
          <Ionicons name="sparkles-outline" size={24} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Atelier IA</Text>
            <Text style={{ fontSize: 14, color: theme.muted }}>Discute avec l'IA pour un programme très précis, comme un powerlifter.</Text>
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Consomme des crédits IA</Text>
          </View>
        </TouchableOpacity>
      </SheetFrame>
    );
  } else if (sheet.type === 'menu') {
    const { item } = sheet;
    const actions = menuActionsFor(item);
    sheetNode = (
      <SheetFrame theme={theme} onClose={closeSheet}>
        <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>
          {item.isActive ? `Programme actif · ${item.source === 'coach' ? 'ton coach' : item.subtitle}` : item.subtitle}
        </Text>
        {actions.includes('activate') ? (
          <FullButton label="Définir comme programme actif" onPress={() => onMenuAction(item, 'activate')} icon="checkmark-circle-outline" disabled={busy} />
        ) : null}
        {actions.includes('duplicate') ? <OutlineButton label="Dupliquer" onPress={() => onMenuAction(item, 'duplicate')} /> : null}
        {actions.includes('rename') ? <OutlineButton label="Renommer" onPress={() => onMenuAction(item, 'rename')} /> : null}
        {actions.includes('delete') ? (
          <>
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />
            <TouchableOpacity
              onPress={() => onMenuAction(item, 'delete')}
              accessibilityRole="button"
              accessibilityLabel="Supprimer"
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: DANGER, fontSize: 16, fontWeight: '700' }}>Supprimer</Text>
            </TouchableOpacity>
            {item.isActive ? (
              <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center' }}>Supprimer un programme actif le met d'abord en pause.</Text>
            ) : null}
          </>
        ) : null}
      </SheetFrame>
    );
  } else if (sheet.type === 'conflict') {
    const { item, coachName } = sheet;
    sheetNode = (
      <SheetFrame theme={theme} onClose={closeSheet}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Remplacer le programme de ton coach ?</Text>
        <Text style={{ fontSize: 16, color: theme.text }}>
          <Text style={{ fontWeight: '800' }}>{coachName}</Text> passe en pause. Ta progression est conservée.
        </Text>
        <Text style={{ fontSize: 16, color: theme.text }}>
          <Text style={{ fontWeight: '800' }}>{item.name}</Text> devient ton seul programme actif.
        </Text>
        <Text style={{ fontSize: 14, color: theme.muted, marginBottom: 6 }}>
          Règle : un seul programme actif. Ton coach garde la main sur ses programmes et pourra te le rappeler.
        </Text>
        <FullButton label={`Activer ${item.name}`} onPress={() => doActivate(item)} disabled={busy} />
        <OutlineButton label="Garder le programme du coach" onPress={closeSheet} />
      </SheetFrame>
    );
  } else if (sheet.type === 'rename') {
    const { item } = sheet;
    sheetNode = (
      <SheetFrame theme={theme} onClose={closeSheet}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Renommer</Text>
        <TextInput
          value={renameValue}
          onChangeText={setRenameValue}
          autoFocus
          maxLength={80}
          accessibilityLabel="Nom du programme"
          style={{ minHeight: 48, borderWidth: 2, borderColor: theme.primary, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: theme.text }}
        />
        <FullButton
          label="Enregistrer"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await renameProgram(supabase as any, item, renameValue);
              setSheet({ type: 'none' });
              await refreshAll();
            })
          }
        />
        <OutlineButton label="Annuler" onPress={closeSheet} />
      </SheetFrame>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 28, fontWeight: '800', color: theme.text }} numberOfLines={1}>Programmes</Text>
        <TouchableOpacity
          onPress={() => setSheet({ type: 'create' })}
          accessibilityRole="button"
          accessibilityLabel="Nouveau"
          style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: actionBg, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {list.length > 0 ? (
        <View style={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {FILTER_ORDER.map((f) => {
              const selected = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${FILTER_LABELS[f]} ${counts[f]}`}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? theme.text : theme.surface,
                    borderWidth: 1,
                    borderColor: selected ? theme.text : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: selected ? '#FFFFFF' : theme.text }}>
                    {FILTER_LABELS[f]} {counts[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>{body}</ScrollView>

      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 104, backgroundColor: theme.text, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{toast}</Text>
        </View>
      ) : null}

      {sheetNode}
    </SafeAreaView>
  );
}
