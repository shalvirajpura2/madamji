// every cap in one place. each can be changed with an env var on vercel without touching code.

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

/** free trial per google account: one 25-minute class and two 15-minute classes */
export const TRIAL = {
  long: num("TRIAL_LONG_CLASSES", 1),
  short: num("TRIAL_SHORT_CLASSES", 2),
};

/**
 * Free classes one network can start in a day, across all accounts, so nobody farms trials with
 * new google accounts. Kept loose because indian mobile networks share one ip between many people.
 */
export const CLASSES_PER_IP_PER_DAY = num("CLASSES_PER_IP_PER_DAY", 10);

/** rate limits: [max requests, window in seconds] */
export const LIMITS = {
  // starting a class spends voice and model credits
  classIp: [num("CLASS_STARTS_PER_IP_PER_HOUR", 10), 3600],
  classUser: [num("CLASS_STARTS_PER_USER_PER_HOUR", 8), 3600],
  profileIp: [20, 3600],
  readIp: [120, 60],
  signInIp: [20, 600],
  // staff pages poll every few seconds, so the request limit is loose; wrong passcodes lock out fast
  staffIp: [90, 60],
  staffFailIp: [10, 900],
} as const satisfies Record<string, readonly [number, number]>;
