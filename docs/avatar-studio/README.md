# Avatar Studio · 头像发布工作台

这是与本地 Gallery Studio 不同的独立工具：Avatar Studio 设计为 Cloudflare Access 保护的 Worker 管理界面，代码保留在专用分支。

**完整操作与部署手册：[feature/avatar-studio / studio/README.md](https://github.com/yen-chiu/yen-chiu.github.io/blob/feature/avatar-studio/studio/README.md)。**

## 架构边界

经 Access 登录 → 本地 CSS 预览 → 人工确认 → Worker 验证 JWT、来源及 PNG → 暂存到 feature/avatar-studio → 专用 Actions 生成并验证 WebP / GIF → 原子提交 PNG、WebP、GIF 三个资源至 main → 部署。

支持方形 PNG 128–2048px、最大 4 MiB。预览并非实际编码输出。发布流程设计要求 Cloudflare Access、Worker 密钥及 GitHub 权限，不能据此判断真实域名已配置或实际可用。该分支不能删除或合并进公开 Astro 页面；它同时是自动发布目标分支。

维护时遵照专属 README 的授权、验证、故障处理及回滚流程；不将 Access 配置、账号邮箱或密钥写入版本库。代码变更与素材发布分开审查。主项目普通 Pages 构建只使用已经提交的头像资源，不重新生成。
