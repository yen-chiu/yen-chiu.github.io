# Vesper · 子项目维护手册

面向仓库维护者的入口。网站访客功能和独立管理工具分开维护；功能合并后以 main 上的实现为准，独立分支的功能不视为已上线。

| 子项目 | 说明与架构 | 维护位置 |
| --- | --- | --- |
| 光影档案 / Gallery | [摄影集与 R2](gallery.md) | main |
| Gallery Studio | [本地摄影发布工作台](gallery-studio/README.md) | main（与 2.0 代码同步合并） |
| Night Radio / 夜间留声 | [音乐目录、播放与授权](music/README.md) | main |
| Nocturne Editorial | [首页、壁纸与动效](home/README.md) | main |
| 友情链接 | [申请、健康检查、RSS](links-maintenance.md) | main |
| Avatar Studio | [独立头像发布工具](avatar-studio/README.md) | feature/avatar-studio |
| 仓库维护 | [分支清理与发布规范](branches.md) | main |

## 通用工作流

使用 Node.js 24，先 `npm ci`，然后 `npm run dev -- --host 127.0.0.1`。修改后执行 `npm test` 与 `npm run build`；涉及交互时运行对应浏览器回归流程并检查真实设备。新功能从最新 main 创建短期分支，提交 PR，人工验收后合并。GitHub Pages 只在 main 的 push 或手动触发时部署，PR 构建不等于已上线。

每个手册维护用途、入口、主要文件、操作步骤、安全边界、测试和故障排查。更新实现时同步更新手册；临时分支不复制整套文档。保留现有主项目双语 README，详细手册以中文为主。文档不含个人凭据及私有原图。
