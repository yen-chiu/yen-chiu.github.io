---
title: Github进行fork后如何与原仓库同步
date: 2023-06-12 08:32:00 +0800
description: fork 了别人的仓库之后，怎么把上游的更新同步回来：配置 upstream 远端、fetch、merge，以及冲突与推送的注意事项。
categories: [Uncategories, Git]
tags: [Github]
image: /assets/img/posts/github-fork-sync/cover.png
---

fork 之后最容易忘的一件事：**fork 只是当时的一份快照**，上游后来的提交不会自动流过来。

同步的核心思路就一句话：把原仓库加成一个叫 `upstream` 的远端，然后像对待普通分支一样 fetch + merge。

## 一、只需要配置一次

```bash
# 看看现在的远端是谁
git remote -v
# origin  https://github.com/你的用户名/仓库.git (fetch/push)

# 把原仓库加进来
git remote add upstream https://github.com/原作者/仓库.git

# 确认两个远端都在
git remote -v
# origin    ...你的仓库...
# upstream  ...原仓库...
```

> 这一步是绝大多数教程漏掉的，却是后面所有命令的前提。
> 加错了用 `git remote set-url upstream <新地址>` 改，不想要了用 `git remote remove upstream`。

## 二、每次同步

```bash
git fetch upstream                 # 只下载，不改工作区
git checkout master                # 切到你要更新的分支
git merge upstream/master          # 合并（保留上游的提交历史）
git push origin master             # 推回你自己的 fork
```

如果你的默认分支叫 `main`，把上面的 `master` 换成 `main` 即可。

合并完可以顺手清理：

```bash
git remote prune origin            # 清掉远端已删除的分支引用
```

## 三、遇到冲突怎么办

`merge` 报 `CONFLICT` 时不要慌，冲突只意味着**同一处被两边都改了**：

```bash
git status                         # 找到 `both modified` 的文件
```

打开文件，会看到这样的标记：

```text
<<<<<<< HEAD
你本地的版本
=======
上游的版本
>>>>>>> upstream/master
```

改成你最终想要的样子（保留标记里的内容，删掉 `<<<<<<<`、`=======`、`>>>>>>>` 这三行），然后：

```bash
git add <冲突的文件>
git merge --continue
```

全部放弃这次合并就 `git merge --abort`，回到合并前。

## 四、几个容易踩的点

**1. 别在有未提交改动时 merge**

```bash
git stash        # 暂存
git merge upstream/master
git stash pop    # 取回
```

**2. 你的改动会被「覆盖」吗？**
不会。`merge` 是三方合并，只在你和上游改了同一行时才冲突，其余改动都会保留。

**3. fork 之后想开自己的分支开发**
建议从 `upstream/master` 切新分支，而不是直接在自己的 `master` 上改：

```bash
git fetch upstream
git checkout -b feature/xxx upstream/master
```

这样 `master` 始终能干净地跟随上游，你的改动都在独立分支里。

**4. 需要提 PR 时**
从你的 `origin` 分支提到上游，走 GitHub 的 Pull Request 流程即可，与同步互不影响。

---

**声明: 本文转载自 [rootjhon](https://github.com/Rootjhon/rootjhon.github.io)，已补充 `upstream` 配置与冲突处理部分**
