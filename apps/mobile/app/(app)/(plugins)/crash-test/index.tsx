import React from 'react';
import { Redirect } from 'expo-router';

// UAT-only route (HABT-02): forces a render error inside the plugin layout so the
// module error guard can be exercised on a device (deep link `ziko://crash-test`).
// Enabled only in dev builds or when the build sets EXPO_PUBLIC_UAT_CRASH_ROUTE=1
// (the `uat-dev` EAS profile). In a production build it redirects home and never throws.
const ENABLED = __DEV__ || process.env.EXPO_PUBLIC_UAT_CRASH_ROUTE === '1';

export default function CrashTestRoute() {
  if (!ENABLED) return <Redirect href="/(app)/" />;
  throw new Error('UAT forced render error (crash-test route)');
}
