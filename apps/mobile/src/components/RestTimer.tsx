import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../stores/themeStore';
import { playCountdownBeep } from '../lib/sounds';

// ─── Constants (outside component to prevent re-creation) ────────────────────
const r = 110;
const CIRC = 2 * Math.PI * r; // ~691.15
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Props ───────────────────────────────────────────────────────────────────
export interface RestTimerProps {
  visible: boolean;
  remaining: number;    // display-only — driven by session.tsx restTimer state
  duration: number;     // total seconds, used for ring progress ratio
  nextLabel?: string;   // e.g. "95 kg × 7 · Développé couché"
  onSkip: () => void;   // "Reprendre maintenant" tap
  onClose: () => void;  // X button tap
  onAdjust?: (delta: number) => void; // optional ±30s
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function RestTimer({
  visible,
  remaining,
  duration,
  nextLabel,
  onSkip,
  onClose,
  onAdjust,
}: RestTimerProps) {
  const theme = useThemeStore((s) => s.theme);

  // Local state — only Pause/Reprendre toggle (not countdown logic)
  const [paused, setPaused] = useState(false);

  // Refs for animations
  const animOffset = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── SVG ring animation — strokeDashoffset ────────────────────────────────
  // useNativeDriver: false REQUIRED — native driver does not support SVG props
  useEffect(() => {
    if (!visible) return;
    const ratio = duration > 0 ? remaining / duration : 0;
    const targetOffset = CIRC * (1 - ratio);
    Animated.timing(animOffset, {
      toValue: targetOffset,
      duration: 1000,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
  }, [remaining, visible, duration, animOffset]);

  // ── Pulse animation on ring opacity — fires when remaining <= 5 ──────────
  // useNativeDriver: true — opacity is supported by native driver
  useEffect(() => {
    if (remaining <= 5 && remaining > 0 && visible) {
      // Play countdown beep sound
      try { playCountdownBeep(remaining); } catch {}

      // Start pulse loop
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.55,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1.0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current = loop;
      loop.start();
    } else {
      // Stop pulse
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
      pulseOpacity.setValue(1);
    }

    return () => {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
    };
  }, [remaining <= 5, visible, pulseOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-close when countdown reaches 0 ──────────────────────────────────
  useEffect(() => {
    if (remaining <= 0 && visible) {
      setTimeout(onClose, 600);
    }
  }, [remaining, visible, onClose]);

  // ── Format M:SS ──────────────────────────────────────────────────────────
  const fmt = (secs: number) => {
    const s = Math.max(0, Math.round(secs));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Dark overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#1C1A17',
          zIndex: 80,
          flexDirection: 'column',
        }}
      >
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 250 }}
          style={{ flex: 1, flexDirection: 'column' }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              paddingHorizontal: 16,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'rgba(255,250,246,0.55)',
              }}
            >
              Repos
            </Text>

            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Fermer le chrono"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(255,250,246,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto',
              }}
            >
              <Ionicons name="close" size={16} color="#FFFAF6" />
            </TouchableOpacity>
          </View>

          {/* ── Center content — SVG ring + countdown ──────────────────── */}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
          >
            {/* SVG ring container — rotated so ring starts at top */}
            <View style={{ width: 260, height: 260, transform: [{ rotate: '-90deg' }] }}>
              <Svg width={260} height={260}>
                <Defs>
                  <SvgLinearGradient id="restGrad" x1="0" x2="1" y1="0" y2="1">
                    <Stop offset="0%" stopColor={theme.primary} />
                    <Stop offset="100%" stopColor="#FFB07A" />
                  </SvgLinearGradient>
                </Defs>

                {/* Background track */}
                <Circle
                  cx={130}
                  cy={130}
                  r={110}
                  stroke="rgba(255,250,246,0.08)"
                  strokeWidth={10}
                  fill="none"
                />

                {/* Animated progress ring */}
                <AnimatedCircle
                  cx={130}
                  cy={130}
                  r={110}
                  stroke="url(#restGrad)"
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={animOffset}
                  opacity={pulseOpacity}
                />
              </Svg>
            </View>

            {/* Countdown text — absolutely centered over SVG */}
            <View
              style={{
                position: 'absolute',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 76,
                  fontWeight: '700',
                  color: '#FFFAF6',
                  lineHeight: 76,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {fmt(remaining)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: 'rgba(255,250,246,0.5)',
                  fontWeight: '700',
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                / {fmt(duration)}
              </Text>
            </View>

            {/* Next series label */}
            {nextLabel ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: 'rgba(255,250,246,0.5)',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Prochaine série
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#FFFAF6',
                    marginTop: 4,
                  }}
                >
                  {nextLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Controls row — −30s / Pause / +30s ─────────────────────── */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingBottom: 16,
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {/* −30s ghost button */}
            <TouchableOpacity
              onPress={() => {
                if (onAdjust) {
                  onAdjust(-30);
                }
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,250,246,0.14)',
                backgroundColor: 'rgba(255,250,246,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>
                −30s
              </Text>
            </TouchableOpacity>

            {/* Pause/Reprendre center button */}
            <TouchableOpacity
              onPress={() => setPaused((p) => !p)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: 'rgba(255,250,246,0.92)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              {paused ? (
                <>
                  <Ionicons name="play" size={12} color="#1C1A17" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1C1A17' }}>
                    Reprendre
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1C1A17' }}>
                  Pause
                </Text>
              )}
            </TouchableOpacity>

            {/* +30s ghost button */}
            <TouchableOpacity
              onPress={() => {
                if (onAdjust) {
                  onAdjust(30);
                }
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,250,246,0.14)',
                backgroundColor: 'rgba(255,250,246,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFAF6' }}>
                +30s
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── CTA — Reprendre maintenant ─────────────────────────────── */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            <TouchableOpacity
              onPress={onSkip}
              style={{
                width: '100%',
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: '#FF5C1A',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="play" size={13} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                Reprendre maintenant
              </Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}
