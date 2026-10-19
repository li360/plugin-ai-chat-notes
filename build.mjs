import { build } from "esbuild"
import { copyFile, mkdir, readFile } from "node:fs/promises"

await mkdir("dist", { recursive: true })

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  jsx: "automatic",
  minify: false,
  sourcemap: false,
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "plugin-protocol",
    "kmgr-api",
    "workspace",
  ],
})

await copyFile("manifest.json", "dist/manifest.json")

const output = await readFile("dist/index.js", "utf8")
if (!/export\s+default\b|as\s+default\b/.test(output)) {
  throw new Error("dist/index.js 缺少 default export；loader 会报「插件未导出 default」")
}

console.log("✅ 打包完成：dist/index.js + dist/manifest.json")
