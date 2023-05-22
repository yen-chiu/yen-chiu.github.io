---
title: Networking in unreal engine
date: 2023-05-04 08:58:36 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# https://docs.unrealengine.com/5.1/zh-CN/networking-and-multiplayer-in-unreal-engine/
---



在虚幻引擎中，在客户端与服务器间同步数据和调用程序的过程被称为 **复制（Replication）** 。

复制系统同时提供了较高层次的抽象物以及低层次的自定义，以便在创建针对多个并发用户的项目时更加方便地处理可能遇到的情况。





----

### FAQ

#### 蓝图中设置RepNotify的值时，OnRep_xxx会在客户端、服务端同步执行

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16837006393331683700638930.png)



