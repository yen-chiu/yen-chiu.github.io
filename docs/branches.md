# 分支清理与发布规范

## 2026-11-25 核查快照

核查基准 main: `4cf52f2a63f9e737a37900bc2d05cfe9be4c8ce3`。以下是创建本次文档分支前的 12 个远端分支。此表为维护决策记录，不是实时分支状态。

| 分支 | 核查时 HEAD | PR | 标记 |
| --- | --- | --- | --- |
| main | 4cf52f2 | — | KEEP · 正式站 |
| feature/avatar-studio | 1218bb4 | — | KEEP · 独立 Worker 与头像发布目标 |
| feat/gallery-studio-editorial | 355c1e8 | #45 | KEEP · 已关闭未合并，另有 README 提交 |
| feat/photo-gallery | 2c980f0 | [#33](https://github.com/yen-chiu/yen-chiu.github.io/pull/33) | DELETE-CANDIDATE · 先处理旧 CI 分支触发器 |
| fix/gallery-photo-detail-layout | 8dbce91 | [#43](https://github.com/yen-chiu/yen-chiu.github.io/pull/43) | DELETE-CANDIDATE |
| feat/home-nocturne-editorial | 17678a1 | [#37](https://github.com/yen-chiu/yen-chiu.github.io/pull/37) | DELETE-CANDIDATE |
| feat/music-cover-lyrics-mobile | ca6e761 | [#32](https://github.com/yen-chiu/yen-chiu.github.io/pull/32) | DELETE-CANDIDATE |
| feat/music-queue-controls | e683522 | [#31](https://github.com/yen-chiu/yen-chiu.github.io/pull/31) | DELETE-CANDIDATE |
| feat/music-shared-playback-core | 62055a7 | [#29](https://github.com/yen-chiu/yen-chiu.github.io/pull/29) | DELETE-CANDIDATE |
| feat/music-vol-01 | f5acd55 | [#30](https://github.com/yen-chiu/yen-chiu.github.io/pull/30) | DELETE-CANDIDATE |
| fix/music-tonearm-motion | 250c6c9 | [#39](https://github.com/yen-chiu/yen-chiu.github.io/pull/39) | DELETE-CANDIDATE |
| chore/professional-root-metadata | 8946d99 | [#35](https://github.com/yen-chiu/yen-chiu.github.io/pull/35) | DELETE-CANDIDATE |

九个候选分支的 HEAD 与各自已合并 PR 的最终 head SHA 相同，合并提交仍为当前 main 的祖先；没有发现合并后新提交。Squash merge 下原始提交可能不属于 main 的祖先，因此仅用 git branch --merged 不充分。此判断不涵盖未推送的本地改动、外部部署或他人工作区。

**特殊依赖：** main 的 gallery-check.yml 仍对 feat/photo-gallery 的 push 触发。删除该旧分支前应经单独审查移除旧触发器或调整为所需的维护目标；pull_request 路径触发仍可使用。本次文档整理不改变 CI 行为。

PR #44 已合并，其开发分支已不存在；PR #45 因原目标分支不再存在而不能沿用原发布路径（关闭原因未核实）。Studio 2.0 保留分支，后续从最新 main 建立新 PR 或安全重放其独有改动，先检查差异与冲突，不将其标为已上线。

本次新增 `docs/subproject-maintenance` 是在审查中的短期文档分支，合并且无新提交后才可列入候选。

## 清理前核对

1. 更新远端信息（git fetch origin --prune），核查当前 HEAD 是否仍与快照一致。
2. 确认对应 PR 已合并到 main、合并提交仍在 main 历史、无新提交或仍打开的依赖 PR；复核 CI、部署、脚本、Worker 及外部服务引用。
3. 核对本地各工作区和未推送提交。不得以远端核查代替本地检查。
4. 如需保存 squash 前的详细历史，先从原 HEAD 创建归档标签或备份，再删除分支。不要把 PR 页面视为永久备份。
5. 获得维护者明确批准后才删除指定远端分支。删除不等于回滚 main，不使用强制操作或批量通配符。删除后刷新分支列表和文档标记。

## 长期维护

- main：正式站，不直接覆盖历史；新改动通过 PR。
- feature/avatar-studio：Worker 的固定暂存目标、独立 Actions，长期保留。不能因旧 PR 状态而清理。
- Gallery Studio 2.0：当前为未合并的开发分支。正式验收后再决定是否保留独立工作台分支。
- 其他短期功能：从最新 main 开分支，提交 PR，检查 CI 与实际环境后 squash merge；不继续复用已 squash 的旧功能分支。

本轮只标记，不删除任何分支。
