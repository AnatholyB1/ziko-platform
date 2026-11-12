import React from 'react';

// Minimal DOM stand-ins for React Native host components (render tests only).
const box = (tag: string) =>
  function Host({ children, testID, onPress }: any) {
    const props: any = { 'data-testid': testID };
    if (onPress) props.onClick = onPress;
    return React.createElement(tag, props, typeof children === 'function' ? null : children);
  };

export const View = box('div');
export const Text = box('span');
export const ScrollView = box('div');
export const SafeAreaView = box('div');
export const TouchableOpacity = box('button');
export const Pressable = box('button');
export const TextInput = ({ value }: any) => React.createElement('input', { defaultValue: value });
export const Modal = ({ visible, children }: any) =>
  visible ? React.createElement('div', null, children) : null;
export const ActivityIndicator = () => React.createElement('div', { 'data-testid': 'spinner' });
export const Dimensions = { get: () => ({ width: 390, height: 800 }) };
export const Platform = { OS: 'android', select: (o: any) => o.android ?? o.default };
export const StyleSheet = { create: (s: any) => s, flatten: (s: any) => s };
export const Alert = { alert: () => undefined };
export const Linking = { openURL: async () => undefined };
export const Keyboard = { dismiss: () => undefined, addListener: () => ({ remove() {} }) };
export const useColorScheme = () => 'light';
export const AppState = { addEventListener: () => ({ remove() {} }), currentState: 'active' };
export const FlatList = ({ data = [], renderItem }: any) =>
  React.createElement('div', null, data.map((item: any, index: number) => renderItem({ item, index })));
export const Image = () => null;
export const KeyboardAvoidingView = box('div');
export const Switch = () => null;
export default { View, Text };
