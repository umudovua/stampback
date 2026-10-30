import { runScenario, type Fixture } from './scenario';

/** Brauzer girişi: Playwright bu funksiyanı səhifədə çağırır. */
declare global {
  interface Window {
    runDeterminism: (fixtures: Fixture[]) => Promise<Awaited<ReturnType<typeof runScenario>>[]>;
  }
}

window.runDeterminism = async (fixtures) => {
  const results = [];
  for (const fixture of fixtures) results.push(await runScenario(fixture));
  return results;
};
