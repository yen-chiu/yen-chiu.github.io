---
title: Github进行fork后如何与原仓库同步
date: 2023-06-12 08:32:00 +0800
categories: [Uncategories, Git]
# Ref
# - https://zhuanlan.zhihu.com/p/89607964
---



- `git status` 检查本地仓库状态
- `git fetch upstream` 拉取远端源仓库更新
- `git checkout master` 切换到 master 分支
- `git merge upstream/master` 合并远程的master分支
- `git push` 推送修改至 Fork仓库

