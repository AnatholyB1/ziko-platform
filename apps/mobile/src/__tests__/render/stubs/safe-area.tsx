import React from 'react';

export const SafeAreaView = ({ children }: any) => React.createElement('div', null, children);
export const SafeAreaProvider = ({ children }: any) => React.createElement('div', null, children);
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
