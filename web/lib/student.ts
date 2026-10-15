"use client";

import { useSyncExternalStore } from "react";

export type Student = { id: string; name: string; grade: number };

const KEY = "ustaad.student";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Student | null } = { raw: null, value: null };

function read(): Student | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw !== cached.raw) {
    let value: Student | null = null;
    try {
      value = raw ? (JSON.parse(raw) as Student) : null;
    } catch {
      value = null;
    }
    cached = { raw, value };
  }
  return cached.value;
}

export function saveStudent(student: Student) {
  try {
    localStorage.setItem(KEY, JSON.stringify(student));
  } catch {
    // private mode: the class still works for this visit
    cached = { raw: JSON.stringify(student), value: student };
  }
  listeners.forEach((l) => l());
}

export function clearStudent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  cached = { raw: null, value: null };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// undefined while the page hydrates, null when nobody has signed in on this device
export function useStudent(): Student | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function newStudentId() {
  return crypto.randomUUID();
}
