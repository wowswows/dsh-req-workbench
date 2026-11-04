# 开发说明（只安装和发布时不用看）

这个仓库提交了 lib 预构建代码。GitHub 用户安装时不需要在自己的机器上编译，也不会运行 prepare 或 prepack。

若要修改源码，需要安装 pnpm 和 Node 24，以及目标 DSH 0.2.1-rc.5。某些 DSH 前端 peer 由宿主虚拟提供，不适合让 pnpm 从注册表自动安装。

1. `pnpm install --ignore-scripts --config.auto-install-peers=false` 安装编译工具。
2. 找到本机 DSH 的当前运行时目录，里面应包含 `node_modules/@deepseek-ai/dsh/package.json`。这不是 DSH_HOME 数据目录，也不是项目工作区。
3. `node scripts/link-runtime.mjs "你的DSH运行时目录"` 将开发 API 指向该安装，仅用于开发。
4. `node scripts/build.mjs` 严格类型检查并重新生成 lib。
5. `node scripts/test.mjs` 运行隔离内存测试，不读取真实聊天或需求存储。
6. 修改 package.json 版本，同时更新 README 和发布指南中的版本/包名示例；源码和新 lib 一起提交。
7. `node scripts/check-release.mjs` 检查发布配置和许可；然后 `pnpm --config.auto-install-peers=false pack` 生成 tgz。

不要提交 node_modules，也不要从自己的 DSH_HOME 复制 sessions、storages、账号文件或需求记录。不要把只在自己机器验证的结果当作所有 DSH 版本兼容。GitHub CI 只检查已构建发行内容并打包，不伪称已运行实际 DSH GUI。

GitHub Actions 的产物需要解压后取出 tgz；这个 CI 不会自动创建公开 Release，不会自动发布 npm。包的 private=true 只防止误执行 npm publish。
