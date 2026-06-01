/**
 * Background notification task registration.
 *
 * expo-task-manager is required to define background tasks. This file registers
 * the ZIKO_BACKGROUND_NOTIFICATION task so TaskManager can process notifications
 * received while the app is in the background or killed.
 *
 * Note: expo-task-manager must be installed separately (it is a peer of expo-notifications).
 * If the module is not present, this file is a safe no-op — background notification
 * delivery still works; badge count sync is deferred to the foreground AppState listener.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hasTaskManager = (() => {
  try {
    require('expo-task-manager');
    return true;
  } catch {
    return false;
  }
})();

if (hasTaskManager) {
  // Dynamic require so TypeScript does not fail when the module is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');

  const BACKGROUND_NOTIFICATION_TASK = 'ZIKO_BACKGROUND_NOTIFICATION';

  TaskManager.defineTask(
    BACKGROUND_NOTIFICATION_TASK,
    ({ error }: { data: unknown; error: unknown }) => {
      if (error) return 3; // BackgroundNotificationResult.Failed
      return 2; // BackgroundNotificationResult.NewData
    }
  );

  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(
    (err: unknown) => {
      console.warn('[notificationTask] registerTaskAsync failed:', err);
    }
  );
}

export {};
