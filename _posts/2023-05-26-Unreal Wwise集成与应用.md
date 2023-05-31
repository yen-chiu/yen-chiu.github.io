---
title: Unreal Wwise集成与应用
date: 2023-05-26 18:32:36 +0800
categories: [音频,Wwise]
tags: []
---

## 集成

- Unreal Wwise 插件的每个版本都是**针对特定** Unreal Engine 版本**专门构建**的。

  **\>>** 因此，**务必使用对应支持**的 Unreal Engine 版本（*详见对应Wwise的版本说明*）

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





服务端插件剥离



```c#
public class xxxTarget : TargetRules
{
	public UGameTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V2;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_1;
        
	}
}
```

