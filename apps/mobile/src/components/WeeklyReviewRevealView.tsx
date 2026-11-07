import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated as RNAnimated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import {
  CHIP_ICON,
  ctaKey,
  getMotionSpec,
  pluralPoints,
  stepPills,
  type PointsView,
  type ReviewStep,
  type ReviewViewModel,
} from '../lib/weeklyRewardViewModel';

type T = (key: string, params?: Record<string, string | number>) => string;

// Phase 44 dark-exception tokens (44-UI-SPEC) + Phase 45 deltas (45-DESIGN-CONTRACT section 2).
const C = {
  bg: '#1C1A17',
  text: '#FFFAF6',
  sub: 'rgba(255,250,246,0.70)',
  card: 'rgba(255,250,246,0.06)',
  line: 'rgba(255,250,246,0.14)',
  primary: '#FF5C1A',
  okInk: '#8BDCAA',
  okBg: 'rgba(46,158,91,0.20)',
  upInk: '#FFB594',
  upBg: 'rgba(255,92,26,0.20)',
  neutralBg: 'rgba(255,250,246,0.10)',
};

const CHIP_STYLE: Record<PointsView['kind'], { bg: string; ink: string }> = {
  met: { bg: C.okBg, ink: C.okInk },
  exceeded: { bg: C.upBg, ink: C.upInk },
  missed: { bg: C.neutralBg, ink: C.text },
};

interface Props {
  vm: ReviewViewModel;
  step: ReviewStep;
  focus: string;
  t: T;
  reduceMotion: boolean;
  onCta: () => void;
}

// Presentational half of WeeklyReviewRevealOverlay: no Modal, no stores, no
// fetching, so it renders with fixture data (browser harness, tests).
export function WeeklyReviewRevealView({ vm, step, focus, t, reduceMotion, onCta }: Props) {
  const motion = getMotionSpec(reduceMotion);
  const pills = stepPills(vm, step);

  const badgeEntering = motion.badge.spring
    ? FadeInUp.springify().damping(12)
    : FadeIn.duration(motion.badge.fadeMs);
  const cardEntering = FadeIn.duration(motion.card.fadeMs).delay(motion.card.delayMs);

  const badgeIcon = step === 'tierUp' ? 'medal' : step === 'reward' ? 'ribbon' : 'sparkles';

  let headline = t('coach.weeklyReview.headline');
  let body = t('coach.weeklyReview.body', { focus });
  if (step === 'tierUp' && vm.tierUp) {
    headline = t('coach.weeklyReview.tierUp.title', { n: vm.tierUp.tier });
    body = t(
      vm.tierUp.hasReward ? 'coach.weeklyReview.tierUp.bodyReward' : 'coach.weeklyReview.tierUp.bodyNoReward',
      { points: vm.tierUp.total },
    );
  } else if (step === 'reward' && vm.reward) {
    headline = t('coach.weeklyReview.reward.title', { n: vm.reward.tier });
    body = t('coach.weeklyReview.reward.body');
  }

  const key = ctaKey(vm, step);
  const ctaLabel = t(key === 'cta' ? 'coach.weeklyReview.cta' : `coach.weeklyReview.${key}`);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }} accessibilityViewIsModal>
      <View
        style={{
          position: 'absolute',
          top: -40,
          left: '50%',
          marginLeft: -180,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: 'rgba(255,92,26,0.25)',
        }}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Relative box inside the safe area so the pills sit 8px below the inset. */}
        <View style={{ flex: 1 }}>
        {pills ? <StepPills index={pills.index} total={pills.total} t={t} /> : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={`b-${step}`} entering={badgeEntering} style={BADGE}>
            <Ionicons name={badgeIcon} size={38} color="#fff" />
          </Animated.View>

          <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 33, fontWeight: '700', color: C.text }}>
            {headline}
          </Text>

          <Text style={{ fontSize: 15, fontWeight: '400', color: C.sub, lineHeight: 22 }}>{body}</Text>

          {step === 'result' && vm.points ? (
            <Animated.View key="pts" entering={cardEntering}>
              <PointsCard points={vm.points} t={t} reduceMotion={reduceMotion} />
            </Animated.View>
          ) : null}

          {step === 'tierUp' && vm.tierUp ? (
            <Animated.View key="tiers" entering={cardEntering}>
              <TierStepper tier={vm.tierUp.tier} count={vm.tierUp.tierCount} t={t} />
            </Animated.View>
          ) : null}

          {step === 'reward' && vm.reward ? (
            <Animated.View key="rw" entering={badgeEntering}>
              <RewardCard reward={vm.reward} t={t} />
            </Animated.View>
          ) : null}

          <TouchableOpacity
            onPress={onCta}
            accessibilityRole="button"
            style={{ paddingVertical: 16, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: '700', color: '#fff' }}>{ctaLabel}</Text>
          </TouchableOpacity>
        </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const BADGE = {
  width: 76,
  height: 76,
  borderRadius: 22,
  backgroundColor: C.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  shadowColor: 'rgba(255,92,26,0.70)',
  shadowOffset: { width: 0, height: 12 },
  shadowRadius: 40,
  shadowOpacity: 1,
  elevation: 16,
};

function StepPills({ index, total, t }: { index: number; total: number; t: T }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('coach.weeklyReview.step.a11y', { n: index, total })}
      style={{
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        height: 8,
        zIndex: 1,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i + 1 === index ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i + 1 === index ? C.primary : C.line,
          }}
        />
      ))}
    </View>
  );
}

function PointsCard({ points, t, reduceMotion }: { points: PointsView; t: T; reduceMotion: boolean }) {
  const motion = getMotionSpec(reduceMotion);
  const fill = useRef(new RNAnimated.Value(motion.bar.durationMs === 0 ? points.barTo : points.barFrom)).current;

  useEffect(() => {
    if (motion.bar.durationMs === 0) {
      fill.setValue(points.barTo);
      return;
    }
    fill.setValue(points.barFrom);
    RNAnimated.timing(fill, {
      toValue: points.barTo,
      duration: motion.bar.durationMs,
      delay: motion.bar.delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, points.barFrom, points.barTo, motion.bar.durationMs, motion.bar.delayMs]);

  const missed = points.kind === 'missed';
  const chip = CHIP_STYLE[points.kind];
  const progress =
    points.barMax !== null
      ? t('coach.weeklyReview.tier.progress', { cur: points.total, max: points.barMax })
      : t(
          pluralPoints(points.total) === 'one' ? 'coach.weeklyReview.tier.totalOne' : 'coach.weeklyReview.tier.total',
          { n: points.total },
        );
  const a11yKey =
    points.kind === 'met'
      ? 'coach.weeklyReview.points.a11yMet'
      : points.kind === 'exceeded'
        ? 'coach.weeklyReview.points.a11yExceeded'
        : 'coach.weeklyReview.points.a11yMissed';
  const max = points.barMax ?? Math.max(points.total, 1);

  return (
    <View
      accessible
      accessibilityLabel={t(a11yKey, { n: points.earned, tier: points.tier, progress })}
      style={{
        borderRadius: 16,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.line,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 32,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: chip.bg,
          }}
        >
          <Ionicons name={CHIP_ICON[points.kind]} size={16} color={chip.ink} />
          <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '700', color: chip.ink }}>
            {t(`coach.weeklyReview.points.${points.kind}`)}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 40,
            lineHeight: 44,
            fontWeight: '800',
            color: missed ? C.sub : C.text,
            fontVariant: ['tabular-nums'],
          }}
        >
          {missed ? '0' : `+${points.earned}`}
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.sub }}> {t('coach.weeklyReview.points.unit')}</Text>
        </Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: Math.min(points.total, max) }}
        style={{ height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' }}
      >
        <RNAnimated.View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: C.primary,
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: C.text }}>
          {t('coach.weeklyReview.tier.label', { n: points.tier })}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '400', color: C.sub }}>{progress}</Text>
      </View>

      {missed ? (
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '400', color: C.sub }}>
          {t('coach.weeklyReview.points.missedSub')}
        </Text>
      ) : null}
    </View>
  );
}

function TierStepper({ tier, count, t }: { tier: number; count: number; t: T }) {
  const nodes = Array.from({ length: count }, (_, i) => i + 1);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('coach.weeklyReview.tier.a11y', { n: tier, max: count })}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}
    >
      {nodes.map((n) => {
        const done = n <= tier;
        return (
          <React.Fragment key={n}>
            {n > 1 ? (
              <View style={{ flex: 1, height: 2, marginHorizontal: 4, backgroundColor: n <= tier ? C.primary : C.line }} />
            ) : null}
            <View style={{ width: 44, height: 44 }}>
              {n === tier ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: -6,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,92,26,0.25)',
                  }}
                />
              ) : null}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 2,
                  borderColor: done ? C.primary : C.line,
                  backgroundColor: done ? C.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: done ? C.bg : C.sub }}>{n}</Text>
              </View>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function RewardCard({ reward, t }: { reward: NonNullable<ReviewViewModel['reward']>; t: T }) {
  const kindLabel = t(`coach.weeklyReview.reward.kind.${reward.kind}`);
  return (
    <View
      accessible
      accessibilityLabel={t('coach.weeklyReview.reward.a11y', { kind: kindLabel.toLowerCase(), name: reward.name })}
      style={{
        borderRadius: 16,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.line,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.upBg, justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '700', color: C.upInk }}>
          {t('coach.weeklyReview.reward.chip')}
        </Text>
      </View>
      <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '700', color: C.text, textAlign: 'center' }}>
        {reward.name}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '700', color: C.sub, textAlign: 'center' }}>
        {kindLabel} {'·'} {t('coach.weeklyReview.tier.label', { n: reward.tier })}
      </Text>
    </View>
  );
}
