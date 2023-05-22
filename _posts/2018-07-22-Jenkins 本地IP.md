---
title:  Jenkins IP访问
date: 2018-07-22 22:12:37 +0800
categories: [自动化,Jenkins]
tags: []
---

# 安装Jenkins后，局域网内无法通过IP+端口访问

## 安装&应用

```bash
brew install jenkins-lts
```

```bash
#启动
brew services start jenkins-lts
#停止
brew services stop jenkins-lts
#重启
brew services restart jenkins-lts
```

## 无法使用IP:8080访问

但是安装完后，使用http://localhost:8080 可以正常访问，但是使用本机IP:8080访问时，就无法访问

发现是会将httpListenAddress默认设置为127.0.0.1，这样会导致只能使用localhost:8080访问，无法IP:8080访问。


将`homebrew.mxcl.jenkins.plist`中的`httpListenAddress`修改为`0.0.0.0`就可以支持任意IP访问了

Eg.

- `/opt/homebrew/Cellar/jenkins/2.399/homebrew.mxcl.jenkins.plist`

