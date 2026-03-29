import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { lookupBarcode } from '../utils/barcode';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (name: string) => void;
  onNotFound: () => void;
}

export default function BarcodeScanner({ visible, onClose, onScan, onNotFound }: BarcodeScannerProps) {
  const [, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const scannedRef = useRef(false);

  // Reset guard when modal becomes visible
  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setScanning(false);
    }
  }, [visible]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(true);

    try {
      const name = await lookupBarcode(data);
      if (name) {
        onScan(name);
        onClose();
      } else {
        onNotFound();
        onClose();
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Camera view */}
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
          }}
        />

        {/* Overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Instruction label above scan region */}
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '400',
              marginBottom: 16,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}
          >
            Placez le code-barres dans le cadre
          </Text>

          {/* Scan region indicator */}
          <View
            style={{
              width: 250,
              height: 250,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              borderRadius: 8,
              backgroundColor: 'transparent',
            }}
          />

          {/* Scanning indicator */}
          {scanning && (
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '400',
                  marginTop: 8,
                }}
              >
                Recherche du produit...
              </Text>
            </View>
          )}
        </View>

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          accessibilityLabel="Fermer le scanner"
          style={{
            position: 'absolute',
            top: 48,
            right: 16,
            padding: 10,
          }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
