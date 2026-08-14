import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Configuration ESLint.
 *
 * Next 16 a retire `next lint` : on passe par le CLI ESLint, et
 * `eslint-config-next` expose desormais directement des configurations plates.
 */
const config = [
  { ignores: [".next/**", "node_modules/**", ".uploads/**", "public/sw.js"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
       * Produit entierement francophone : le texte est plein d'apostrophes
       * (« d'argent », « l'eglise », « n'importe »). React les rend
       * correctement ; les echapper en &apos; rendrait les sources
       * illisibles sans rien apporter. Regle desactivee en connaissance de
       * cause, pas ignoree.
       */
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    /*
     * Pages et layouts de l'App Router : ce sont des composants serveur
     * asynchrones, executes une fois par requete, sans re-rendu. `Date.now()`
     * y est le comportement voulu — la regle de purete vise le rendu client,
     * ou une valeur instable poserait effectivement probleme. Elle reste donc
     * active partout ailleurs, notamment dans src/components.
     */
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
];

export default config;
