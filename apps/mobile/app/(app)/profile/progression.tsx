import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';

interface Level {
  level: number;
  name: string;
  minXP: number;
  maxXP: number | null;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const LEVELS: Level[] = [
  { level: 1,  name: 'Débutant',     minXP: 0,      maxXP: 499,    icon: 'leaf-outline',         color: '#6B6963' },
  { level: 2,  name: 'Apprenti',     minXP: 500,    maxXP: 1499,   icon: 'school-outline',        color: '#2E9E5B' },
  { level: 3,  name: 'Confirmé',     minXP: 1500,   maxXP: 2999,   icon: 'ribbon-outline',        color: '#2EC4B6' },
  { level: 4,  name: 'Athlète',      minXP: 3000,   maxXP: 5499,   icon: 'barbell-outline',       color: '#2E7BF6' },
  { level: 5,  name: 'Challenger',   minXP: 5500,   maxXP: 9999,   icon: 'flash-outline',         color: '#7B5BD0' },
  { level: 6,  name: 'Compétiteur',  minXP: 10000,  maxXP: 14999,  icon: 'trophy-outline',        color: '#E8A33A' },
  { level: 7,  name: 'Expert',       minXP: 15000,  maxXP: 24999,  icon: 'star-outline',          color: '#FF5C1A' },
  { level: 8,  name: 'Pro',          minXP: 25000,  maxXP: 39999,  icon: 'shield-outline',        color: '#E94B3C' },
  { level: 9,  name: 'Elite',        minXP: 40000,  maxXP: 59999,  icon: 'medal-outline',         color: '#E91E63' },
  { level: 10, name: 'Champion',     minXP: 60000,  maxXP: 89999,  icon: 'diamond-outline',       color: '#FF5C1A' },
  { level: 11, name: 'Légende',      minXP: 90000,  maxXP: 129999, icon: 'flame-outline',         color: '#FF5C1A' },
  { level: 12, name: 'Immortel',     minXP: 130000, maxXP: null,   icon: 'planet-outline',        color: '#FF5C1A' },
];

// Mock current XP — in a real app fetch from gamification store or Supabase
const CURRENT_XP = 3_420;

function formatXP(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(xp % 1000 === 0 ? 0 : 1)}k`;
  return String(xp);
}

function getCurrentLevel(xp: number): Level {
  return (
    [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0]
  );
}

function getLevelProgress(xp: number, level: Level): number {
  if (!level.maxXP) return 100;
  const range = level.maxXP - level.minXP + 1;
  return Math.min(100, ((xp - level.minXP) / range) * 100);
}

export default function ProgressionScreen() {
  const theme = useThemeStore((s) => s.theme);
  const currentLevel = getCurrentLevel(CURRENT_XP);
  const progressPercent = getLevelProgress(CURRENT_XP, currentLevel);
  const xpToNext = currentLevel.maxXP != null ? currentLevel.maxXP + 1 - CURRENT_XP : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: `${theme.text}0F`,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Gamification
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>
            Progression XP
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Current level hero */}
        <View style={{
          backgroundColor: '#1C1A17', borderRadius: 16, padding: 20, marginBottom: 20,
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: 80,
            backgroundColor: `${currentLevel.color}55`, opacity: 0.5,
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: `${currentLevel.color}33`,
              borderWidth: 2, borderColor: currentLevel.color,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={currentLevel.icon} size={26} color={currentLevel.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: currentLevel.color, letterSpacing: 1, textTransform: 'uppercase' }}>
                Niveau {currentLevel.level}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFAF6', lineHeight: 28 }}>
                {currentLevel.name}
              </Text>
            </View>
          </View>

          {/* XP display */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFFAF6', lineHeight: 40 }}>
              {CURRENT_XP.toLocaleString('fr-FR')}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,250,246,0.6)' }}>XP</Text>
          </View>

          {/* Progress bar */}
          <View style={{ height: 6, backgroundColor: 'rgba(255,250,246,0.12)', borderRadius: 3, marginBottom: 6 }}>
            <View style={{
              width: `${progressPercent}%`, height: '100%',
              backgroundColor: currentLevel.color, borderRadius: 3,
            }} />
          </View>
          {currentLevel.maxXP != null ? (
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.55)' }}>
              {xpToNext.toLocaleString('fr-FR')} XP jusqu'au niveau {currentLevel.level + 1}
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.55)' }}>
              Niveau maximal atteint
            </Text>
          )}
        </View>

        {/* Level table header */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
        }}>
          Tableau des niveaux
        </Text>

        {/* Level rows */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {LEVELS.map((lvl, i) => {
            const isCurrent = lvl.level === currentLevel.level;
            const isUnlocked = CURRENT_XP >= lvl.minXP;

            return (
              <View key={lvl.level} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                backgroundColor: isCurrent ? `${lvl.color}0D` : 'transparent',
              }}>
                {/* Icon */}
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: isUnlocked ? `${lvl.color}22` : `${theme.text}08`,
                  borderWidth: isCurrent ? 2 : 0,
                  borderColor: lvl.color,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons
                    name={lvl.icon}
                    size={20}
                    color={isUnlocked ? lvl.color : theme.muted}
                  />
                </View>

                {/* Level info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '700',
                      color: isUnlocked ? theme.text : theme.muted,
                    }}>
                      {lvl.name}
                    </Text>
                    {isCurrent && (
                      <View style={{
                        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
                        backgroundColor: lvl.color,
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>
                          EN COURS
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
                    {lvl.maxXP != null
                      ? `${formatXP(lvl.minXP)} – ${formatXP(lvl.maxXP)} XP`
                      : `${formatXP(lvl.minXP)} XP+`}
                  </Text>
                </View>

                {/* Level number badge */}
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: isUnlocked ? `${lvl.color}22` : `${theme.text}08`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '800',
                    color: isUnlocked ? lvl.color : theme.muted,
                  }}>
                    {lvl.level}
                  </Text>
                </View>

                {/* Lock / check */}
                {isUnlocked ? (
                  isCurrent ? null : (
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  )
                ) : (
                  <Ionicons name="lock-closed-outline" size={16} color={theme.muted} />
                )}
              </View>
            );
          })}
        </View>

        {/* XP tips */}
        <Text style={{
          fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1,
          textTransform: 'uppercase', marginTop: 20, marginBottom: 10, marginLeft: 4,
        }}>
          Comment gagner des XP
        </Text>
        <View style={{
          backgroundColor: theme.surface, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {[
            { icon: 'barbell-outline' as const, label: 'Compléter une séance', xp: '+50 XP', color: theme.primary },
            { icon: 'checkmark-circle-outline' as const, label: 'Valider une habitude', xp: '+10 XP', color: '#2E9E5B' },
            { icon: 'trophy-outline' as const, label: 'Nouveau record (PR)', xp: '+100 XP', color: '#E8A33A' },
            { icon: 'flame-outline' as const, label: 'Streak 7 jours', xp: '+200 XP', color: '#E94B3C' },
            { icon: 'sparkles-outline' as const, label: 'Terminer un programme', xp: '+500 XP', color: '#7B5BD0' },
          ].map((tip, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 13,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
            }}>
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: `${tip.color}1A`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={tip.icon} size={17} color={tip.color} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>{tip.label}</Text>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                backgroundColor: `${tip.color}1A`,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: tip.color }}>{tip.xp}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
