import { fileStore } from "./file";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const hasDatabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const store: Store = hasDatabase ? supabaseStore : fileStore;

export * from "./types";
