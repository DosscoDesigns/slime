import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Photography here is intentionally plain <img> + srcSet rather than
      // next/image: the images are pre-optimized WebP with EXIF stripped
      // (TEMP/optimize-photos.py), and next/image would route them through
      // Vercel's image transformation, which is billed per source image.
      // The rule has nothing left to tell us, and leaving it as a standing
      // warning is what let a real one hide in the noise — see the
      // --max-warnings 0 note in package.json.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
