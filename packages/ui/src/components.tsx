import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInput,
  TextInputProps,
  StyleProp,
} from 'react-native';
import { MotiView } from 'moti';
import { useThemeStore, ThemePalette } from '@ziko/plugin-sdk';

// ── Static tokens (no theme dependency) ─────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  button: { fontSize: 15, fontWeight: '600' as const },
} as const;

// ── Internal helper ──────────────────────────────────────────
function resolveCardStyle(theme: ThemePalette, override?: ThemePalette['cardStyle']): ViewStyle {
  const style = override ?? theme.cardStyle;
  switch (style) {
    case 'flat':
      return { borderWidth: 1, borderColor: theme.border };
    case 'outlined':
      return { borderWidth: 1.5, borderColor: theme.text };
    case 'shadow':
    default:
      return {
        borderWidth: 0,
        shadowColor: theme.cardDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      };
  }
}

// ── Button ───────────────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  leftIcon,
}: ButtonProps) {
  const theme = useThemeStore((s) => s.theme);

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 15, paddingHorizontal: 24 },
    lg: { paddingVertical: 18, paddingHorizontal: 32 },
  };
  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: theme.primary },
    dark: { backgroundColor: theme.cardDark },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.primary },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF4444' },
  };
  const textVariant: Record<string, TextStyle> = {
    primary: { color: '#FFFFFF' },
    dark: { color: theme.cardDarkText },
    outline: { color: theme.primary },
    ghost: { color: theme.muted },
    danger: { color: '#EF4444' },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        {
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        sizeStyles[size],
        variantStyles[variant],
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'dark' ? theme.cardDarkText : '#FFFFFF'}
        />
      ) : (
        <>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text style={[typography.button, textVariant[variant], textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Card ─────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  animate?: boolean;
  delay?: number;
  cardStyle?: 'flat' | 'shadow' | 'outlined';
}

export function Card({
  children,
  style,
  padding = 'md',
  animate = false,
  delay = 0,
  cardStyle,
}: CardProps) {
  const theme = useThemeStore((s) => s.theme);
  const baseStyle: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    padding: spacing[padding],
    ...resolveCardStyle(theme, cardStyle),
  };

  if (animate) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 350, delay }}
        style={[baseStyle, style]}
      >
        {children}
      </MotiView>
    );
  }
  return <View style={[baseStyle, style]}>{children}</View>;
}

// ── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
}

export function Badge({ label, color, textColor }: BadgeProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  const tc = textColor ?? c;
  return (
    <View style={{
      backgroundColor: c + '22',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.full,
      alignSelf: 'flex-start',
    }}>
      <Text style={[typography.caption, { color: tc, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

// ── Tag ──────────────────────────────────────────────────────
export function Tag({ label, color }: { label: string; color?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.warn;
  return (
    <View style={{
      backgroundColor: c + '18',
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && (
        <Text style={[typography.bodySmall, { color: theme.muted, marginBottom: 6 }]}>
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        style={[
          {
            backgroundColor: theme.background,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? '#EF4444' : theme.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 14,
            color: theme.text,
            fontSize: 15,
          },
          style,
        ]}
        placeholderTextColor={theme.muted}
      />
      {error && (
        <Text style={[typography.caption, { color: '#EF4444', marginTop: 4 }]}>{error}</Text>
      )}
    </View>
  );
}

// ── ScreenHeader ─────────────────────────────────────────────
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.h2, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[typography.bodySmall, { color: theme.muted, marginTop: 2 }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View>{right}</View>}
    </View>
  );
}

// ── StatCard ─────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  style?: ViewStyle;
  animate?: boolean;
  delay?: number;
}

export function StatCard({ label, value, unit, color, style, animate, delay }: StatCardProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  return (
    <Card style={[{ alignItems: 'center', flex: 1 }, style]} animate={animate} delay={delay}>
      <Text style={[typography.h2, { color: c }]}>{value}</Text>
      {unit && <Text style={[typography.caption, { color: theme.muted }]}>{unit}</Text>}
      <Text style={[typography.caption, { color: theme.muted, marginTop: 4 }]}>{label}</Text>
    </Card>
  );
}

// ── ProgressBar ──────────────────────────────────────────────
interface ProgressBarProps {
  progress: number; // 0–1
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ progress, color, height = 6, style }: ProgressBarProps) {
  const theme = useThemeStore((s) => s.theme);
  const c = color ?? theme.primary;
  const pct = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[{
      height,
      backgroundColor: theme.border,
      borderRadius: height / 2,
      overflow: 'hidden',
    }, style]}>
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${pct * 100}%` as any }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ height: '100%', backgroundColor: c, borderRadius: height / 2 }}
      />
    </View>
  );
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={[{
      height: 1,
      backgroundColor: theme.border,
      marginVertical: spacing.md,
    }, style]} />
  );
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({
  width,
  height = 16,
  borderRadius = radius.sm,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.7 }}
      transition={{ type: 'timing', duration: 800, loop: true }}
      style={[{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: theme.border,
      }, style]}
    />
  );
}
