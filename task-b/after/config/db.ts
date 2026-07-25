// AFTER — secret pulled from env, never committed. In week-1 of the
// migration plan this also gets rotated, since the old hardcoded value
// must be assumed compromised (it lived in git history).
export const dbConfig = {
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
};
