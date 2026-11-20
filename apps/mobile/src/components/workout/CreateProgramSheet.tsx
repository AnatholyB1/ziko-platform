// v1.21 Phase 2 (CLAR-01) - feuille de choix "Créer un programme" de l'onglet Entrainement (maquettes T02, T04).
// Deux rangees : Assistant en 4 etapes (program-builder, gratuit) et Atelier IA. Avec `withSession` (bouton "+"),
// un second groupe "Séance seule" propose la generation d'une seance IA. Cout lu du serveur via `credit`.
import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { FIRST_WORKOUT_PATHS, TRAINING_EMPTY_COPY as C, type CreditView } from '../../lib/firstWorkout';
import { PathRow, openPath } from '../home/FirstWorkoutCard';

const manual = FIRST_WORKOUT_PATHS[0];
const aiSimple = FIRST_WORKOUT_PATHS[1];
const atelier = FIRST_WORKOUT_PATHS[2];

function GroupLabel({ children }: { children: string }) {
  return (
    <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6963' }}>
      {children}
    </Text>
  );
}

export default function CreateProgramSheet({
  visible, onClose, credit, withSession = false,
}: { visible: boolean; onClose: () => void; credit: CreditView; withSession?: boolean }) {
  const choose = (p: typeof manual) => {
    onClose();
    openPath(p, credit);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,26,23,0.45)' }}>
        <Pressable
          testID="create-sheet-scrim"
          accessibilityLabel={C.cancel}
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 }} />
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#1C1A17' }}>
              {withSession ? C.plusLabel : C.sheetTitle}
            </Text>
            {!withSession && (
              <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 4 }}>{C.sheetSubtitle}</Text>
            )}
          </View>
          {withSession && <GroupLabel>{C.groupProgram}</GroupLabel>}
          <View style={{ borderTopWidth: 1, borderTopColor: '#E2E0DA' }}>
            <PathRow
              testID="create-sheet-manual"
              path={manual}
              view={credit}
              nameOverride={C.sheetManualName}
              sentenceOverride={C.sheetManualSentence}
              onPress={() => choose(manual)}
            />
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#E2E0DA' }}>
            <PathRow
              testID="create-sheet-atelier"
              path={atelier}
              view={credit}
              sentenceOverride={C.sheetAtelierSentence}
              onPress={() => choose(atelier)}
            />
          </View>
          {withSession && (
            <>
              <GroupLabel>{C.groupSession}</GroupLabel>
              <View style={{ borderTopWidth: 1, borderTopColor: '#E2E0DA' }}>
                <PathRow
                  testID="create-sheet-session"
                  path={aiSimple}
                  view={credit}
                  nameOverride={C.secondary}
                  onPress={() => choose(aiSimple)}
                />
              </View>
            </>
          )}
          <Pressable
            testID="create-sheet-cancel"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={C.cancel}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#B53D05' }}>{C.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
