import type { Song } from "../../shared/types";
import { songToJson } from "./exchange";

/**
 * One-click library sync to a real folder via the File System Access API.
 * No server: Chrome hands the app a directory handle the user picked, the
 * handle persists in IndexedDB, and each save rewrites <id>.json files.
 */

interface WritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
  getFile?(): Promise<{ text(): Promise<string> }>;
}

export interface DirHandleLike {
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandleLike>;
  queryPermission?(desc: { mode: string }): Promise<string>;
  requestPermission?(desc: { mode: string }): Promise<string>;
}

declare global {
  interface Window {
    showDirectoryPicker?(opts?: { id?: string; mode?: string }): Promise<DirHandleLike>;
  }
}

export function diskSyncSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

const DB_NAME = "chordsheet-fs";
const STORE = "handles";
const KEY = "songsDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSavedDir(): Promise<DirHandleLike | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as DirHandleLike) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveDir(handle: DirHandleLike): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // Session-only handle; the picker will simply reopen next time.
  }
}

/** Opens the picker; returns null when unsupported. Rethrows user cancel. */
export async function pickDir(): Promise<DirHandleLike | null> {
  if (!diskSyncSupported()) return null;
  const handle = await window.showDirectoryPicker!({ id: "chordsheet-songs", mode: "readwrite" });
  await saveDir(handle);
  return handle;
}

export async function ensurePermission(handle: DirHandleLike): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const state = await handle.queryPermission({ mode: "readwrite" });
  if (state === "granted") return true;
  if (state === "prompt" && handle.requestPermission) {
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
  }
  return false;
}

export interface SyncResult {
  written: number;
  /** Files whose on-disk content already matched; left untouched. */
  skipped: number;
}

/**
 * Write each song as <id>.json. Disk is checked first: a file whose content
 * already matches is skipped, never rewritten, so repeated saves are
 * idempotent and no duplicate or churned files appear.
 */
export async function syncSongs(songs: Song[], dir: DirHandleLike): Promise<SyncResult> {
  let written = 0;
  let skipped = 0;
  for (const song of songs) {
    const json = songToJson(song);
    const name = `${song.id}.json`;

    let existing: FileHandleLike | null = null;
    try {
      existing = await dir.getFileHandle(name);
    } catch {
      existing = null;
    }
    if (existing?.getFile) {
      try {
        const current = await (await existing.getFile()).text();
        if (current === json) {
          skipped += 1;
          continue;
        }
      } catch {
        // Unreadable; fall through and rewrite.
      }
    }

    const file = existing ?? (await dir.getFileHandle(name, { create: true }));
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();
    written += 1;
  }
  return { written, skipped };
}
