export const logger = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  hit: (msg) => console.log(`\x1b[32m[CACHE HIT]\x1b[0m ${msg}`),
  req: (msg) => console.log(`\x1b[33m[REQUEST]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  divider: () => console.log(`\n========================================\n`),
};