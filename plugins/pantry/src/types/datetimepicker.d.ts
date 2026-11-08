// The package is installed under apps/mobile, so it does not resolve from this
// workspace when type-checking the plugin on its own. Minimal ambient
// declaration covering the props PantryItemForm uses (mirrors
// apps/mobile/src/types/declarations.d.ts).
declare module '@react-native-community/datetimepicker' {
  import type { ComponentType } from 'react';
  import type { ViewStyle } from 'react-native';

  export interface DateTimePickerEvent {
    type: string;
    nativeEvent: {
      timestamp?: number;
      utcOffset?: number;
    };
  }

  export interface DateTimePickerProps {
    value: Date;
    mode?: 'date' | 'time' | 'datetime' | 'countdown';
    display?: 'default' | 'spinner' | 'calendar' | 'clock' | 'inline';
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    style?: ViewStyle;
    textColor?: string;
    accentColor?: string;
    locale?: string;
    is24Hour?: boolean;
    disabled?: boolean;
    themeVariant?: 'light' | 'dark';
    testID?: string;
  }

  const DateTimePicker: ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
