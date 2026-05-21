import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import { useThemeStore } from '@ziko/plugin-sdk';

interface WeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  dotDates?: Set<string>;
}

export function WeekStrip({ selectedDate, onSelect, dotDates }: WeekStripProps) {
  const theme = useThemeStore((s) => s.theme);

  const today = startOfDay(new Date());
  const jsToday = getDay(today);
  const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
  const monday = addDays(today, mondayOffset);
  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = format(date, 'yyyy-MM-dd');
    const isToday = differenceInCalendarDays(date, today) === 0;
    const hasDot = dotDates?.has(key) ?? false;
    return { label: DAY_LABELS[i], num: format(date, 'd'), date, isToday, hasDot };
  });

  const selectedKey = format(startOfDay(selectedDate), 'yyyy-MM-dd');

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
      {days.map((d, i) => {
        const dayKey = format(d.date, 'yyyy-MM-dd');
        const isSelected = dayKey === selectedKey;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelect(d.date)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: isSelected ? theme.primary : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: isSelected ? '#fff' : theme.muted,
              }}
            >
              {d.label}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: isSelected ? '#fff' : theme.text,
                marginTop: 2,
              }}
            >
              {d.num}
            </Text>
            {d.hasDot && (
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isSelected ? '#fff' : theme.primary,
                  marginTop: 3,
                }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
