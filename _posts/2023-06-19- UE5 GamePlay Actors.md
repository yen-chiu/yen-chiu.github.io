---
title: UE5 GamePlay Actors
date: 2023-06-19 08:32:00 +0800
categories: [Unreal,Beginner]
# Ref
# - https://docs.unrealengine.com/5.2/zh-CN/actors-in-unreal-engine/
# - https://docs.unrealengine.com/5.2/zh-CN/actor-ticking-in-unreal-engine/
---



Actor不直接保存 Transform信息（位置、旋转和缩放）数据；如Actor的`RootComponent`存在，则使用它的变换数据

## 生命周期

- Spawn 和 IO Load 的生命流程在 BeginPlay之前有所不同 
- 将任意属性设为"Expose on Spawn"即可延迟 Actor 的生成

![ActorLifeCycle1.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306191054587.jpeg)

### PIE的流程中 Actor 是如何被Duplicated的？

#### 非PIE的时候这个机制可用吗？



#### 调用 EndPlay 的全部情形：

- 对 Destroy 显式调用。
- Play in Editor 终结。
- 关卡过渡（无缝行程或加载地图）。 包含 Actor 的流关卡被卸载。
- Actor 的生命期已过。
- 应用程序关闭（全部 Actor 被销毁）。

无论这些情形出现的方式如何，Actor 都将被标记为 `RF_PendingKill`，因此在下个垃圾回收周期中它将被解除分配。此外，可以考虑使用更整洁的 `FWeakObjectPtr<AActor>` 代替手动检查"等待销毁"。

### GC

一个对象被标记待销毁的一段时间后，垃圾回收会将其从内存中实际移除，释放其使用的资源。

在对象的销毁过程中，以下函数将被调用：

1. **BeginDestroy** - 对象可利用此机会释放内存并处理其他多线程资源（即为图像线程代理对象）。与销毁相关的大多数游戏性功能理应在 `EndPlay` 中更早地被处理。
2. **IsReadyForFinishDestroy** - 垃圾回收过程将调用此函数，以确定对象是否可被永久解除分配。返回 `false`，此函数即可延迟对象的实际销毁，直到下一个垃圾回收过程。
3. **FinishDestroy** - 最后对象将被销毁，这是释放内部数据结构的另一个机会。这是内存释放前的最后一次调用。

## Ticking

### Tick 组排序

| **Tick 组**           | **引擎活动**                                                 |
| :-------------------- | :----------------------------------------------------------- |
| **TG_PrePhysics**     | 帧的开始。<br>此 tick 中的物理模拟数据属于上一帧 — 也就是上一帧渲染到屏幕上的数据 |
| **TG_DuringPhysics**  | 到达此步骤时，物理模拟已开始。Tick 此组时的任意时候，或所有组成员已 tick 后，模拟完成并更新引擎的物理数据。<br>因为物理模拟数据可能来自当前帧或上一帧，此 tick 组只**推荐用于无视物理数据或允许一帧偏差的逻辑**。 |
| **TG_PostPhysics**    | 此步骤开始时物理模拟已完成，引擎正在使用当前帧的数据。       |
| n/a                   | 处理隐藏操作、tick 世界时间管理器、更新摄像机、更新关卡流送体积域和流送操作。 |
| **TG_PostUpdateWork** | n/a                                                          |
| n/a                   | 处理之前在帧中创建的 actor 的延迟生成。完成帧并渲染。        |

### Tick 依赖性

存在于 actor 和组件上的 `AddTickPrerequisiteActor` 和 `AddTickPrerequisiteComponent` 函数将设置存在函数调用的 actor 或组件等待 tick，直到特定的其他 actor 或组件完成 tick。

这尤其适用于这样的情况：

- 在帧中几乎相同时间发生，但一个 actor/组件将设置另一个 actor/组件所需的数据。
- 在 tick 组上使用它的原因是：
  - 如存在于相同组中，许多 actor 可被并行更新。如 actors 只是个体依赖于一个或两个其他 actors，而无需等待整个组完成后再进行 tick，则没有必要将一组 actors 移动到一个全新的组。

### Actor Tick 设置

在 `BeginPlay` 中，actor 将向引擎注册其主 tick 函数和其组件的 tick 函数。Actor 的 tick 函数可通过 `PrimaryActorTick` 成员设为在特定 tick 组中运行，或完全禁用。

这通常在构造函数中完成，以确保 `BeginPlay` 调用前数据设置正确。一些常用代码如下：

```c++
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bTickEvenWhenPaused = true;
    PrimaryActorTick.TickGroup = TG_PrePhysics;
```

### 其他

- 启用\禁用： `AActor::SetActorTickEnabled` 、`UActorComponent::SetComponentTickEnabled`
- 此外，一个 actor 或组件可以有多个 tick 函数。这是通过创建一个继承`FTickFunction`并覆盖`ExecuteTick`和`DiagnosticMessage`函数的结构来实现的。
- 要启用和注册 tick 函数，最常见的方法是覆盖`AActor::RegisterActorTickFunctions`并添加对 tick 函数结构的调用`SetTickFunctionEnable`，然后将`RegisterTickFunction`拥有 actor 的级别作为参数。