# DSH 功能需求清单

聊项目时，AI 主动把你想做的功能整理成一份简单清单；后续讨论会更新已有条目，而不是堆成聊天记录。清单在会话上方的「需求」页，与「对话 / 轨迹 / 上下文 / 编队」同级。

> 这是基于 Songran241/dsh-req-workbench 的非官方重构版，不是原作者的官方更新。见 NOTICE.md 和 LICENSE。

## 能做什么

- 自动整理用户明确提出、以及 AI 能准确理解的功能需求。
- 同一功能反复讨论时合并更新，写成小白也能看懂的短标题和说明。
- 没有把握的想法单独待确认，不擅自当成用户要求。
- 原话、子任务等细节默认收起；需求可手工编辑，并有并发修改保护。
- 按会话隔离；安装程序不会带入别人的聊天或需求数据，也不自动跨机器同步。
- 使用正在与你对话的 AI 调用维护工具，不额外启动一个模型。模型仍需实际调用工具才能写入，不能保证任何模型每次都正确提炼。

## 安装前看一眼

**本版仅验证 DSH 0.2.1-rc.5 的 Web 界面。** 先运行 `dsh --version`，版本不同请先确认兼容性，不要强行豁免。仅安装无需下载源码、Node 开发依赖或编译；插件代码已放在 lib 目录中。

如果原插件已安装，同名包会替换原版，不能将两个版本同时启用。安装影响目标 profile 中的所有会话，不只影响正在聊天的一个窗口。

## 方式一：把安装包发给另一台电脑（最简单）

1. 复制 `dsh-community-dsh-req-workbench-0.2.1-dsh021.1.tgz` 到另一台电脑，并放在以后不会误删的位置。
2. 打开 PowerShell/终端，执行（路径改成实际存放的位置）：

```powershell
dsh plugin --profile web add 'C:\DSH-plugins\dsh-community-dsh-req-workbench-0.2.1-dsh021.1.tgz'
```

3. 如果应用提示需要重启，就重启对应的 DSH 服务/应用；随后刷新页面，打开项目会话，点击上方「需求」。

`web` 必须是那套 DSH 实际使用的 profile。如果它用的是别的配置名，请替换该参数。**不要解压 tgz，也不要直接导入源码 ZIP 当插件安装。** 请保留本地 tgz，重装依赖可能仍会引用它。

## 方式二：从自己的 GitHub 安装

仓库地址：https://github.com/wowswows/dsh-req-workbench

推荐直接安装已发布版本，无需编译：

```powershell
dsh plugin --profile web add github:wowswows/dsh-req-workbench#v0.2.1-dsh021.1
```

也可将安装包上传到 GitHub Releases，再复制该附件的真实下载链接安装：

```powershell
dsh plugin --profile web add 'https://github.com/wowswows/dsh-req-workbench/releases/download/v0.2.1-dsh021.1/dsh-community-dsh-req-workbench-0.2.1-dsh021.1.tgz'
```

上面是本仓库的 Release 安装地址。本项目没有 prepare/prepack 安装脚本，GitHub 安装使用已提交的 lib，不要求用户在另一台机器重新构建。

## 卸载

```powershell
dsh plugin --profile web remove '@dsh-community/dsh-req-workbench'
```

按提示刷新或重启目标 DSH。卸载不等于删除已保存的数据；不要随意清理 DSH 数据目录。

## 想发布到 GitHub？

先看同目录的 **发布和安装指南.md**，里面有网页与 GitHub Desktop 两种操作方式。普通发布者不必重新编译，也不需要注册 npm 账号。

开发者请看 DEVELOPMENT.md。发布前可运行 `node scripts/check-release.mjs`，该检查只使用 Node 内置功能，不读取你的 DSH 账号或聊天内容。

## License

MIT。保留原作者 Copyright (c) 2026 liangsongran。浏览器中包含的 Zod 许可见 THIRD_PARTY_NOTICES.md。
