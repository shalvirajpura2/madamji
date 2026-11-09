import { after } from "next/server";
import { store, type NewActivity } from "./store";

/** Writes to the staff activity log after the response is sent, so logging never slows or breaks a request. */
export function log(entry: NewActivity) {
  const write = () =>
    store.logActivity(entry).catch((e) => console.error(`could not log ${entry.kind}`, e));
  try {
    after(write);
  } catch {
    // outside a request (scripts, tests)
    void write();
  }
}
