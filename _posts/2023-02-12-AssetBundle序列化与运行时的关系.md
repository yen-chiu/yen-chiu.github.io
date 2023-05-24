---
title: AssetBundle序列化与运行时的关系
date: 2023-02-12 18:32:00 +0800
categories: [Unity, AssetBundle]
tags: [AssetBundle, 内存优化]

# Ref
#  - https://blog.unity.com/technology/tales-from-the-optimization-trenches-saving-memory-with-addressables
#  - https://docs.unity3d.com/Packages/com.unity.addressables@1.17/manual/MemoryManagement.html#assetbundle-memory-overhead
#  - https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ManagingAssets.html#asset-and-assetbundle-dependencies
---

## 引用与内存关系

- 父级对象被加载时，硬引用依赖会一起加载到内存中，即时这些硬引用不需要；

- 单一个AB对象中的部分Assets不被使用时，目前仅有两种情况可以卸载：

  > Can partially load,Can't partially unload.

  - 当这个AB对象被完全卸载时；
  - 调用 `Resources.UnloadUnusedAssets()`  (*CPU耗时高*)

- 在AB中冗余的隐式依赖项资源，也将在内存中冗余

- AB的依赖关系是基于 Bundle之间的依赖关系

  - **所以可以自己建立加载框架，去管理依赖关系和加载行为是有必要的**

  > 如果一个资产引用另一个包中的对象，则整个包都依赖于该包。这意味着即使在第一个 bundle 中加载了一个资产，它没有自己的依赖项，这个AB所依赖的AssetBundle 仍然会加载到内存中。
  >
  > eg.  按以下的AB情景，加载 BundleA时，BundleB必然存在与内存中，**无论加载的是否是 RootAsset1**
  >
  > ```
  > // RootAsset2 引用 DependencyAsset3
  > BundleA = [RootAsset1,RootAsset2]
  > 
  > BundleB = [DependencyAsset3]
  > ```

## SerializedFile

每个加载的 AssetBundle 在内存中都有一个 `SerializedFile` ，此缓冲区在 AssetBundle 的生命周期内持续存在。

此内存是 AssetBundle 元数据，而不是 bundle 中的实际资产。 

此元数据包括： 

- **两个**文件读取缓冲区
- 一个类型树，列出包中包含的每个唯一类型
- 指向资产的目录

在这三项中，文件读取缓冲区占用的空间最多。

这些缓冲区在 `PS4`、`Switch` 和 `Windows RT` 上各为 **64 KB**，在所有其他平台上为 **7 KB**。

> 在以下的示例中，缓冲区大小为
>
> ````
> 1,819 个AB * 64 KB * 2 个缓冲区 = 227 MB
> ````
>
> ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16759299076001675929906604.png) 



由于缓冲区的数量与 AssetBundle 的数量呈线性关系，减少内存的简单解决方案是在运行时加载更少的包。

**需要根据游戏品类平衡分包的粒度方案。**

## TypeTree 

TypeTree 描述了一种数据类型的字段布局。

- AssetBundle 中的每个序列化文件都包含文件中每个对象类型的类型树，除非在构建时剥离。

- TypeTree 信息的目的是用于加载反序列化与序列化方式略有不同的对象。

- AssetBundle 之间不共享 TypeTree 信息；每个 bundle 都有一套完整的 TypeTrees 用于描述它包含的对象。

加载 AssetBundle 时会加载所有 TypeTrees，并在 AssetBundle 的生命周期内将其保存在内存中。

与 TypeTrees 相关的内存开销与序列化文件中**唯一类型的数量以及这些类型的复杂性成正比**。

### 如何减少AssetBundle TypeTrees 的内存占用

- 将相同类型的资产放在同一个包中。

- 关闭 TypeTrees —— 关闭 TypeTrees 通过从 bundle 中排除此信息来使的 AssetBundle 更小。

  > 但是，如果没有 TypeTree 信息，可能会在使用较新版本的 Unity 加载较旧的捆绑包时或在项目中进行很小的脚本更改后遇到序列化错误或未定义的行为。

- 首选更简单的数据类型以降低 TypeTree 的复杂性。

## Table of contents

> 简单来说，处理好分包的粒度从而去规划运行时的峰值、AB在内存中的数量。

- The table of contents is a map within the bundle that allows you to look up each explicitly included asset by name. 
- It scales linearly with **the number of assets** and **the length of the string names** by which they are mapped.
- The size of your table of contents data is based on the total number of assets.
- You can minimize the amount of memory dedicated to holding table of content data by minimizing the number of AssetBundles loaded at a given time.

## Preload table

Preload table 是资产引用的所有**其他对象**的列表。当从 AssetBundle 加载资源时，Unity 使用Preload table来加载这些引用的对象。

> 例如，预制件为其每个组件以及它可能引用的任何其他资产（材质、纹理等）都有一个预加载条目。每个预加载条目都是 64 位的，可以引用其他 AssetBundle 中的对象。

当一个资产引用另一个资产，而另一个资产又引用其他资产时，预加载表可能会变大，因为它包含加载这两个资产所需的条目。

如果两个资产都引用了第三个资产，那么两者的预加载表都包含加载第三个资产的条目（无论引用的资产是否在同一个 AssetBundle 中）。

> 例如，考虑这样一种情况，在 AssetBundle 中有两个资产（PrefabA 和 PrefabB），并且这两个预制件都引用了第三个预制件 (PrefabC)，该预制件很**大并且包含多个组件和对其他资产的引用**。
>
> - 这个 AssetBundle 包含两个预加载表，一个用于 PrefabA，一个用于 PrefabB。
> - 这些表包含其各自预制件的所有对象的条目，但也包含 PrefabC 中的所有对象和 PrefabC 引用的任何对象的条目。
> - 因此，加载 PrefabC 所需的信息最终会在 PrefabA 和 PrefabB 中重复。
>
> **无论 PrefabC 是否显式添加到 AssetBundle 中**，都会发生这种情况。
>
> ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16762563059011676256305787.png) 

### 如何应对

If you determine that the memory overhead from the preload table is a problem, you can structure your loadable assets so that they have fewer complex loading dependencies.

#### 资源制作约束

- 避免制作过于复杂的静态预制
- 预制尽量小
- 所依赖的组件尽可能少
- 简化资源的依赖关系

## SpriteAtlas 

这个资源引擎在处理的时候每个大版本都有所不同，需要自行做实验分析

- [SpritePackerModes](https://docs.unity3d.com/Manual/SpritePackerModes.html) 