# 来源与发布说明

本项目基于 [Songran241/dsh-req-workbench](https://github.com/Songran241/dsh-req-workbench)，上游基线提交为 `e2210ec15f85973564e0581bd536b212005e5a2e`，使用 MIT 许可。

原始版权：Copyright (c) 2026 liangsongran。完整原始许可保留在 LICENSE，不应删除。

本分支进行了非官方适配与重构：支持 DSH 0.2.1-rc.5；需求页与对话、轨迹等会话页同级；AI 主动维护需求；通俗的统一功能清单；会话隔离、版本冲突保护及来源折叠。

为让 DSH 将此版本作为原插件的替换更新，本分支保留原始包标识 `@dsh-community/dsh-req-workbench`。这不表示当前发布者拥有 dsh-community 的 npm scope，也不表示原作者审核或发布了本分支。请勿将本分支当成上游官方发行版。包设置 private=true 是为了防止误执行 npm publish，不影响 GitHub 发布和 DSH 安装。

发布 GitHub 仓库时可选择自己的仓库名称；保留本说明和 LICENSE。若以后希望把它作为可与原版并存的独立插件，须同时修改服务名、工具名、存储域、客户端模块 ID 等，不能只改 package.json 的 name。

本发布项目只提供程序源码、预构建代码、公开说明及许可；不包含原项目的 Git 历史、个人聊天、需求记录、账号凭据、GUI 截图或机器专用依赖链接。
