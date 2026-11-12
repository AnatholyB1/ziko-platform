export class MMKV {
  private m = new Map<string, string>();
  getString(k: string) { return this.m.get(k); }
  set(k: string, v: string) { this.m.set(k, v); }
  delete(k: string) { this.m.delete(k); }
}
export const createMMKV = () => new MMKV();
