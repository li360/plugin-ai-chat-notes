# Plugin SDK

本目录由 scripts/export-plugin-sdk.ps1 生成。

- kmgr-api-*.tgz
- plugin-protocol-*.tgz

第三方插件在 package.json 中使用：

`json
"kmgr-api": "file:./plugin-sdk/kmgr-api-0.1.0.tgz",
"plugin-protocol": "file:./plugin-sdk/plugin-protocol-0.1.0.tgz"
`

eact / eact-dom / eact/jsx-runtime / plugin-protocol / kmgr-api / workspace
必须保持 esbuild external，由宿主运行时提供。
