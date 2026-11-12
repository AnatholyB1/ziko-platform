import React, { useRef, useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { lookupBarcode, type BarcodeProduct } from '../utils/barcode';
import { COPY } from '../utils/copy';
import { PrimaryButton, SecondaryButton, StateCard } from '../components/parts';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  /** Produit connu : le formulaire se pre-remplit. */
  onScan: (product: BarcodeProduct) => void;
  /** L'utilisateur choisit la saisie manuelle (code inconnu ou camera refusee). */
  onManual: () => void;
}

type Phase = 'camera' | 'unknown';

/** Scan (B17), camera refusee (B18) et code inconnu : toujours un chemin de saisie manuelle en 1 tap. */
export default function BarcodeScanner({ visible, onClose, onScan, onManual }: BarcodeScannerProps) {
  const theme = useThemeStore((s) => s.theme);
  const [permission, requestPermission] = useCameraPermissions();
  const [searching, setSearching] = useState(false);
  const [phase, setPhase] = useState<Phase>('camera');
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    scannedRef.current = false;
    setSearching(false);
    setPhase('camera');
    if (!permission || (!permission.granted && permission.canAskAgain)) {
      requestPermission();
    }
  }, [visible]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setSearching(true);
    try {
      const product = await lookupBarcode(data);
      if (product) {
        onScan(product);
        onClose();
      } else {
        setPhase('unknown');
      }
    } finally {
      setSearching(false);
    }
  };

  const denied = !!permission && !permission.granted && !permission.canAskAgain;
  const pending = !permission || (!permission.granted && permission.canAskAgain);

  const manual = () => {
    onManual();
    onClose();
  };

  const closeButton = (
    <TouchableOpacity
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={COPY.scanClose}
      style={{ position: 'absolute', top: 44, right: 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="close" size={28} color={denied || phase === 'unknown' ? theme.text : '#FFFFFF'} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {denied || phase === 'unknown' ? (
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 16, justifyContent: 'center' }}>
          {denied ? (
            <StateCard icon="camera-outline" title={COPY.cameraOffTitle} body={COPY.cameraOffBody}>
              <PrimaryButton label={COPY.openSettings} icon="settings-outline" onPress={() => Linking.openSettings()} />
              <SecondaryButton label={COPY.scanManual} icon="create-outline" onPress={manual} />
            </StateCard>
          ) : (
            <StateCard icon="help-circle-outline" title={COPY.scanUnknownTitle} body={COPY.scanUnknownBody}>
              <PrimaryButton label={COPY.scanManual} icon="create-outline" onPress={manual} />
              <SecondaryButton
                label={COPY.scanButton}
                icon="barcode-outline"
                onPress={() => {
                  scannedRef.current = false;
                  setPhase('camera');
                }}
              />
            </StateCard>
          )}
          {closeButton}
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          {pending ? null : (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
            />
          )}

          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, marginBottom: 16, textAlign: 'center', paddingHorizontal: 32 }}>
              {COPY.scanHint}
            </Text>
            <View style={{ width: 260, height: 180, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16 }} />
            {searching ? (
              <View style={{ alignItems: 'center', marginTop: 24 }} accessibilityLiveRegion="polite">
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 15, marginTop: 8 }}>{COPY.scanSearching}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 32 }}>
            <SecondaryButton label={COPY.scanManual} icon="create-outline" onPress={manual} />
          </View>
          {closeButton}
        </View>
      )}
    </Modal>
  );
}
