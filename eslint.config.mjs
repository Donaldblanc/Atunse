// ESLint flat config (Next 16's eslint-config-next is flat-config only).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  { ignores: ["demo_mock/**", ".next/**", "node_modules/**", "next-env.d.ts", ".claude/**"] },
];

export default eslintConfig;
