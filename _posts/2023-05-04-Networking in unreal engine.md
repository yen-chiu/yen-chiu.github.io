---
title: Networking in unreal engine
date: 2023-05-04 08:58:36 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
#  - https://docs.unrealengine.com/5.1/zh-CN/networking-and-multiplayer-in-unreal-engine/
#  - https://technology.riotgames.com/news/valorants-128-tick-servers
---



在虚幻引擎中，在客户端与服务器间同步数据和调用程序的过程被称为 **复制（Replication）** 。

复制系统同时提供了较高层次的抽象物以及低层次的自定义，以便在创建针对多个并发用户的项目时更加方便地处理可能遇到的情况。

### 远程过程调用(RPC)

| RPC类型          | 说明                                                         |
| :--------------- | :----------------------------------------------------------- |
| **Server**       | 仅在主持游戏的服务器上调用。                                 |
| **Client**       | 仅在拥有该函数所属Actor的客户端上调用。若Actor无拥有连接，将不会执行此逻辑。 |
| **NetMulticast** | 在与服务器连接的所有客户端及服务器本身上调用。               |

提供对应 `UFUNCTION` 宏中的 `Server`、`Client` 或 `NetMulticast` 说明符，可在将C++函数指定为RPC。其代码将在代码实现中使用后缀 `_Implementation`。

ExampleClass.h

```c++
//服务器RPC MyFunction的声明。
UFUNCTION(Server, Reliable, WithValidation)
void MyFunction(int myInt);
```

ExampleClass.cpp

```c++
//服务器RPC MyFunction的实现。
void AExampleClass::MyFunction_Implementation(int myInt)
{
    //游戏代码在此。
}
```

----

### FAQ

#### 蓝图中设置RepNotify的值时，OnRep_xxx会在客户端、服务端同步执行

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16837006393331683700638930.png)



----



### DS 服务器优化

- 压测数据监控，及时发现（CI）
- [Property Replication](https://docs.unrealengine.com/en-US/Gameplay/Networking/Actors/Properties/index.html) 的效率比 [RPC](https://docs.unrealengine.com/en-US/Gameplay/Networking/Actors/RPCs/index.html#:~:text=RPCs (Remote Procedure Calls) are,other over a network connection.)  慢的多， 100 ~ 1000 倍;但官方更推荐 RepNotify
- 自定义 Animation 的采样频率
  - 业务向的LOD降低，eg. 在某些情况下的Idle等
- 关注 Mem Missing - 非统一内存访问 [NUMA](https://whatis.techtarget.com/definition/NUMA-non-uniform-memory-access#:~:text=NUMA (non-uniform memory access) is a method of,symmetric multiprocessing ( SMP ) system.)
  - ![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306161704286.png)
- 关注程序调度系统





