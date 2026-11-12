// Recorded navigation calls so tests can assert on them.
export const routerCalls: { method: string; args: unknown[] }[] = [];
const rec = (method: string) => (...args: unknown[]) => {
  routerCalls.push({ method, args });
};
export const router = {
  push: rec('push'),
  replace: rec('replace'),
  back: rec('back'),
  canGoBack: () => true,
  navigate: rec('navigate'),
};
export const useRouter = () => router;
export const useSegments = () => ['(app)', '(plugins)', 'habits', 'dashboard'];
export const Stack: any = () => null;
export const useFocusEffect = (_cb: unknown) => undefined;
export const useLocalSearchParams = () => ({});
