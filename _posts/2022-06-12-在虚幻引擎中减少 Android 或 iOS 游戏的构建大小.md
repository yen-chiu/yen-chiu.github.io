---
title: 在虚幻引擎中减少 Android 或 iOS 游戏的构建大小
date:  2022-06-12 14:13:23 +0800
categories: [Unreal, 包体分发]
tags: [AppSize]
# Ref
# - https://georgy.dev/posts/reducing-mobile-build-size/
---

# 项目设置

- 设置`Build Configuration`并`Shipping`启用`For distribution`：

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16769655811351676965580368.png)

- 排除一些未使用的编辑器资产并像这样压缩所需的资产：

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16769655961451676965595217.png)

- 启用共享材质着色器代码和使用共享材质本机库，这将稍微减小大小，但是会导致运行时加载的效率

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16769656061361676965605832.png)

- 如果不使用移动点光源，请将“Max Movable Point Lights”设置为 0。这将略微减小着色器的大小，从而减小构建大小：

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16769656171361676965616456.png)

# Disabling plugins

您的项目可能包含默认启用的未使用插件：

- Android media player
- Android movie player
- Apple movie player
- CharacterAI
- OculusVR
- Windows Movie player
- WMF media player
- SteamVR
- Kdevelop Integration
- Cable component
- AVF media player
- Audio capture
- Archvis character

# Excluding packaged assets

您还可以删除游戏中打包但从未使用过的未使用资产。以下示例与 Win64 平台相关。

首先，您需要确定需要排除哪些特定资产。为此，您需要打开`main.obb.png`游戏 pak 文件内“assets”文件夹中的存档文件。

要解压`.pak`文件并获取`main.obb.png`{: .filepath}文件，请在文件夹中打开控制台`Engine/Binaries/Win64`{: .filepath}并编写以下命令：

```bash
UnrealPak.exe [PathToPakFile].pak -extract [PathToExtractPakFile]
```

之后，您可以遍历提取的文件夹/文件并选择您的游戏中未使用的内容。

一旦确定了游戏中不需要哪些资源，在 `[PROJECT_NAME]/Build/Android`  打开（或创建）`PakBlacklist-Shipping.txt`{: .filepath}，并指定构建项目时需要排除的文件夹和文件。

例如:

```
../../../Engine/Plugins/Blendables/
../../../Engine/Plugins/Editor/
../../../Engine/Plugins/Enterprise/
../../../[PROJECT_NAME]/AssetRegistry.bin
../../../Engine/Content/ArtTools/
../../../Engine/Content/EngineFonts/Faces/
../../../Engine/Content/Internationalization/icudt64l/coll/
../../../Engine/Content/Internationalization/icudt64l/translit/
../../../Engine/Content/Internationalization/icudt64l/lang/
../../../Engine/Content/Internationalization/icudt64l/unit/
../../../Engine/Content/Internationalization/icudt64l/zone/
../../../Engine/Content/Internationalization/icudt64l/region/
../../../Engine/Content/Localization/
../../../Engine/Content/Maps/
../../../Engine/Content/MobileResources/
../../../Engine/Content/SlateDebug/
../../../Engine/Content/Tutorial/
../../../Engine/Content/Slate/Fonts/
../../../Engine/Content/Slate/Testing/
../../../Engine/Content/Slate/Tutorials/
../../../Engine/Content/Slate/Icons/
../../../Engine/Content/Slate/CrashTracker/
../../../Engine/Content/Slate/Old/
../../../Engine/Content/Slate/Docking/
../../../Engine/Content/Slate/Common/
../../../Engine/Plugins/Runtime/LeapMotionController/
../../../Engine/Plugins/Editor/SpeedTreeImporter/Content/SpeedTree9/game_wind_noise.ubulk
```

# 禁用引擎模块

如果您仍然对构建大小不满意，还有另一种选择 - 通过禁用未使用但很重的模块来重建引擎，这些模块也包含在项目打包时。

为此，请下载引擎源代码、生成项目文件并通过 IDE 打开虚幻引擎解决方案。

然后打开目录下的 `UnrealGame.Target.cs`{: .filepath} 文件，设置如下变量：

```c#
bCompileAPEX = false;
bCompileICU = false;
bBuildDeveloperTools = true;
bCompileRecast = false;
bCompileSpeedTree = false;
bCompileForSize = true;
bCompileCEF3 = false;
bCompileFreeType = false;
bIWYU = true;
bUsesSlate = false;
bCompileChaos = false;
bUseChaos = false;
bUseChaosChecked = false;
bUseChaosMemoryTracking = false;
bCompilePhysX = false;
bCompileNvCloth = false;
bCompileRecast = false;
bCompileNavmeshSegmentLinks = false;
bCompileNavmeshClusterLinks = false;
bUseDebugLiveCodingConsole = false;
bUseLoggingInShipping = false;
bLoggingToMemoryEnabled = false;
bUseLauncherChecks = false;
bEnforceIWYU = true;
```

最后，您只需要为目标平台重建引擎和您的项目，仅此而已。