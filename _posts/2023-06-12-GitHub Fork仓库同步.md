---
title: Github进行fork后如何与原仓库同步
date: 2023-06-12 08:32:00 +0800
categories: [Uncategories, Git]
tags: [Github]
---

- 检查本地仓库状态

```bash
git status
```

- 拉取远端源仓库更新

```bash
git fetch upstream
```

- 切换到 master 分支

```bash
git checkout master
```

- 合并远程的 master 分支

```bash
git merge upstream/master
```

- 推送修改至 Fork 仓库

```bash
git push
```

---

**声明: 本文转载自[rootjhon](https://github.com/Rootjhon/rootjhon.github.io)**
