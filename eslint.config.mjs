import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * `pnpm lint` had been a script with no configuration behind it: ESLint
 * printed "couldn't find a config file" and the shell saw exit 0 through a
 * pipe. A check that reports success while doing nothing is the exact failure
 * mode this application exists to demonstrate, so it should not have been
 * living in its own package.json.
 *
 * eslint-config-next 16 exports flat config directly — no FlatCompat, which
 * cannot serialise its plugin graph.
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      ".localdb/**",
      "node_modules/**",
    ],
  },
];

export default config;
