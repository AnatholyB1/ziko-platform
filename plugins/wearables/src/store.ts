import { create } from 'zustand';
import { Platform } from 'react-native';

// ── Types ────────────────────────────────────────────────────

export interface StepData {
  date: string;
  count: number;
}

export interface HeartRateData {
  date: string;
  avg_bpm: number;
  min_bpm: number;
  max_bpm: number;
  resting_bpm: number | null;
}

export interface SleepData {
  date: string;
  bedtime: string;
  wake_time: string;
  duration_hours: number;
  quality: number | null;
}

export interface CaloriesData {
  date: string;
  active: number;
  total: number;
}

export interface ExerciseData {
  date: string;
  type: string;
  duration_min: number;
  calories: number;
  distance_km: number | null;
  heart_rate_avg: number | null;
}

export interface HealthSummary {
  date: string;
  steps: number;
  calories_active: number;
  calories_total: number;
  heart_rate_avg: number | null;
  heart_rate_resting: number | null;
  sleep_hours: number | null;
  exercises: ExerciseData[];
}

export interface SyncStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  platform: 'apple_health' | 'health_connect' | 'none';
  permissionsGranted: boolean;
}

// ── Store ────────────────────────────────────────────────────

interface WearablesState {
  syncStatus: SyncStatus;
  todaySummary: HealthSummary | null;
  weeklySteps: StepData[];
  isLoading: boolean;
  error: string | null;

  setSyncStatus: (status: SyncStatus) => void;
  setTodaySummary: (summary: HealthSummary | null) => void;
  setWeeklySteps: (steps: StepData[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  initialize: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  syncAll: () => Promise<void>;
  getSteps: (startDate: string, endDate: string) => Promise<StepData[]>;
  getHeartRate: (startDate: string, endDate: string) => Promise<HeartRateData[]>;
  getSleep: (startDate: string, endDate: string) => Promise<SleepData[]>;
  getCalories: (startDate: string, endDate: string) => Promise<CaloriesData[]>;
  getExercises: (startDate: string, endDate: string) => Promise<ExerciseData[]>;
  getDaySummary: (date: string) => Promise<HealthSummary>;
}

// ── Helpers ──────────────────────────────────────────────────

function dateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Platform adapters ────────────────────────────────────────

async function initializeHealthConnect(): Promise<boolean> {
  try {
    const HC = require('react-native-health-connect');
    // initialize() must be called before getSdkStatus() in v3.x
    const isInitialized = await HC.initialize();
    if (!isInitialized) return false;
    const status = await HC.getSdkStatus();
    return status === HC.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

async function requestHealthConnectPermissions(): Promise<boolean> {
  try {
    const HC = require('react-native-health-connect');
    const granted = await HC.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Weight' },
      { accessType: 'read', recordType: 'BodyFat' },
    ]);
    return granted.length > 0;
  } catch {
    return false;
  }
}

async function getHealthConnectSteps(start: Date, end: Date): Promise<StepData[]> {
  try {
    const HC = require('react-native-health-connect');
    const result = await HC.readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    // Group by date
    const byDate: Record<string, number> = {};
    for (const r of result) {
      const date = new Date(r.startTime).toISOString().split('T')[0];
      byDate[date] = (byDate[date] ?? 0) + (r.count ?? 0);
    }
    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  } catch {
    return [];
  }
}

async function getHealthConnectHeartRate(start: Date, end: Date): Promise<HeartRateData[]> {
  try {
    const HC = require('react-native-health-connect');
    const result = await HC.readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    const byDate: Record<string, number[]> = {};
    for (const r of result) {
      const date = new Date(r.startTime).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      for (const sample of r.samples ?? []) {
        byDate[date].push(sample.beatsPerMinute);
      }
    }
    return Object.entries(byDate).map(([date, bpms]) => ({
      date,
      avg_bpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
      min_bpm: Math.min(...bpms),
      max_bpm: Math.max(...bpms),
      resting_bpm: null,
    }));
  } catch {
    return [];
  }
}

async function getHealthConnectSleep(start: Date, end: Date): Promise<SleepData[]> {
  try {
    const HC = require('react-native-health-connect');
    const result = await HC.readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    return result.map((r: any) => {
      const bedtime = new Date(r.startTime);
      const wakeTime = new Date(r.endTime);
      const durationMs = wakeTime.getTime() - bedtime.getTime();
      return {
        date: wakeTime.toISOString().split('T')[0],
        bedtime: bedtime.toTimeString().slice(0, 5),
        wake_time: wakeTime.toTimeString().slice(0, 5),
        duration_hours: Math.round((durationMs / 3600000) * 10) / 10,
        quality: null,
      };
    });
  } catch {
    return [];
  }
}

async function getHealthConnectCalories(start: Date, end: Date): Promise<CaloriesData[]> {
  try {
    const HC = require('react-native-health-connect');
    const [activeRes, totalRes] = await Promise.all([
      HC.readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      }),
      HC.readRecords('TotalCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      }),
    ]);
    const byDate: Record<string, { active: number; total: number }> = {};
    for (const r of activeRes) {
      const date = new Date(r.startTime).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = { active: 0, total: 0 };
      byDate[date].active += r.energy?.inKilocalories ?? 0;
    }
    for (const r of totalRes) {
      const date = new Date(r.startTime).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = { active: 0, total: 0 };
      byDate[date].total += r.energy?.inKilocalories ?? 0;
    }
    return Object.entries(byDate).map(([date, cals]) => ({
      date,
      active: Math.round(cals.active),
      total: Math.round(cals.total),
    }));
  } catch {
    return [];
  }
}

async function getHealthConnectExercises(start: Date, end: Date): Promise<ExerciseData[]> {
  try {
    const HC = require('react-native-health-connect');
    const result = await HC.readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    return result.map((r: any) => {
      const startTime = new Date(r.startTime);
      const endTime = new Date(r.endTime);
      const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      return {
        date: startTime.toISOString().split('T')[0],
        type: String(r.exerciseType ?? 'unknown').toLowerCase(),
        duration_min: durationMin,
        calories: 0,
        distance_km: null,
        heart_rate_avg: null,
      };
    });
  } catch {
    return [];
  }
}

// ── Apple HealthKit adapter ──────────────────────────────────

async function initializeHealthKit(): Promise<boolean> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    return new Promise((resolve) => {
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.StepCount,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.RestingHeartRate,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
            AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
            AppleHealthKit.Constants.Permissions.DistanceCycling,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.BodyFatPercentage,
          ],
          write: [] as string[],
        },
      };
      AppleHealthKit.initHealthKit(permissions, (err: any) => {
        resolve(!err);
      });
    });
  } catch {
    return false;
  }
}

async function getHealthKitSteps(start: Date, end: Date): Promise<StepData[]> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    return new Promise((resolve) => {
      AppleHealthKit.getDailyStepCountSamples(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err: any, results: any[]) => {
          if (err || !results) return resolve([]);
          resolve(results.map((r) => ({
            date: new Date(r.startDate).toISOString().split('T')[0],
            count: Math.round(r.value),
          })));
        },
      );
    });
  } catch {
    return [];
  }
}

async function getHealthKitHeartRate(start: Date, end: Date): Promise<HeartRateData[]> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const samples: any[] = await new Promise((resolve) => {
      AppleHealthKit.getHeartRateSamples(
        {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          ascending: true,
        },
        (err: any, results: any[]) => resolve(err ? [] : results ?? []),
      );
    });

    const restingBpm: number | null = await new Promise((resolve) => {
      AppleHealthKit.getRestingHeartRate(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err: any, results: any[]) => {
          if (err || !results?.length) return resolve(null);
          resolve(Math.round(results[results.length - 1].value));
        },
      );
    });

    const byDate: Record<string, number[]> = {};
    for (const s of samples) {
      const date = new Date(s.startDate).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(s.value);
    }

    return Object.entries(byDate).map(([date, bpms]) => ({
      date,
      avg_bpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
      min_bpm: Math.round(Math.min(...bpms)),
      max_bpm: Math.round(Math.max(...bpms)),
      resting_bpm: restingBpm,
    }));
  } catch {
    return [];
  }
}

async function getHealthKitSleep(start: Date, end: Date): Promise<SleepData[]> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    return new Promise((resolve) => {
      AppleHealthKit.getSleepSamples(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err: any, results: any[]) => {
          if (err || !results) return resolve([]);
          // Filter for InBed or Asleep values
          const sleepSamples = results.filter((r) =>
            r.value === 'INBED' || r.value === 'ASLEEP' || r.value === 'CORE' || r.value === 'DEEP' || r.value === 'REM',
          );
          if (!sleepSamples.length) return resolve([]);

          // Group overlapping sleep samples into sessions
          const sessions: SleepData[] = [];
          let sessionStart = new Date(sleepSamples[0].startDate);
          let sessionEnd = new Date(sleepSamples[0].endDate);

          for (let i = 1; i < sleepSamples.length; i++) {
            const sampleStart = new Date(sleepSamples[i].startDate);
            const sampleEnd = new Date(sleepSamples[i].endDate);
            // If gap > 1 hour, consider it a new session
            if (sampleStart.getTime() - sessionEnd.getTime() > 3600000) {
              const durationMs = sessionEnd.getTime() - sessionStart.getTime();
              sessions.push({
                date: sessionEnd.toISOString().split('T')[0],
                bedtime: sessionStart.toTimeString().slice(0, 5),
                wake_time: sessionEnd.toTimeString().slice(0, 5),
                duration_hours: Math.round((durationMs / 3600000) * 10) / 10,
                quality: null,
              });
              sessionStart = sampleStart;
            }
            if (sampleEnd > sessionEnd) sessionEnd = sampleEnd;
          }
          // Push last session
          const durationMs = sessionEnd.getTime() - sessionStart.getTime();
          sessions.push({
            date: sessionEnd.toISOString().split('T')[0],
            bedtime: sessionStart.toTimeString().slice(0, 5),
            wake_time: sessionEnd.toTimeString().slice(0, 5),
            duration_hours: Math.round((durationMs / 3600000) * 10) / 10,
            quality: null,
          });

          resolve(sessions);
        },
      );
    });
  } catch {
    return [];
  }
}

async function getHealthKitCalories(start: Date, end: Date): Promise<CaloriesData[]> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    const [active, basal] = await Promise.all([
      new Promise<any[]>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(
          { startDate: start.toISOString(), endDate: end.toISOString() },
          (err: any, results: any[]) => resolve(err ? [] : results ?? []),
        );
      }),
      new Promise<any[]>((resolve) => {
        AppleHealthKit.getBasalEnergyBurned(
          { startDate: start.toISOString(), endDate: end.toISOString() },
          (err: any, results: any[]) => resolve(err ? [] : results ?? []),
        );
      }),
    ]);

    const byDate: Record<string, { active: number; basal: number }> = {};
    for (const r of active) {
      const date = new Date(r.startDate).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = { active: 0, basal: 0 };
      byDate[date].active += r.value ?? 0;
    }
    for (const r of basal) {
      const date = new Date(r.startDate).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = { active: 0, basal: 0 };
      byDate[date].basal += r.value ?? 0;
    }

    return Object.entries(byDate).map(([date, cals]) => ({
      date,
      active: Math.round(cals.active),
      total: Math.round(cals.active + cals.basal),
    }));
  } catch {
    return [];
  }
}

async function getHealthKitExercises(start: Date, end: Date): Promise<ExerciseData[]> {
  try {
    const AppleHealthKit = require('react-native-health').default;
    return new Promise((resolve) => {
      AppleHealthKit.getSamples(
        {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          type: 'Workout',
        },
        (err: any, results: any[]) => {
          if (err || !results) return resolve([]);
          resolve(results.map((r) => ({
            date: new Date(r.start).toISOString().split('T')[0],
            type: String(r.activityName ?? 'unknown').toLowerCase(),
            duration_min: Math.round((r.duration ?? 0) / 60),
            calories: Math.round(r.calories ?? 0),
            distance_km: r.distance ? Math.round(r.distance * 10) / 10 : null,
            heart_rate_avg: null,
          })));
        },
      );
    });
  } catch {
    return [];
  }
}

// ── Store ────────────────────────────────────────────────────

export const useWearablesStore = create<WearablesState>()((set, get) => ({
  syncStatus: {
    isConnected: false,
    lastSyncAt: null,
    platform: 'none',
    permissionsGranted: false,
  },
  todaySummary: null,
  weeklySteps: [],
  isLoading: false,
  error: null,

  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setTodaySummary: (todaySummary) => set({ todaySummary }),
  setWeeklySteps: (weeklySteps) => set({ weeklySteps }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      let connected = false;
      const platform = Platform.OS;

      if (platform === 'android') {
        connected = await initializeHealthConnect();
        if (connected) {
          set({
            syncStatus: {
              isConnected: true,
              lastSyncAt: null,
              platform: 'health_connect',
              permissionsGranted: false,
            },
          });
        }
      } else if (platform === 'ios') {
        connected = await initializeHealthKit();
        if (connected) {
          set({
            syncStatus: {
              isConnected: true,
              lastSyncAt: null,
              platform: 'apple_health',
              permissionsGranted: true, // HealthKit grants at init
            },
          });
        }
      }

      if (!connected) {
        set({
          syncStatus: { isConnected: false, lastSyncAt: null, platform: 'none', permissionsGranted: false },
          error: platform === 'ios'
            ? 'Apple Health non disponible sur cet appareil.'
            : 'Health Connect non disponible. Installez l\'application Health Connect.',
        });
      }
    } catch (e: any) {
      set({ error: e.message ?? 'Erreur d\'initialisation' });
    } finally {
      set({ isLoading: false });
    }
  },

  requestPermissions: async () => {
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') {
      const granted = await requestHealthConnectPermissions();
      set({ syncStatus: { ...syncStatus, permissionsGranted: granted } });
      return granted;
    }
    // iOS: permissions granted at initHealthKit
    return syncStatus.platform === 'apple_health';
  },

  syncAll: async () => {
    const { syncStatus, getDaySummary, getSteps } = get();
    if (!syncStatus.isConnected || !syncStatus.permissionsGranted) return;

    set({ isLoading: true, error: null });
    try {
      const todayStr = today();
      const weekAgo = daysAgo(6);

      const [summary, steps] = await Promise.all([
        getDaySummary(todayStr),
        getSteps(weekAgo, todayStr),
      ]);

      set({
        todaySummary: summary,
        weeklySteps: steps,
        syncStatus: { ...get().syncStatus, lastSyncAt: new Date().toISOString() },
      });
    } catch (e: any) {
      set({ error: e.message ?? 'Erreur de synchronisation' });
    } finally {
      set({ isLoading: false });
    }
  },

  getSteps: async (startDate: string, endDate: string) => {
    const { start, end } = dateRange(startDate, endDate);
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') return getHealthConnectSteps(start, end);
    if (syncStatus.platform === 'apple_health') return getHealthKitSteps(start, end);
    return [];
  },

  getHeartRate: async (startDate: string, endDate: string) => {
    const { start, end } = dateRange(startDate, endDate);
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') return getHealthConnectHeartRate(start, end);
    if (syncStatus.platform === 'apple_health') return getHealthKitHeartRate(start, end);
    return [];
  },

  getSleep: async (startDate: string, endDate: string) => {
    const { start, end } = dateRange(startDate, endDate);
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') return getHealthConnectSleep(start, end);
    if (syncStatus.platform === 'apple_health') return getHealthKitSleep(start, end);
    return [];
  },

  getCalories: async (startDate: string, endDate: string) => {
    const { start, end } = dateRange(startDate, endDate);
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') return getHealthConnectCalories(start, end);
    if (syncStatus.platform === 'apple_health') return getHealthKitCalories(start, end);
    return [];
  },

  getExercises: async (startDate: string, endDate: string) => {
    const { start, end } = dateRange(startDate, endDate);
    const { syncStatus } = get();
    if (syncStatus.platform === 'health_connect') return getHealthConnectExercises(start, end);
    if (syncStatus.platform === 'apple_health') return getHealthKitExercises(start, end);
    return [];
  },

  getDaySummary: async (date: string) => {
    const { getSteps, getHeartRate, getSleep, getCalories, getExercises } = get();
    const [steps, heartRate, sleep, calories, exercises] = await Promise.all([
      getSteps(date, date),
      getHeartRate(date, date),
      getSleep(date, date),
      getCalories(date, date),
      getExercises(date, date),
    ]);

    const daySteps = steps.find((s) => s.date === date);
    const dayHR = heartRate.find((h) => h.date === date);
    const dayCals = calories.find((c) => c.date === date);
    const daySleep = sleep.find((s) => s.date === date);

    return {
      date,
      steps: daySteps?.count ?? 0,
      calories_active: dayCals?.active ?? 0,
      calories_total: dayCals?.total ?? 0,
      heart_rate_avg: dayHR?.avg_bpm ?? null,
      heart_rate_resting: dayHR?.resting_bpm ?? null,
      sleep_hours: daySleep?.duration_hours ?? null,
      exercises: exercises.filter((e) => e.date === date),
    };
  },
}));
