---
title: Unreal Wwise集成与应用
date: 2023-05-26 18:32:36 +0800
categories: [音频,Wwise]
tags: []
# Ref
# - https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=ue_dev_workflows.html
# - https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=using_initialsetup.html
# - https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=using_features_localization.html
# - https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=using_features_reference_load_switch_container.html
# - https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=using_faq.html
---

## 集成

- Unreal Wwise 插件的每个版本都是 **针对特定** Unreal Engine 版本 **专门构建** 的。

  **\>>** 因此，**务必** 使用 **对应** 支持 的 Unreal Engine 版本（*详见对应Wwise的版本说明*）

- 为了便于跨平台开发，必须**先安装** <u>Windows</u> 和 <u>Mac</u> **Wwise SDK**，**再安装 Unreal Wwise** 插件

### 与Wwise相关的工程结构

- 整个 Wwise 工程目录
- 所有 Unreal Wwise 素材（Event、SoundBank、Aux Bus 等）
- Unreal 工程设置文件：
  - DefaultGame.ini
  - DefaultUser.ini

### 版本控制相关的工程结构

- GeneratedSoundBanks
- `*.json`
- `*.bnk`
- `*.wem`为了让开发者运行集成代码并有声音，他们只需要做两件事：
  - 安装 Wwise 插件。
  - 能够访问`GeneratedSoundBanks`编辑器平台（Windows 或 Mac）的文件夹。您可以`GeneratedSoundBanks`在 Wwise Integration Settings 下的 Project Settings 中更改 Unreal 中的路径，在[SoundBank Settings](https://www.audiokinetic.com/en/library/edge/?source=Help&id=soundbank_settings_soundbanks_tab)中更改 Wwise Authoring 中的路径。
  - 

### 使用命名约定创建资产

- 在 Wwise 中根据需要的命名约定创建资源，这样可以确保 Event 具有稳定的 GUID 和正确的 Event ID。

- 在 Unreal 中，可以使用 Wwise Picker 或 WAAPI Picker 将新创建的事件拖到内容浏览器中的文件夹中。或者，可以使用[同步选项](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=features_editor_auto_sync.html)创建资产。这种方法需要同时打开 Wwise Authoring 和 Unreal。

  > 一般的项目体量来说，对 `GeneratedSoundBanks` 目录做好同步即可。



### Wwise 工程设置

在打开 SoundBank Settings (**Project > Project Settings > SoundBanks**) 时，可以看到启用了以下设置：

- Copy Loose/Streamed Media
- Remove Unused Generated Files
- Generate Per Bank Metadata File（有可能同时启用 Generate All Banks Metadata File）
- Generate JSON Metadata
- Include in Metadata：
  - Object GUID
  - Object Path
  - Max Attenuation（强烈推荐）
  - Estimated Duration（强烈推荐）

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306081142923.png)

在 **Project > Project Settings > Logs** ，禁用了以下设置：

- Media is duplicated in several SoundBanks
- Media not found in any SoundBank

## Wwise引擎初始化参数 & 内存池设置参考

SoundEngine 初始化步骤在 `FAkSoundEngineInitialization::Initialize()` 方法中执行。

在此方法中，会通过 Wwise Initialization Settings 内针对每个平台设定的数值来配置内存、流播放、IO、声音引擎、平台、音乐引擎和通信设置。

更多参数设置细节，翻阅文档手册 \>> [URL](https://www.audiokinetic.com/zh/library/edge/?source=UE4&id=using_initialsetup.html)

## 工程研发

### WwiseSoundEngine.Build.cs

负责针对每个支持的平台为插件设置构建参数

- 指定要链接哪些静态库；
- 指定要在运行时加载哪些动态库；
- 定义用于控制各种集成功能的预处理器宏。

### 宏定义

- `AK_CONFIGURATION` : 指定 Wwise 构建配置 – 静态库和动态库所在的相应子文件夹。
- `AK_SUPPORT_OPUS`  : 用于声明 Wwise Opus 库可供使用。
- `AK_SUPPORT_WAAPI`  : 用于声明 Wwise Authoring API 库可供使用。
- `AK_UNREAL_MAX_CONCURRENT_IO` : 用于指定允许发生的最大并发读取和写入数。

### 构建细节

- 在 SoundBank（音频包）生成期间，会修改 `…\Content\Wwise\EditorOnly\ActivatedPlugins.uasset` 文件，来将平台名称映射到每个平台所需插件的名称列表。

#### Android、IOS

为了减少**包体**的占用，可以 **移除** `…\Plugins\Wwise\ThirdParty` 内 `bin` 文件夹中的无用共享库。

-  `ThirdParty` 内对应 `bin` 文件夹中的所有 Wwise 插件打包到最终可执行文件中
- 对于 Android，有个 UPL 文件位于 `…\Plugins\Wwise\Source\AkAudio\Wwise_APL.xml` ，用来声明将把所有共享库打包到最终可执行文件中以构建库的基础架构。
- 对于 iOS 和 tvOS，会在 `…\Plugins\Wwise\Source\AkAudio\Private\Generated\AkiOSPlugins.h` 头文件内处理插件注册。此文件在 SoundBank 生成期间生成并包含在 `…\Plugins\Wwise\Source\AkAudio\Private\AkAudioDevice.cpp` 内。

#### Mac 、 Windows

把共享动态库添加到所生成 `…\Binaries\<UEPlatform>\<TargetName>`.target 文件中的运行时依赖项列表

> 若要将 Wwise Unreal Integration 用在 UE 调试配置中以在 Windows 上使用调试 CRT，请将 `WwiseUEPlatform_Windows.Build.cs` 内的 `bIsDebugBuild` 变量设为 true。注意，在设置此变量时将禁用 AkOpusDecoder 和 AkAutobahn 库，因为这两个库目前不支持调试 CRT。

### 链接模块

Wwise Unreal Integration 被分成了多个模块。为了在 C++ 工程内使用 Wwise 的功能，必须在工程的构建文件 (`.Build.cs`) 内链接这些模块。

可以通过从构建文件中移除模块来将其禁用。

在以下示例中，工程包含以下 public 模块：Core、CoreUOBject、Engine、InputCore、AkAudio 和 WwiseSoundEngine。其中，`AkAudio` 和 `WwiseSoundEngine` 为 Wwise 模块。

```c#

public class MyModule : ModuleRules
{
    public MyModule(ReadOnlyTargetRules Target) : base(Target)
    {
        PublicDependencyModuleNames.AddRange(new string[] { 
            "Core", "CoreUObject", "Engine", "InputCore", 
            "AkAudio", "WwiseSoundEngine" 
        });
 
        // 其他设置

    }
}
```

在本例中，可使用 `WwiseSoundEngine` 和 `AkAudio` 模块的功能。模块可包含在 `PublicDependencyModulesNames` 或 `PrivateDependencyModulesNames` 中。

#### 模块概述

- **AkAudio**：该根模块适用于大部分面向用户的 Integration 功能。
- **AkAudioMixer**：该模块允许工程将音频输出及音频下混从 Unreal 音频组件传输到 Wwise 工程的混音器。
- **AudiokineticTools**：该模块整合了特定于编辑器的工具以及 Wwise Picker 等实用工具。
- **WwiseFileHandler**：该模块为 Wwise 声音引擎提供所需的媒体、SoundBank 和外部源，包括处理来自 Wwise Location Resolver 和 I/O Hook 的请求。
- **WwiseProjectDatabase**：该模块提供基于内存的数据库视图，方便查看 Wwise 工程所生成 SoundBank 的当前状态。
- **WwiseResourceCooker**：该模块将 [WwiseObjectInfo 结构](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=pg_features_objects_assets.html#features_objects_classes_assetinfo) 转换为 [Cooked 结构](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=pg_features_objects_assets.html#features_objects_classes_cookeddata)，并将所需资源复制到 Staging 目录。
- **WwiseResourceLoader**：该模块负责加载和卸载各种 Wwise 素材类型所需的资源。
- **WwiseSoundEngine**：该模块提供 Wwise 声音引擎 API 和 Unreal 工程之间的桥接。

![模块依赖关系](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306081743579.png)



### 服务端插件剥离

> 需要在业务代码中剥离改插件的调用

```c#
// Copyright Epic Games, Inc. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class xxTarget : TargetRules
{
	public xxTarget(TargetInfo Target) : base(Target)
	{
        DisablePlugins.Add("Wwise");
    }
}
```

###  C++调用示例

#### WwiseSoundEngine 模块

`WwiseSoundEngine` 模块提供对大部分 SoundEngine API 操作的底层访问。

> 此代码会在给定 Actor 上发送 Event。您必须在 Actor 上添加 `UAkComponent` 以通过 Wwise 予以注册。同时还要加载 Event，因为 `WwiseSoundEngine` 模块中不会自动加载 Event。

```c++
#include "AkAudioEvent.h"
#include "AkComponent.h"
#include "Wwise/LowLevel/WwiseLowLevelSoundEngine.h"
 

void PostEvent(UAkAudioEvent* Event, AActor* GameObject)
{
    if (FWwiseLowLevelSoundEngine::Get())
    {
        TArray<UAkComponent*> Array;
        GameObject->GetComponents<UAkComponent>(Array);
        //Actor 没有绑定 AkComponent。若要通过此 Actor 来发出声音，就需要此组件。

        if(Array.Num() == 0)
        {
            Event->LoadData();
            auto* AkAudioComponent = NewObject<UAkComponent>(GameObject);
            AkAudioComponent->SetupAttachment(GameObject->GetDefaultAttachComponent());
            Array.Add(AkAudioComponent);
            AkAudioComponent->RegisterComponent();
        }
 
        FWwiseLowLevelSoundEngine::Get()->PostEvent(Event->GetWwiseShortID(), Array[0]->GetAkGameObjectID());
    }
}
```

#### AkAudio 模块

它可以完成 `WwiseSoundEngine` 模块可使用 Unreal 组件执行的大部分操作。

作为直接调用 SoundEngine 的替代方法，AkAudioDevice 提供了很多辅助函数来封装常用的 WwiseSoundEngine API。这些辅助函数还会检查是否已加载使用 API 所需的资源并提供更多日志信息。

就像前面的例子一样，以下代码也会在给定 Actor 上发送 Event。同时，还会绑定 `AkComponent` 并加载 Event：

```c++
#include "AkAudio.h"
 

void PostEvent(UAkAudioEvent* Event, AActor* GameObject)
{
    if (FAkAudioDevice::Get())
    {
        FAkAudioDevice::Get()->PostAkAudioEventOnActor(Event, GameObject);
    }
}
```

### 语音多语言切换

#### 实现准则

- 由于 Wwise 声音引擎的限制，**必须在没有本地化语音播放时更改语言**。
- 如果正在播放事件，声音引擎不会卸载包含它的库。加载的bank不能被具有相同名称的新bank替换，即使它是不同的语言。
- bank必须先卸载。

#### 实现方案

调用`FWwiseResourceLoader::SetLanguage`和`IWwiseStreamMgrAPI::SetCurrentLanguage`

三种可能状态`EWwiseReloadLanguage`：

- EWwiseReloadLanguage::**Immediate**
  - 将加载 Event 资源时所用的 FWwiseResourceLoader 中的 CurrentLanguage 变量设为新的语言。
  - 重新加载之前语言加载的所有 Soundbanks、ShareSets、Aux Buss 和 Events 的资源。
- EWwiseReloadLanguage::**Safe**
  - **做与Immediate**相同的事情，但也会调用`IWwiseSoundEngineAPI::StopAll()`以在重新加载资源之前停止所有播放的声音。
- EWwiseReloadLanguage::**Manual**
  - 只有 FWwiseResourceLoader 中的 CurrentLanguage 变量更改为新语言。
  - 用户负责卸载和重新加载需要更改语言的 Wwise 资源。

## 性能优化

### 使用 Reference-Loaded Switch Containers 优化内存

> 在 Wwise Unreal 2022.1 版本之前 称为 `Split Switch Container Media`

默认情况下，加载 Wwise Event 资产时，它们可能使用的所有资源（SoundBank 和媒体）都会随之加载。

在嵌套的 switch container 设计结构中，将会有大量的资源被加载，导致内存占用上涨。

如果您的 Switch Container 中的媒体是流式传输的（这对于大型音乐文件来说很常见），则此功能可提高性能，因为文件仅在必要时才打开以进行流式传输。

#### 适用的案例举例

- 主角的脚步声事件可能包含较深的层次结构，其取决于多个开关（如鞋子类型、地面材质和天气状况）。然而，大多数地图只包含材料或天气条件的子集。同样，该角色通常一次只穿一种类型的鞋类，因此无需为所有其他类型的鞋类加载声音。
- 基于开关容器的动态音乐系统的不同分支可能依赖于仅在特定地图中使用的开关或状态。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306091144330.png)

如果活动关卡引用 Human_Surface_Material 开关并且仅引用 Material_Dirt 开关值（例如，通过关卡蓝图中的 SetSwitch 节点），则只有 FS_Dirt_[01-04] 媒体文件会加载到内存中。_

加载引用 Material_Grass 的子关卡时，grass_[01-04] 媒体文件会自动与 Switch 一起加载。

### 需要额外注意

**启用此选项后，会将 Switch 或 State 值加载到内存中以确定要加载的媒体。**

- **使用字符串设置状态或开关值**。您必须确保加载相应的 Switch 或 State 值资产
  - 例如通过使用[加载资产](https://docs.unrealengine.com/en-US/BlueprintAPI/EditorScripting/Asset/LoadAsset/index.html)蓝图节点。
- **从 C++ 设置状态或开关值**。您必须确保加载相应的 Switch 或 State Value 资产
  - 例如通过使用 Unreal Engine [Asynchronous Asset Loading](https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/ProgrammingWithCPP/Assets/AsyncLoading/index.html)。
- **不建议在 使用 RTPC 控制的 Switch Containers **。这种类型的容器在加载媒体时会导致不一致。如果您使用 RTPC 控制的切换容器，请避免使用此选项。

此外，在 submaps 或菜单中加载和设置开关或状态时要小心。当这些关卡被卸载时，如果 Switch 或 State Value 资产没有在持久关卡中被引用，它们可能也会被卸载，这会导致它们相关的媒体被卸载。若Switch Value或State Value仍然设置在场景中的GameObject上，很可能会产生不合预期的行为。

<u>简单来说，需要管理好 Switch 、State 的内存资源</u>。

### 启用 Reference-Loaded Switch Container Media

每个[UAkAudioEvent](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=pg_features_objects_assets.html#features_objects_classes_UAkAudioEvent)都包含[FWwiseEventInfo](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=pg_features_objects_assets.html#features_objects_classes_FWwiseEventInfo)结构，以此了解别其所代表的 Wwise Event。

WwiseEventInfo 结构还包含 SwitchContainerLoading 字段，它可以启用  reference-loaded  Switch Container media。

- 设置为**AlwaysLoad**（所有事件的默认模式）时，所有媒体资源都随事件一起加载。
- 设置为**LoadOnReference**时，只有引用的媒体资源随事件一起加载。

### 技术细节

当此选项被激活且 Wwise Event 资产由 WwiseResourceCooker 烘焙时，其烘焙数据包含一组 SwitchContainerLeaves。

这些 Leaf 是由一系列不同的 Switch Value 或 State Value 到所要加载的媒体和 SoundBank 的映射。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306091144330.png)

比如这个例子，FS_Dirt_[01-04] 资源仅当 `Human_Surface_Material` 和 `Material_Dirt` Switches Values 被加载时才需要。

这由 <KBD>SwitchContainerLeaf</KBD> 表示，它具有由一对 `Human_Surface_Material` 和 `Material_Dirt` 开关组成的“键”，以及被依赖的 FS_Dirt_[01-04] 。

在通过 WwiseResourceLoader 加载 Wwise Event 时，会与对应的一组 SwitchContainerLeaf 添加到 WwiseResourceLoader 针对各个已知道的 Switch Value 和 State Value 跟踪的 Leaf 列表中。由 WwiseResourceLoader 加载（或卸载）。

> - 只有在通过 WwiseResourceLoader 加载 Event、Switch 和 State 素材时，才会对媒体依赖关系进行评估
> - Setting and unsetting Switches or States in the Sound Engine does not cause media to be loaded or unloaded.

要进一步优化内存使用，还可以禁用[UAkAudioType](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=pg_features_objects_assets.html#features_objects_classes_UAkAudioType)公开的**AutoLoad**属性，该属性适用于所有 Wwise 资源。在禁用此选项时，必须调用各个素材的 **LoadData** 和 **UnloadData**（可在 Blueprint 中找到）方法来驱动WwiseResourceLoader 的加、卸载。

## 第三人称听者设置

![企业微信截图_16863021986371](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306091726206.png)

## FAQ

### 最好不要混用 Unreal Audio 和Wwise

- 在 IOS 上可能遇到Crash、无法加载的情况，一定要用的话，需要设置 [Using the AkAudioMixer Module](https://www.audiokinetic.com/zh/library/2022.1.4_8202/?source=UE4&id=using_features_akaudiomixer.html)

- 禁用 Unreal Audio的步骤：

  - 将 `<UE_ROOT>/Engine/Config/iOS/IOSEngine.ini` AudioDeviceModuleName 字段置空

    ```ini
    AudioDeviceModuleName=IOSAudio
    ```

    ```ini
    AudioDeviceModuleName=
    ```

    

### 如何使用 Debug库构建？

在以下文件中将 `bDebugBuildsActuallyUseDebugCRT` 变量设为 `true` ：`<UE_ROOT>/Engine/Source/Programs/UnrealBuildTool/Configuration/BuildConfiguration.cs`。



### UE5 Android 构建时特别注意事项

**必须更改 `ThirdParty` 文件夹内的 Android SDK 文件夹层级结构。**

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16865346979601686534697373.png)

| 原目录 | 目标目录 |
| -----: | :------- |
| `Android_armeabi-v7a`  |  `Android/armeabi-v7a` |
| `Android_arm64-v8a` |  `Android/arm64-v8a` |
| `Android_x86` | `Android/x86` |
| `Android_x86_64` |  `Android/x86_64` |









