import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const TODAY_DATE = new Date();
const TODAY_DAY = TODAY_DATE.getDate();
const TODAY_MONTH = TODAY_DATE.getMonth();
const TODAY_YEAR = TODAY_DATE.getFullYear();

// Mock sessions keyed by "YYYY-M-D"
function buildMockSessions(year: number, month: number): Record<number, { type: string; color: string }> {
  return {
    1: { type: 'Push', color: '#FF5C1A' },
    3: { type: 'Pull', color: '#2E7BF6' },
    5: { type: 'Legs', color: '#2E9E5B' },
    8: { type: 'Push', color: '#FF5C1A' },
    10: { type: 'Pull', color: '#2E7BF6' },
    15: { type: 'Push', color: '#FF5C1A' },
    17: { type: 'Pull', color: '#2E7BF6' },
    19: { type: 'Legs', color: '#2E9E5B' },
    22: { type: 'Push', color: '#FF5C1A' },
    24: { type: 'Pull', color: '#2E7BF6' },
    26: { type: 'Repos actif', color: '#6B6963' },
    ...(year === TODAY_YEAR && month === TODAY_MONTH
      ? { [TODAY_DAY]: { type: "Aujourd'hui · Legs", color: '#1C1A17' } }
      : {}),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-based weekday (0=Mon … 6=Sun)
function firstWeekdayMon(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7;
}

export default function CalendarScreen() {
  const theme = useThemeStore((s) => s.theme);

  const [offset, setOffset] = useState(0); // months from today
  const [selDay, setSelDay] = useState(TODAY_DAY);

  const displayDate = new Date(TODAY_YEAR, TODAY_MONTH + offset, 1);
  const dispMonth = displayDate.getMonth();
  const dispYear = displayDate.getFullYear();

  const monthLabel = `${MONTH_NAMES[dispMonth]} ${dispYear}`;
  const totalDays = daysInMonth(dispYear, dispMonth);
  const leadingBlanks = firstWeekdayMon(dispYear, dispMonth);
  const sessions = buildMockSessions(dispYear, dispMonth);
  const isCurrentMonth = dispYear === TODAY_YEAR && dispMonth === TODAY_MONTH;

  const selectedSession = sessions[selDay] ?? null;

  const cardStyle = {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.text + '0F', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: theme.text }}>
          {monthLabel}
        </Text>

        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => { setOffset((o) => o - 1); setSelDay(1); }}
            style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.text + '0F', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={14} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setOffset((o) => o + 1); setSelDay(1); }}
            style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.text + '0F', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={14} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Month stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {[
            { n: '14', l: 'Séances' },
            { n: '11h', l: 'Volume' },
            { n: '3', l: 'PR' },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, ...cardStyle, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{s.n}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Weekday labels */}
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 0.8 }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Days grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {/* Leading blanks */}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const s = sessions[day];
            const isToday = isCurrentMonth && day === TODAY_DAY;
            const isSel = day === selDay;

            return (
              <TouchableOpacity
                key={day}
                onPress={() => setSelDay(day)}
                style={{
                  width: `${100 / 7 - 0.6}%`,
                  aspectRatio: 1,
                  borderRadius: 10,
                  backgroundColor: isSel ? theme.text : theme.surface,
                  borderWidth: isToday && !isSel ? 1.5 : 1,
                  borderColor: isToday && !isSel ? theme.primary : theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isSel ? '#fff' : theme.text }}>{day}</Text>
                {s && (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? '#fff' : s.color }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day detail */}
        <View style={{ ...cardStyle, marginTop: 16, padding: 14 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {selDay} {MONTH_NAMES[dispMonth]}
          </Text>

          {selectedSession ? (
            <>
              <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, marginTop: 4 }}>{selectedSession.type}</Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                {isCurrentMonth && selDay <= TODAY_DAY
                  ? '5 exercices · 42 min · 12,4 t'
                  : '5 exercices prévus · 18:00'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.text }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                    {isCurrentMonth && selDay <= TODAY_DAY ? 'Voir détails' : 'Démarrer'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.text + '0F' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>Modifier</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, marginTop: 4 }}>Repos</Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Aucune séance prévue</Text>
              <TouchableOpacity
                style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.primary }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ Planifier</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
