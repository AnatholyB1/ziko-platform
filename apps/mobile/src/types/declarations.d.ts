// Module declarations for packages without proper TypeScript resolution
// in the mobile app's bundler module resolution mode.

declare module '@react-native-community/datetimepicker' {
  import type { ComponentType } from 'react';
  import type { ViewStyle } from 'react-native';

  export type AndroidMode = 'date' | 'time';
  export type IOSMode = 'date' | 'time' | 'datetime' | 'countdown';
  export type Display = 'default' | 'spinner' | 'calendar' | 'clock' | 'inline';

  export interface DateTimePickerEvent {
    type: string;
    nativeEvent: {
      timestamp?: number;
      utcOffset?: number;
    };
  }

  export interface DateTimePickerProps {
    value: Date;
    mode?: AndroidMode | IOSMode;
    display?: Display;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    style?: ViewStyle;
    textColor?: string;
    accentColor?: string;
    locale?: string;
    is24Hour?: boolean;
    timeZoneName?: string;
    timeZoneOffsetInMinutes?: number;
    disabled?: boolean;
    themeVariant?: 'light' | 'dark';
    testID?: string;
  }

  const DateTimePicker: ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
