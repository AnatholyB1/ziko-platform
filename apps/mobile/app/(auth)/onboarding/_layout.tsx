import React, { useState, createContext, useContext } from 'react';
import { Stack } from 'expo-router';

export type OBState = {
  goal: string | null;
  level: string | null;
  frequency: number;
  equipment: string[];
  sex: string | null;
  age: number;
  height: number;
  weight: number;
};

const DEFAULT_OB_STATE: OBState = {
  goal: null,
  level: null,
  frequency: 4,
  equipment: [],
  sex: null,
  age: 28,
  height: 178,
  weight: 76,
};

type OBContextType = {
  obState: OBState;
  setObState: (partial: Partial<OBState>) => void;
};

export const OBContext = createContext<OBContextType>({
  obState: DEFAULT_OB_STATE,
  setObState: () => {},
});

export function useOBContext() {
  return useContext(OBContext);
}

export default function OnboardingLayout() {
  const [obState, setObStateRaw] = useState<OBState>(DEFAULT_OB_STATE);

  const setObState = (partial: Partial<OBState>) => {
    setObStateRaw((prev) => ({ ...prev, ...partial }));
  };

  return (
    <OBContext.Provider value={{ obState, setObState }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="step-1" />
        <Stack.Screen name="step-2" />
        <Stack.Screen name="step-3" />
        <Stack.Screen name="step-4" />
        <Stack.Screen name="step-5" />
        <Stack.Screen name="step-6" />
        <Stack.Screen name="step-7" />
      </Stack>
    </OBContext.Provider>
  );
}
