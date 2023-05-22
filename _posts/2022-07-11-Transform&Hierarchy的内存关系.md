---
title: Transform & Hierarchy 的内存关系
date: 2022-07-11 12:26:08 +0800
categories: [Unity, 性能优化]
tags: [优化]

# Ref
#  - https://www.youtube.com/watch?v=W45-fsnPhJY&t=794s
---

# Transform

### 内存布局的演变

#### Unity 5.3 Transform 在内存中并不是连续的内存

- 不具备 缓存命中的内存友好模型

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16551751980581655175197615.png) 

#### Unity5.4 Transform的内存结构修改为连续的内存块

- 为场景的 每个根Transform 创建一个 TransformHierarchy structure；

- 需要留意的是，因为 内存模型修改为 连续buffer块的模式，因此会发生常见的 **扩容&拷贝** 的性能敏感行为；

  > 在创建大量子物体前，可以使用 **Transform.hierarchyCapacity** 初始化 Buffer Size；

- 对ECS模式更友好

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16551753660641655175365185.png) 

### TransformHierarchy structure的一些细节

- 每个 *root Transform* 都对应一个 *TransformHierarchy*

- 包含 *hierarchy* 中所有 *transforms* 的相关数据

  - TRS，indices for parents & siblings

  - Interest bitmask & dirty bitmask

    > 当一个渲染组件被添加到 transform时，会在 `Interest bitmask`  中标记  Render位；

- 内部系统通过 Interest bitmask 跟踪状态

  - Physics is one bit,renderer is another bit,etc.

- 内部会根据 TransformHierarachy structure 来处理 dirty 逻辑；

  - `dirtyMask |= -1 & interestMask`

    > 当我们移动 transform 时， 会根据 `interestMask` 来设置 `dirtyMask`

- 任意一个*Transform*的修改会导致整个*Hierarchy*处于*dirty*状态

- 为了更新 *bitmask* 必须对全部的*Hierarchy*进行遍历

### Hierarchy 管理的最佳实践

- 平铺结构 优于 树状结构
  - Hierarchy 层次尽可能小的，使得dirty检查遍历更少的对象
  - 能够更多可追踪的单位
- 避免过少的根节点
  - Transform的变化检查是采用 Job Wokrer来加速的

#### 数据案例

| 树状结构 | 平铺 |
| -------- | ---- |
| 100 个根 |      |
|          |      |
|          |      |



![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16551772010371655177200688.png) 



![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16552842862941655284285624.png) 



![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16552843012901655284300561.png)







**避免使用过多层级**

拆分层级！在层级视图中如果游戏对象不需要嵌套，请简化父子化。较少的层级关系将受益于多线程刷新场景中的变换 (Transform)。复杂层级关系会发生不必要的变换 (Transform) 计算以及更多垃圾收集开销。



**变换一次，而非两次**

另外，移动变换 (Transform) 时，使用 Transform.SetPositionAndRotation 可以一次就同时更新位置和旋转。这样可以避免两次修改变换（Transform）的开销。



Transform.SetPositionAndRotation：

*https://docs.unity3d.com/ScriptReference/Transform.SetPositionAndRotation.html*



如果需要在运行时初始化游戏对象，一项简单的优化是在初始化过程中父子化和重新定位：

初始化游戏对象：

https://docs.unity3d.com/ScriptReference/Object.Instantiate.html

```c#
GameObject.Instantiate(prefab, parent);
GameObject.Instantiate(prefab, parent, position, rotation);
```

有关 Object.Instantiate 的更多详细信息，请参阅脚本 API。

脚本 API：

*https://docs.unity3d.com/ScriptReference/Object.Instantiate.html*





每当一个GameObject移动、旋转、缩放时，Unity都必须通知每个与其相关的游戏系统。渲染、物理、以及该GameObject的每个父子物体，都需要被通知到，以匹配它做出的动作。随着游戏内容增加，GameObject的数量也会暴涨，仅是发送这些消息的开销就会成为很大的性能问题。



### 层级结构指南

如果有东西每一帧都会移动，确保它所有的子物体都确实需要了解位置信息。只有渲染、物理、音频或者类似的核心系统才应该出现。

在运行时动态创建的游戏对象，如果它们没有必要作为出生点对象的子物体，那就放在场景的根节点下。

开发者可以很方便的注册自己生成的所有内容，并通过OnEnable和OnDisable来向它们传递出生点对象的ActiveInHeirarchy状态。

尝试将需要移动的物体进行分组，大约每个根节点50个左右的GameObject。这样，底层系统就可以将TransformChangeDispatch任务按照每线程最优数量进行分组。可避免出现线程过于繁忙或过于空闲的情况。



> Optimize Game Objects



Physics.Raycast 的调用需要在 Tran



----

{% include embed/youtube.html id='W45-fsnPhJY' %}
