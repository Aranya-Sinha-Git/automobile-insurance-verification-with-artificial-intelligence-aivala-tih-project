import { auth } from "./firebase";

/** Local data is partitioned by the Firebase account currently signed in. */
export function currentAccountId(): string {
  return auth.currentUser?.uid || "local-development";
}

export function accountStorageKey(name: string, accountId = currentAccountId()): string {
  return `${name}_${accountId}`;
}

export function readAccountJson<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(accountStorageKey(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeAccountJson(name: string, value: unknown): void {
  localStorage.setItem(accountStorageKey(name), JSON.stringify(value));
}

export function removeAccountData(name: string): void {
  localStorage.removeItem(accountStorageKey(name));
}
