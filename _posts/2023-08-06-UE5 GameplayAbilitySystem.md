---
title: UE5 GameplayAbilitySystem
date: 2023-08-06 13:47:37 +0800
categories: [Unreal,Beginner]
tags: [GAS]
# Ref
# - https://github.com/tranek/GASDocumentation
# - https://github.com/tranek/GASShooter

---



## 1. GameplayAbilitySystem 插件介绍

来自[官方文档](https://docs.unrealengine.com/en-US/Gameplay/GameplayAbilitySystem/index.html)：

> GAS系统是一个高度灵活的框架，用于构建可能在 RPG 或 MOBA 游戏中找到的类型的能力和属性。
>
> 可以为游戏中的角色构建要使用的动作或被动能力，状态效果可以因这些动作而增强或削弱各种属性，实施“冷却”计时器或资源成本来调节这些动作的使用，更改每个级别的能力及其效果、激活粒子或声音效果等等。
>
> 简而言之，该系统可以帮助设计、实现和有效地网络游戏内能力，就像跳跃一样简单，或者像任何现代 RPG 或 MOBA 游戏中最喜欢的角色的能力设置一样复杂。

GameplayAbilitySystem 插件由 Epic Games 开发，附带虚幻引擎 5 (UE5)。

它已经在 Paragon 和 Fortnite 等 AAA 商业游戏中经过了战斗测试。

该插件为单人和多人游戏提供了开箱即用的解决方案：

- 实施基于等级的角色能力或技能，并具有可选的**成本**和**冷却时间**（[GameplayAbilities](https://github.com/tranek/GASDocumentation#concepts-ga)）
- 操纵`Attributes`属于参与者的数值（[属性](https://github.com/tranek/GASDocumentation#concepts-a)）
- 将状态效果应用于演员 ( [GameplayEffects](https://github.com/tranek/GASDocumentation#concepts-ge) )
- 应用于`GameplayTags`演员 ( [GameplayTags](https://github.com/tranek/GASDocumentation#concepts-gt) )
- 生成视觉或声音效果（[GameplayCues](https://github.com/tranek/GASDocumentation#concepts-gc)）
- Replication 上述所有内容

在多人游戏中，GAS 为 [客户端预测 ](https://github.com/tranek/GASDocumentation#concepts-p) 提供支持：

- Ability  激活
- 播放动画蒙太奇
- 修改 `Attributes`
- 应用 `GameplayTags`
- Spawning `GameplayCues`
- 通过`RootMotionSource`连接到 的功能进行移动`CharacterMovementComponent`。

**GAS 必须在 C++ 中设置**，但`GameplayAbilities`可以`GameplayEffects`由设计者在 Blueprint 中创建。

目前 GAS 的问题：

- `GameplayEffect`延迟协调
  - 无法预测 ability 冷却时间，因此在高延时的情况下，冷却时间较短的ability，在服务端的频率低于正常延时的玩家。
    - 可以从设计上对于短CD的技能做，状态开关的设计，而不是单发的行为?

- 无法预测 的删除`GameplayEffects`。
  - 然而，我们可以回滚`GameplayEffects`的影响，从而有效地消除它们。这并不总是适当或可行的，并且仍然是一个问题。


## 2. 示例项目

[GASDocumentation](https://github.com/tranek/GASDocumentation)提供了一个示例，说明了如何在`PlayerState`类中使用`CommunicalSystemComponent`（`ASC`）设置基本的第三人称射击游戏，用于玩家/AI受控英雄的游戏机类别和AI受控小兵的`Character`类中的`ASC`。

目标是保持该项目简单，同时展示 GAS 基础知识并通过注释良好的代码展示一些常见要求的功能。

由于其专注于初学者，该项目不显示[预测射弹](https://github.com/tranek/GASDocumentation#concepts-p-spawn)等高级主题。

概念展示：

- `ASC` on `PlayerState` vs `Character`
- Replicated `Attributes`
- Replicated animation montages
- `GameplayTags`
- 在`GameplayEffects`中应用和删除`GameplayAbilities`
- 应用护甲减轻的伤害来改变角色的健康状况
- `GameplayEffectExecutionCalculations`
- 眩晕效果
- 死亡与重生
- 在服务器上通过ability 生成actors （射弹）
- 通过瞄准和冲刺来预测改变本地玩家的速度
- 不断消耗体力去冲刺
- 使用法力来施放技能
- 被动能力
- 堆叠`GameplayEffects`
- 瞄准演员
- 在蓝图中创建`GameplayAbilities`
- 用 C++ 创建`GameplayAbilities`
- Instanced per `Actor` `GameplayAbilities`
- Non-Instanced `GameplayAbilities` (Jump)
- 静态`GameplayCues`（FireGun 弹丸撞击粒子效果）
- Actor `GameplayCues`（冲刺和眩晕粒子效果）

英雄职业具有以下能力：

| Ability      | 输入绑定          | Predicted | C++ / 蓝图 | 描述                                                         |
| ------------ | ----------------- | --------- | ---------- | ------------------------------------------------------------ |
| 跳           | 空格键            | √         | C++        | 让英雄跳跃。                                                 |
| 枪           | 鼠标左键          | x         | C++        | 从英雄的枪中发射射弹。动画已预测，但射弹未预测。             |
| 瞄准目标     | 鼠标右键          | √         | 蓝图       | 按住按钮时，英雄会走得更慢，镜头会放大，以便用枪进行更精确的射击。 |
| 短跑         | Left Shift        | √         | 蓝图       | 按住按钮时，英雄会跑得更快，消耗体力。                       |
| 向前冲刺     | Q                 | √         | 蓝图       | 英雄以体力为代价向前冲刺。                                   |
| 被动装甲堆栈 | 被动的<br>Passive | x         | 蓝图       | 每 4 秒英雄就会获得一层护甲，最多可达 4 层。受到伤害会移除一层护甲。 |
| 流星         | R                 | x         | 蓝图       | 玩家瞄准一个位置，向敌人投下一颗流星，造成伤害并击晕他们。目标是可以预测的，而流星的产生则不是。 |

`GameplayAbilities`使用 C++ 还是蓝图创建并不重要。这里使用了两者的混合，例如如何用每种语言进行操作。

Minions 没有任何预定义的`GameplayAbilities`. 红色小兵有更多的生命恢复，而蓝色小兵有更高的起始生命值。

对于`GameplayAbility`命名，

- 使用后缀`_BP`来表示`GameplayAbility's`逻辑是在蓝图中创建的
- 缺少后缀意味着逻辑是用 C++ 创建的。

**蓝图资源命名前缀**

| 前缀 | 资产类型        |
| ---: | :-------------- |
|  GA_ | GameplayAbility |
|  GC_ | GameplayCue     |
|  GE_ | GameplayEffect  |



## 3. 使用 GAS 设置项目

使用 GAS 设置项目的基本步骤：

1. 在编辑器中启用 GameplayAbilitySystem 插件

2. 编辑`YourProjectName.Build.cs`以添加`"GameplayAbilities", "GameplayTags", "GameplayTasks"`到的`PrivateDependencyModuleNames`

   ```c#
   PrivateDependencyModuleNames.AddRange(new string[] {
       "GameplayAbilities",
       "GameplayTags",
       "GameplayTasks"
   });
   ```

3. 刷新/重新生成 Visual Studio 项目文件

4. 从 4.24 开始，现在强制调用`UAbilitySystemGlobals::Get().InitGlobalData()`使用[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data). 

   - 示例项目在`UAssetManager::StartInitialLoading()`. 请参阅[`InitGlobalData()`](https://github.com/tranek/GASDocumentation#concepts-asg-initglobaldata)获取更多信息。

这就是启用 GAS 所需要做的全部工作。

接着，在`Character` 或 `PlayerState` 添加 [`Ability System Component（ASC）`](https://github.com/tranek/GASDocumentation#concepts-asc) 、 [`AttributeSet`](https://github.com/tranek/GASDocumentation#concepts-as)  ，然后开始制作[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)和 [`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)。

## 4. GAS 概念

### 4.1 Ability System Component

`AbilitySystemComponent`（`ASC`）是GAS的核心。它是处理与系统的所有交互的`UActorComponent`( )。[`UAbilitySystemComponent`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UAbilitySystemComponent/index.html)任何`Actor`想要使用[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)、拥有[`Attributes`](https://github.com/tranek/GASDocumentation#concepts-a)或接收的人[`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)都必须附有一个`ASC`。这些对象都存在于 内部并由 管理和复制（除了`Attributes`由其复制的对象外[`AttributeSet`](https://github.com/tranek/GASDocumentation#concepts-as)）`ASC`。开发人员应该但不要求对其进行子类化。

与其`Actor`相连的`ASC`被称为`OwnerActor`的`ASC`。`Actor`的物理表示`ASC`称为`AvatarActor`。和`OwnerActor`可以与 MOBA 游戏中简单 AI 小兵的情况相同`AvatarActor`。`Actor`它们也可以不同，`Actors`就像 MOBA 游戏中玩家控制的英雄一样，其中 是`OwnerActor`，`PlayerState`是`AvatarActor`英雄的`Character`职业。大多数人`Actors`都会`ASC`自己拥有。如果的`Actor`意志重生并且需要在重生时`Attributes`或`GameplayEffects`在重生之间持续存在（就像 MOBA 中的英雄），那么理想的位置是`ASC`在`PlayerState`.

**注意：**如果的`ASC`位于的 上`PlayerState`，那么将需要增加`NetUpdateFrequency`的 的`PlayerState`。它默认为非常低的值，并且可能会在客户端上发生诸如和 之类`PlayerState`的事情之前导致延迟或感知滞后。一定要启用，Fortnite 使用它。`Attributes``GameplayTags`[`Adaptive Network Update Frequency`](https://docs.unrealengine.com/en-US/Gameplay/Networking/Actors/Properties/index.html#adaptivenetworkupdatefrequency)

the`OwnerActor`和 the`AvatarActor`如果不同`Actors`，则应实施`IAbilitySystemInterface`. 该接口有一个必须重写的函数`UAbilitySystemComponent* GetAbilitySystemComponent() const`，它返回一个指向其 的指针`ASC`。`ASCs`通过寻找这个接口函数在系统内部进行交互。

目前保持`ASC`活跃状态。`GameplayEffects``FActiveGameplayEffectsContainer ActiveGameplayEffects`

`ASC`保留其授予的`Gameplay Abilities`权利`FGameplayAbilitySpecContainer ActivatableAbilities`。每当计划迭代 时`ActivatableAbilities.Items`，请务必在循环上方添加`ABILITYLIST_SCOPE_LOCK();`以锁定列表以防止更改（由于删除功能）。每个`ABILITYLIST_SCOPE_LOCK();`范围内的内容都会递增`AbilityScopeLockCount`，然后在超出范围时递减。不要尝试删除范围内的能力`ABILITYLIST_SCOPE_LOCK();`（清除能力功能会`AbilityScopeLockCount`在内部进行检查，以防止在列表被锁定时删除能力）。



### 4.1.1 复制模式

定义`ASC`了三种不同的复制模式，用于复制`GameplayEffects`、`GameplayTags`、`GameplayCues`- `Full`、`Mixed`、 和`Minimal`。`Attributes`被他们复制`AttributeSet`。

| 复制模式  | 何时使用                       | 描述                                                         |
| --------- | ------------------------------ | ------------------------------------------------------------ |
| `Full`    | 单人玩家                       | 每一个`GameplayEffect`都被复制到每个客户端。                 |
| `Mixed`   | 多人游戏，玩家控制`Actors`     | `GameplayEffects`仅复制到拥有的客户端。仅`GameplayTags`和`GameplayCues`被复制给每个人。 |
| `Minimal` | 多人游戏，人工智能控制`Actors` | `GameplayEffects`永远不会复制给任何人。仅`GameplayTags`和`GameplayCues`被复制给每个人。 |

**注意：** `Mixed`复制模式期望`OwnerActor's` `Owner`是`Controller`. `PlayerState's` `Owner`是`Controller`默认的，但`Character's`不是。如果使用非`Mixed`复制模式，那么需要调用有效的。`OwnerActor``PlayerState``SetOwner()``OwnerActor``Controller`

从 4.24 开始，`PossessedBy()`现在将 的所有者设置`Pawn`为新的`Controller`.





### 4.1.2 设置和初始化

`ASCs`通常在构造函数中构造`OwnerActor's`并显式标记为已复制。**这必须在 C++ 中完成**。

```
AGDPlayerState::AGDPlayerState()
{
	// Create ability system component, and set it to be explicitly replicated
	AbilitySystemComponent = CreateDefaultSubobject<UGDAbilitySystemComponent>(TEXT("AbilitySystemComponent"));
	AbilitySystemComponent->SetIsReplicated(true);
	//...
}
```



需要在服务器和客户端上用它的和`ASC`进行初始化。希望在设置后（拥有后）进行初始化。单人游戏只需要担心服务器路径。`OwnerActor``AvatarActor``Pawn's` `Controller`

`ASC`对于居住在 上的玩家控制的角色`Pawn`，我通常在函数中的服务器上进行初始化`Pawn's` `PossessedBy()`，并在函数中的客户端上进行初始化`PlayerController's` `AcknowledgePossession()`。

```
void APACharacterBase::PossessedBy(AController * NewController)
{
	Super::PossessedBy(NewController);

	if (AbilitySystemComponent)
	{
		AbilitySystemComponent->InitAbilityActorInfo(this, this);
	}

	// ASC MixedMode replication requires that the ASC Owner's Owner be the Controller.
	SetOwner(NewController);
}
```



```
void APAPlayerControllerBase::AcknowledgePossession(APawn* P)
{
	Super::AcknowledgePossession(P);

	APACharacterBase* CharacterBase = Cast<APACharacterBase>(P);
	if (CharacterBase)
	{
		CharacterBase->GetAbilitySystemComponent()->InitAbilityActorInfo(CharacterBase, CharacterBase);
	}

	//...
}
```



`ASC`对于居住在 上的玩家控制的角色`PlayerState`，我通常在函数中初始化服务器`Pawn's` `PossessedBy()`并在函数中在客户端上初始化`Pawn's` `OnRep_PlayerState()`。这确保了`PlayerState`客户端上存在。

```
// Server only
void AGDHeroCharacter::PossessedBy(AController * NewController)
{
	Super::PossessedBy(NewController);

	AGDPlayerState* PS = GetPlayerState<AGDPlayerState>();
	if (PS)
	{
		// Set the ASC on the Server. Clients do this in OnRep_PlayerState()
		AbilitySystemComponent = Cast<UGDAbilitySystemComponent>(PS->GetAbilitySystemComponent());

		// AI won't have PlayerControllers so we can init again here just to be sure. No harm in initing twice for heroes that have PlayerControllers.
		PS->GetAbilitySystemComponent()->InitAbilityActorInfo(PS, this);
	}
	
	//...
}
```



```
// Client only
void AGDHeroCharacter::OnRep_PlayerState()
{
	Super::OnRep_PlayerState();

	AGDPlayerState* PS = GetPlayerState<AGDPlayerState>();
	if (PS)
	{
		// Set the ASC for clients. Server does this in PossessedBy.
		AbilitySystemComponent = Cast<UGDAbilitySystemComponent>(PS->GetAbilitySystemComponent());

		// Init ASC Actor Info for clients. Server will init its ASC when it possesses a new Actor.
		AbilitySystemComponent->InitAbilityActorInfo(PS, this);
	}

	// ...
}
```



如果收到错误消息，`LogAbilitySystem: Warning: Can't activate LocalOnly or LocalPredicted ability %s when not local!`则说明没有`ASC`在客户端上初始化。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.2 游戏标签

[`FGameplayTags`](https://docs.unrealengine.com/en-US/API/Runtime/GameplayTags/FGameplayTag/index.html)`Parent.Child.Grandchild...`是用 注册的形式的分层名称`GameplayTagManager`。这些标签对于分类和描述对象的状态非常有用。例如，如果一个角色被击晕，我们可以`State.Debuff.Stun` `GameplayTag`在击晕持续时间内给它一个 a 。

会发现自己用布尔值或枚举替换了以前用布尔值或枚举处理的东西`GameplayTags`，并对对象是否具有确定性进行布尔逻辑`GameplayTags`。

当给一个对象赋予标签时，如果它有标签，我们通常会将它们添加到该对象中`ASC`，以便 GAS 可以与它们交互。`UAbilitySystemComponent`实现`IGameplayTagAssetInterface`给予函数来访问其拥有的`GameplayTags`。

多个`GameplayTags`可以存储在一个`FGameplayTagContainer`. 最好使用 a`GameplayTagContainer`而不是 a `TArray<FGameplayTag>`，因为可以`GameplayTagContainers`增加一些效率魔法。虽然标签是标准的，但如果在项目设置中启用，`FNames`它们可以有效地打包在一起进行`FGameplayTagContainers`复制。要求服务器和客户端具有相同的. 这通常不会成为问题，因此应该启用此选项。也可以返回for 迭代。`Fast Replication``Fast Replication``GameplayTags``GameplayTagContainers``TArray<FGameplayTag>`

```
GameplayTags`存储在`FGameplayTagCountContainer`a中`TagMap`，该 a 存储该 的实例数`GameplayTag`。A中`FGameplayTagCountContainer`可能仍然有，但其为零。如果仍然有. 任何或类似函数都会检查 ，如果不存在或者为零，则返回 false。`GameplayTag``TagMapCount``ASC``GameplayTag``HasTag()``HasMatchingTag()``TagMapCount``GameplayTag``TagMapCount
```

`GameplayTags`必须提前在`DefaultGameplayTags.ini`. UE5编辑器在项目设置中提供了一个界面，让开发人员可以进行管理，`GameplayTags`而无需手动编辑`DefaultGameplayTags.ini`. 编辑`GameplayTag`器可以创建、重命名、搜索引用和删除`GameplayTags`.

[![项目设置中的 GameplayTag 编辑器](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplaytageditor.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplaytageditor.png)

搜索`GameplayTag`引用将`Reference Viewer`在编辑器中显示熟悉的图表，显示引用`GameplayTag`. 然而，这不会显示任何引用`GameplayTag`.

重命名`GameplayTags`会创建一个重定向，以便仍然引用原始资源的资源`GameplayTag`可以重定向到新的`GameplayTag`. 如果可能的话，我更喜欢创建一个新的`GameplayTag`，手动更新所有对新的引用`GameplayTag`，然后删除旧的`GameplayTag`以避免创建重定向。

除了 之外`Fast Replication`，`GameplayTag`编辑器还可以选择填写通常复制的内容`GameplayTags`以进一步优化它们。

`GameplayTags`如果它们是从`GameplayEffect`. 允许`ASC`添加`LooseGameplayTags`不复制且必须手动管理的内容。示例项目使用`LooseGameplayTag`for`State.Dead`以便拥有的客户端可以在其健康状况降至零时立即做出响应。重生时手动将回`TagMapCount`零。`TagMapCount`仅在使用时手动调整`LooseGameplayTags`。`UAbilitySystemComponent::AddLooseGameplayTag()`使用和`UAbilitySystemComponent::RemoveLooseGameplayTag()`功能比手动调整更好`TagMapCount`。

在 C++ 中获取对 a 的引用`GameplayTag`：

```
FGameplayTag::RequestGameplayTag(FName("Your.GameplayTag.Name"))
```



对于高级`GameplayTag`操作，例如获取父级或子级`GameplayTags`，请查看`GameplayTagManager`. 要访问`GameplayTagManager`，请包含`GameplayTagManager.h`并使用 来调用它`UGameplayTagManager::Get().FunctionName`。`GameplayTagManager`实际上将它们存储`GameplayTags`为关系节点（父节点、子节点等），以便比常量字符串操作和比较更快的处理速度。

`GameplayTags`并且`GameplayTagContainers`可以使用可选的`UPROPERTY`说明符`Meta = (Categories = "GameplayCue")`来过滤蓝图中的标签，以仅显示`GameplayTags`父标签为 的标签`GameplayCue`。当知道`GameplayTag`or`GameplayTagContainer`变量只能用于时，这很有用`GameplayCues`。

或者，有一个名为 的单独结构`FGameplayCueTag`，它封装了 a`FGameplayTag`并`GameplayTags`在蓝图中自动过滤，以仅显示父标记为 的那些标记`GameplayCue`。

如果要过滤`GameplayTag`函数中的参数，请使用`UFUNCTION`说明符`Meta = (GameplayTagFilter = "GameplayCue")`。`GameplayTagContainer`函数中的参数不能被过滤。如果想编辑引擎以允许这样做，请查看如何`SGameplayTagGraphPin::ParseDefaultValueData()`从`Engine\Plugins\Editor\GameplayTagsEditor\Source\GameplayTagsEditor\Private\SGameplayTagGraphPin.cpp`调用`FilterString = UGameplayTagsManager::Get().GetCategoriesMetaFromField(PinStructType);`和传递`FilterString`到`SGameplayTagWidget`in `SGameplayTagGraphPin::GetListContent()`。`GameplayTagContainer`这些函数的版本不`Engine\Plugins\Editor\GameplayTagsEditor\Source\GameplayTagsEditor\Private\SGameplayTagContainerGraphPin.cpp`检查元字段属性并传递过滤器。

示例项目广泛使用`GameplayTags`.

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.2.1 响应游戏标签的变化

提供了何时添加或删除的`ASC`委托。`GameplayTags`它接受一个`EGameplayTagEventType`，可以指定仅在`GameplayTag`添加/删除或 中发生任何更改时触发`GameplayTag's` `TagMapCount`。

```
AbilitySystemComponent->RegisterGameplayTagEvent(FGameplayTag::RequestGameplayTag(FName("State.Debuff.Stun")), EGameplayTagEventType::NewOrRemoved).AddUObject(this, &AGDPlayerState::StunTagChanged);
```



回调函数有一个参数`GameplayTag`和 new `TagCount`。

```
virtual void StunTagChanged(const FGameplayTag CallbackTag, int32 NewCount);
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.3 属性



#### 4.3.1 属性定义

`Attributes`是由 struct 定义的浮点值[`FGameplayAttributeData`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/FGameplayAttributeData/index.html)。这些可以代表任何东西，从角色的生命值到角色的等级，再到药水的充电次数。如果它是属于 an 的游戏相关数值`Actor`，则应考虑使用 an `Attribute`。`Attributes`通常应仅进行修改，[`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)以便 ASC 可以[预测](https://github.com/tranek/GASDocumentation#concepts-p)变化。

`Attributes`由 定义并存在于[`AttributeSet`](https://github.com/tranek/GASDocumentation#concepts-as). 负责`AttributeSet`复制`Attributes`标记为复制的内容。[`AttributeSets`](https://github.com/tranek/GASDocumentation#concepts-as)请参阅有关如何定义 的部分`Attributes`。

**提示：**如果不希望`Attribute`出现在 的编辑器列表中`Attributes`，可以使用`Meta = (HideInDetailsView)` `property specifier`.

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.3.2 基础值与当前值

An`Attribute`由两个值组成 - a`BaseValue`和 a `CurrentValue`。是`BaseValue`的永久值，`Attribute`而`CurrentValue`是 加上`BaseValue`临时修改`GameplayEffects`。例如，的`Character`移动速度可能`Attribute`为`BaseValue`600 单位/秒。由于尚未`GameplayEffects`修改移动速度，`CurrentValue`因此也是 600 u/s。如果她获得临时的 50 u/s 移动速度增益，则`BaseValue`保持不变为 600 u/s，而`CurrentValue`现在为 600 + 50，总共 650 u/s。当移动速度增益到期时，`CurrentValue`会恢复到`BaseValue`600 u/s。

GAS 的初学者常常会混淆`BaseValue`an 的最大值`Attribute`，并尝试将其视为最大值。这是一个不正确的做法。可以更改或在能力或 UI 中引用的最大值`Attributes`应被视为单独的`Attributes`。对于硬编码的最大值和最小值，有一种方法可以定义一个可以设置最大值和最小值的`DataTable`with `FAttributeMetaData`，但是 Epic 在该结构上方的注释将其称为“正在进行的工作”。请参阅`AttributeSet.h`获取更多信息。为了防止混淆，我建议将能力或 UI 中可以引用的最大值作为单独的`Attributes`和硬编码的最大值和最小值，仅用于夹紧`Attributes`的最大值和最小值定义为`AttributeSet`. 的钳位`Attributes`讨论于[PreAttributeChange()](https://github.com/tranek/GASDocumentation#concepts-as-preattributechange)用于对 进行更改`CurrentValue`，[PostGameplayEffectExecute()](https://github.com/tranek/GASDocumentation#concepts-as-postgameplayeffectexecute)`BaseValue`用于对from进行更改`GameplayEffects`。

对 的永久更改`BaseValue`来自`Instant` `GameplayEffects`while`Duration`并`Infinite` `GameplayEffects`更改`CurrentValue`. 定期`GameplayEffects`被视为即时`GameplayEffects`并更改`BaseValue`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.3.3 元属性

有些`Attributes`被视为临时值的占位符，旨在与`Attributes`. 这些被称为`Meta Attributes`. 例如，我们通常将损坏定义为`Meta Attribute`。我们没有`GameplayEffect`直接改变我们的健康状况`Attribute`，而是使用`Meta Attribute`所谓的损害作为占位符。这样，伤害值可以通过 buffs 和 debuffs 进行修改，并且[`GameplayEffectExecutionCalculation`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)可以在 中进一步操作`AttributeSet`，例如从当前护盾中减去伤害`Attribute`，然后最后从生命值中减去剩余部分`Attribute`。这种伤害`Meta Attribute`在彼此之间没有持久性`GameplayEffects`，并且会被每个人所覆盖。`Meta Attributes`通常不会被复制。

`Meta Attributes`为“我们造成了多少伤害？”之间的伤害和治疗等问题提供了良好的逻辑分离。以及“我们该如何处理这种损坏？”。这种逻辑上的分离意味着我们`Gameplay Effects`不需要`Execution Calculations`知道目标如何处理损害。继续我们的损害示例，`Gameplay Effect`确定损害程度，然后`AttributeSet`决定如何处理该损害。并非所有字符都可能具有相同的特性`Attributes`，特别是当使用子类化时`AttributeSets`。基`AttributeSet`类可能只有生命值`Attribute`，但子类`AttributeSet`可能会添加护盾`Attribute`。`AttributeSet`带有护盾的子类`Attribute`所受到的伤害分配方式与基`AttributeSet`类不同。

虽然`Meta Attributes`它们是一个很好的设计模式，但它们不是强制性的。如果你只有一个`Execution Calculation`用于所有伤害实例，并且`Attribute Set`所有角色共享一个类别，那么你可以在 内对生命值、护盾等进行伤害分配`Execution Calculation`并直接修改它们`Attributes`。只会牺牲灵活性，但这对来说可能没问题。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.3.4 响应属性变化

要监听更改`Attribute`以更新 UI 或其他游戏玩法，请使用`UAbilitySystemComponent::GetGameplayAttributeValueChangeDelegate(FGameplayAttribute Attribute)`。该函数返回一个可以绑定的委托，每当发生更改时都会自动调用该委托`Attribute`。该委托提供一个`FOnAttributeChangeData`带有`NewValue`、`OldValue`和 的参数`FGameplayEffectModCallbackData`。**注意：**只能`FGameplayEffectModCallbackData`在服务器上设置。

```
AbilitySystemComponent->GetGameplayAttributeValueChangeDelegate(AttributeSetBase->GetHealthAttribute()).AddUObject(this, &AGDPlayerState::HealthChanged);
```



```
virtual void HealthChanged(const FOnAttributeChangeData& Data);
```



示例项目绑定到`Attribute`值已更改的委托，以`GDPlayerState`更新 HUD 并在生命值达到零时响应玩家死亡。

`ASyncTask`示例项目中包含一个将其包装到 的自定义蓝图节点。它在`UI_HUD`UMG Widget 中用于更新生命值、法力值和耐力值。这`AsyncTask`将永远存在，直到手动调用`EndTask()`，我们在 UMG Widget 的`Destruct`事件中执行此操作。见`AsyncTaskAttributeChanged.h/cpp`。

[![监听BP节点属性变化](https://github.com/tranek/GASDocumentation/raw/master/Images/attributechange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/attributechange.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.3.5 派生属性

要使 的`Attribute`部分或全部值源自一个或多个其他值`Attributes`，请将 an`Infinite` `GameplayEffect`与一个或多个`Attribute Based`或一起使用。当它依赖的更新时，它会自动更新。[`MMC`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc) [`Modifiers`](https://github.com/tranek/GASDocumentation#concepts-ge-mods)`Derived Attribute``Attribute`

`Modifiers`a 上所有 的最终公式与`Derived Attribute`的公式相同`Modifier Aggregators`。如果需要按特定顺序进行计算，请在`MMC`.

```
((CurrentValue + Additive) * Multiplicitive) / Division
```



**注意：**如果在 PIE 中使用多个客户端，需要`Run Under One Process`在编辑器首选项中禁用，否则当它们在除第一个客户端之外的客户端上`Derived Attributes`独立更新时将不会更新。`Attributes`

在此示例中，我们有一个从公式 中的、和,`Infinite` `GameplayEffect`得出 的值。每当任何更新其值时，都会自动重新计算其值。`TestAttrA``Attributes``TestAttrB``TestAttrC``TestAttrA = (TestAttrA + TestAttrB) * ( 2 * TestAttrC)``TestAttrA``Attributes`

[![派生属性示例](https://github.com/tranek/GASDocumentation/raw/master/Images/derivedattribute.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/derivedattribute.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.4 属性设置



#### 4.4.1 属性集定义

定义`AttributeSet`、保存和管理对 的更改`Attributes`。开发人员应该从[`UAttributeSet`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UAttributeSet/index.html). `AttributeSet`在构造函数中创建 an 会`OwnerActor's`自动将其注册到其`ASC`. **这必须在 C++ 中完成**。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.4.2 属性集设计

An`ASC`可能有一个或多个`AttributeSets`。`AttributeSets`属性集的内存开销可以忽略不计，因此使用多少属性集是由开发人员自行决定的。

游戏中的`AttributeSet`每个人共享一个大型整体是可以接受的，并且仅在需要时使用属性，而忽略未使用的属性。`Actor`

或者，可以选择根据需要有选择地添加多个`AttributeSet`代表分组。例如，可以有一个与健康相关的、一个与法力相关的，等等。在 MOBA 游戏中，英雄可能需要法力，但小兵可能不需要。因此，英雄会获得法力，而小兵则不会。`Attributes``Actors``AttributeSet``Attributes``AttributeSet``Attributes``AttributeSet`

此外，`AttributeSets`可以将其细分为另一种选择性选择`Attributes`具有的方法`Actor`。`Attributes`内部称为`AttributeSetClassName.AttributeName`. 当对 进行子类化时`AttributeSet`，父类中的所有`Attributes`仍将以父类的名称作为前缀。

虽然可以拥有多个`AttributeSet`，但在 .NET 上不应拥有多个`AttributeSet`同一类`ASC`。如果同一类中有多个`AttributeSet`，它不知道该`AttributeSet`使用哪一个，只会选择一个。



##### 4.4.2.1 具有单独属性的子组件

如果在一个`Pawn`类似的单独可损坏盔甲上有多个可损坏组件，我建议如果知道可以在一个组件上`Pawn`产生那么多生命值的可损坏组件的最大数量- DamageableCompHealth0、DamageableCompHealth1 等来表示逻辑那些易损坏组件的“插槽”。在可损坏组件类实例中，分配可以读取或知道要对其施加损坏的插槽编号。可损坏组件的数量少于最大数量或为零就可以了。仅仅因为 a有, 并不意味着必须使用它。未使用的占用少量内存。`Attributes``AttributeSet``Attribute``GameplayAbilities`[`Executions`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)`Attribute``Pawns``AttributeSet``Attribute``Attributes`

如果的子组件需要多个`Attributes`，则子组件的数量可能是无限的，子组件可以分离并被其他玩家使用（例如武器），或者由于任何其他原因此方法不适合，我建议放弃并将`Attributes`普通的旧浮标存储在组件上。请参阅[项目属性](https://github.com/tranek/GASDocumentation#concepts-as-design-itemattributes)。



##### 4.4.2.2 在运行时添加和删除属性集

`AttributeSets`可以在运行时添加和删除`ASC`；然而，移除`AttributeSets`可能会很危险。例如，如果`AttributeSet`在服务器之前在客户端上删除 an 并将`Attribute`值更改复制到客户端，则将`Attribute`无法找到它`AttributeSet`并导致游戏崩溃。

将武器添加到库存中：

```
AbilitySystemComponent->GetSpawnedAttributes_Mutable().AddUnique(WeaponAttributeSetPointer);
AbilitySystemComponent->ForceReplication();
```



从库存中移除武器时：

```
AbilitySystemComponent->GetSpawnedAttributes_Mutable().Remove(WeaponAttributeSetPointer);
AbilitySystemComponent->ForceReplication();
```





##### 4.4.2.3 物品属性（武器弹药）

有几种方法可以实现可装备的物品`Attributes`（武器弹药、装甲耐久度等）。所有这些方法都将值直接存储在项目上。对于在其生命周期内可由多名玩家装备的物品来说，这是必要的。

> 1. 在项目上使用普通浮动（**推荐**）
> 2. `AttributeSet`在项目上分开
> 3. `ASC`在项目上分开



###### 4.4.2.3.1 项目上的普通浮动

而不是`Attributes`在项目类实例上存储普通浮点值。Fortnite 和[GASShooter](https://github.com/tranek/GASShooter)以这种方式处理枪支弹药。对于枪，将最大弹夹尺寸、弹夹中的当前弹药、储备弹药等直接存储为`COND_OwnerOnly`枪实例上的复制浮点数 ( )。如果武器共享备用弹药，可以将备用弹药作为`Attribute`共享弹药移动到角色上`AttributeSet`（重装能力可以使用`Cost GE`从备用弹药拉入枪的浮动弹夹弹药中）。由于没有使用`Attributes`当前的弹夹弹药，因此需要重写一些函数来`UGameplayAbility`检查枪上的浮标并应用成本。使枪`SourceObject`成为[`GameplayAbilitySpec`](https://github.com/tranek/GASDocumentation#concepts-ga-spec)授予该能力意味着可以在该能力内使用授予该能力的枪。

为了防止枪在自动射击期间复制回弹药量并破坏本地弹药量，请在玩家拥有 in 时禁用`IsFiring` `GameplayTag`复制`PreReplication()`。实际上是在这里进行自己的本地预测。

```
void AGSWeapon::PreReplication(IRepChangedPropertyTracker& ChangedPropertyTracker)
{
	Super::PreReplication(ChangedPropertyTracker);

	DOREPLIFETIME_ACTIVE_OVERRIDE(AGSWeapon, PrimaryClipAmmo, (IsValid(AbilitySystemComponent) && !AbilitySystemComponent->HasMatchingGameplayTag(WeaponIsFiringTag)));
	DOREPLIFETIME_ACTIVE_OVERRIDE(AGSWeapon, SecondaryClipAmmo, (IsValid(AbilitySystemComponent) && !AbilitySystemComponent->HasMatchingGameplayTag(WeaponIsFiringTag)));
}
```



好处：

1. 避免使用限制`AttributeSets`（见下文）

限制：

1. 无法使用现有`GameplayEffect`工作流程（`Cost GEs`用于弹药使用等）
2. 需要覆盖关键功能来`UGameplayAbility`检查弹药成本并将其应用于枪的浮动



###### 4.4.2.3.2`AttributeSet`关于项目

[在将添加到玩家的物品中的](https://github.com/tranek/GASDocumentation#concepts-as-design-addremoveruntime)`AttributeSet`物品[添加到玩家的库存中时，](https://github.com/tranek/GASDocumentation#concepts-as-design-addremoveruntime)使用单独的物品是可行的，但它有一些主要的限制。[我在GASShooter](https://github.com/tranek/GASShooter)的早期版本中使用了这个作为武器弹药。武器将诸如最大弹夹尺寸、弹夹中的当前弹药、储备弹药等存储在武器类别中。如果武器共享备用弹药，可以将备用弹药移动到共享弹药中的角色上。当武器被添加到服务器上的玩家库存中时，该武器会将其添加到玩家的. 然后服务器会将其复制到客户端。如果武器从库存中移除，它也会从[`ASC`](https://github.com/tranek/GASDocumentation#concepts-as-design-addremoveruntime)`Attributes``AttributeSet``AttributeSet``AttributeSet``ASC::SpawnedAttributes``AttributeSet``ASC::SpawnedAttributes`。

当`AttributeSet`生命依赖于除武器之外的其他东西时`OwnerActor`，最初会在`AttributeSet`. 解决方法是构造`AttributeSet`in`BeginPlay()`而不是在构造函数中，并在武器上实现（将武器添加到玩家库存时`IAbilitySystemInterface`将指针设置为）。`ASC`

```
void AGSWeapon::BeginPlay()
{
	if (!AttributeSet)
	{
		AttributeSet = NewObject<UGSWeaponAttributeSet>(this);
	}
	//...
}
```



可以通过查看这个[旧版本的 GASShooter](https://github.com/tranek/GASShooter/tree/df5949d0dd992bd3d76d4a728f370f2e2c827735)在实践中看到它。

好处：

1. 可以使用现有的工作`GameplayAbility`流程`GameplayEffect`（`Cost GEs`用于弹药使用等）
2. 对于非常小的一组项目来说设置简单

限制：

1. 你必须`AttributeSet`为每种武器类型创建一个新类别。由于更改了数组中类的第`ASCs`一个实例的外观，因此在功能上只能拥有类的一个实例。同一类的其他实例将被忽略。`AttributeSet``Attribute``AttributeSet``ASCs` `SpawnedAttributes``AttributeSet`
2. 由于之前每个类别只有一个`AttributeSet`实例的原因，玩家的库存中每种类型的武器只能拥有一种`AttributeSet`。
3. 删除`AttributeSet`是危险的。在 GASShooter 中，如果玩家用火箭自杀，玩家会立即从库存中移除火箭发射器（包括从`AttributeSet`）`ASC`。当服务器复制火箭发射器的弹药发生`Attribute`变化时，`AttributeSet`客户端上的弹药不再存在`ASC`，游戏崩溃了。



###### 4.4.2.3.3`ASC`关于项目

将每个项目放在一个整体`AbilitySystemComponent`上是一种极端的方法。我没有亲自这样做过，也没有在野外见过它。需要大量的工程才能使其发挥作用。

> 是否可以拥有多个具有相同所有者但不同头像的AbilitySystemComponents（例如，在将Owner 设置为PlayerState 的pawn 和武器/物品/射弹上）？
>
> 我看到的第一个问题是在拥有的 Actor 上实现 IGameplayTagAssetInterface 和 IAbilitySystemInterface。前者可能是可能的：只需聚合来自所有 ASC 的标签（但要注意 -HasAllMatchingGameplayTags 可能只能通过跨 ASC 聚合来满足。仅将调用转发到每个 ASC 并将结果或在一起是不够的）。但后者更加棘手：哪一个 ASC 才是权威的？如果有人想申请 GE - 哪一个应该获得它？也许你可以解决这些问题，但问题的这一面将是最困难的：所有者将拥有多个 ASC。
>
> 不过，棋子和武器上的单独 ASC 本身就有意义。例如，区分描述武器的标签和描述拥有棋子的标签。也许授予武器的标签也“适用于”所有者而不是其他东西确实有意义（例如，属性和 GE 是独立的，但所有者将像我上面描述的那样聚合拥有的标签）。我确信这会成功。但同一所有者拥有多个 ASC 可能会很冒险。

*Epic 的 Dave Ratti 对[社区问题 #6 的回答](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)*

好处：

1. 可以使用现有的工作`GameplayAbility`流程`GameplayEffect`（`Cost GEs`用于弹药使用等）
2. 可以重用`AttributeSet`类（每种武器的 ASC 上有一个）

限制：

1. 工程成本未知
2. 有可能吗？

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.4.3 定义属性

**`Attributes`C++中只能**在`AttributeSet's`头文件中定义。建议将此宏块添加到每个`AttributeSet`头文件的顶部。它会自动为的`Attributes`.

```
// Uses macros from AttributeSet.h
#define ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \
	GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName) \
	GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)
```



复制的健康属性将定义如下：

```
UPROPERTY(BlueprintReadOnly, Category = "Health", ReplicatedUsing = OnRep_Health)
FGameplayAttributeData Health;
ATTRIBUTE_ACCESSORS(UGDAttributeSetBase, Health)
```



`OnRep`还在标题中定义该函数：

```
UFUNCTION()
virtual void OnRep_Health(const FGameplayAttributeData& OldHealth);
```



的 .cpp 文件应使用预测系统使用的宏`AttributeSet`填充`OnRep`函数：`GAMEPLAYATTRIBUTE_REPNOTIFY`

```
void UGDAttributeSetBase::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
	GAMEPLAYATTRIBUTE_REPNOTIFY(UGDAttributeSetBase, Health, OldHealth);
}
```



最后，`Attribute`需要添加`GetLifetimeReplicatedProps`：

```
void UGDAttributeSetBase::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME_CONDITION_NOTIFY(UGDAttributeSetBase, Health, COND_None, REPNOTIFY_Always);
}
```



`REPNOTIFY_Always`告诉`OnRep`函数如果本地值已经等于从服务器复制的值（由于预测），则触发该函数。`OnRep`默认情况下，如果本地值与从服务器复制的值相同，则不会触发该函数。

如果`Attribute`不像 a 那样复制`Meta Attribute`，则可以跳过`OnRep`和步骤。`GetLifetimeReplicatedProps`





#### 4.4.4 初始化属性

有多种初始化方法`Attributes`（将它们设置`BaseValue`为`CurrentValue`某个初始值）。Epic 建议使用 instant `GameplayEffect`. 这也是示例项目中使用的方法。

`GE_HeroAttributes`有关如何即时初始化的信息，`GameplayEffect`请参阅示例项目中的蓝图`Attributes`。这种情况的应用`GameplayEffect`发生在 C++ 中。

如果`ATTRIBUTE_ACCESSORS`在定义 时使用了宏`Attributes`，则将自动为`AttributeSet`每个 生成一个初始化函数`Attribute`，可以在闲暇时在 C++ 中调用该函数。

```
// InitHealth(float InitialValue) is an automatically generated function for an Attribute 'Health' defined with the `ATTRIBUTE_ACCESSORS` macro
AttributeSet->InitHealth(100.0f);
```



请参阅`AttributeSet.h`参考资料 来了解更多初始化方法`Attributes`。

**注意：** 4.24 之前，`FAttributeSetInitterDiscreteLevels`无法使用`FGameplayAttributeData`. 它是在`Attributes`原始浮动时创建的，并且会抱怨`FGameplayAttributeData`不是`Plain Old Data`( `POD`)。[此问题已在 4.24 https://issues.unrealengine.com/issue/UE-76557](https://issues.unrealengine.com/issue/UE-76557)中修复。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.4.5 PreAttributeChange()

```
PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)`是在变化发生之前`AttributeSet`响应变化的主要功能之一。它是通过参考参数限制`Attribute's` `CurrentValue`传入更改的理想位置。`CurrentValue``NewValue
```

例如，要限制移动速度修改器，示例项目会这样做：

```
if (Attribute == GetMoveSpeedAttribute())
{
	// Cannot slow less than 150 units/s and cannot boost more than 1000 units/s
	NewValue = FMath::Clamp<float>(NewValue, 150, 1000);
}
```



该函数是由我们添加到（[定义属性](https://github.com/tranek/GASDocumentation#concepts-as-attributes)`GetMoveSpeedAttribute()`）的宏块创建的。`AttributeSet.h`

这是由对 的任何更改触发的`Attributes`，无论是使用setter（由（[定义属性](https://github.com/tranek/GASDocumentation#concepts-as-attributes)`Attribute`）中的宏块定义）还是使用。`AttributeSet.h`[`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)

**注意：**此处发生的任何限制都不会永久更改`ASC`. 它仅更改查询修饰符返回的值。这意味着任何需要重新计算`CurrentValue`所有修改器的东西，例如[`GameplayEffectExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)需要[`ModifierMagnitudeCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)再次实施钳位。

**注意：** Epic 的评论说`PreAttributeChange()`不要将其用于游戏事件，而是主要用于夹紧。更改游戏事件的推荐位置`Attribute`是`UAbilitySystemComponent::GetGameplayAttributeValueChangeDelegate(FGameplayAttribute Attribute)`（[响应属性更改](https://github.com/tranek/GASDocumentation#concepts-a-changes)）。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.4.6 PostGameplayEffectExecute()

```
PostGameplayEffectExecute(const FGameplayEffectModCallbackData & Data)`仅在立即更改`BaseValue`an后触发。当它们从.`Attribute`[`GameplayEffect`](https://github.com/tranek/GASDocumentation#concepts-ge)`Attribute``GameplayEffect
```

例如，在示例项目中，我们从此处的`Meta Attribute`生命值中减去最终伤害`Attribute`。如果有盾牌`Attribute`，我们会先减去它的伤害，然后再减去生命值的剩余部分。示例项目还使用此位置来应用命中反应动画、显示浮动伤害数字以及为杀手分配经验和黄金赏金。按照设计，伤害`Meta Attribute`总是会在一瞬间发生`GameplayEffect`，而不是`Attribute`二传手。

其他`Attributes`只会`BaseValue`从瞬间改变的东西`GameplayEffects`，如法力和耐力，也可以在此处固定到其对应的最大值`Attributes`。

**注意：**`PostGameplayEffectExecute()`调用时，对 的更改`Attribute`已经发生，但尚未复制回客户端，因此此处的限制值不会导致客户端进行两次网络更新。客户端只有在锁定后才会收到更新。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.4.7 OnAttributeAggregatorCreated()

`OnAttributeAggregatorCreated(const FGameplayAttribute& Attribute, FAggregator* NewAggregator)`当为该集合中的an`Aggregator`创建 an时触发。`Attribute`它允许自定义设置[`FAggregatorEvaluateMetaData`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/FAggregatorEvaluateMetaData/index.html)。`AggregatorEvaluateMetaData`被用于基于所有应用于它的`Aggregator`评估。默认情况下，仅用于确定哪些符合条件，其中的示例允许所有正数，但将负数限制为仅最负数。Paragon 使用此功能仅允许对玩家应用最负面的移动速度缓慢效果，无论在应用所有正移动速度增益的同时有多少缓慢效果。不符合条件的仍然存在，只是没有汇总到决赛中`CurrentValue``Attribute`[`Modifiers`](https://github.com/tranek/GASDocumentation#concepts-ge-mods)`AggregatorEvaluateMetaData``Aggregator``Modifiers``MostNegativeMod_AllPositiveMods``Modifiers``Modifiers``Modifiers``ASC``CurrentValue`。一旦条件发生变化，他们可能会获得资格，例如如果最负面的情况`Modifier`到期，那么下一个最负面的`Modifier`（如果存在）就会有资格。

`Modifier`在仅允许最负面和所有正面的示例中使用 AggregatorEvaluateMetaData `Modifiers`：

```
virtual void OnAttributeAggregatorCreated(const FGameplayAttribute& Attribute, FAggregator* NewAggregator) const override;
```



```
void UGSAttributeSetBase::OnAttributeAggregatorCreated(const FGameplayAttribute& Attribute, FAggregator* NewAggregator) const
{
	Super::OnAttributeAggregatorCreated(Attribute, NewAggregator);

	if (!NewAggregator)
	{
		return;
	}

	if (Attribute == GetMoveSpeedAttribute())
	{
		NewAggregator->EvaluationMetaData = &FAggregatorEvaluateMetaDataLibrary::MostNegativeMod_AllPositiveMods;
	}
}
```



`AggregatorEvaluateMetaData`对限定符的自定义应添加`FAggregatorEvaluateMetaDataLibrary`为静态变量。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.5 游戏效果



#### 4.5.1 游戏效果定义

[`GameplayEffects`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UGameplayEffect/index.html)( ) 是改变自己和他人能力`GE`的容器。它们可以引起立即的变化，例如伤害或治疗，或应用长期状态增益/减益，例如移动速度提升或眩晕。该类是一个**纯数据**类，定义单个游戏效果。不应向 中添加额外的逻辑。通常，设计者会创建许多 的蓝图子类。[`Attributes`](https://github.com/tranek/GASDocumentation#concepts-a)[`GameplayTags`](https://github.com/tranek/GASDocumentation#concepts-gt)`Attribute``UGameplayEffect``GameplayEffects``UGameplayEffect`

`GameplayEffects``Attributes`通过[`Modifiers`](https://github.com/tranek/GASDocumentation#concepts-ge-mods)和[`Executions`( `GameplayEffectExecutionCalculation`)](https://github.com/tranek/GASDocumentation#concepts-ge-ec)进行更改。

`GameplayEffects`具有三种类型的持续时间：`Instant`、`Duration`和`Infinite`。

此外，`GameplayEffects`可以添加/执行[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc). An `Instant` `GameplayEffect`will 调用`Execute`，`GameplayCue` `GameplayTags`而 a`Duration`或`Infinite` `GameplayEffect`will调用`Add`and 。`Remove``GameplayCue` `GameplayTags`

| 持续时间类型 | 游戏提示事件 | 何时使用                                                     |
| ------------ | ------------ | ------------------------------------------------------------ |
| `Instant`    | 执行         | 对于立即永久更改`Attribute's` `BaseValue`。`GameplayTags`不会被应用，即使对于一个框架也是如此。 |
| `Duration`   | 添加和删除   | 对于临时更改`Attribute's` `CurrentValue`和应用`GameplayTags`，将在`GameplayEffect`过期时删除或手动删除。持续时间在类/蓝图中指定`UGameplayEffect`。 |
| `Infinite`   | 添加和删除   | 对于临时更改`Attribute's` `CurrentValue`和应用`GameplayTags`，将在`GameplayEffect`删除时删除。它们永远不会自行过期，必须通过能力或 手动删除`ASC`。 |

```
Duration`并可以`Infinite` `GameplayEffects`选择应用其定义的每秒应用`Periodic Effects`它。在更改和时被视为。这些对于随时间推移造成的伤害 (DOT) 类型的效果非常有用。**注：**无法[预测](https://github.com/tranek/GASDocumentation#concepts-p)。`Modifiers``Executions``X``Period``Periodic Effects``Instant` `GameplayEffects``Attribute's` `BaseValue``Executing` `GameplayCues` `Periodic Effects
Duration`如果不满足/满足（[游戏效果标签](https://github.com/tranek/GASDocumentation#concepts-ge-tags)） ，可以`Infinite` `GameplayEffects`在应用后暂时关闭和打开。关闭 a会消除其和的影响，但不会消除. 打开背面会重新应用其和。`Ongoing Tag Requirements``GameplayEffect``Modifiers``GameplayTags``GameplayEffect``GameplayEffect``Modifiers``GameplayTags
```

如果需要手动重新计算`Modifiers`a`Duration`或 的`Infinite` `GameplayEffect`(假设有一个`MMC`使用不来自 的数据`Attributes`)，可以`UAbilitySystemComponent::ActiveGameplayEffects.SetActiveGameplayEffectLevel(FActiveGameplayEffectHandle ActiveHandle, int32 NewLevel)`使用它已经具有的相同级别进行调用`UAbilitySystemComponent::ActiveGameplayEffects.GetActiveGameplayEffect(ActiveHandle).Spec.GetLevel()`。`Modifiers`当这些支持更新时，基于支持的内容会`Attributes`自动更新`Attributes`。`SetActiveGameplayEffectLevel()`更新的主要功能`Modifiers`是：

```
MarkItemDirty(Effect);
Effect.Spec.CalculateModifierMagnitudes();
// Private function otherwise we'd call these three functions without needing to set the level to what it already is
UpdateAllAggregatorModMagnitudes(Effect);
```



`GameplayEffects`通常不被实例化。当一种能力或`ASC`想要应用 a时`GameplayEffect`，它会[`GameplayEffectSpec`](https://github.com/tranek/GASDocumentation#concepts-ge-spec)从 中创建 a `GameplayEffect's` `ClassDefaultObject`。成功应用`GameplayEffectSpecs`后会被添加到一个名为 的新结构中`FActiveGameplayEffect`，该结构`ASC`在名为 的特殊容器结构中进行跟踪`ActiveGameplayEffects`。



#### 4.5.2 应用游戏效果

`GameplayEffects`可以通过多种方式应用，从 上的函数[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)和 上的函数`ASC`，通常采用 的形式`ApplyGameplayEffectTo`。`UAbilitySystemComponent::ApplyGameplayEffectSpecToSelf()`不同的函数本质上是最终调用`Target`.

要`GameplayEffects`在 a 之外应用`GameplayAbility`，例如从射弹中应用，需要获取`Target's` `ASC`并使用它的函数之一`ApplyGameplayEffectToSelf`。

可以通过绑定到其委托来侦听何时将任何`Duration`或`Infinite` `GameplayEffects`应用于 an ：`ASC`

```
AbilitySystemComponent->OnActiveGameplayEffectAddedDelegateToSelf.AddUObject(this, &APACharacterBase::OnActiveGameplayEffectAddedCallback);
```



回调函数：

```
virtual void OnActiveGameplayEffectAddedCallback(UAbilitySystemComponent* Target, const FGameplayEffectSpec& SpecApplied, FActiveGameplayEffectHandle ActiveHandle);
```



无论复制模式如何，服务器都将始终调用此函数。自治代理只会`GameplayEffects`在复制模式`Full`和`Mixed`复制模式下调用此方法。模拟代理只会在`Full` [复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)下调用此方法。





#### 4.5.3 移除游戏效果

`GameplayEffects`可以通过多种方式从 上的函数[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)和 上的函数中删除`ASC`，通常采用 的形式`RemoveActiveGameplayEffect`。`FActiveGameplayEffectsContainer::RemoveActiveEffects()`不同的函数本质上是最终调用`Target`.

要删除`GameplayEffects`a 之外的内容`GameplayAbility`，需要获取`Target's` `ASC`并使用其函数之一来`RemoveActiveGameplayEffect`。

可以通过绑定到其委托来侦听任何`Duration`或何时`Infinite` `GameplayEffects`从 中删除：`ASC`

```
AbilitySystemComponent->OnAnyGameplayEffectRemovedDelegate().AddUObject(this, &APACharacterBase::OnRemoveGameplayEffectCallback);
```



回调函数：

```
virtual void OnRemoveGameplayEffectCallback(const FActiveGameplayEffect& EffectRemoved);
```



无论复制模式如何，服务器都将始终调用此函数。自治代理只会`GameplayEffects`在复制模式`Full`和`Mixed`复制模式下调用此方法。模拟代理只会在`Full` [复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)下调用此方法。

#### 4.5.4 游戏效果修改器

```
Modifiers`更改和 是[预测性](https://github.com/tranek/GASDocumentation#concepts-p)更改`Attribute`的唯一方法。A可以有零个或多个。每个负责通过指定的操作仅更改一个。`Attribute``GameplayEffect``Modifiers``Modifier``Attribute
```

| 手术       | 描述                                                         |
| ---------- | ------------------------------------------------------------ |
| `Add`      | 将结果添加到`Modifier's`指定的`Attribute`. 使用负值进行减法。 |
| `Multiply` | 将结果乘以`Modifier's`指定的值`Attribute`。                  |
| `Divide`   | 将结果除以`Modifier's`指定的`Attribute`。                    |
| `Override` | 用结果覆盖`Modifier's`指定的值。`Attribute`                  |

an`CurrentValue`的`Attribute`是所有其`Modifiers`添加到其 的聚合结果`BaseValue`。如何聚合的公式在中`Modifiers`定义如下：`FAggregatorModChannel::EvaluateWithBase``GameplayEffectAggregator.cpp`

```
((InlineBaseValue + Additive) * Multiplicitive) / Division
```



任何值`Override` `Modifiers`都会覆盖最终值，最后应用的值`Modifier`优先。

**注意：**对于基于百分比的更改，请确保使用该`Multiply`操作，以便在添加后发生。

**注意：** [预测](https://github.com/tranek/GASDocumentation#concepts-p)在百分比变化方面存在问题。

有四种类型`Modifiers`：可扩展浮点型、基于属性、自定义计算类和由调用者设置。它们都会生成一些浮点值，然后用于根据其操作更改指定`Attribute`的值。`Modifier`

| `Modifier`类型             | 描述                                                         |
| -------------------------- | ------------------------------------------------------------ |
| `Scalable Float`           | `FScalableFloats`是一个可以指向数据表的结构，该数据表的变量为行，级别为列。可扩展浮点将自动读取能力当前级别（或如果覆盖则不同级别[`GameplayEffectSpec`](https://github.com/tranek/GASDocumentation#concepts-ge-spec)）的指定表行的值。该值可以进一步通过系数来操纵。如果未指定数据表/行，则会将该值视为 1，因此该系数可用于在所有级别将其硬编码为单个值。[![可扩展浮动](https://github.com/tranek/GASDocumentation/raw/master/Images/scalablefloats.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/scalablefloats.png) |
| `Attribute Based`          | `Attribute Based` `Modifiers`采取(谁创建了) 或(谁收到了`CurrentValue`)`BaseValue`的支持，并使用系数以及前后系数添加进一步修改它。意味着在创建时捕获支持，而无快照意味着在应用时捕获。`Attribute``Source``GameplayEffectSpec``Target``GameplayEffectSpec``Snapshotting``Attribute``GameplayEffectSpec``Attribute``GameplayEffectSpec` |
| `Custom Calculation Class` | `Custom Calculation Class`为复杂的`Modifiers`. 这`Modifier`需要一个[`ModifierMagnitudeCalculation`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)类，并且可以通过系数以及前后系数加法进一步操作生成的浮点值。 |
| `Set By Caller`            | `SetByCaller` `Modifiers``GameplayEffect`是由能力或`GameplayEffectSpec`在 上创建的人在运行时之外设置的值`GameplayEffectSpec`。例如，`SetByCaller`如果想根据玩家按住按钮来充能技能的时间来设置伤害，则可以使用 a 。`SetByCallers`本质上是`TMap<FGameplayTag, float>`生活在`GameplayEffectSpec`. 只是`Modifier`告诉`Aggregator`寻找`SetByCaller`与所提供的关联的值`GameplayTag`。使用者只能使用该概念的版本`SetByCallers`。此处版本已禁用。如果设置为但正确的不存在`Modifiers``GameplayTag``FName``Modifier``SetByCaller``SetByCaller``GameplayTag``GameplayEffectSpec`，游戏将抛出运行时错误并返回值 0。这可能会导致操作出现问题`Divide`。[`SetByCallers`](https://github.com/tranek/GASDocumentation#concepts-ge-spec-setbycaller)有关如何使用的更多信息，请参阅`SetByCallers`。 |



##### 4.5.4.1 乘法和除法修饰符

默认情况下，所有`Multiply`和`Divide` `Modifiers`都会先相加，然后再将它们相乘或除以`Attribute`s `BaseValue`。

```
float FAggregatorModChannel::EvaluateWithBase(float InlineBaseValue, const FAggregatorEvaluateParameters& Parameters) const
{
	...
	float Additive = SumMods(Mods[EGameplayModOp::Additive], GameplayEffectUtilities::GetModifierBiasByModifierOp(EGameplayModOp::Additive), Parameters);
	float Multiplicitive = SumMods(Mods[EGameplayModOp::Multiplicitive], GameplayEffectUtilities::GetModifierBiasByModifierOp(EGameplayModOp::Multiplicitive), Parameters);
	float Division = SumMods(Mods[EGameplayModOp::Division], GameplayEffectUtilities::GetModifierBiasByModifierOp(EGameplayModOp::Division), Parameters);
	...
	return ((InlineBaseValue + Additive) * Multiplicitive) / Division;
	...
}
```



```
float FAggregatorModChannel::SumMods(const TArray<FAggregatorMod>& InMods, float Bias, const FAggregatorEvaluateParameters& Parameters)
{
	float Sum = Bias;

	for (const FAggregatorMod& Mod : InMods)
	{
		if (Mod.Qualifies())
		{
			Sum += (Mod.EvaluatedMagnitude - Bias);
		}
	}

	return Sum;
}
```



*从`GameplayEffectAggregator.cpp`*

在此公式中和`Multiply`的值`Divide` `Modifiers`均为（有a ）。所以它看起来像：`Bias``1``Addition``Bias``0`

```
1 + (Mod1.Magnitude - 1) + (Mod2.Magnitude - 1) + ...
```



这个公式会导致一些意想不到的结果。首先，该公式将所有修饰符相加，然后将它们相乘或除以`BaseValue`。大多数人会期望它将它们相乘或相除。例如，如果有两个`Multiply`修饰符`1.5`，大多数人会期望`BaseValue`乘以`1.5 x 1.5 = 2.25`。相反，这会将`1.5`s 加在一起以乘以`BaseValue`( `2`) `50% increase + another 50% increase = 100% increase`。这是基础速度的速度增益`GameplayPrediction.h`的示例。再加上一个速度增益就可以了。`10%``500``550``10%``600`

其次，该公式对于可以使用哪些值有一些未记录的规则，因为它是在设计时考虑到 Paragon 的。

`Multiply`乘法`Divide`加法公式的规则：

- `(No more than one value < 1) AND (Any number of values [1, 2))`
- `OR (One value >= 2)`

公式`Bias`中的 基本上减去了范围内数字的整数位`[1, 2)`。第一个`Modifier`'s`Bias`从起始值中减去`Sum`（设置为`Bias`循环之前的值），这就是为什么任何值本身都可以工作以及为什么一个值`< 1`可以与 range 中的数字一起工作`[1, 2)`。

一些例子`Multiply`：
乘数：`0.5`
`1 + (0.5 - 1) = 0.5`，正确

乘数：`0.5, 0.5`
`1 + (0.5 - 1) + (0.5 - 1) = 0`，预期不正确`1`？小于的多个值`1`对于添加乘数没有意义。Paragon 被设计为仅使用 的[最大负值，`Multiply` `Modifiers`](https://github.com/tranek/GASDocumentation#cae-nonstackingge)因此最多只会有一个小于`1`乘以 的值`BaseValue`。

乘数：`1.1, 0.5`
`1 + (0.5 - 1) + (1.1 - 1) = 0.6`，正确

乘数：`5, 5`
`1 + (5 - 1) + (5 - 1) = 9`，预期不正确`10`。永远是`sum of the Modifiers - number of Modifiers + 1`.

许多游戏会希望它们的`Multiply`和`Divide` `Modifiers`在应用于 之前先进行乘法和除法运算`BaseValue`。为此，需要**更改**`FAggregatorModChannel::EvaluateWithBase()`.

```c++
float FAggregatorModChannel::EvaluateWithBase(float InlineBaseValue, const FAggregatorEvaluateParameters& Parameters) const
{
	...
	float Multiplicitive = MultiplyMods(Mods[EGameplayModOp::Multiplicitive], Parameters);
	float Division = MultiplyMods(Mods[EGameplayModOp::Division], Parameters);
	...

	return ((InlineBaseValue + Additive) * Multiplicitive) / Division;
}
```



```c++
float FAggregatorModChannel::MultiplyMods(const TArray<FAggregatorMod>& InMods, const FAggregatorEvaluateParameters& Parameters)
{
	float Multiplier = 1.0f;

	for (const FAggregatorMod& Mod : InMods)
	{
		if (Mod.Qualifies())
		{
			Multiplier *= Mod.EvaluatedMagnitude;
		}
	}

	return Multiplier;
}
```



##### 4.5.4.2 修改器上的游戏标签

```
SourceTags`并且可以为每个[Modifier](https://github.com/tranek/GASDocumentation#concepts-ge-mods)`TargetTags`设置。它们的工作方式与. 因此，仅在应用效果时才考虑标签。即，当具有周期性、无限效果时，仅在第一次应用效果时考虑它们，而*不是*在每次周期性执行时考虑它们。[`Application Tag requirements`](https://github.com/tranek/GASDocumentation#concepts-ge-tags)`GameplayEffect
```

`Attribute Based`修饰符还可以设置`SourceTagFilter`和`TargetTagFilter`。当确定作为修饰符来源的属性的大小时`Attribute Based`，这些过滤器用于排除该属性的某些修饰符。源或目标不具有过滤器所有标签的修饰符将被排除。

详细来说，这意味着：源 ASC 和目标 ASC 的标签由 捕获`GameplayEffects`。创建时会捕获源 ASC 标签`GameplayEffectSpec`，在执行效果时会捕获目标 ASC 标签。当确定无限或持续时间效果的修饰符是否“有资格”应用（即其聚合器有资格）并且设置了那些过滤器时，将捕获的标签与过滤器进行比较。





#### 4.5.5 叠加游戏效果

`GameplayEffects``GameplayEffectSpec`默认情况下，将应用不知道或不关心应用程序先前存在的实例的新实例`GameplayEffectSpec`。`GameplayEffects`可以设置为 stack，其中不是`GameplayEffectSpec`添加新的实例，而是`GameplayEffectSpec's`更改当前现有的堆栈计数。堆叠仅适用于`Duration`和`Infinite` `GameplayEffects`。

有两种类型的堆叠：按源聚合和按目标聚合。

| 堆叠式     | 描述                                                         |
| ---------- | ------------------------------------------------------------ |
| 按来源汇总 | `ASC`目标上的每个源都有一个单独的堆栈实例。每个源可以应用 X 数量的堆栈。 |
| 按目标聚合 | 无论源如何，目标上都只有一个堆栈实例。每个源可以应用一个堆栈，最高可达共享堆栈限制。 |

堆栈还具有过期、持续时间刷新和周期重置的策略。他们在蓝图中有有用的悬停工具提示`GameplayEffect`。

示例项目包含一个自定义蓝图节点，用于侦听`GameplayEffect`堆栈更改。HUD UMG Widget 使用它来更新玩家拥有的被动装甲堆栈数量。这`AsyncTask`将永远存在，直到手动调用`EndTask()`，我们在 UMG Widget 的`Destruct`事件中执行此操作。见`AsyncTaskEffectStackChanged.h/cpp`。

[![监听 GameplayEffect Stack Change BP 节点](https://github.com/tranek/GASDocumentation/raw/master/Images/gestackchange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gestackchange.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.6 授予的能力

`GameplayEffects`可以授予新[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)的`ASCs`. 只有`Duration`和`Infinite` `GameplayEffects`可以授予能力。

一个常见的用例是当你想要强迫其他玩家做一些事情，比如将他们从击退或拉扯中移动时。可以向他们应用`GameplayEffect`，授予他们自动激活能力（请参阅[被动能力](https://github.com/tranek/GASDocumentation#concepts-ga-activating-passive)了解如何在授予能力时自动激活能力），对他们执行所需的操作。

设计者可以选择`GameplayEffect`授予哪些能力、授予能力的级别、[绑定能力的输入](https://github.com/tranek/GASDocumentation#concepts-ga-input)以及授予能力的删除策略。

| 搬迁政策       | 描述                                                         |
| -------------- | ------------------------------------------------------------ |
| 立即取消能力   | `GameplayEffect`当授予的能力从目标中移除时，授予的能力将被立即取消并移除。 |
| 结束时移除能力 | 授予的能力可以完成，然后从目标中删除。                       |
| 没做什么       | `GameplayEffect`授予的能力不会因为从目标中删除授予而受到影响。目标永久具有该能力，直到稍后手动将其移除。 |





#### 4.5.7 游戏效果标签

`GameplayEffects`携带多个[`GameplayTagContainers`](https://github.com/tranek/GASDocumentation#concepts-gt). 设计师将编辑每个类别的`Added`和`Removed` `GameplayTagContainers`，结果将显示在`Combined` `GameplayTagContainer`on 编辑中。`Added`标签是新标签，它`GameplayEffect`添加了其父级以前没有的标签。`Removed`标签是父类有但该子类没有的标签。

| 类别                   | 描述                                                         |
| ---------------------- | ------------------------------------------------------------ |
| 游戏效果资产标签       | 拥有的标签`GameplayEffect`。它们本身不执行任何功能，仅用于描述`GameplayEffect`. |
| 授予标签               | 标签存在于 上`GameplayEffect`，但也赋予 所`ASC`应用`GameplayEffect`的 。`ASC`当被移除时，它们也会被移除`GameplayEffect`。这仅适用于`Duration`和`Infinite` `GameplayEffects`。 |
| 持续的标签要求         | 应用后，这些标签将决定是否`GameplayEffect`打开或关闭。A`GameplayEffect`可以关闭但仍可应用。如果 a`GameplayEffect`由于未满足持续标签要求而关闭，但随后满足要求，则 a`GameplayEffect`将再次打开并重新应用其修改器。这仅适用于`Duration`和`Infinite` `GameplayEffects`。 |
| 应用程序标签要求       | 目标上的标签确定 a 是否`GameplayEffect`可以应用于目标。如果不满足这些要求，则不`GameplayEffect`适用。 |
| 删除带有标签的游戏效果 | `GameplayEffects`成功应用后，目标中包含任何这些标签的目标将被从`Asset Tags`目标`Granted Tags`中删除。`GameplayEffect` |

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.8 抗扰度

```
GameplayEffects``GameplayEffects`可以授予豁免权，有效阻止其他基于 的应用程序[`GameplayTags`](https://github.com/tranek/GASDocumentation#concepts-gt)。虽然免疫可以通过其他方式有效地实现，例如，使用此系统可以提供何时因免疫而被阻止的`Application Tag Requirements`代表。`GameplayEffects``UAbilitySystemComponent::OnImmunityBlockGameplayEffectDelegate
```

`GrantedApplicationImmunityTags`检查源`ASC`（如果有的话，包括来自源能力的标签`AbilityTags`）是否具有任何指定的标签。`GameplayEffects`这是一种根据特定字符或来源的标签提供免疫力的方法。

`Granted Application Immunity Query`检查传入`GameplayEffectSpec`是否与任何查询匹配以阻止或允许其应用程序。

查询在`GameplayEffect`蓝图中具有有用的悬停工具提示。





#### 4.5.9 游戏效果规范

( ) 可以被认为是[`GameplayEffectSpec`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/FGameplayEffectSpec/index.html)的`GESpec`实例化`GameplayEffects`。它们持有对`GameplayEffect`它们所代表的类、它是在什么级别创建的以及谁创建它的引用。这些可以在应用程序之前在运行时自由创建和修改，`GameplayEffects`这与设计人员在运行前创建的不同。当应用 a 时`GameplayEffect`， a`GameplayEffectSpec`是从 a 创建的，`GameplayEffect`这实际上是应用于目标的。

`GameplayEffectSpecs`是通过`GameplayEffects`使用`UAbilitySystemComponent::MakeOutgoingSpec()`which is创建的`BlueprintCallable`。`GameplayEffectSpecs`不必立即应用。通常将 a 传递`GameplayEffectSpec`给由能力创建的射弹，射弹可以将其应用于稍后击中的目标。当`GameplayEffectSpecs`成功应用时，它们返回一个名为 的新结构`FActiveGameplayEffect`。

值得注意的`GameplayEffectSpec`内容：

- `GameplayEffect`这`GameplayEffect`是创建的类。
- 这水平`GameplayEffectSpec`。通常与创建的能力级别相同，`GameplayEffectSpec`但也可以不同。
- 的持续时间`GameplayEffectSpec`。默认为 的持续时间`GameplayEffect`，但可以不同。
- `GameplayEffectSpec`周期效应的周期。默认为 的期间，`GameplayEffect`但可以不同。
- this 的当前堆栈计数`GameplayEffectSpec`。堆栈限制位于`GameplayEffect`.
- 告诉[`GameplayEffectContextHandle`](https://github.com/tranek/GASDocumentation#concepts-ge-context)我们是谁创造了这个`GameplayEffectSpec`。
- `Attributes``GameplayEffectSpec`由于快照而在创建时捕获的。
- `DynamicGrantedTags`除授予`GameplayEffectSpec`目标公司外，还授予目标`GameplayTags`公司`GameplayEffect`。
- `DynamicAssetTags``GameplayEffectSpec`除了该拥有之外，该`AssetTags`还有`GameplayEffect`。
- `SetByCaller` `TMaps`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



##### 4.5.9.1 按调用者设置

```
SetByCallers`允许携带与 a或around`GameplayEffectSpec`相关的浮点值。它们分别存储在各自的:和上。这些可以用作运送漂浮物的普通手段或通用手段。将能力内部生成的数值数据传递到或via是很常见的。`GameplayTag``FName``TMaps``TMap<FGameplayTag, float>``TMap<FName, float>``GameplayEffectSpec``Modifiers``GameplayEffect`[`GameplayEffectExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)[`ModifierMagnitudeCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)`SetByCallers
```

| `SetByCaller`使用 | 笔记                                                         |
| ----------------- | ------------------------------------------------------------ |
| `Modifiers`       | 必须在课堂上提前定义`GameplayEffect`。只能使用`GameplayTag`版本。如果在类上定义了`GameplayEffect`，但`GameplayEffectSpec`没有相应的标记和浮点值对，则游戏在应用 时会出现运行时错误`GameplayEffectSpec`并返回 0。这是操作的潜在问题`Divide`。见[`Modifiers`](https://github.com/tranek/GASDocumentation#concepts-ge-mods)。 |
| 别处              | 不需要在任何地方提前定义。读取 a`SetByCaller`上不存在的 a`GameplayEffectSpec`可以返回开发人员定义的默认值，并带有可选警告。 |

要在蓝图中分配`SetByCaller`值，请使用需要的版本的蓝图节点（`GameplayTag`或`FName`）：

[![分配 SetByCaller](https://github.com/tranek/GASDocumentation/raw/master/Images/setbycaller.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/setbycaller.png)

要读取`SetByCaller`蓝图中的值，需要在蓝图库中创建自定义节点。

要`SetByCaller`在 C++ 中赋值，请使用需要的函数版本（`GameplayTag`或`FName`）：

```
void FGameplayEffectSpec::SetSetByCallerMagnitude(FName DataName, float Magnitude);
```



```
void FGameplayEffectSpec::SetSetByCallerMagnitude(FGameplayTag DataTag, float Magnitude);
```



要读取`SetByCaller`C++ 中的值，请使用需要的函数版本（`GameplayTag`或`FName`）：

```
float GetSetByCallerMagnitude(FName DataName, bool WarnIfNotFound = true, float DefaultIfNotFound = 0.f) const;
```



```
float GetSetByCallerMagnitude(FGameplayTag DataTag, bool WarnIfNotFound = true, float DefaultIfNotFound = 0.f) const;
```



我建议使用该`GameplayTag`版本而不是该`FName`版本。这可以防止蓝图中的拼写错误。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.10 游戏效果上下文

该[`GameplayEffectContext`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/FGameplayEffectContext/index.html)结构保存有关`GameplayEffectSpec's`煽动者和 的信息[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)。[`ModifierMagnitudeCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)这也是一个很好的子类结构，可以在/ [`GameplayEffectExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)、[`AttributeSets`](https://github.com/tranek/GASDocumentation#concepts-as)和 等位置之间传递任意数据[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc)。

子类化`GameplayEffectContext`：

1. 子类`FGameplayEffectContext`
2. 覆盖`FGameplayEffectContext::GetScriptStruct()`
3. 覆盖`FGameplayEffectContext::Duplicate()`
4. `FGameplayEffectContext::NetSerialize()`如果需要复制新数据则覆盖
5. 为的子类实现，就像`TStructOpsTypeTraits`父结构一样`FGameplayEffectContext`
6. `AllocGameplayEffectContext()`在的类中重写[`AbilitySystemGlobals`](https://github.com/tranek/GASDocumentation#concepts-asg)以返回子类的新对象

[GASShooter](https://github.com/tranek/GASShooter)使用一个子类`GameplayEffectContext`来添加`TargetData`可以在 中访问的子类`GameplayCues`，专门用于霰弹枪，因为它可以击中多个敌人。





#### 4.5.11 修正量值计算

[`ModifierMagnitudeCalculations`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UGameplayModMagnitudeCalculation/index.html)(`ModMagCalc`或`MMC`) 是强大的类，[`Modifiers`](https://github.com/tranek/GASDocumentation#concepts-ge-mods)如`GameplayEffects`. 它们的功能与 类似，[`GameplayEffectExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)但功能较弱，最重要的是它们可以[预测](https://github.com/tranek/GASDocumentation#concepts-p)。它们的唯一目的是从 中返回一个浮点值`CalculateBaseMagnitude_Implementation()`。可以在蓝图和 C++ 中子类化并重写此函数。

`MMCs`可以在`GameplayEffects`- `Instant`、`Duration`、`Infinite`、 或的任意持续时间内使用`Periodic`。

```
MMCs'`优势在于他们有能力捕获任意数量的值`Attributes`，并`Source`完全访问和。可以是快照，也可以不是。快照在创建时捕获，而非快照在应用时捕获，并在和更改时自动更新。捕获会根据. 此重新计算不会**在**中运行，因此必须在此处再次进行任何钳位。`Target``GameplayEffect``GameplayEffectSpec``GameplayTags``SetByCallers``Attributes``Attributes``GameplayEffectSpec``Attributes``GameplayEffectSpec``Attribute``Infinite``Duration` `GameplayEffects``Attributes``CurrentValue``ASC`[`PreAttributeChange()`](https://github.com/tranek/GASDocumentation#concepts-as-preattributechange)`AbilitySet
```

| 快照 | 源或目标 | 拍摄于`GameplayEffectSpec` | 当或`Attribute`更改时自动更新`Infinite``Duration` `GE` |
| ---- | -------- | -------------------------- | ------------------------------------------------------ |
| 是的 | 来源     | 创建                       | 不                                                     |
| 是的 | 目标     | 应用                       | 不                                                     |
| 不   | 来源     | 应用                       | 是的                                                   |
| 不   | 目标     | 应用                       | 是的                                                   |

由此产生的浮点数可以通过系数以及前后系数相加`MMC`进一步修改。`GameplayEffect's` `Modifier`

`MMC`捕获`Target's`法力的示例`Attribute`会减少中毒效果，其中减少的量根据法力的数量`Target`和可能具有的标签而变化`Target`：

```
UPAMMC_PoisonMana::UPAMMC_PoisonMana()
{

	//ManaDef defined in header FGameplayEffectAttributeCaptureDefinition ManaDef;
	ManaDef.AttributeToCapture = UPAAttributeSetBase::GetManaAttribute();
	ManaDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Target;
	ManaDef.bSnapshot = false;

	//MaxManaDef defined in header FGameplayEffectAttributeCaptureDefinition MaxManaDef;
	MaxManaDef.AttributeToCapture = UPAAttributeSetBase::GetMaxManaAttribute();
	MaxManaDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Target;
	MaxManaDef.bSnapshot = false;

	RelevantAttributesToCapture.Add(ManaDef);
	RelevantAttributesToCapture.Add(MaxManaDef);
}

float UPAMMC_PoisonMana::CalculateBaseMagnitude_Implementation(const FGameplayEffectSpec & Spec) const
{
	// Gather the tags from the source and target as that can affect which buffs should be used
	const FGameplayTagContainer* SourceTags = Spec.CapturedSourceTags.GetAggregatedTags();
	const FGameplayTagContainer* TargetTags = Spec.CapturedTargetTags.GetAggregatedTags();

	FAggregatorEvaluateParameters EvaluationParameters;
	EvaluationParameters.SourceTags = SourceTags;
	EvaluationParameters.TargetTags = TargetTags;

	float Mana = 0.f;
	GetCapturedAttributeMagnitude(ManaDef, Spec, EvaluationParameters, Mana);
	Mana = FMath::Max<float>(Mana, 0.0f);

	float MaxMana = 0.f;
	GetCapturedAttributeMagnitude(MaxManaDef, Spec, EvaluationParameters, MaxMana);
	MaxMana = FMath::Max<float>(MaxMana, 1.0f); // Avoid divide by zero

	float Reduction = -20.0f;
	if (Mana / MaxMana > 0.5f)
	{
		// Double the effect if the target has more than half their mana
		Reduction *= 2;
	}
	
	if (TargetTags->HasTagExact(FGameplayTag::RequestGameplayTag(FName("Status.WeakToPoisonMana"))))
	{
		// Double the effect if the target is weak to PoisonMana
		Reduction *= 2;
	}
	
	return Reduction;
}
```



如果不在构造函数中添加`FGameplayEffectAttributeCaptureDefinition`to并尝试捕获，将在捕获时收到有关缺少 Spec 的错误。如果不需要捕获，则无需向 中添加任何内容。`RelevantAttributesToCapture``MMC's``Attributes``Attributes``RelevantAttributesToCapture`

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.12 游戏效果执行计算

[`GameplayEffectExecutionCalculations`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UGameplayEffectExecutionCalculat-/index.html)( `ExecutionCalculation`、`Execution`（经常会在插件的源代码中看到这个术语）或`ExecCalc`) 是`GameplayEffects`更改`ASC`. 像 一样[`ModifierMagnitudeCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)，这些可以捕获`Attributes`并选择性地快照它们。与 不同的是`MMCs`，它们可以更改多个`Attribute`，并且基本上可以执行程序员想要的任何其他操作。这种强大功能和灵活性的缺点是它们无法[预测](https://github.com/tranek/GASDocumentation#concepts-p)，并且必须用 C++ 来实现。

`ExecutionCalculations`只能与`Instant`和 一起使用`Periodic` `GameplayEffects`。任何带有“执行”一词的内容通常指的是这两种类型的`GameplayEffects`.

快照捕获创建`Attribute`时间`GameplayEffectSpec`，而非快照捕获应用`Attribute`时间。`GameplayEffectSpec`捕获`Attributes`会`CurrentValue`根据`ASC`. 此重新计算不会**在**[`PreAttributeChange()`](https://github.com/tranek/GASDocumentation#concepts-as-preattributechange)中运行`AbilitySet`，因此必须在此处再次进行任何钳位。

| 快照 | 源或目标 | 拍摄于`GameplayEffectSpec` |
| ---- | -------- | -------------------------- |
| 是的 | 来源     | 创建                       |
| 是的 | 目标     | 应用                       |
| 不   | 来源     | 应用                       |
| 不   | 目标     | 应用                       |

为了设置`Attribute`捕获，我们遵循 Epic 的 ActionRPG 示例项目设置的模式，定义一个结构体，保存并定义我们如何捕获`Attributes`并在该结构的构造函数中创建它的一个副本。对于每个 ，都会有一个这样的结构`ExecCalc`。**注意：**每个结构体都需要一个唯一的名称，因为它们共享相同的命名空间。对结构使用相同的名称将导致捕获错误的行为`Attributes`（主要是捕获错误的值`Attributes`）。

对于`Local Predicted`、`Server Only`、 和`Server Initiated` [`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)，`ExecCalc`仅对服务器进行调用。

基于从`Source`和上的许多属性读取的复杂公式来计算受到的伤害`Target`是最常见的示例`ExecCalc`。包含的示例项目有一个简单的`ExecCalc`计算伤害的方法，它可以从 中读取伤害值`GameplayEffectSpec's` [`SetByCaller`](https://github.com/tranek/GASDocumentation#concepts-ge-spec-setbycaller)，然后根据`Attribute`从 中捕获的护甲来减轻该值`Target`。见`GDDamageExecCalculation.cpp/.h`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



##### 4.5.12.1 发送数据执行计算

`ExecutionCalculation`除了捕获之外，还有几种方法可以将数据发送到`Attributes`。



###### 4.5.12.1.1 通过调用者设置

上的任何[`SetByCallers`设置`GameplayEffectSpec`](https://github.com/tranek/GASDocumentation#concepts-ge-spec-setbycaller)都可以直接在 中读取`ExecutionCalculation`。

```
const FGameplayEffectSpec& Spec = ExecutionParams.GetOwningSpec();
float Damage = FMath::Max<float>(Spec.GetSetByCallerMagnitude(FGameplayTag::RequestGameplayTag(FName("Data.Damage")), false, -1.0f), 0.0f);
```





###### 4.5.12.1.2 支持数据属性计算修饰符

如果想将值硬编码到 a `GameplayEffect`，可以使用 a 来传递它们`CalculationModifier`，该 a 使用捕获的数据之一`Attributes`作为支持数据。

在此屏幕截图示例中，我们将 50 添加到捕获的 Damage 中`Attribute`。还可以将其设置`Override`为仅接受硬编码值。

[![支持数据属性计算修饰符](https://github.com/tranek/GASDocumentation/raw/master/Images/calculationmodifierbackingdataattribute.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/calculationmodifierbackingdataattribute.png)

`ExecutionCalculation`当它捕获 时读取该值`Attribute`。

```
float Damage = 0.0f;
// Capture optional damage value set on the damage GE as a CalculationModifier under the ExecutionCalculation
ExecutionParams.AttemptCalculateCapturedAttributeMagnitude(DamageStatics().DamageDef, EvaluationParameters, Damage);
```





###### 4.5.12.1.3 支持数据临时变量计算修饰符

如果想将值硬编码到 a `GameplayEffect`，可以使用 a 来传递它们，而`CalculationModifier`a 使用 a`Temporary Variable`或`Transient Aggregator`C++ 中的调用方式。与`Temporary Variable`相关联`GameplayTag`。

在此屏幕截图示例中，我们`Temporary Variable`使用`Data.Damage` `GameplayTag`.

[![支持数据临时变量计算修改器](https://github.com/tranek/GASDocumentation/raw/master/Images/calculationmodifierbackingdatatempvariable.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/calculationmodifierbackingdatatempvariable.png)

添加支持`Temporary Variables`到的`ExecutionCalculation`构造函数：

```
ValidTransientAggregatorIdentifiers.AddTag(FGameplayTag::RequestGameplayTag("Data.Damage"));
```



`ExecutionCalculation`使用与捕获函数类似的特殊捕获函数读取该值`Attribute`。

```
float Damage = 0.0f;
ExecutionParams.AttemptCalculateTransientAggregatorMagnitude(FGameplayTag::RequestGameplayTag("Data.Damage"), EvaluationParameters, Damage);
```





###### 4.5.12.1.4 游戏效果上下文

[可以通过上的](https://github.com/tranek/GASDocumentation#concepts-ge-context)`ExecutionCalculation`自定义将数据发送到。[`GameplayEffectContext``GameplayEffectSpec`](https://github.com/tranek/GASDocumentation#concepts-ge-context)

在 中，`ExecutionCalculation`可以`EffectContext`从 访问`FGameplayEffectCustomExecutionParameters`。

```
const FGameplayEffectSpec& Spec = ExecutionParams.GetOwningSpec();
FGSGameplayEffectContext* ContextHandle = static_cast<FGSGameplayEffectContext*>(Spec.GetContext().Get());
```



如果需要更改`GameplayEffectSpec`或 上的某些内容`EffectContext`：

```
FGameplayEffectSpec* MutableSpec = ExecutionParams.GetOwningSpecForPreExecuteMod();
FGSGameplayEffectContext* ContextHandle = static_cast<FGSGameplayEffectContext*>(MutableSpec->GetContext().Get());
```



`GameplayEffectSpec`如果修改中的，请小心`ExecutionCalculation`。请参阅 的评论`GetOwningSpecForPreExecuteMod()`。

```
/** Non const access. Be careful with this, especially when modifying a spec after attribute capture. */
FGameplayEffectSpec* GetOwningSpecForPreExecuteMod() const;
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.13 定制应用要求

[`CustomApplicationRequirement`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UGameplayEffectCustomApplication-/index.html)( `CAR`) 类为设计者提供了对是否`GameplayEffect`可以应用 a 的高级控制，而不是`GameplayTag`对`GameplayEffect`. 这些可以在 Blueprint 中通过重写来实现`CanApplyGameplayEffect()`，在 C++ 中可以通过重写来实现`CanApplyGameplayEffect_Implementation()`。

何时使用的示例`CARs`：

- `Target`需要有一定数量的`Attribute`
- `Target`需要有一定数量的堆栈`GameplayEffect`

`CARs`还可以执行更高级的操作，例如检查此实例是否`GameplayEffect`已存在`Target`并[更改现有实例的持续时间](https://github.com/tranek/GASDocumentation#concepts-ge-duration)，而不是应用新实例（返回 false `CanApplyGameplayEffect()`）。





#### 4.5.14 成本玩法效果

[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)有一个`GameplayEffect`专门设计用作该能力成本的可选选项。成本是指需要多少资金`Attribute`才能`ASC`激活`GameplayAbility`。如果`GA`无法负担`Cost GE`，那么他们将无法激活。这`Cost GE`应该是`Instant` `GameplayEffect`一个或多个`Modifiers`从 中减去的结果`Attributes`。默认情况下，`Cost GEs`意味着可以预测，建议保持该功能，即不使用`ExecutionCalculations`。`MMCs`对于复杂的成本计算是完全可以接受和鼓励的。

刚开始时，很可能会拥有一个独特的、需要付费的`Cost GE`产品。`GA`一种更高级的技术是将一个重用`Cost GE`为多个，并且仅使用特定数据`GAs`修改`GameplayEffectSpec`从创建的数据（成本值在 上定义）。**这仅适用于****能力。**`Cost GE``GA``GA`**`Instanced`**

重用的两种技术`Cost GE`：

1. **使用`MMC`.** 这是最简单的方法。创建一个[`MMC`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)从实例读取成本值的`GameplayAbility`实例，可以从`GameplayEffectSpec`.

```
float UPGMMC_HeroAbilityCost::CalculateBaseMagnitude_Implementation(const FGameplayEffectSpec & Spec) const
{
	const UPGGameplayAbility* Ability = Cast<UPGGameplayAbility>(Spec.GetContext().GetAbilityInstance_NotReplicated());

	if (!Ability)
	{
		return 0.0f;
	}

	return Ability->Cost.GetValueAtLevel(Ability->GetAbilityLevel());
}
```



在此示例中，成本值是我添加到其中的子类的`FScalableFloat`成本值。`GameplayAbility`

```
UPROPERTY(BlueprintReadOnly, EditAnywhere, Category = "Cost")
FScalableFloat Cost;
```



[![成本GE与MMC](https://github.com/tranek/GASDocumentation/raw/master/Images/costmmc.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/costmmc.png)

1. **覆盖`UGameplayAbility::GetCostGameplayEffect()`。**重写此函数并[在运行时](https://github.com/tranek/GASDocumentation#concepts-ge-dynamic)[创建一个`GameplayEffect`](https://github.com/tranek/GASDocumentation#concepts-ge-dynamic)读取`GameplayAbility`.

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.15 冷却游戏效果

[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)有一个`GameplayEffect`专门设计用作技能冷却时间的选项。冷却时间决定了激活后多长时间可以再次激活该能力。如果 a`GA`仍处于冷却状态，则无法激活。这`Cooldown GE`应该是（“ ”）中`Duration` `GameplayEffect`没有`Modifiers`且唯一的`GameplayTag`每个`GameplayAbility`能力槽位（如果的游戏具有分配给共享冷却时间的槽位的可互换能力）。实际上检查的是 的存在而不是 的存在。默认情况下，意味着可以预测，建议保持该功能，即不使用。对于复杂的冷却时间计算来说是完全可以接受和鼓励的。`GameplayEffect's` `GrantedTags``Cooldown Tag``GA``Cooldown Tag``Cooldown GE``Cooldown GEs``ExecutionCalculations``MMCs`

刚开始时，很可能会拥有一个具有冷却时间的独特`Cooldown GE`物品。`GA`一种更先进的技术是将一个重用`Cooldown GE`为多个，并且只需使用特定数据（冷却时间和冷却时间在 上定义）来`GAs`修改创建的。**这仅适用于****能力。**`GameplayEffectSpec``Cooldown GE``GA``Cooldown Tag``GA`**`Instanced`**

重用的两种技术`Cooldown GE`：

1. **使用一个[`SetByCaller`](https://github.com/tranek/GASDocumentation#concepts-ge-spec-setbycaller).** 这是最简单的方法。将共享的持续时间设置`Cooldown GE`为。在的子类上，定义一个 float /表示持续时间， a表示 unique ，以及一个临时变量，我们将用作 our和标签联合的返回指针。`SetByCaller``GameplayTag``GameplayAbility``FScalableFloat``FGameplayTagContainer``Cooldown Tag``FGameplayTagContainer``Cooldown Tag``Cooldown GE's`

```
UPROPERTY(BlueprintReadOnly, EditAnywhere, Category = "Cooldown")
FScalableFloat CooldownDuration;

UPROPERTY(BlueprintReadOnly, EditAnywhere, Category = "Cooldown")
FGameplayTagContainer CooldownTags;

// Temp container that we will return the pointer to in GetCooldownTags().
// This will be a union of our CooldownTags and the Cooldown GE's cooldown tags.
UPROPERTY(Transient)
FGameplayTagContainer TempCooldownTags;
```



然后覆盖以返回我们和任何现有标签`UGameplayAbility::GetCooldownTags()`的并集。`Cooldown Tags``Cooldown GE's`

```
const FGameplayTagContainer * UPGGameplayAbility::GetCooldownTags() const
{
	FGameplayTagContainer* MutableTags = const_cast<FGameplayTagContainer*>(&TempCooldownTags);
	MutableTags->Reset(); // MutableTags writes to the TempCooldownTags on the CDO so clear it in case the ability cooldown tags change (moved to a different slot)
	const FGameplayTagContainer* ParentTags = Super::GetCooldownTags();
	if (ParentTags)
	{
		MutableTags->AppendTags(*ParentTags);
	}
	MutableTags->AppendTags(CooldownTags);
	return MutableTags;
}
```



最后，重写`UGameplayAbility::ApplyCooldown()`以注入 our`Cooldown Tags`并将 the 添加`SetByCaller`到cooldown 中`GameplayEffectSpec`。

```
void UPGGameplayAbility::ApplyCooldown(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo * ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const
{
	UGameplayEffect* CooldownGE = GetCooldownGameplayEffect();
	if (CooldownGE)
	{
		FGameplayEffectSpecHandle SpecHandle = MakeOutgoingGameplayEffectSpec(CooldownGE->GetClass(), GetAbilityLevel());
		SpecHandle.Data.Get()->DynamicGrantedTags.AppendTags(CooldownTags);
		SpecHandle.Data.Get()->SetSetByCallerMagnitude(FGameplayTag::RequestGameplayTag(FName(  OurSetByCallerTag  )), CooldownDuration.GetValueAtLevel(GetAbilityLevel()));
		ApplyGameplayEffectSpecToOwner(Handle, ActorInfo, ActivationInfo, SpecHandle);
	}
}
```



在此图中，冷却时间`Modifier`设置`SetByCaller`为。将在上面的代码中。`Data Tag``Data.Cooldown``Data.Cooldown``OurSetByCallerTag`

[![使用 SetByCaller 进行冷却 GE](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownsbc.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownsbc.png)

1. **使用[`MMC`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc).** 除了将和 中`SetByCaller`的持续时间设置为 之外，其设置与上面相同。相反，将持续时间设置为 a并指向我们将制作的新内容。`Cooldown GE``ApplyCooldown``Custom Calculation Class``MMC`

```
UPROPERTY(BlueprintReadOnly, EditAnywhere, Category = "Cooldown")
FScalableFloat CooldownDuration;

UPROPERTY(BlueprintReadOnly, EditAnywhere, Category = "Cooldown")
FGameplayTagContainer CooldownTags;

// Temp container that we will return the pointer to in GetCooldownTags().
// This will be a union of our CooldownTags and the Cooldown GE's cooldown tags.
UPROPERTY(Transient)
FGameplayTagContainer TempCooldownTags;
```



然后覆盖以返回我们和任何现有标签`UGameplayAbility::GetCooldownTags()`的并集。`Cooldown Tags``Cooldown GE's`

```
const FGameplayTagContainer * UPGGameplayAbility::GetCooldownTags() const
{
	FGameplayTagContainer* MutableTags = const_cast<FGameplayTagContainer*>(&TempCooldownTags);
	MutableTags->Reset(); // MutableTags writes to the TempCooldownTags on the CDO so clear it in case the ability cooldown tags change (moved to a different slot)
	const FGameplayTagContainer* ParentTags = Super::GetCooldownTags();
	if (ParentTags)
	{
		MutableTags->AppendTags(*ParentTags);
	}
	MutableTags->AppendTags(CooldownTags);
	return MutableTags;
}
```



最后，重写`UGameplayAbility::ApplyCooldown()`将我们的注入`Cooldown Tags`到cooldown中`GameplayEffectSpec`。

```
void UPGGameplayAbility::ApplyCooldown(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo * ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo) const
{
	UGameplayEffect* CooldownGE = GetCooldownGameplayEffect();
	if (CooldownGE)
	{
		FGameplayEffectSpecHandle SpecHandle = MakeOutgoingGameplayEffectSpec(CooldownGE->GetClass(), GetAbilityLevel());
		SpecHandle.Data.Get()->DynamicGrantedTags.AppendTags(CooldownTags);
		ApplyGameplayEffectSpecToOwner(Handle, ActorInfo, ActivationInfo, SpecHandle);
	}
}
```



```
float UPGMMC_HeroAbilityCooldown::CalculateBaseMagnitude_Implementation(const FGameplayEffectSpec & Spec) const
{
	const UPGGameplayAbility* Ability = Cast<UPGGameplayAbility>(Spec.GetContext().GetAbilityInstance_NotReplicated());

	if (!Ability)
	{
		return 0.0f;
	}

	return Ability->CooldownDuration.GetValueAtLevel(Ability->GetAbilityLevel());
}
```



[![带 MMC 的冷却 GE](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownmmc.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownmmc.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



##### 4.5.15.1 获取游戏冷却效果的剩余时间

```
bool APGPlayerState::GetCooldownRemainingForTag(FGameplayTagContainer CooldownTags, float & TimeRemaining, float & CooldownDuration)
{
	if (AbilitySystemComponent && CooldownTags.Num() > 0)
	{
		TimeRemaining = 0.f;
		CooldownDuration = 0.f;

		FGameplayEffectQuery const Query = FGameplayEffectQuery::MakeQuery_MatchAnyOwningTags(CooldownTags);
		TArray< TPair<float, float> > DurationAndTimeRemaining = AbilitySystemComponent->GetActiveEffectsTimeRemainingAndDuration(Query);
		if (DurationAndTimeRemaining.Num() > 0)
		{
			int32 BestIdx = 0;
			float LongestTime = DurationAndTimeRemaining[0].Key;
			for (int32 Idx = 1; Idx < DurationAndTimeRemaining.Num(); ++Idx)
			{
				if (DurationAndTimeRemaining[Idx].Key > LongestTime)
				{
					LongestTime = DurationAndTimeRemaining[Idx].Key;
					BestIdx = Idx;
				}
			}

			TimeRemaining = DurationAndTimeRemaining[BestIdx].Key;
			CooldownDuration = DurationAndTimeRemaining[BestIdx].Value;

			return true;
		}
	}

	return false;
}
```



**注意：**查询客户端的剩余冷却时间需要客户端能够接收复制的`GameplayEffects`. 这将取决于它们的`ASC's` [复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)。



##### 4.5.15.2 监听冷却开始和结束

要侦听冷却时间何时开始，可以`Cooldown GE`通过绑定到 来响应应用 的时间`AbilitySystemComponent->OnActiveGameplayEffectAddedDelegateToSelf`，或者`Cooldown Tag`通过绑定到 来响应添加的时间`AbilitySystemComponent->RegisterGameplayTagEvent(CooldownTag, EGameplayTagEventType::NewOrRemoved)`。我建议监听何时`Cooldown GE`添加，因为还可以访问`GameplayEffectSpec`应用它的。由此可以确定是`Cooldown GE`本地预测的还是服务器校正的。

要侦听冷却时间何时结束，可以`Cooldown GE`通过绑定到 来响应 何时被删除，或者通过绑定到 来响应`AbilitySystemComponent->OnAnyGameplayEffectRemovedDelegate()`何时被删除。我建议监听何时被删除，因为当服务器更正进来时，它将删除我们本地预测的一个，导致即使我们仍处于冷却状态，也会引发火灾。在删除预测和应用服务器更正的过程中，该值不会改变。`Cooldown Tag``AbilitySystemComponent->RegisterGameplayTagEvent(CooldownTag, EGameplayTagEventType::NewOrRemoved)``Cooldown Tag``Cooldown GE``OnAnyGameplayEffectRemovedDelegate()``Cooldown Tag``Cooldown GE``Cooldown GE`

**注意：**在客户端上侦听`GameplayEffect`要添加或删除的 要求它们可以接收复制的`GameplayEffects`. 这将取决于它们的`ASC's` [复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)。

示例项目包括一个自定义蓝图节点，用于侦听冷却时间的开始和结束。HUD UMG Widget 使用它来更新流星冷却的剩余时间。这`AsyncTask`将永远存在，直到手动调用`EndTask()`，我们在 UMG Widget 的`Destruct`事件中执行此操作。见[`AsyncTaskCooldownChanged.h/cpp`](https://github.com/tranek/GASDocumentation/blob/master/Source/GASDocumentation/Private/Characters/Abilities/AsyncTaskCooldownChanged.cpp)。

[![监听冷却变化BP节点](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownchange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownchange.png)



##### 4.5.15.3 预测冷却时间

目前无法真正预测冷却时间。`Cooldown GE`当应用本地预测时，我们可以启动 UI 冷却计时器，但`GameplayAbility's`实际冷却时间与服务器的冷却时间剩余时间相关。根据玩家的延迟，本地预测的冷却时间可能会到期，但`GameplayAbility`服务器上仍处于冷却状态，这将阻止`GameplayAbility's`立即重新激活，直到服务器的冷却时间到期。

示例项目通过在本地预测的冷却时间开始时使流星能力的 UI 图标变灰，然后在服务器纠正后启动冷却计时器来处理此问题`Cooldown GE`。

这样做的一个游戏结果是，高延迟的玩家在短冷却能力上的射速比低延迟的玩家低，这使他们处于劣势。Fortnite 通过他们的武器具有不使用冷却时间的自定义簿记来避免这种情况`GameplayEffects`。

[Epic 希望有一天在GAS 的未来迭代](https://github.com/tranek/GASDocumentation#concepts-p-future)中实现真正的预测冷却时间（`GameplayAbility`当本地冷却时间到期但服务器仍处于冷却时间时，玩家可以激活冷却时间）。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.16 更改活动游戏效果持续时间

`Cooldown GE`要更改 a或 any的剩余时间`Duration` `GameplayEffect`，我们需要更改`GameplayEffectSpec's` `Duration`、更新其`StartServerWorldTime`、更新其`CachedStartServerWorldTime`、更新其`StartWorldTime`，然后重新运行对持续时间的检查`CheckDuration()`。在服务器上执行此操作并标记为`FActiveGameplayEffect`脏会将更改复制到客户端。 **注意：**这确实涉及`const_cast`并且可能不是 Epic 改变持续时间的预期方式，但到目前为止似乎效果很好。

```
bool UPAAbilitySystemComponent::SetGameplayEffectDurationHandle(FActiveGameplayEffectHandle Handle, float NewDuration)
{
	if (!Handle.IsValid())
	{
		return false;
	}

	const FActiveGameplayEffect* ActiveGameplayEffect = GetActiveGameplayEffect(Handle);
	if (!ActiveGameplayEffect)
	{
		return false;
	}

	FActiveGameplayEffect* AGE = const_cast<FActiveGameplayEffect*>(ActiveGameplayEffect);
	if (NewDuration > 0)
	{
		AGE->Spec.Duration = NewDuration;
	}
	else
	{
		AGE->Spec.Duration = 0.01f;
	}

	AGE->StartServerWorldTime = ActiveGameplayEffects.GetServerWorldTime();
	AGE->CachedStartServerWorldTime = AGE->StartServerWorldTime;
	AGE->StartWorldTime = ActiveGameplayEffects.GetWorldTime();
	ActiveGameplayEffects.MarkItemDirty(*AGE);
	ActiveGameplayEffects.CheckDuration(Handle);

	AGE->EventSet.OnTimeChanged.Broadcast(AGE->Handle, AGE->StartWorldTime, AGE->GetDuration());
	OnGameplayEffectDurationChange(*AGE);

	return true;
}
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.5.17 在运行时创建动态游戏效果

在运行时创建动态`GameplayEffects`是一个高级主题。不必经常这样做。

在 C++ 中只能`Instant` `GameplayEffects`在运行时从头开始创建。`Duration`并且`Infinite` `GameplayEffects`无法在运行时动态创建，因为当它们复制时，它们会查找`GameplayEffect`不存在的类定义。要实现此功能，应该`GameplayEffect`像通常在编辑器中那样创建一个原型类。然后根据`GameplayEffectSpec`运行时所需的内容自定义实例。

`Instant` `GameplayEffects`[在运行时创建的也可以从本地预测](https://github.com/tranek/GASDocumentation#concepts-p) 中调用`GameplayAbility`。然而，目前尚不清楚动态创建是否会产生副作用。

##### 例子

示例项目创建了一个当角色受到致命一击时将金币和经验值发送回给角色的杀手`AttributeSet`。

```
// Create a dynamic instant Gameplay Effect to give the bounties
UGameplayEffect* GEBounty = NewObject<UGameplayEffect>(GetTransientPackage(), FName(TEXT("Bounty")));
GEBounty->DurationPolicy = EGameplayEffectDurationType::Instant;

int32 Idx = GEBounty->Modifiers.Num();
GEBounty->Modifiers.SetNum(Idx + 2);

FGameplayModifierInfo& InfoXP = GEBounty->Modifiers[Idx];
InfoXP.ModifierMagnitude = FScalableFloat(GetXPBounty());
InfoXP.ModifierOp = EGameplayModOp::Additive;
InfoXP.Attribute = UGDAttributeSetBase::GetXPAttribute();

FGameplayModifierInfo& InfoGold = GEBounty->Modifiers[Idx + 1];
InfoGold.ModifierMagnitude = FScalableFloat(GetGoldBounty());
InfoGold.ModifierOp = EGameplayModOp::Additive;
InfoGold.Attribute = UGDAttributeSetBase::GetGoldAttribute();

Source->ApplyGameplayEffectToSelf(GEBounty, 1.0f, Source->MakeEffectContext());
```



`GameplayEffect`第二个示例显示了在本地预测中创建的运行时`GameplayAbility`。使用风险自负（请参阅代码中的注释）！

```
UGameplayAbilityRuntimeGE::UGameplayAbilityRuntimeGE()
{
	NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;
}

void UGameplayAbilityRuntimeGE::ActivateAbility(const FGameplayAbilitySpecHandle Handle, const FGameplayAbilityActorInfo* ActorInfo, const FGameplayAbilityActivationInfo ActivationInfo, const FGameplayEventData* TriggerEventData)
{
	if (HasAuthorityOrPredictionKey(ActorInfo, &ActivationInfo))
	{
		if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
		{
			EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
		}

		// Create the GE at runtime.
		UGameplayEffect* GameplayEffect = NewObject<UGameplayEffect>(GetTransientPackage(), TEXT("RuntimeInstantGE"));
		GameplayEffect->DurationPolicy = EGameplayEffectDurationType::Instant; // Only instant works with runtime GE.

		// Add a simple scalable float modifier, which overrides MyAttribute with 42.
		// In real world applications, consume information passed via TriggerEventData.
		const int32 Idx = GameplayEffect->Modifiers.Num();
		GameplayEffect->Modifiers.SetNum(Idx + 1);
		FGameplayModifierInfo& ModifierInfo = GameplayEffect->Modifiers[Idx];
		ModifierInfo.Attribute.SetUProperty(UMyAttributeSet::GetMyModifiedAttribute());
		ModifierInfo.ModifierMagnitude = FScalableFloat(42.f);
		ModifierInfo.ModifierOp = EGameplayModOp::Override;

		// Apply the GE.

		// Create the GESpec here to avoid the behavior of ASC to create GESpecs from the GE class default object.
		// Since we have a dynamic GE here, this would create a GESpec with the base GameplayEffect class, so we
		// would lose our modifiers. Attention: It is unknown, if this "hack" done here can have drawbacks!
		// The spec prevents the GE object being collected by the GarbageCollector, since the GE is a UPROPERTY on the spec.
		FGameplayEffectSpec* GESpec = new FGameplayEffectSpec(GameplayEffect, {}, 0.f); // "new", since lifetime is managed by a shared ptr within the handle
		ApplyGameplayEffectSpecToOwner(Handle, ActorInfo, ActivationInfo, FGameplayEffectSpecHandle(GESpec));
	}
	EndAbility(Handle, ActorInfo, ActivationInfo, false, false);
}
```







#### 4.5.18 游戏效果容器

Epic 的[Action RPG 示例项目](https://www.unrealengine.com/marketplace/en-US/product/action-rpg)实现了一个名为`FGameplayEffectContainer`. 这些不在普通 GAS 中，但非常方便地容纳`GameplayEffects`和[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)。它自动执行一些工作，例如`GameplayEffectSpecs`从其. 在 a 中制作 a并将其传递给生成的射弹非常简单且直接。我选择不在包含的示例项目中实现，以展示在普通 GAS 中没有它们时如何工作，但我强烈建议研究它们并考虑将它们添加到的项目中。`GameplayEffects``GameplayEffectContext``GameplayEffectContainer``GameplayAbility``GameplayEffectContainers`

要访问 的`GESpecs`内部`GameplayEffectContainers`以执行添加等操作`SetByCallers`，请中断`FGameplayEffectContainer`并`GESpec`通过其在 数组中的索引访问引用`GESpecs`。这要求提前知道`GESpec`要访问的索引。

[![带有 GameplayEffectContainer 的 SetByCaller](https://github.com/tranek/GASDocumentation/raw/master/Images/gecontainersetbycaller.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gecontainersetbycaller.png)

`GameplayEffectContainers`[还包含可选的高效瞄准](https://github.com/tranek/GASDocumentation#concepts-targeting-containers)手段。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.6 游戏能力



#### 4.6.1 游戏能力定义

[`GameplayAbilities`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/UGameplayAbility/index.html)( `GA`) 是`Actor`游戏中可以执行的任何动作或技能。多个人`GameplayAbility`可以同时处于活动状态，例如冲刺和开枪。这些可以用蓝图或 C++ 制作。

示例`GameplayAbilities`：

- 跳跃
- 短跑
- 开枪
- 每 X 秒被动阻止一次攻击
- 使用药水
- 打开一扇门
- 收集资源
- 建造一座建筑物

不应该执行的事情`GameplayAbilities`：

- 基本动作输入
- 与 UI 的一些交互 - 不要使用 a`GameplayAbility`从商店购买商品。

这些不是规则，只是我的建议。的设计和实现可能会有所不同。

`GameplayAbilities`带有默认功能，具有修改属性更改量或更改`GameplayAbility's`功能的级别。

`GameplayAbilities`在拥有的客户端和/或服务器上运行，具体取决于[`Net Execution Policy`](https://github.com/tranek/GASDocumentation#concepts-ga-net)但不是模拟代理。确定`Net Execution Policy`a 是否`GameplayAbility`将被本地[预测](https://github.com/tranek/GASDocumentation#concepts-p)。[它们包括可选成本和冷却时间`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ga-commit)的默认行为。`GameplayAbilities`用于[`AbilityTasks`](https://github.com/tranek/GASDocumentation#concepts-at)随着时间的推移发生的动作，例如等待事件、等待属性更改、等待玩家选择目标或`Character`移动`Root Motion Source`。**模拟客户端将无法运行`GameplayAbilities`**。相反，当服务器运行该功能时，任何视觉上需要在模拟代理上播放的内容（例如动画蒙太奇）都将通过声音和粒子等装饰性内容进行复制`AbilityTasks`或RPC。[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc)

所有功能`GameplayAbilities`都将`ActivateAbility()`被的游戏逻辑覆盖。可以添加额外的逻辑，以便在完成或取消`EndAbility()`时运行。`GameplayAbility`

一个简单的流程图`GameplayAbility`： [![简单的游戏能力流程图](https://github.com/tranek/GASDocumentation/raw/master/Images/abilityflowchartsimple.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/abilityflowchartsimple.png)

更复杂的流程图`GameplayAbility`： [![复杂的游戏能力流程图](https://github.com/tranek/GASDocumentation/raw/master/Images/abilityflowchartcomplex.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/abilityflowchartcomplex.png)

`GameplayAbilities`复杂的能力可以通过多个相互交互（激活、取消等）来实现。



##### 4.6.1.1 复制策略

不要使用此选项。该名称具有误导性，不需要它。[`GameplayAbilitySpecs`](https://github.com/tranek/GASDocumentation#concepts-ga-spec)默认情况下从服务器复制到所属客户端。如上所述，**`GameplayAbilities`不要在模拟代理上运行**。他们使用`AbilityTasks`和`GameplayCues`来复制或 RPC 视觉变化到模拟代理。Epic 的 Dave Ratti 表示他希望[将来删除此选项](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)。



##### 4.6.1.2 服务器尊重远程能力取消

这个选项常常会带来麻烦。这意味着如果客户端`GameplayAbility`由于取消或自然完成而结束，它将强制服务器版本结束，无论它是否完成。后一个问题很重要，特别是对于`GameplayAbilities`高延迟玩家使用的本地预测。通常会想要禁用此选项。



##### 4.6.1.3 直接复制输入

设置此选项将始终将输入按下和释放事件复制到服务器。如果将[输入](https://github.com/tranek/GASDocumentation#concepts-ga-input)`Generic Replicated Events`绑定到.[`AbilityTasks`](https://github.com/tranek/GASDocumentation#concepts-at)[`ASC`](https://github.com/tranek/GASDocumentation#concepts-ga-input)

史诗评论：

```
/** Direct Input state replication. These will be called if bReplicateInputDirectly is true on the ability and is generally not a good thing to use. (Instead, prefer to use Generic Replicated Events). */
UAbilitySystemComponent::ServerSetInputPressed()
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.2 将输入绑定到 ASC

允许`ASC`直接将输入操作绑定到它，并`GameplayAbilities`在授予这些输入时将其分配给它们。如果满足要求，分配的输入操作将在按下时`GameplayAbilities`自动激活。需要分配的输入操作才能使用响应输入的内置函数。`GameplayAbilities``GameplayTag``AbilityTasks`

除了分配给 activate 的输入操作之外`GameplayAbilities`，`ASC`还接受通用输入`Confirm`和`Cancel`输入。这些特殊输入用于`AbilityTasks`确认[`Target Actors`](https://github.com/tranek/GASDocumentation#concepts-targeting-actors)或取消等操作。

要将输入绑定到`ASC`，必须首先创建一个将输入操作名称转换为字节的枚举。枚举名称必须与项目设置中用于输入操作的名称完全匹配。没关系`DisplayName`。

来自示例项目：

```
UENUM(BlueprintType)
enum class EGDAbilityInputID : uint8
{
	// 0 None
	None			UMETA(DisplayName = "None"),
	// 1 Confirm
	Confirm			UMETA(DisplayName = "Confirm"),
	// 2 Cancel
	Cancel			UMETA(DisplayName = "Cancel"),
	// 3 LMB
	Ability1		UMETA(DisplayName = "Ability1"),
	// 4 RMB
	Ability2		UMETA(DisplayName = "Ability2"),
	// 5 Q
	Ability3		UMETA(DisplayName = "Ability3"),
	// 6 E
	Ability4		UMETA(DisplayName = "Ability4"),
	// 7 R
	Ability5		UMETA(DisplayName = "Ability5"),
	// 8 Sprint
	Sprint			UMETA(DisplayName = "Sprint"),
	// 9 Jump
	Jump			UMETA(DisplayName = "Jump")
};
```



如果`ASC`住在 上`Character`，则`SetupPlayerInputComponent()`包含用于绑定到 的函数`ASC`：

```
// Bind to AbilitySystemComponent
FTopLevelAssetPath AbilityEnumAssetPath = FTopLevelAssetPath(FName("/Script/GASDocumentation"), FName("EGDAbilityInputID"));
AbilitySystemComponent->BindAbilityActivationToInputComponent(PlayerInputComponent, FGameplayAbilityInputBinds(FString("ConfirmTarget"),
	FString("CancelTarget"), AbilityEnumAssetPath, static_cast<int32>(EGDAbilityInputID::Confirm), static_cast<int32>(EGDAbilityInputID::Cancel)));
```



如果`ASC`生活在 上`PlayerState`，则内部可能存在潜在的竞争条件`SetupPlayerInputComponent()`，其中`PlayerState`可能尚未复制到客户端。因此，我建议尝试绑定到`SetupPlayerInputComponent()`和中的输入`OnRep_PlayerState()`。`OnRep_PlayerState()`本身是不够的，因为在告诉客户端`Actor's` `InputComponent`调用创建. 示例项目演示了尝试通过布尔门控过程在两个位置进行绑定，因此它实际上只绑定输入一次。`PlayerState``PlayerController``ClientRestart()``InputComponent`

**注意：**在示例项目`Confirm`和`Cancel`枚举中，项目设置（`ConfirmTarget`和`CancelTarget`）中的输入操作名称不匹配，但我们在 中提供了它们之间的映射`BindAbilityActivationToInputComponent()`。这些很特殊，因为我们提供映射并且它们不必匹配，但它们可以匹配。枚举中的所有其他输入必须与项目设置中的输入操作名称匹配。

因为`GameplayAbilities`它只会被一个输入激活（它们总是像 MOBA 一样存在于同一个“槽”中），我更喜欢向我的`UGameplayAbility`子类添加一个变量，我可以在其中定义它们的输入。`ClassDefaultObject`然后我可以在授予该能力时阅读此内容。



##### 4.6.2.1 绑定输入而不激活能力

如果不希望`GameplayAbilities`在按下输入时自动激活，但仍将它们绑定到输入以与 一起使用`AbilityTasks`，则可以向的`UGameplayAbility`子类添加一个新的 bool 变量`bActivateOnInput`，该变量默认为`true`并覆盖`UAbilitySystemComponent::AbilityLocalInputPressed()`。

```
void UGSAbilitySystemComponent::AbilityLocalInputPressed(int32 InputID)
{
	// Consume the input if this InputID is overloaded with GenericConfirm/Cancel and the GenericConfim/Cancel callback is bound
	if (IsGenericConfirmInputBound(InputID))
	{
		LocalInputConfirm();
		return;
	}

	if (IsGenericCancelInputBound(InputID))
	{
		LocalInputCancel();
		return;
	}

	// ---------------------------------------------------------

	ABILITYLIST_SCOPE_LOCK();
	for (FGameplayAbilitySpec& Spec : ActivatableAbilities.Items)
	{
		if (Spec.InputID == InputID)
		{
			if (Spec.Ability)
			{
				Spec.InputPressed = true;
				if (Spec.IsActive())
				{
					if (Spec.Ability->bReplicateInputDirectly && IsOwnerActorAuthoritative() == false)
					{
						ServerSetInputPressed(Spec.Handle);
					}

					AbilitySpecInputPressed(Spec);

					// Invoke the InputPressed event. This is not replicated here. If someone is listening, they may replicate the InputPressed event to the server.
					InvokeReplicatedEvent(EAbilityGenericReplicatedEvent::InputPressed, Spec.Handle, Spec.ActivationInfo.GetActivationPredictionKey());
				}
				else
				{
					UGSGameplayAbility* GA = Cast<UGSGameplayAbility>(Spec.Ability);
					if (GA && GA->bActivateOnInput)
					{
						// Ability is not active, so try to activate it
						TryActivateAbility(Spec.Handle);
					}
				}
			}
		}
	}
}
```







#### 4.6.3 赋予能力

授予 a`GameplayAbility`将`ASC`其添加到满足[要求的](https://github.com/tranek/GASDocumentation#concepts-ga-tags)情况下允许其随意激活`ASC's`的列表中。`ActivatableAbilities``GameplayAbility`[`GameplayTag`](https://github.com/tranek/GASDocumentation#concepts-ga-tags)

我们`GameplayAbilities`在服务器上授予权限，然后服务器会自动将其复制[`GameplayAbilitySpec`](https://github.com/tranek/GASDocumentation#concepts-ga-spec)到拥有的客户端。其他客户端/模拟代理不会收到`GameplayAbilitySpec`.

示例项目在游戏开始时读取并授予的类`TArray<TSubclassOf<UGDGameplayAbility>>`上存储 a ：`Character`

```
void AGDCharacterBase::AddCharacterAbilities()
{
	// Grant abilities, but only on the server	
	if (Role != ROLE_Authority || !AbilitySystemComponent.IsValid() || AbilitySystemComponent->bCharacterAbilitiesGiven)
	{
		return;
	}

	for (TSubclassOf<UGDGameplayAbility>& StartupAbility : CharacterAbilities)
	{
		AbilitySystemComponent->GiveAbility(
			FGameplayAbilitySpec(StartupAbility, GetAbilityLevel(StartupAbility.GetDefaultObject()->AbilityID), static_cast<int32>(StartupAbility.GetDefaultObject()->AbilityInputID), this));
	}

	AbilitySystemComponent->bCharacterAbilitiesGiven = true;
}
```



当授予这些 时`GameplayAbilities`，我们`GameplayAbilitySpecs`使用`UGameplayAbility`类、能力级别、它所绑定的输入以及将其赋予this 的`SourceObject`人或谁来创建。`GameplayAbility``ASC`

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.4 激活能力

如果a`GameplayAbility`被分配了一个输入动作，当按下输入并且满足其`GameplayTag`要求时，它将自动激活。这可能并不总是激活`GameplayAbility`. 它`ASC`提供了另外四种激活方法`GameplayAbilities`：通过`GameplayTag`、`GameplayAbility`类、`GameplayAbilitySpec`句柄和通过事件。激活`GameplayAbility`by 事件允许[随事件传入数据负载](https://github.com/tranek/GASDocumentation#concepts-ga-data)。

```
UFUNCTION(BlueprintCallable, Category = "Abilities")
bool TryActivateAbilitiesByTag(const FGameplayTagContainer& GameplayTagContainer, bool bAllowRemoteActivation = true);

UFUNCTION(BlueprintCallable, Category = "Abilities")
bool TryActivateAbilityByClass(TSubclassOf<UGameplayAbility> InAbilityToActivate, bool bAllowRemoteActivation = true);

bool TryActivateAbility(FGameplayAbilitySpecHandle AbilityToActivate, bool bAllowRemoteActivation = true);

bool TriggerAbilityFromGameplayEvent(FGameplayAbilitySpecHandle AbilityToTrigger, FGameplayAbilityActorInfo* ActorInfo, FGameplayTag Tag, const FGameplayEventData* Payload, UAbilitySystemComponent& Component);

FGameplayAbilitySpecHandle GiveAbilityAndActivateOnce(const FGameplayAbilitySpec& AbilitySpec, const FGameplayEventData* GameplayEventData);
```



要激活`GameplayAbility`事件，`GameplayAbility`必须`Triggers`在`GameplayAbility`. 分配 a`GameplayTag`并为 选取一个选项`GameplayEvent`。要发送事件，请使用函数`UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(AActor* Actor, FGameplayTag EventTag, FGameplayEventData Payload)`。激活`GameplayAbility`by 事件允许传入带有数据的有效负载。

`GameplayAbility` `Triggers``GameplayAbility`还允许在添加或删除时激活`GameplayTag`。

**注意：**在蓝图中激活`GameplayAbility`from 事件时，必须使用该`ActivateAbilityFromEvent`节点，并且标准`ActivateAbility`节点**不能存在**于的图中。如果该`ActivateAbility`节点存在，则始终会通过该节点调用它`ActivateAbilityFromEvent`。

**注意：**不要忘记`EndAbility()`在`GameplayAbility`应该终止时调用，除非你有一个`GameplayAbility`总是像被动能力一样运行的能力。

**局部预测** 的激活序列`GameplayAbilities`：

1. **拥有客户**来电`TryActivateAbility()`
2. 通话`InternalTryActivateAbility()`
3. 调用`CanActivateAbility()`并返回是否`GameplayTag`满足要求、是否`ASC`能够承受成本、是否`GameplayAbility`处于冷却状态以及当前没有其他实例处于活动状态
4. 调用`CallServerTryActivateAbility()`并传递它`Prediction Key`生成的
5. 通话`CallActivateAbility()`
6. Calls `PreActivate()`Epic 将此称为“样板初始化内容”
7. 最终调用`ActivateAbility()`激活能力

**服务器**接收`CallServerTryActivateAbility()`

1. 通话`ServerTryActivateAbility()`
2. 通话`InternalServerTryActivateAbility()`
3. 通话`InternalTryActivateAbility()`
4. 调用`CanActivateAbility()`并返回是否`GameplayTag`满足要求、是否`ASC`能够承受成本、是否`GameplayAbility`处于冷却状态以及当前没有其他实例处于活动状态
5. 如果成功则调用`ClientActivateAbilitySucceed()`，告诉它更新其`ActivationInfo`激活已由服务器确认并广播委托`OnConfirmDelegate`。这与输入确认不同。
6. 通话`CallActivateAbility()`
7. Calls `PreActivate()`Epic 将此称为“样板初始化内容”
8. 最终调用`ActivateAbility()`激活能力

如果服务器在任何时候无法激活，它将调用`ClientActivateAbilityFailed()`，立即终止客户端`GameplayAbility`并撤消任何预测的更改。



##### 4.6.4.1 被动技能

要实现`GameplayAbilities`自动激活并连续运行的被动，请覆盖在授予 a 并设置并调用`UGameplayAbility::OnAvatarSet()`时自动调用的。`GameplayAbility``AvatarActor``TryActivateAbility()`

我建议将 a 添加`bool`到的自定义`UGameplayAbility`类中，指定`GameplayAbility`授予时是否应激活。示例项目这样做是因为其被动装甲堆叠能力。

被动`GameplayAbilities`通常有[`Net Execution Policy`](https://github.com/tranek/GASDocumentation#concepts-ga-net)一个`Server Only`。

```
void UGDGameplayAbility::OnAvatarSet(const FGameplayAbilityActorInfo * ActorInfo, const FGameplayAbilitySpec & Spec)
{
	Super::OnAvatarSet(ActorInfo, Spec);

	if (bActivateAbilityOnGranted)
	{
		ActorInfo->AbilitySystemComponent->TryActivateAbility(Spec.Handle, false);
	}
}
```



Epic 将此功能描述为启动被动能力和执行`BeginPlay`类型操作的正确位置。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



##### 4.6.4.2 激活失败标签

技能有默认逻辑来告诉技能激活失败的原因。要启用此功能，必须设置与默认失败情况相对应的 GameplayTags。

将这些标签（或自己的命名约定）添加到的项目中：

```
+GameplayTagList=(Tag="Activation.Fail.BlockedByTags",DevComment="")
+GameplayTagList=(Tag="Activation.Fail.CantAffordCost",DevComment="")
+GameplayTagList=(Tag="Activation.Fail.IsDead",DevComment="")
+GameplayTagList=(Tag="Activation.Fail.MissingTags",DevComment="")
+GameplayTagList=(Tag="Activation.Fail.Networking",DevComment="")
+GameplayTagList=(Tag="Activation.Fail.OnCooldown",DevComment="")
```



然后将它们添加到[`GASDocumentation\Config\DefaultGame.ini`](https://github.com/tranek/GASDocumentation/blob/master/Config/DefaultGame.ini#L8-L13)：

```
[/Script/GameplayAbilities.AbilitySystemGlobals]
ActivateFailIsDeadName=Activation.Fail.IsDead
ActivateFailCooldownName=Activation.Fail.OnCooldown
ActivateFailCostName=Activation.Fail.CantAffordCost
ActivateFailTagsBlockedName=Activation.Fail.BlockedByTags
ActivateFailTagsMissingName=Activation.Fail.MissingTags
ActivateFailNetworkingName=Activation.Fail.Networking
```



现在，每当能力激活失败时，相应的 GameplayTag 将包含在输出日志消息中或在 HUD 上可见`showdebug AbilitySystem`。

```
LogAbilitySystem: Display: InternalServerTryActivateAbility. Rejecting ClientActivation of Default__GA_FireGun_C. InternalTryActivateAbility failed: Activation.Fail.BlockedByTags
LogAbilitySystem: Display: ClientActivateAbilityFailed_Implementation. PredictionKey :109 Ability: Default__GA_FireGun_C
```



[![showdebug 能力系统中显示激活失败标签](https://github.com/tranek/GASDocumentation/raw/master/Images/activationfailedtags.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/activationfailedtags.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.5 取消能力

`GameplayAbility`要从内部取消 a ，可以调用`CancelAbility()`。这将调用`EndAbility()`并将其`WasCancelled`参数设置为 true。

要从外部取消`GameplayAbility`，`ASC`提供了一些功能：

```
/** Cancels the specified ability CDO. */
void CancelAbility(UGameplayAbility* Ability);	

/** Cancels the ability indicated by passed in spec handle. If handle is not found among reactivated abilities nothing happens. */
void CancelAbilityHandle(const FGameplayAbilitySpecHandle& AbilityHandle);

/** Cancel all abilities with the specified tags. Will not cancel the Ignore instance */
void CancelAbilities(const FGameplayTagContainer* WithTags=nullptr, const FGameplayTagContainer* WithoutTags=nullptr, UGameplayAbility* Ignore=nullptr);

/** Cancels all abilities regardless of tags. Will not cancel the ignore instance */
void CancelAllAbilities(UGameplayAbility* Ignore=nullptr);

/** Cancels all abilities and kills any remaining instanced abilities */
virtual void DestroyActiveState();
```



**注意：**我发现`CancelAllAbilities`如果有`Non-Instanced` `GameplayAbilities`. 似乎撞到了`Non-Instanced` `GameplayAbility`就放弃了。`CancelAbilities`可以`Non-Instanced` `GameplayAbilities`更好地处理，这就是示例项目使用的（Jump 是非实例`GameplayAbility`）。你的旅费可能会改变。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.6 获得主动能力

初学者经常会问“如何获得主动能力？” 也许可以在其上设置变量或取消它。`GameplayAbility`一次可以有多个激活，因此不存在一种“激活能力”。相反，必须搜索（假设拥有）`ASC's`列表并找到与正在查找的[或](https://github.com/tranek/GASDocumentation#concepts-ga-tags)匹配的列表。`ActivatableAbilities``GameplayAbilities``ASC`[`Asset``Granted` `GameplayTag`](https://github.com/tranek/GASDocumentation#concepts-ga-tags)

`UAbilitySystemComponent::GetActivatableAbilities()`返回 a`TArray<FGameplayAbilitySpec>`供迭代。

还有`ASC`另一个辅助函数，它接受 a`GameplayTagContainer`作为参数来协助搜索，而不是手动迭代 的列表`GameplayAbilitySpecs`。该`bOnlyAbilitiesThatSatisfyTagRequirements`参数只会返回`GameplayAbilitySpecs`满足其`GameplayTag`要求并且可以立即激活的参数。例如，可以进行两种基本攻击`GameplayAbilities`，一种使用武器，一种使用赤手空拳，并且根据是否配备武器设置要求来激活正确的攻击`GameplayTag`。有关更多信息，请参阅 Epic 对该功能的评论。

```
UAbilitySystemComponent::GetActivatableGameplayAbilitySpecsByAllMatchingTags(const FGameplayTagContainer& GameplayTagContainer, TArray < struct FGameplayAbilitySpec* >& MatchingGameplayAbilities, bool bOnlyAbilitiesThatSatisfyTagRequirements = true)
```



一旦你得到了`FGameplayAbilitySpec`你正在寻找的东西，你就可以调用`IsActive()`它。





#### 4.6.7 实例化策略

A`GameplayAbility's` `Instancing Policy`决定激活时是否`GameplayAbility`实例化以及如何实例化。

| `Instancing Policy` | 描述                                                         | 何时使用的示例                                               |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 每个演员实例化      | 每个`ASC`实例只有一个`GameplayAbility`在激活之间重复使用的实例。 | 这可能是`Instancing Policy`最常用的。可以将其用于任何能力，并在激活之间提供持久性。设计者负责在需要它的激活之间手动重置任何变量。 |
| 每次执行实例化      | 每次`GameplayAbility`激活 a 时，`GameplayAbility`都会创建 a 的新实例。 | 这样做的好处`GameplayAbilities`是每次激活时变量都会重置。这些提供的性能更差，因为它们每次激活时`Instanced Per Actor`都会产生新的。`GameplayAbilities`示例项目不使用其中任何一个。 |
| 非实例化            | 其`GameplayAbility`运行于其`ClassDefaultObject`. 没有创建任何实例。 | 这是三者中性能最好的，但它的用途也是最受限制的。`Non-Instanced` `GameplayAbilities`无法存储状态，这意味着没有动态变量，也没有绑定到`AbilityTask`委托。使用它们的最佳位置是经常使用的简单能力，例如 MOBA 或 RTS 中的小兵基本攻击。示例项目的跳转`GameplayAbility`是`Non-Instanced`。 |





#### 4.6.8 网络执行策略

A`GameplayAbility's` `Net Execution Policy`决定谁运行`GameplayAbility`以及运行顺序。

| `Net Execution Policy` | 描述                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `Local Only`           | 仅在拥有的客户端上运行`GameplayAbility`。这对于仅进行局部外观更改的能力可能很有用。单人游戏应该使用`Server Only`. |
| `Local Predicted`      | `Local Predicted` `GameplayAbilities`首先在拥有的客户端上激活，然后在服务器上激活。服务器的版本将纠正客户端错误预测的任何内容。请参阅[预测](https://github.com/tranek/GASDocumentation#concepts-p)。 |
| `Server Only`          | 仅`GameplayAbility`在服务器上运行。被动`GameplayAbilities`通常是`Server Only`。单人游戏应该使用这个。 |
| `Server Initiated`     | `Server Initiated` `GameplayAbilities`首先在服务器上激活，然后在拥有的客户端上激活。我个人并没有使用过这些（如果有的话）。 |

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.9 能力标签

`GameplayAbilities`带有`GameplayTagContainers`内置逻辑。这些都没有`GameplayTags`被复制。

| `GameplayTag Container`     | 描述                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `Ability Tags`              | `GameplayTags`拥有的`GameplayAbility`。这些只是`GameplayTags`为了描述`GameplayAbility`。 |
| `Cancel Abilities with Tag` | 当激活此功能时，其他`GameplayAbilities`包含这些的内容`GameplayTags`将`Ability Tags`被取消。`GameplayAbility` |
| `Block Abilities with Tag`  | 当此功能处于活动状态时，其他`GameplayAbilities`具有这些功能的`GameplayTags`设备`Ability Tags`将被阻止激活`GameplayAbility`。 |
| `Activation Owned Tags`     | 当此功能处于活动状态时，这些`GameplayTags`将提供给所有者。请记住，这些内容不会被复制。`GameplayAbility's``GameplayAbility` |
| `Activation Required Tags`  | **只有拥有者拥有所有**这些`GameplayAbility`才能激活此功能。`GameplayTags` |
| `Activation Blocked Tags`   | `GameplayAbility`如果所有者拥有其中**任何一个**，则无法激活此功能`GameplayTags`。 |
| `Source Required Tags`      | 只有具备**所有**这些`GameplayAbility`才能激活此功能。仅当由事件触发时才设置。`Source``GameplayTags``Source` `GameplayTags``GameplayAbility` |
| `Source Blocked Tags`       | 如果有其中**任何一个**`GameplayAbility`，则无法激活此功能。仅当由事件触发时才设置。`Source``GameplayTags``Source` `GameplayTags``GameplayAbility` |
| `Target Required Tags`      | 只有具备**所有**这些`GameplayAbility`才能激活此功能。仅当由事件触发时才设置。`Target``GameplayTags``Target` `GameplayTags``GameplayAbility` |
| `Target Blocked Tags`       | 如果有其中**任何一个**`GameplayAbility`，则无法激活此功能。仅当由事件触发时才设置。`Target``GameplayTags``Target` `GameplayTags``GameplayAbility` |

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.10 游戏能力规格

A`GameplayAbilitySpec`存在于`ASC`a`GameplayAbility`被授予之后，并定义可激活的`GameplayAbility`-`GameplayAbility`类、级别、输入绑定和运行时状态，这些状态必须与类分开`GameplayAbility`。

当在服务器上授予 a 时`GameplayAbility`，服务器会将其复制`GameplayAbilitySpec`到拥有它的客户端，以便她可以激活它。

激活 a`GameplayAbilitySpec`将创建一个实例（或不创建`Non-Instanced` `GameplayAbilities`），具体`GameplayAbility`取决于其`Instancing Policy`。





#### 4.6.11 将数据传递给能力

的一般范例`GameplayAbilities`是`Activate->Generate Data->Apply->End`. 有时需要根据现有数据采取行动。GAS 提供了一些将外部数据导入的选项`GameplayAbilities`：

| 方法                                    | 描述                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| `GameplayAbility`按事件激活             | `GameplayAbility`使用包含数据负载的事件激活。事件的有效负载从客户端复制到服务器以进行本地预测`GameplayAbilities`。将两个`Optional Object`或两个[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)变量用于不适合任何现有变量的任意数据。这样做的缺点是它会阻止通过输入绑定激活该功能。要激活`GameplayAbility`事件，`GameplayAbility`必须`Triggers`在`GameplayAbility`. 分配 a`GameplayTag`并为 选取一个选项`GameplayEvent`。要发送事件，请使用函数`UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(AActor* Actor, FGameplayTag EventTag, FGameplayEventData Payload)`。 |
| 使用`WaitGameplayEvent` `AbilityTask`   | 使用 来`WaitGameplayEvent` `AbilityTask`告诉`GameplayAbility`激活后监听带有负载数据的事件。事件负载和发送它的过程与通过事件激活相同`GameplayAbilities`。这样做的缺点是事件不会由 复制，`AbilityTask`并且只能用于`Local Only`和`Server Only` `GameplayAbilities`。可能可以编写自己的`AbilityTask`来复制事件负载。 |
| 使用`TargetData`                        | 自定义`TargetData`结构是在客户端和服务器之间传递任意数据的好方法。 |
| 将数据存储在`OwnerActor`或`AvatarActor` | 使用存储在`OwnerActor`、`AvatarActor`或可以获得引用的任何其他对象上的复制变量。此方法最灵活，可`GameplayAbilities`与输入绑定激活一起使用。但是，它不保证数据在使用时会从复制同步。必须提前确保这一点 - 这意味着如果设置复制变量然后立即激活，`GameplayAbility`则无法保证由于潜在的数据包丢失而在接收器上发生的顺序。 |





#### 4.6.12 技能消耗和冷却时间

`GameplayAbilities`具有可选成本和冷却时间的功能。成本是为了激活带有( ) 的实施`Attributes`而必须具有的预定义金额。冷却时间是计时器，可防止 a 重新激活，直至其过期，并通过( )实现。`ASC``GameplayAbility``Instant` `GameplayEffect`[`Cost GE`](https://github.com/tranek/GASDocumentation#concepts-ge-cost)`GameplayAbility``Duration` `GameplayEffect`[`Cooldown GE`](https://github.com/tranek/GASDocumentation#concepts-ge-cooldown)

`GameplayAbility`在调用之前`UGameplayAbility::Activate()`，它会调用`UGameplayAbility::CanActivateAbility()`。该函数检查拥有者是否`ASC`能够承受成本 ( `UGameplayAbility::CheckCost()`) 并确保其`GameplayAbility`不处于冷却状态 ( `UGameplayAbility::CheckCooldown()`)。

```
GameplayAbility`在调用之后，它可以选择使用which 调用和`Activate()`随时提交成本和冷却时间。如果不应该同时提交，设计者可以选择单独调用或单独调用。再次进行成本和冷却呼叫，这是与它们相关的失败的最后机会。激活后，所有权可能会发生变化，无法满足提交时的成本。如果[预测密钥](https://github.com/tranek/GASDocumentation#concepts-p-key)在提交时有效，则可以[在本地预测](https://github.com/tranek/GASDocumentation#concepts-p)提交成本和冷却时间。`UGameplayAbility::CommitAbility()``UGameplayAbility::CommitCost()``UGameplayAbility::CommitCooldown()``CommitCost()``CommitCooldown()``CheckCost()``CheckCooldown()``GameplayAbility``ASC's` `Attributes``GameplayAbility
```

请参阅[`CostGE`](https://github.com/tranek/GASDocumentation#concepts-ge-cost)和[`CooldownGE`](https://github.com/tranek/GASDocumentation#concepts-ge-cooldown)了解实施细节。





#### 4.6.13 能力升级

提升能力的常用方法有两种：

| 升级方法                        | 描述                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| 新级别的取消授予和重新授予      | `GameplayAbility`从服务器上取消授予（删除）`ASC`并在下一个级别将其重新授予。`GameplayAbility`如果当时处于活动状态，这将终止。 |
| 提高`GameplayAbilitySpec's`等级 | 在服务器上，找到`GameplayAbilitySpec`，增加其级别，并将其标记为脏，以便复制到所属客户端。`GameplayAbility`如果该方法当时处于活动状态，则该方法不会终止。 |

两种方法的主要区别在于是否希望`GameplayAbilities`在升级时取消活动。很可能会使用这两种方法，具体取决于的`GameplayAbilities`. `bool`我建议在的子类中添加 a来`UGameplayAbility`指定要使用的方法。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.14 能力集

`GameplayAbilitySets`是用于`UDataAsset`保存输入绑定和角色启动列表的便利类，`GameplayAbilities`具有授予`GameplayAbilities`. 子类还可以包含额外的逻辑或属性。Paragon 有一个`GameplayAbilitySet`每个英雄，其中包括他们所给予的所有`GameplayAbilities`。

我发现这门课是不必要的，至少从我到目前为止所看到的来看是这样。`GameplayAbilitySets`示例项目处理 及其子类内部的所有功能`GDCharacterBase`。





#### 4.6.15 能力批量

传统的`Gameplay Ability`生命周期涉及从客户端到服务器的至少两到三个 RPC。

1. `CallServerTryActivateAbility()`
2. `ServerSetReplicatedTargetData()`（选修的）
3. `ServerEndAbility()`

如果`GameplayAbility`在一帧中的一个原子分组中执行所有这些操作，我们可以优化此工作流程，将所有两个或三个 RPC 批处理（组合）到一个 RPC 中。`GAS`将此 RPC 优化称为`Ability Batching`。何时使用的常见示例`Ability Batching`是命中扫描枪。命中扫描枪激活，进行线路跟踪，将其发送[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)到服务器，并在一帧中的一个原子组中结束该能力。GASShooter示例项目演示了这种[用于](https://github.com/tranek/GASShooter)其命中扫描枪的技术。

半自动枪是最好的情况，并将`CallServerTryActivateAbility()`, `ServerSetReplicatedTargetData()`（子弹击中结果）, 和 分批`ServerEndAbility()`放入一个 RPC，而不是三个 RPC。

全自动/连发枪批量`CallServerTryActivateAbility()`并将`ServerSetReplicatedTargetData()`第一颗子弹放入一个 RPC，而不是两个 RPC。每个后续项目符号都是其自己的`ServerSetReplicatedTargetData()`RPC。最后，`ServerEndAbility()`当枪停止射击时，作为单独的 RPC 发送。这是最坏的情况，我们只在第一个项目符号上保存一个 RPC，而不是两个。这种情况也可以通过激活该功能来实现，[`Gameplay Event`](https://github.com/tranek/GASDocumentation#concepts-ga-data)该功能会将子弹从客户端发送`TargetData`到`EventPayload`服务器。后一种方法的缺点是必须`TargetData`在功能外部生成，而批处理方法则在`TargetData`功能内部生成。

`Ability Batching`默认情况下在 上处于禁用状态[`ASC`](https://github.com/tranek/GASDocumentation#concepts-asc)。要启用`Ability Batching`，请覆盖`ShouldDoServerAbilityRPCBatch()`以返回 true：

```
virtual bool ShouldDoServerAbilityRPCBatch() const override { return true; }
```



现在`Ability Batching`已启用，在激活想要批量处理的能力之前，必须`FScopedServerAbilityRPCBatcher`事先创建一个结构体。这个特殊的结构将尝试在其范围内批处理其后的任何能力。一旦`FScopedServerAbilityRPCBatcher`超出范围，任何激活的能力都不会尝试批量。`FScopedServerAbilityRPCBatcher`其工作原理是在每个可批处理的函数中包含特殊代码，拦截发送 RPC 的调用，并将消息打包到批处理结构中。当`FScopedServerAbilityRPCBatcher`超出范围时，它会自动将此批处理结构 RPC 到`UAbilitySystemComponent::EndServerAbilityRPCBatch()`. 服务器接收批量 RPC `UAbilitySystemComponent::ServerAbilityRPCBatch_Internal(FServerAbilityRPCBatch& BatchInfo)`。该`BatchInfo`参数将包含该能力是否应该结束以及在激活时是否按下了输入的标志，以及`TargetData`如果包括在内的话。这是一个很好的函数，可以设置断点来确认批处理是否正常工作。或者，使用 cvar`AbilitySystem.ServerRPCBatching.Log 1`启用特殊功能批处理日志记录。

这种机制只能在 C++ 中完成，并且只能通过它们来激活能力`FGameplayAbilitySpecHandle`。

```
bool UGSAbilitySystemComponent::BatchRPCTryActivateAbility(FGameplayAbilitySpecHandle InAbilityHandle, bool EndAbilityImmediately)
{
	bool AbilityActivated = false;
	if (InAbilityHandle.IsValid())
	{
		FScopedServerAbilityRPCBatcher GSAbilityRPCBatcher(this, InAbilityHandle);
		AbilityActivated = TryActivateAbility(InAbilityHandle, true);

		if (EndAbilityImmediately)
		{
			FGameplayAbilitySpec* AbilitySpec = FindAbilitySpecFromHandle(InAbilityHandle);
			if (AbilitySpec)
			{
				UGSGameplayAbility* GSAbility = Cast<UGSGameplayAbility>(AbilitySpec->GetPrimaryInstance());
				GSAbility->ExternalEndAbility();
			}
		}

		return AbilityActivated;
	}

	return AbilityActivated;
}
```



`GameplayAbility`GASShooter对从不直接调用的半自动和全自动枪支重复使用相同的批次`EndAbility()`（它由仅本地能力在能力之外处理，该能力管理玩家输入以及基于当前开火模式对批次能力的调用）。由于所有的 RPC 都必须在 的范围内发生`FScopedServerAbilityRPCBatcher`，因此我提供了`EndAbilityImmediately`参数，以便控制/管理本地只能指定此功能是否应该批量调用`EndAbility()`（半自动），或者不批量调用`EndAbility()`（全自动） ）并且该`EndAbility()`调用稍后将在其自己的 RPC 中发生。

GASShooter 公开了一个蓝图节点以允许批处理能力，上述仅限本地的能力使用该能力来触发批处理能力。

[![激活批量能力](https://github.com/tranek/GASDocumentation/raw/master/Images/batchabilityactivate.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/batchabilityactivate.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.6.16 网络安全策略

A`GameplayAbility`决定`NetSecurityPolicy`了一项能力应该在网络上执行的位置。它可以防止客户端尝试执行受限功能。

| `NetSecurityPolicy`     | 描述                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `ClientOrServer`        | 无安全要求。客户端或服务器可以自由触发该能力的执行和终止。   |
| `ServerOnlyExecution`   | 请求执行此功能的客户端将被服务器忽略。客户端仍然可以请求服务器取消或终止此能力。 |
| `ServerOnlyTermination` | 客户端请求取消或结束此能力将被服务器忽略。客户仍然可以请求执行该功能。 |
| `ServerOnly`            | 服务器控制该能力的执行和终止。客户端提出的任何请求都将被忽略。 |

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.7 能力任务



### 4.7.1 能力任务定义

`GameplayAbilities`只在一帧中执行。这本身并没有提供太多的灵活性。为了执行随时间推移发生的操作或需要响应稍后某个时间点触发的委托，我们使用称为 的潜在操作`AbilityTasks`。

GAS 具有许多`AbilityTasks`开箱即用的功能：

- 移动角色的任务`RootMotionSource`
- 播放动画蒙太奇的任务
- 响应`Attribute`变化的任务
- 响应`GameplayEffect`变化的任务
- 响应玩家输入的任务
- 和更多

构造函数强制执行硬编码的游戏范围内同时运行的`UAbilityTask`最大并发数为 1000 。在设计可以同时拥有数百个角色（例如 RTS 游戏）的游戏`AbilityTasks`时，请记住这一点。`GameplayAbilities`

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.7.2 自定义能力任务

通常会创建自己的自定义`AbilityTasks`（用 C++）。示例项目附带两个自定义`AbilityTasks`：

1. `PlayMontageAndWaitForEvent``PlayMontageAndWait`是默认值和的组合`WaitGameplayEvent` `AbilityTasks`。`AnimNotifies`这允许动画蒙太奇将游戏事件从后面发送到`GameplayAbility`启动它们的地方。使用它可以在动画蒙太奇期间的特定时间触发动作。
2. `WaitReceiveDamage`监听是否`OwnerActor`受到伤害。`GameplayAbility`当英雄受到伤害时，被动护甲堆叠会移除一层护甲。

`AbilityTasks`组成：

- 创建新实例的静态函数`AbilityTask`
- `AbilityTask`当完成其目的时广播的代表
- `Activate()`启动其主要工作、绑定到外部委托等的函数。
- 用于清理的函数`OnDestroy()`，包括它绑定到的外部委托
- 绑定到的任何外部委托的回调函数
- 成员变量和任何内部辅助函数

**注意：** `AbilityTasks`只能声明一种类型的输出委托。所有输出委托都必须属于此类型，无论它们是否使用参数。传递未使用的委托参数的默认值。

```
AbilityTasks`仅在运行拥有的客户端或服务器上运行`GameplayAbility`；但是，可以通过在构造函数中设置、覆盖并设置要复制的任何成员变量来将其设置`AbilityTasks`为在模拟客户端上运行。这仅在极少数情况下有用，例如运动，不想复制每个运动变化而是模拟整个运动。皆作此事。参见示例。`bSimulatedTask = true;``AbilityTask``virtual void InitSimulatedTask(UGameplayTasksComponent& InGameplayTasksComponent);``AbilityTasks``AbilityTask``RootMotionSource` `AbilityTasks``AbilityTask_MoveToLocation.h/.cpp
AbilityTasks`如果在构造函数中`Tick`设置并覆盖，则可以。当需要跨帧平滑地对值进行 lerp 时，这非常有用。参见示例。`bTickingTask = true;``AbilityTask``virtual void TickTask(float DeltaTime);``AbilityTask_MoveToLocation.h/.cpp
```





### 4.7.3 使用能力任务

`AbilityTask`要在 C++ 中创建并激活（来自`GDGA_FireGun.cpp`）：

```
UGDAT_PlayMontageAndWaitForEvent* Task = UGDAT_PlayMontageAndWaitForEvent::PlayMontageAndWaitForEvent(this, NAME_None, MontageToPlay, FGameplayTagContainer(), 1.0f, NAME_None, false, 1.0f);
Task->OnBlendOut.AddDynamic(this, &UGDGA_FireGun::OnCompleted);
Task->OnCompleted.AddDynamic(this, &UGDGA_FireGun::OnCompleted);
Task->OnInterrupted.AddDynamic(this, &UGDGA_FireGun::OnCancelled);
Task->OnCancelled.AddDynamic(this, &UGDGA_FireGun::OnCancelled);
Task->EventReceived.AddDynamic(this, &UGDGA_FireGun::EventReceived);
Task->ReadyForActivation();
```



在蓝图中，我们只使用为`AbilityTask`. 我们不必打电话`ReadyForActivation()`。这是由 . 自动调用的`Engine/Source/Editor/GameplayTasksEditor/Private/K2Node_LatentGameplayTaskCall.cpp`。如果它们存在于的类中，也会自动调用（请参阅参考资料`K2Node_LatentGameplayTaskCall`）。重申一下，仅对蓝图进行自动魔法魔法。在 C++ 中，我们必须手动调用、和。`BeginSpawningActor()``FinishSpawningActor()``AbilityTask``AbilityTask_WaitTargetData``K2Node_LatentGameplayTaskCall``ReadyForActivation()``BeginSpawningActor()``FinishSpawningActor()`

[![蓝图等待目标数据能力任务](https://github.com/tranek/GASDocumentation/raw/master/Images/abilitytask.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/abilitytask.png)

要手动取消`AbilityTask`，只需在蓝图中（称为）或 C++ 中调用`EndTask()`该对象即可。`AbilityTask``Async Task Proxy`





### 4.7.4 根运动源能力任务

GAS 可以随着时间的`AbilityTasks`推移进行移动`Characters`，例如使用`Root Motion Sources`挂钩进行击退、复杂的跳跃、拉动和冲刺`CharacterMovementComponent`。

**注意：**预测`RootMotionSource` `AbilityTasks`适用于引擎版本 4.19 和 4.25+。引擎版本 4.20-4.24 的预测存在缺陷；然而，它们`AbilityTasks`仍然在多人游戏中发挥其功能，并进行了较小的网络修正，并且在单人游戏中完美运行。可以将4.25 中的[预测修复](https://github.com/EpicGames/UnrealEngine/commit/94107438dd9f490e7b743f8e13da46927051bf33#diff-65f6196f9f28f560f95bd578e07e290c)挑选到自定义 4.20-4.24 引擎中。





### 4.8 游戏提示



#### 4.8.1 游戏提示定义

`GameplayCues`( `GC`) 执行与游戏玩法无关的事物，例如声音效果、粒子效果、相机抖动等，`GameplayCues`通常会被复制（除非明确`Executed`、`Added`或`Removed`本地）和预测。

我们通过`GameplayCues`将`GameplayTag`具有**强制父名称的`GameplayCue.`**对应项和事件类型（`Execute`、`Add`或`Remove`）发送到 来触发。对象和其他实现 的对象可以基于( ) 订阅这些事件。`GameplayCueManager``ASC``GameplayCueNotify``Actors``IGameplayCueInterface``GameplayCue's` `GameplayTag``GameplayCueTag`

**注意：**重申一下，`GameplayCue` `GameplayTags`需要从 的父级`GameplayTag`开始`GameplayCue`。例如，有效的`GameplayCue` `GameplayTag`可能是`GameplayCue.A.B.C`.

`GameplayCueNotifies`有、`Static`和两类`Actor`。它们响应不同的事件，并且不同类型的事件`GameplayEffects`可以触发它们。用的逻辑覆盖相应的事件。

| `GameplayCue`班级                                            | 事件              | `GameplayEffect`类型     | 描述                                                         |
| ------------------------------------------------------------ | ----------------- | ------------------------ | ------------------------------------------------------------ |
| [`GameplayCueNotify_Static`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UGameplayCueNotify_Static/index.html) | `Execute`         | `Instant`或者`Periodic`  | 静态`GameplayCueNotifies`操作`ClassDefaultObject`（意味着没有实例）并且非常适合一次性效果，例如命中影响。 |
| [`GameplayCueNotify_Actor`](https://docs.unrealengine.com/en-US/BlueprintAPI/GameplayCueNotify/index.html) | `Add`或者`Remove` | `Duration`或者`Infinite` | Actor`GameplayCueNotifies`在 时生成一个新实例`Added`。因为这些是实例化的，所以它们可以随着时间的推移执行操作，直到`Removed`。`Duration`这些非常适合循环声音和粒子效果，当背景或被`Infinite` `GameplayEffect`删除或手动调用删除时，这些效果将被删除。`Added`这些还带有选项来管理允许同时使用的数量，以便相同效果的多个应用程序仅启动声音或粒子一次。 |

`GameplayCueNotifies`从技术上讲可以响应任何事件，但这通常是我们使用它们的方式。

**注意：**使用时`GameplayCueNotify_Actor`，请检查`Auto Destroy on Remove`，否则后续调用将`Add`不起作用`GameplayCueTag`。

当使用除和 以外的`ASC` [复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)`Full`时，`Add`事件`Remove` `GC`将在服务器播放器（侦听服务器）上触发两次 - 一次用于应用 ，`GE`另一次从“最小”`NetMultiCast`到客户端。然而，`WhileActive`事件仍然只会触发一次。所有事件只会在客户端上触发一次。

示例项目包括`GameplayCueNotify_Actor`用于眩晕和冲刺的效果。它还`GameplayCueNotify_Static`对 FireGun 的射弹产生影响。这些`GCs`可以通过[在本地触发它们](https://github.com/tranek/GASDocumentation#concepts-gc-local)而不是通过`GE`. 我选择在示例项目中展示使用它们的初学者方法。





#### 4.8.2 触发游戏提示

当成功应用（未被标签或免疫阻止）时，从 a 内部`GameplayEffect`填写`GameplayTags`所有`GameplayCues`应触发的内容。

[![由 GameplayEffect 触发的 GameplayCue](https://github.com/tranek/GASDocumentation/raw/master/Images/gcfromge.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gcfromge.png)

`UGameplayAbility``Execute`向、`Add`或提供蓝图节点`Remove` `GameplayCues`。

[![GameplayCue 由 GameplayAbility 触发](https://github.com/tranek/GASDocumentation/raw/master/Images/gcfromga.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gcfromga.png)

在 C++ 中，可以直接调用函数`ASC`（或将它们暴露给子`ASC`类中的蓝图）：

```
/** GameplayCues can also come on their own. These take an optional effect context to pass through hit result, etc */
void ExecuteGameplayCue(const FGameplayTag GameplayCueTag, FGameplayEffectContextHandle EffectContext = FGameplayEffectContextHandle());
void ExecuteGameplayCue(const FGameplayTag GameplayCueTag, const FGameplayCueParameters& GameplayCueParameters);

/** Add a persistent gameplay cue */
void AddGameplayCue(const FGameplayTag GameplayCueTag, FGameplayEffectContextHandle EffectContext = FGameplayEffectContextHandle());
void AddGameplayCue(const FGameplayTag GameplayCueTag, const FGameplayCueParameters& GameplayCueParameters);

/** Remove a persistent gameplay cue */
void RemoveGameplayCue(const FGameplayTag GameplayCueTag);
	
/** Removes any GameplayCue added on its own, i.e. not as part of a GameplayEffect. */
void RemoveAllGameplayCues();
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.8.3 本地游戏提示

`GameplayCues`默认情况下`GameplayAbilities`，会复制用于触发的公开函数`ASC`。每个`GameplayCue`事件都是一个多播 RPC。这可能会导致大量 RPC。GAS 还强制每个网络更新最多使用两个相同的`GameplayCue`RPC。`GameplayCues`我们通过尽可能使用本地来避免这种情况。`GameplayCues`仅本地`Execute`、、`Add`或`Remove`在个人客户端上。

我们可以使用 local 的场景`GameplayCues`：

- 弹丸撞击
- 近战碰撞影响
- `GameplayCues`从动画蒙太奇中发射

应该添加到子类中的本地`GameplayCue`函数`ASC`：

```
UFUNCTION(BlueprintCallable, Category = "GameplayCue", Meta = (AutoCreateRefTerm = "GameplayCueParameters", GameplayTagFilter = "GameplayCue"))
void ExecuteGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters& GameplayCueParameters);

UFUNCTION(BlueprintCallable, Category = "GameplayCue", Meta = (AutoCreateRefTerm = "GameplayCueParameters", GameplayTagFilter = "GameplayCue"))
void AddGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters& GameplayCueParameters);

UFUNCTION(BlueprintCallable, Category = "GameplayCue", Meta = (AutoCreateRefTerm = "GameplayCueParameters", GameplayTagFilter = "GameplayCue"))
void RemoveGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters& GameplayCueParameters);
```



```
void UPAAbilitySystemComponent::ExecuteGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters & GameplayCueParameters)
{
	UAbilitySystemGlobals::Get().GetGameplayCueManager()->HandleGameplayCue(GetOwner(), GameplayCueTag, EGameplayCueEvent::Type::Executed, GameplayCueParameters);
}

void UPAAbilitySystemComponent::AddGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters & GameplayCueParameters)
{
	UAbilitySystemGlobals::Get().GetGameplayCueManager()->HandleGameplayCue(GetOwner(), GameplayCueTag, EGameplayCueEvent::Type::OnActive, GameplayCueParameters);
	UAbilitySystemGlobals::Get().GetGameplayCueManager()->HandleGameplayCue(GetOwner(), GameplayCueTag, EGameplayCueEvent::Type::WhileActive, GameplayCueParameters);
}

void UPAAbilitySystemComponent::RemoveGameplayCueLocal(const FGameplayTag GameplayCueTag, const FGameplayCueParameters & GameplayCueParameters)
{
	UAbilitySystemGlobals::Get().GetGameplayCueManager()->HandleGameplayCue(GetOwner(), GameplayCueTag, EGameplayCueEvent::Type::Removed, GameplayCueParameters);
}
```



如果 a`GameplayCue`是`Added`本地的，那么它应该是`Removed`本地的。如果是`Added`通过复制，就应该`Removed`通过复制。





#### 4.8.4 游戏提示参数

```
GameplayCues`接收一个`FGameplayCueParameters`包含额外信息的结构作为`GameplayCue`参数。如果从或 上`GameplayCue`的函数手动触发，则必须手动填写传递给 的结构。如果由 a 触发，则以下变量将自动填充到结构中：`GameplayAbility``ASC``GameplayCueParameters``GameplayCue``GameplayCue``GameplayEffect``GameplayCueParameters
```

- 聚合源标签
- 聚合目标标签
- 游戏效果等级
- 能力等级
- [效果上下文](https://github.com/tranek/GASDocumentation#concepts-ge-context)
- 幅度（如果在标签容器上方的下拉列表中选择了幅度`GameplayEffect`以及影响该幅度的对应值）`Attribute``GameplayCue``Modifier``Attribute`

```
SourceObject`结构中的变量可能是手动触发时`GameplayCueParameters`将任意数据传递给的好地方。`GameplayCue``GameplayCue
```

**注意：**参数结构中的某些变量`Instigator`可能已经存在于`EffectContext`. 它还`EffectContext`可以包含一个在世界上`FHitResult`生成的位置。`GameplayCue`子类化`EffectContext`可能是将更多数据传递给 的好方法`GameplayCues`，尤其是那些由`GameplayEffect`.

有关详细信息，请参阅[`UAbilitySystemGlobals`](https://github.com/tranek/GASDocumentation#concepts-asg)填充结构的 3 个函数。`GameplayCueParameters`它们是虚拟的，因此可以覆盖它们以自动填充更多信息。

```
/** Initialize GameplayCue Parameters */
virtual void InitGameplayCueParameters(FGameplayCueParameters& CueParameters, const FGameplayEffectSpecForRPC &Spec);
virtual void InitGameplayCueParameters_GESpec(FGameplayCueParameters& CueParameters, const FGameplayEffectSpec &Spec);
virtual void InitGameplayCueParameters(FGameplayCueParameters& CueParameters, const FGameplayEffectContextHandle& EffectContext);
```







#### 4.8.5 游戏提示管理器

默认情况下，`GameplayCueManager`将扫描整个游戏目录并将`GameplayCueNotifies`其加载到内存中。`GameplayCueManager`我们可以通过在 .txt 文件中设置来更改扫描的路径`DefaultGame.ini`。

```
[/Script/GameplayAbilities.AbilitySystemGlobals]
GameplayCueNotifyPaths="/Game/GASDocumentation/Characters"
```



我们确实希望`GameplayCueManager`扫描并找到所有`GameplayCueNotifies`；然而，我们不希望它异步加载播放中的每一个。这会将所有`GameplayCueNotify`引用的声音和粒子放入内存中，无论它们是否在关卡中使用。在像《Paragon》这样的大型游戏中，内存中可能会存在数百兆字节的不需要的资源，并导致启动时卡顿和游戏冻结。

每次启动时异步加载的替代方法`GameplayCue`是仅`GameplayCues`在游戏中触发时异步加载。这可以减少不必要的内存使用和潜在的游戏硬冻结，同时异步加载每个内容以换取在游戏过程中`GameplayCue`第一次触发特定内容时可能出现的延迟效果。`GameplayCue`对于 SSD 来说，这种潜在的延迟是不存在的。我没有在硬盘上测试过。如果在 UE 编辑器中使用此选项，并且编辑器需要编译粒子系统，则在第一次加载 GameplayCues 期间可能会出现轻微的故障或冻结。这在构建中不是问题，因为粒子系统已经被编译。

首先，我们必须子类化`UGameplayCueManager`并告诉`AbilitySystemGlobals`该类`UGameplayCueManager`在`DefaultGame.ini`.

```
[/Script/GameplayAbilities.AbilitySystemGlobals]
GlobalGameplayCueManagerClass="/Script/ParagonAssets.PBGameplayCueManager"
```



在我们的`UGameplayCueManager`子类中，重写`ShouldAsyncLoadRuntimeObjectLibraries()`.

```
virtual bool ShouldAsyncLoadRuntimeObjectLibraries() const override
{
	return false;
}
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.8.6 防止触发游戏提示

有时我们不想`GameplayCues`开火。例如，如果我们阻止攻击，我们可能不想播放与伤害相关的命中影响`GameplayEffect`，或者改为播放自定义影响。[`GameplayEffectExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)我们可以通过调用`OutExecutionOutput.MarkGameplayCuesHandledManually()`然后手动将`GameplayCue`事件发送到`Target`或 来在 内部执行此操作`Source's` `ASC`。

如果不想`GameplayCues`在特定的情况下触发任何事件`ASC`，可以进行设置`AbilitySystemComponent->bSuppressGameplayCues = true;`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.8.7 游戏提示批处理

每次`GameplayCue`触发都是不可靠的 NetMulticast RPC。`GCs`在我们同时触发多个的情况下，有一些优化方法可以将它们压缩为一个 RPC 或通过发送更少的数据来节省带宽。



##### 4.8.7.1 手动RPC

假设有一把可以发射八颗子弹的霰弹枪。那是八道痕迹和冲击`GameplayCues`。[GASShooter](https://github.com/tranek/GASShooter)采用一种懒惰的方法，通过将所有跟踪信息存储到 as 中，将它们组合成一个[`EffectContext`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)RPC [`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)。虽然这将 RPC 从 8 个减少到 1 个，但它仍然在该 RPC 中通过网络发送大量数据（约 500 字节）。更优化的方法是发送带有自定义结构的 RPC，可以在其中有效地对命中位置进行编码，或者可以为其提供随机种子数以在接收端重新创建/近似影响位置。然后，客户端将解压此自定义结构并返回到[本地执行`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc-local)。

这是如何运作的：

1. 声明一个`FScopedGameplayCueSendContext`. 这会抑制`UGameplayCueManager::FlushPendingCues()`直到超出范围，这意味着所有内容都`GameplayCues`将排队直到`FScopedGameplayCueSendContext`超出范围。
2. 覆盖`UGameplayCueManager::FlushPendingCues()`合并`GameplayCues`，可以根据某些自定义将其批处理`GameplayTag`到的自定义结构中，并将其 RPC 到客户端。
3. 客户端接收自定义结构并将其解压到本地执行`GameplayCues`。

`GameplayCues`当需要不符合`GameplayCueParameters`报价的特定参数并且不想将它们添加到`EffectContext`伤害数字、暴击指示器、破碎护盾指示器、致命一击指示器等时，也可以使用此方法。

https://forums.unrealengine.com/development-discussion/c-gameplay-programming/1711546-fscopedgameplaycuesendcontext-gameplaycuemanager



##### 4.8.7.2 一个GE上多个GC

```
GameplayCues`a 上的所有内容`GameplayEffect`均已在一个 RPC 中发送。默认情况下，将在不可靠的 NetMulticast 中`UGameplayCueManager::InvokeGameplayCueAddedAndWhileActive_FromSpec()`发送整个`GameplayEffectSpec`（但转换为），而不管 的。这可能会占用大量带宽，具体取决于. 我们可以通过设置 cvar 来优化这一点。这将转换为结构和 RPC，而不是整个. 这可能会节省带宽，但信息也会减少，具体取决于转换方式以及需要了解的内容。`FGameplayEffectSpecForRPC``ASC``Replication Mode``GameplayEffectSpec``AbilitySystem.AlwaysConvertGESpecToGCParams 1``GameplayEffectSpecs``FGameplayCueParameter``FGameplayEffectSpecForRPC``GESpec``GameplayCueParameters``GCs
```

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.8.8 游戏提示事件

`GameplayCues`回应具体`EGameplayCueEvents`：

| `EGameplayCueEvent` | 描述                                                         |
| ------------------- | ------------------------------------------------------------ |
| `OnActive`          | `GameplayCue`当 a被激活（添加）时调用。                      |
| `WhileActive`       | 在活动时调用`GameplayCue`，即使它实际上并未刚刚应用（正在进行加入等）。这不是`Tick`！就像添加`OnActive`a 或变得相关时一样，它被调用一次。`GameplayCueNotify_Actor`如果需要`Tick()`，只需使用`GameplayCueNotify_Actor`的`Tick()`。`AActor`毕竟是一个。 |
| `Removed`           | 当 a 被移除时调用`GameplayCue`。`GameplayCue`响应该事件的蓝图函数是`OnRemove`。 |
| `Executed`          | `GameplayCue`执行a 时调用：即时效果或周期性效果`Tick()`。`GameplayCue`响应该事件的蓝图函数是`OnExecute`。 |

用于`OnActive``GameplayCue`在开始时发生的任何事情`GameplayCue`，但如果后来的加入者错过了也没关系。用于希望迟到的加入者看到的`WhileActive`持续效果。`GameplayCue`例如，如果有`GameplayCue`一个 MOBA 爆炸中的塔结构，可以将初始爆炸粒子系统和爆炸声音放入其中`OnActive`，并将任何残留的持续火焰粒子或声音放入 中`WhileActive`。在这种情况下，迟到的加入者重播 的初始爆炸是没有意义的`OnActive`，但希望他们看到爆炸发生后地面上持续的、循环的火焰效果`WhileActive`。`OnRemove`应该清理`OnActive`和中添加的任何内容`WhileActive`。`WhileActive`每次 Actor 进入 a 的相关范围时都会被调用`GameplayCueNotify_Actor`。`OnRemove`每次 Actor 离开 a 的相关范围时都会被调用`GameplayCueNotify_Actor`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.8.9 游戏提示可靠性

`GameplayCues`一般来说，应该被认为是不可靠的，因此不适合任何直接影响游戏玩法的事情。

**已执行`GameplayCues`：**这些`GameplayCues`是通过不可靠的多播应用的，并且始终不可靠。

**`GameplayCues`申请自`GameplayEffects`：**

- 自治代理可靠地接收`OnActive`、`WhileActive`、 以及对和的`OnRemove`
  `FActiveGameplayEffectsContainer::NetDeltaSerialize()`调用。拨打电话至.`UAbilitySystemComponent::HandleDeferredGameplayCues()``OnActive``WhileActive``FActiveGameplayEffectsContainer::RemoveActiveGameplayEffectGrantedTagsAndModifiers()``OnRemoved`
- 模拟代理可靠地接收`WhileActive`和`OnRemove`
  `UAbilitySystemComponent::MinimalReplicationGameplayCues`的复制调用`WhileActive`和`OnRemove`。该`OnActive`事件由不可靠的多播调用。

**`GameplayCues`应用时不带`GameplayEffect`：**

- 自治代理可靠地接收且`OnRemove`
  事件由不可靠的多播调用。`OnActive``WhileActive`
- 模拟代理可靠地接收`WhileActive`和`OnRemove`
  `UAbilitySystemComponent::MinimalReplicationGameplayCues`的复制调用`WhileActive`和`OnRemove`。该`OnActive`事件由不可靠的多播调用。

如果需要 a 中的某些内容`GameplayCue`“可靠”，请从 a 中应用它`GameplayEffect`并用于`WhileActive`添加 FX 和`OnRemove`删除 FX。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.9 能力系统全局变量

该类[`AbilitySystemGlobals`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/UAbilitySystemGlobals/index.html)保存有关 GAS 的全局信息。大多数变量可以从`DefaultGame.ini`. 一般来说，不必与此类交互，但应该知道它的存在。如果需要子类化诸如 the[`GameplayCueManager`](https://github.com/tranek/GASDocumentation#concepts-gc-manager)或 the 之类的东西[`GameplayEffectContext`](https://github.com/tranek/GASDocumentation#concepts-ge-context)，则必须通过`AbilitySystemGlobals`.

要子类化`AbilitySystemGlobals`，请在以下位置设置类名`DefaultGame.ini`：

```
[/Script/GameplayAbilities.AbilitySystemGlobals]
AbilitySystemGlobalsClassName="/Script/ParagonAssets.PAAbilitySystemGlobals"
```





#### 4.9.1 初始化全局数据()

从 UE 4.24 开始，现在需要调用`UAbilitySystemGlobals::Get().InitGlobalData()`use [`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)，否则将收到与服务器相关的错误，`ScriptStructCache`并且客户端将与服务器断开连接。该函数在项目中只需要调用一次。Fortnite 从 调用它`UAssetManager::StartInitialLoading()`，Paragon 从 调用它`UEngine::Init()`。我发现将其放在`UAssetManager::StartInitialLoading()`一个好地方，如示例项目所示。我会考虑将此样板代码复制到的项目中以避免`TargetData`.

如果在使用时遇到崩溃`AbilitySystemGlobals` `GlobalAttributeSetDefaultsTableNames`，可能需要稍后调用，`UAbilitySystemGlobals::Get().InitGlobalData()`例如 Fortnite 中的`AssetManager`或 中的`GameInstance`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.10 预测

GAS 开箱即用，支持客户端预测；然而，它并不能预测一切。GAS 中的客户端预测意味着客户端不必等待服务器的许可来激活`GameplayAbility`并应用`GameplayEffects`。它可以“预测”授予其执行此操作权限的服务器，并预测其将应用于的目标`GameplayEffects`。然后，服务器`GameplayAbility`在客户端激活后运行网络延迟时间，并告诉客户端他的预测是否正确。如果客户端的任何预测是错误的，他将“回滚”他的“错误预测”中的更改以匹配服务器。

GAS 相关预测的权威来源位于`GameplayPrediction.h`插件源代码中。

Epic 的心态是只预测你“能逃脱惩罚”的事情。例如，Paragon 和 Fortnite 不会预测伤害。他们很可能会使用[`ExecutionCalculations`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)无论如何都无法预测的伤害。这并不是说不能尝试预测某些事情，例如损坏。无论如何，如果你这样做并且它对你来说效果很好，那就太好了。

> ...我们也并不完全致力于“预测一切：无缝且自动”的解决方案。我们仍然认为玩家的预测最好保持在最低限度（意思是：预测你能逃脱的最小数量的东西）。

*Epic 的 Dave Ratti 对新[网络预测插件的评论](https://github.com/tranek/GASDocumentation#concepts-p-npp)*

**预测什么：**

> - 能力激活
> - 触发事件
> - 游戏效果应用：
>   - 属性修改（例外：执行当前不预测，仅属性修改）
>   - 游戏玩法标签修改
> - 游戏提示事件（来自预测游戏效果及其本身）
> - 蒙太奇
> - 运动（内置于 UE5 UCharacterMovement）

**未预测到的情况：**

> - 游戏效果移除
> - GameplayEffect 周期性效果（点滴答）

*从`GameplayPrediction.h`*

虽然我们可以预测`GameplayEffect`应用，但我们无法预测`GameplayEffect`删除。解决此限制的一种方法是预测当我们想要删除`GameplayEffect`. 假设我们预测移动速度减慢 40%。我们可以通过应用 40% 的移动速度增益来预测性地移除它。然后`GameplayEffects`同时删除两者。这并不适合所有场景，`GameplayEffect`仍然需要对预测删除的支持。Epic 的 Dave Ratti 表示希望将其添加到[GAS 的未来迭代](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)中。

因为我们无法预测 的删除`GameplayEffects`，所以我们无法完全预测`GameplayAbility`冷却时间，并且没有针对`GameplayEffect`它们的反向解决方法。服务器的复制`Cooldown GE`将存在于客户端上，任何绕过此的尝试（`Minimal`例如使用复制模式）都将被服务器拒绝。这意味着具有较高延迟的客户端需要更长的时间来告诉服务器进行冷却并接收服务器的`Cooldown GE`. 这意味着延迟较高的玩家的开火率会低于延迟较低的玩家，从而使他们在对抗延迟较低的玩家时处于劣势。Fortnite 通过使用自定义簿记而不是`Cooldown GEs`.

关于预测损坏，我个人并不推荐它，尽管它是大多数人在开始使用 GAS 时首先尝试的事情之一。我特别不建议尝试预测死亡。虽然可以预测损坏，但这样做很棘手。如果你错误地预测了施加的伤害，玩家会看到敌人的生命值回升。如果你试图预测死亡，这可能会特别尴尬和令人沮丧。假设你错误地预测了`Character's`死亡，它开始布娃娃，但当服务器纠正它时，它会停止布娃娃并继续向你射击。

**注意：（** `Instant` `GameplayEffects`例如）可以无缝地预测自己的`Cost GEs`变化，预测其他角色的变化将在他们的 中显示短暂的异常或“blip” 。实际上，预测的处理方式是这样的：如果预测错误，它们可以回滚。当应用服务器时，可能存在两个相同的情况，导致应用两次或在短时间内根本不应用。它最终会自行纠正，但有时玩家会注意到这一点。`Attributes``Instant` `Attribute``Attributes``Instant` `GameplayEffects``Infinite` `GameplayEffects``GameplayEffect``GameplayEffect's``Modifier`

GAS的预测实现试图解决的问题：

> 1. “我可以这样做吗？” 预测的基本协议。
> 2. “撤消”当预测失败时如何撤消副作用。
> 3. “重做”如何避免重播我们在本地预测但也会从服务器复制的副作用。
> 4. “完整性”如何确保我们/真正/预测了所有副作用。
> 5. “依赖关系”如何管理依赖预测和预测事件链。
> 6. “覆盖”如何预测性地覆盖由服务器复制/拥有的状态。

*从`GameplayPrediction.h`*

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.10.1 预测键

GAS 的预测基于 a 的概念`Prediction Key`，它是客户端在激活 a 时生成的整数标识符`GameplayAbility`。

- 客户端在激活`GameplayAbility`. 这是`Activation Prediction Key`.
- 客户端将此预测密钥发送到服务器`CallServerTryActivateAbility()`。
- `GameplayEffects`当预测密钥有效时，客户端将此预测密钥添加到其应用的所有内容中。
- 客户的预测密钥超出范围。进一步预测效果同样`GameplayAbility`需要一个新的[范围预测窗口](https://github.com/tranek/GASDocumentation#concepts-p-windows)。
- 服务器从客户端接收预测密钥。
- 服务器将此预测密钥添加到`GameplayEffects`它应用的所有内容中。
- 服务器将预测密钥复制回客户端。
- `GameplayEffects`客户端从服务器接收复制的内容以及用于应用它们的预测密钥。如果任何复制的内容与客户端应用相同预测密钥的`GameplayEffects`内容匹配，则它们被正确预测。目标`GameplayEffects`上将暂时有两份 的副本，直到客户端删除其预测的副本。`GameplayEffect`
- 客户端接收从服务器返回的预测密钥。这是`Replicated Prediction Key`. 该预测密钥现已标记为过时。
- 客户端删除它使用现已过时的复制预测密钥创建的**所有内容。** 服务器复制的内容将持续存在。客户端添加但未从服务器接收到匹配的复制版本的任何内容都是错误预测的。`GameplayEffects``GameplayEffects``GameplayEffects`

从激活预测密钥`GameplayAbilities`开始，预测密钥在指令“窗口”的原子分组期间保证是有效的。`Activation`可以认为这仅在一帧内有效。来自潜在操作的任何回调`AbilityTasks`将不再具有有效的预测密钥，除非具有生成新的[范围预测窗口的](https://github.com/tranek/GASDocumentation#concepts-p-windows)`AbilityTask`内置同步点。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.10.2 在能力中创建新的预测窗口

为了预测回调中的更多操作`AbilityTasks`，我们需要使用新的范围预测键创建一个新的范围预测窗口。这有时称为客户端和服务器之间的同步点。有些`AbilityTasks`与所有输入相关的都带有内置功能来创建新的范围预测窗口，这意味着回调中的原子代码`AbilityTasks'`可以使用有效的范围预测键。其他任务（例如`WaitDelay`任务）没有内置代码来为其回调创建新的范围预测窗口。如果需要预测`AbilityTask`没有内置代码来创建范围预测窗口（如 ）之后的操作，我们必须使用和 选项`WaitDelay`手动执行此操作。当客户点击`WaitNetSync` `AbilityTask``OnlyServerWait``WaitNetSync``OnlyServerWait`，它根据`GameplayAbility's`激活预测密钥生成一个新的范围预测密钥，将其 RPC 到服务器，并将其添加到`GameplayEffects`它应用的任何新密钥中。当服务器点击`WaitNetSync`with时`OnlyServerWait`，它会等待，直到从客户端收到新的范围预测键，然后再继续。此作用域预测密钥与激活预测密钥执行相同的操作 - 应用于`GameplayEffects`客户端并复制回客户端以标记为过时。范围预测键在超出范围之前一直有效，这意味着范围预测窗口已关闭。同样，只有原子操作（没有任何潜在的操作）可以使用新的作用域预测键。

可以根据需要创建任意数量的范围预测窗口。

如果想将同步点功能添加到自己的自定义中`AbilityTasks`，请查看输入功能如何将`WaitNetSync` `AbilityTask`代码注入其中。

**注意：**使用时`WaitNetSync`，这确实会阻止服务器`GameplayAbility`继续执行，直到收到客户端的消息为止。这可能会被恶意用户滥用，他们会破解游戏并故意延迟发送新的范围预测密钥。虽然 Epic 很少使用`WaitNetSync`，但如果担心的话，它建议可能会构建一个带有延迟的新版本`AbilityTask`，该版本会在没有客户端的情况下自动继续。

每次我们应用耐力成本时，示例项目都会`WaitNetSync`在 Sprint 中创建一个新的范围预测窗口，以便我们可以对其进行预测。`GameplayAbility`理想情况下，我们在应用成本和冷却时间时需要一个有效的预测密钥。

如果的预测`GameplayEffect`在所属客户端上播放了两次，则的预测密钥已过时，并且正在遇到“重做”问题。通常可以通过在应用之前`WaitNetSync` `AbilityTask`放置一个来创建新的范围预测键来解决此问题。`OnlyServerWait``GameplayEffect`

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.10.3 预测生成 Actor

预测性地在客户身上产生`Actors`是一个高级主题。GAS 不提供开箱即用的处理此问题的功能（唯一在服务器上`SpawnActor` `AbilityTask`生成）。关键概念是在客户端和服务器上`Actor`生成复制。`Actor`

如果这`Actor`只是装饰性的或没有任何游戏目的，简单的解决方案是重写该`Actor's` `IsNetRelevantFor()`函数以限制服务器复制到拥有的客户端。拥有的客户端将拥有其本地生成的版本，而服务器和其他客户端将拥有服务器的复制版本。

```
bool APAReplicatedActorExceptOwner::IsNetRelevantFor(const AActor * RealViewer, const AActor * ViewTarget, const FVector & SrcLocation) const
{
	return !IsOwnedBy(ViewTarget);
}
```



如果生成的东西`Actor`像需要预测伤害的射弹一样影响游戏玩法，那么需要超出本文档范围的高级逻辑。在 Epic Games 的 GitHub 上查看 UnrealTournament 如何预测性地生成射弹。他们仅在拥有的客户端上生成一个虚拟射弹，该虚拟射弹与服务器的复制射弹同步。





#### 4.10.4 GAS 预测的未来

`GameplayPrediction.h`未来他们可能会添加预测`GameplayEffect`移除和周期性的功能`GameplayEffects`。

Epic 的 Dave Ratti[表示有兴趣](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)解决`latency reconciliation`预测冷却时间的问题，这会使延迟较高的玩家相对于延迟较低的玩家处于不利地位。

Epic 的新[`Network Prediction`插件](https://github.com/tranek/GASDocumentation#concepts-p-npp)预计将像之前的`CharacterMovementComponent` *插件一样与 GAS 完全互操作。*





#### 4.10.5 网络预测插件

`CharacterMovementComponent`Epic 最近发起了一项用新插件替换 的计划`Network Prediction`。该插件仍处于早期阶段，但可以在虚幻引擎 GitHub 上尽早访问。现在判断该引擎将在哪个未来版本中首次亮相还为时过早。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 4.11 目标定位



#### 4.11.1 目标数据

[`FGameplayAbilityTargetData`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/FGameplayAbilityTargetData/index.html)是用于通过网络传递的目标数据的通用结构。`TargetData`通常会保存`AActor`/`UObject`引用、`FHitResults`以及其他通用位置/方向/原点信息。但是，可以对其进行子类化，以将任何想要的内容放入其中，作为在[客户端和服务器之间传递数据`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga-data)的简单方法。基本结构`FGameplayAbilityTargetData`不能直接使用，而是可以子类化。`GAS`附带了一些`FGameplayAbilityTargetData`开箱即用的子类结构，位于`GameplayAbilityTargetTypes.h`.

```
TargetData`通常由**手动**[`Target Actors`](https://github.com/tranek/GASDocumentation#concepts-targeting-actors)生成或创建，并由或通过. 由于处于、、、、 后端的功能可以访问.[`AbilityTasks`](https://github.com/tranek/GASDocumentation#concepts-at)[`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)[`EffectContext`](https://github.com/tranek/GASDocumentation#concepts-ge-context)`EffectContext`[`Executions`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)[`MMCs`](https://github.com/tranek/GASDocumentation#concepts-ge-mmc)[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc)[`AttributeSet`](https://github.com/tranek/GASDocumentation#concepts-as)`TargetData
```

我们通常不会直接传递`FGameplayAbilityTargetData`，而是使用[`FGameplayAbilityTargetDataHandle`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/FGameplayAbilityTargetDataHandle/index.html)具有指向 的内部 TArray 的指针`FGameplayAbilityTargetData`。这个中间结构为`TargetData`.

继承自的示例`FGameplayAbilityTargetData`：

```
USTRUCT(BlueprintType)
struct MYGAME_API FGameplayAbilityTargetData_CustomData : public FGameplayAbilityTargetData
{
    GENERATED_BODY()
public:

    FGameplayAbilityTargetData_CustomData()
    { }

    UPROPERTY()
    FName CoolName = NAME_None;

    UPROPERTY()
    FPredictionKey MyCoolPredictionKey;

    // This is required for all child structs of FGameplayAbilityTargetData
    virtual UScriptStruct* GetScriptStruct() const override
    {
    	return FGameplayAbilityTargetData_CustomData::StaticStruct();
    }

	// This is required for all child structs of FGameplayAbilityTargetData
    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
	    // The engine already defined NetSerialize for FName & FPredictionKey, thanks Epic!
        CoolName.NetSerialize(Ar, Map, bOutSuccess);
        MyCoolPredictionKey.NetSerialize(Ar, Map, bOutSuccess);
        bOutSuccess = true;
        return true;
    }
}

template<>
struct TStructOpsTypeTraits<FGameplayAbilityTargetData_CustomData> : public TStructOpsTypeTraitsBase2<FGameplayAbilityTargetData_CustomData>
{
	enum
	{
        WithNetSerializer = true // This is REQUIRED for FGameplayAbilityTargetDataHandle net serialization to work
	};
};
```



将目标数据添加到句柄：

```
UFUNCTION(BlueprintPure)
FGameplayAbilityTargetDataHandle MakeTargetDataFromCustomName(const FName CustomName)
{
	// Create our target data type, 
	// Handle's automatically cleanup and delete this data when the handle is destructed, 
	// if you don't add this to a handle then be careful because this deals with memory management and memory leaks so its safe to just always add it to a handle at some point in the frame!
	FGameplayAbilityTargetData_CustomData* MyCustomData = new FGameplayAbilityTargetData_CustomData();
	// Setup the struct's information to use the inputted name and any other changes we may want to do
	MyCustomData->CoolName = CustomName;
	
	// Make our handle wrapper for Blueprint usage
	FGameplayAbilityTargetDataHandle Handle;
	// Add the target data to our handle
	Handle.Add(MyCustomData);
	// Output our handle to Blueprint
	return Handle
}
```



为了获取值，需要进行类型安全检查，因为从句柄的目标数据获取值的唯一方法是使用通用 C/C++ 转换，这不是类型安全的，可能会导致对象切片和*崩溃*。对于类型检查，有多种方法可以执行此操作（但是诚实地想要），两种常见的方法是：

- 游戏标签：可以使用子类层次结构，在该子类层次结构中，知道每当某个代码架构的功能发生时，都可以转换为基本父类型并获取其游戏标签，然后与继承类的转换标签进行比较。
- 脚本结构和静态结构：可以直接进行类比较（这可能涉及大量 IF 语句或创建一些模板函数），下面是执行此操作的示例，但基本上可以从任何（这`FGameplayAbilityTargetData`是它的一个很好的优点是 a`USTRUCT`并要求任何继承的类在 ) 中指定结构类型`GetScriptStruct`并比较它是否是正在寻找的类型。下面是使用这些函数进行类型检查的示例：

```
UFUNCTION(BlueprintPure)
FName GetCoolNameFromTargetData(const FGameplayAbilityTargetDataHandle& Handle, const int Index)
{   
    // NOTE, there is two versions of this '::Get(int32 Index)' function; 
    // 1) const version that returns 'const FGameplayAbilityTargetData*', good for reading target data values 
    // 2) non-const version that returns 'FGameplayAbilityTargetData*', good for modifying target data values
    FGameplayAbilityTargetData* Data = Handle.Get(Index); // This will valid check the index for you 
    
    // Valid check we have something to use, null data means nothing to cast for
    if(Data == nullptr)
    {
       	return NAME_None;
    }
    // This is basically the type checking pass, static_cast does not have type safety, this is why we do this check.
    // If we don't do this then it will object slice the struct and thus we have no way of making sure its that type.
    if(Data->GetScriptStruct() == FGameplayAbilityTargetData_CustomData::StaticStruct())
    {
        // Here is when you would do the cast because we know its the correct type already
        FGameplayAbilityTargetData_CustomData* CustomData = static_cast<FGameplayAbilityTargetData_CustomData*>(Data);    
        return CustomData->CoolName;
    }
    return NAME_None;
}
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.11.2 目标参与者

`GameplayAbilities`生成[`TargetActors`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/AGameplayAbilityTargetActor/index.html)来`WaitTargetData` `AbilityTask`可视化并捕获来自世界的目标信息。`TargetActors`可以选择用于[`GameplayAbilityWorldReticles`](https://github.com/tranek/GASDocumentation#concepts-targeting-reticles)显示当前目标。确认后，返回目标信息，[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)然后可以将其传递到`GameplayEffects`.

`TargetActors`因此`AActor`它们可以具有任何类型的可见组件来表示它们的目标**位置**和**方式**，例如静态网格物体或贴花。静态网格物体可用于可视化角色将构建的对象的放置。贴花可用于显示地面上的影响区域。示例项目使用[`AGameplayAbilityTargetActor_GroundTrace`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/AGameplayAbilityTargetActor_Grou-/index.html)地面上的贴花来表示流星能力的伤害区域。他们也不需要显示任何东西。例如，对于[GASShooter](https://github.com/tranek/GASShooter)中使用的即时追踪到目标的扫描枪显示任何内容是没有意义的。

它们使用基本轨迹或碰撞重叠捕获目标信息，并根据实现将结果转换为`FHitResults`或`AActor`数组。通过其参数确定目标何时被确认。当**不**使用时，通常会在 上执行跟踪/重叠，并根据其实现将其位置更新为 。虽然这会在 上执行跟踪/重叠，但它通常并不可怕，因为它不会被复制，并且通常不会同时运行多个（尽管可以有更多） 。请注意，它使用一些复杂的`TargetData``TargetActor``WaitTargetData` `AbilityTask``TEnumAsByte<EGameplayTargetingConfirmation::Type> ConfirmationType``TEnumAsByte<EGameplayTargetingConfirmation::Type::Instant``TargetActor``Tick()``FHitResult``Tick()``TargetActor``Tick()``TargetActors`可能会做很多事情，就像 GASShooter 中火箭发射器的辅助能力一样。虽然跟踪对客户端的响应非常快，但如果性能影响太大，`Tick()`可以考虑降低跟踪率。`TargetActor`在 的情况下`TEnumAsByte<EGameplayTargetingConfirmation::Type::Instant`，`TargetActor`立即产生、产生`TargetData`并销毁。`Tick()`从未被调用过。

| `EGameplayTargetingConfirmation::Type` | 当目标确定后                                                 |
| -------------------------------------- | ------------------------------------------------------------ |
| `Instant`                              | 定位立即发生，无需特殊逻辑或用户输入来决定何时“触发”。       |
| `UserConfirmed`                        | 当用户将能力[绑定到`Confirm`输入](https://github.com/tranek/GASDocumentation#concepts-ga-input)或通过调用确认定位时，就会发生定位`UAbilitySystemComponent::TargetConfirm()`。它`TargetActor`还将响应绑定`Cancel`输入或`UAbilitySystemComponent::TargetCancel()`取消定位的调用。 |
| `Custom`                               | GameplayTargeting Skill 负责通过调用 来决定目标数据何时准备就绪`UGameplayAbility::ConfirmTaskByInstanceName()`。他们`TargetActor`还将回应`UGameplayAbility::CancelTaskByInstanceName()`取消定位。 |
| `CustomMulti`                          | GameplayTargeting Skill 负责通过调用 来决定目标数据何时准备就绪`UGameplayAbility::ConfirmTaskByInstanceName()`。他们`TargetActor`还将回应`UGameplayAbility::CancelTaskByInstanceName()`取消定位。不应结束`AbilityTask`后续数据生产。 |

并非每个 EGameplayTargetingConfirmation::Type 都受支持`TargetActor`。比如`AGameplayAbilityTargetActor_GroundTrace`不支持`Instant`确认。

接受`WaitTargetData` `AbilityTask`一个`AGameplayAbilityTargetActor`类作为参数，并会在每次激活时生成一个实例，并在结束时`AbilityTask`销毁。接受一个已经生成的，但在结束时仍然会销毁它。这两种方法的效率都很低，因为它们要么生成，要么每次使用都需要新生成。它们非常适合原型制作，但在生产中，如果遇到像自动步枪一样不断生产的情况，可能会探索优化它。GASShooter 有一个自定义子类和一个从头开始编写的新子类，允许重用 a而无需破坏它。`TargetActor``AbilityTask``WaitTargetDataUsingActor` `AbilityTask``TargetActor``AbilityTask``AbilityTasks``TargetActor``TargetData`[`AGameplayAbilityTargetActor`](https://github.com/tranek/GASShooter/blob/master/Source/GASShooter/Public/Characters/Abilities/GSGATA_Trace.h)[`WaitTargetDataWithReusableActor`](https://github.com/tranek/GASShooter/blob/master/Source/GASShooter/Public/Characters/Abilities/AbilityTasks/GSAT_WaitTargetDataUsingActor.h) `AbilityTask``TargetActor`

`TargetActors`默认情况下不复制；但是，如果这在的游戏中有意义，则可以让它们进行复制，以向其他玩家显示本地玩家的目标位置。它们确实包含通过`WaitTargetData` `AbilityTask`. 如果`TargetActor`的`ShouldProduceTargetDataOnServer`属性设置为`false`，则客户端将在确认后通过in将其 RPC`TargetData`到服务器。如果是，客户端将向服务器发送通用确认事件 RPC，服务器将在收到 RPC 后进行跟踪或重叠检查，以在服务器上生成数据。如果客户端取消定位，它将向服务器发送通用取消事件 RPC`CallServerSetReplicatedTargetData()``UAbilityTask_WaitTargetData::OnTargetDataReadyCallback()``ShouldProduceTargetDataOnServer``true``EAbilityGenericReplicatedEvent::GenericConfirm``UAbilityTask_WaitTargetData::OnTargetDataReadyCallback()``EAbilityGenericReplicatedEvent::GenericCancel``UAbilityTask_WaitTargetData::OnTargetDataCancelledCallback`。`TargetActor`正如所看到的，和 上都有很多代表`WaitTargetData` `AbilityTask`。响应`TargetActor`输入以制作和广播`TargetData`就绪、确认或取消代表。`WaitTargetData`侦听 的`TargetActor`就绪`TargetData`、确认和取消委托，并将该信息转发回`GameplayAbility`和 服务器。如果发送`TargetData`到服务器，可能需要在服务器上进行验证以确保看起来`TargetData`合理以防止作弊。直接在服务器上生成`TargetData`可以完全避免此问题，但可能会导致拥有客户端的错误预测。

根据`AGameplayAbilityTargetActor`使用的特定子类，节点`ExposeOnSpawn`上将公开不同的参数`WaitTargetData` `AbilityTask`。一些常见参数包括：

| 常用`TargetActor`参数 | 定义                                                         |
| --------------------- | ------------------------------------------------------------ |
| 调试                  | 如果，则每当在非发布版本中执行跟踪`true`时，它将绘制调试跟踪/重叠信息。`TargetActor`请记住， non-`Instant` `TargetActors`将在 上执行跟踪`Tick()`，因此这些调试绘制调用也将在 上发生`Tick()`。 |
| 筛选                  | `Actors`[可选] 一个特殊的结构，用于在发生跟踪/重叠时从目标中过滤掉（删除） 。典型的用例是过滤掉玩家的`Pawn`，要求目标属于特定类别。有关更高级的用例，请参阅[目标数据过滤器。](https://github.com/tranek/GASDocumentation#concepts-target-data-filters) |
| 十字线类              | [可选] 将会产生的子`AGameplayAbilityWorldReticle`类`TargetActor`。 |
| 十字线参数            | [可选] 配置的标线。参见[十字线](https://github.com/tranek/GASDocumentation#concepts-targeting-reticles)。 |
| 起始位置              | 跟踪应该从哪里开始的特殊结构。通常这将是玩家的视点、武器枪口或 的`Pawn`位置。 |

对于默认`TargetActor`类，`Actors`只有直接位于跟踪/重叠中时才是有效目标。如果它们留下痕迹/重叠（它们移动或移开视线），它们就不再有效。如果希望`TargetActor`记住最后一个有效目标，则需要将此功能添加到自定义`TargetActor`类中。我将这些称为持久目标，因为它们将持续存在`TargetActor`，直到收到确认或取消，`TargetActor`在其跟踪/重叠中找到新的有效目标，或者目标不再有效（已销毁）。GASShooter 使用持久目标作为其火箭发射器的辅助能力的寻的火箭瞄准。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.11.3 目标数据过滤器

使用 和`Make GameplayTargetDataFilter`节点`Make Filter Handle`，可以过滤掉玩家的类别`Pawn`或仅选择特定类别。如果需要更高级的过滤，可以子类化`FGameplayTargetDataFilter`并覆盖该`FilterPassesForActor`函数。

```
USTRUCT(BlueprintType)
struct GASDOCUMENTATION_API FGDNameTargetDataFilter : public FGameplayTargetDataFilter
{
	GENERATED_BODY()

	/** Returns true if the actor passes the filter and will be targeted */
	virtual bool FilterPassesForActor(const AActor* ActorToBeFiltered) const override;
};
```



但是，这不能直接在`Wait Target Data`节点中工作，因为它需要`FGameplayTargetDataFilterHandle`. `Make Filter Handle`必须创建一个新的自定义来接受子类：

```
FGameplayTargetDataFilterHandle UGDTargetDataFilterBlueprintLibrary::MakeGDNameFilterHandle(FGDNameTargetDataFilter Filter, AActor* FilterActor)
{
	FGameplayTargetDataFilter* NewFilter = new FGDNameTargetDataFilter(Filter);
	NewFilter->InitializeFilterContext(FilterActor);

	FGameplayTargetDataFilterHandle FilterHandle;
	FilterHandle.Filter = TSharedPtr<FGameplayTargetDataFilter>(NewFilter);
	return FilterHandle;
}
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.11.4 游戏能力世界十字线

[`AGameplayAbilityWorldReticles`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/AGameplayAbilityWorldReticle/index.html)( `Reticles`)在使用未确认的定位时，可视化的定位**对象**。负责所有的生成和销毁生命周期。这样他们就可以使用任何类型的视觉组件来表示。[GASShooter](https://github.com/tranek/GASShooter)中常见的实现是使用在屏幕空间中显示 UMG Widget（始终面向玩家的相机）。不知道它们在哪一个上，但是可以在自定义. 通常会在每个 上将 的位置更新为目标位置。`Instant`[`TargetActors`](https://github.com/tranek/GASDocumentation#concepts-targeting-actors)`TargetActors``Reticles``Reticles``AActors``WidgetComponent``Reticles``AActor``TargetActor``TargetActors``Reticle``Tick()`

GASShooter 用于`Reticles`显示火箭发射器辅助能力的寻的火箭的锁定目标。敌人身上的红色指示器是`Reticle`。类似的白色图像是火箭发射器的十字准线。 [![GASShooter 中的标线](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplayabilityworldreticle.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplayabilityworldreticle.png)

`Reticles`为设计师提供了一些`BlueprintImplementableEvents`（它们旨在在蓝图中开发）：

```
/** Called whenever bIsTargetValid changes value. */
UFUNCTION(BlueprintImplementableEvent, Category = Reticle)
void OnValidTargetChanged(bool bNewValue);

/** Called whenever bIsTargetAnActor changes value. */
UFUNCTION(BlueprintImplementableEvent, Category = Reticle)
void OnTargetingAnActor(bool bNewValue);

UFUNCTION(BlueprintImplementableEvent, Category = Reticle)
void OnParametersInitialized();

UFUNCTION(BlueprintImplementableEvent, Category = Reticle)
void SetReticleMaterialParamFloat(FName ParamName, float value);

UFUNCTION(BlueprintImplementableEvent, Category = Reticle)
void SetReticleMaterialParamVector(FName ParamName, FVector value);
```



`Reticles`可以选择使用for 配置[`FWorldReticleParameters`](https://docs.unrealengine.com/en-US/API/Plugins/GameplayAbilities/Abilities/FWorldReticleParameters/index.html)提供的`TargetActor`。默认结构仅提供一个变量`FVector AOEScale`。虽然可以从技术上子类化此结构，但`TargetActor`将仅接受基本结构。不允许使用 default 对其进行子类化似乎有点短视`TargetActors`。但是，如果进行自己的自定义`TargetActor`，则可以提供自己的自定义标线参数结构，并`AGameplayAbilityWorldReticles`在生成它们时手动将其传递给的子类。

`Reticles`默认情况下不会复制，但如果的游戏可以向其他玩家显示本地玩家的目标玩家，则可以进行复制。

`Reticles`只会在默认的当前有效目标上显示`TargetActors`。例如，如果使用 来`AGameplayAbilityTargetActor_SingleLineTrace`追踪目标，则`Reticle`只有当敌人直接位于追踪路径中时才会出现 。如果你把目光移开，敌人就不再是有效目标，并且意志`Reticle`也会消失。如果希望`Reticle`保留最后一个有效目标，将需要自定义`TargetActor`以记住最后一个有效目标并将其保留`Reticle`在其中。我将这些称为持久目标，因为它们将持续存在`TargetActor`，直到收到确认或取消，`TargetActor`在其跟踪/重叠中找到新的有效目标，或者目标不再有效（已销毁）。GASShooter 使用持久目标作为其火箭发射器的辅助能力的寻的火箭瞄准。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 4.11.5 游戏效果容器定位

[`GameplayEffectContainers`](https://github.com/tranek/GASDocumentation#concepts-ge-containers)配备可选的、高效的生产方式[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)。`EffectContainer`当应用到客户端和服务器时，这种定位会立即发生。它比[`TargetActors`](https://github.com/tranek/GASDocumentation#concepts-targeting-actors)在目标对象的 CDO 上运行更高效（不会生成和销毁`Actors`），但它缺乏玩家输入，无需确认即可立即发生，无法取消，并且无法从客户端向服务器发送数据（产生两者的数据）。它非常适合即时追踪和碰撞重叠。Epic 的[动作 RPG 示例项目](https://www.unrealengine.com/marketplace/en-US/product/action-rpg)包括两种示例类型的目标及其容器 - 目标能力所有者和拉动`TargetData`来自一个事件。它还在蓝图中实现了一个功能，以在距播放器的一定偏移量（由子蓝图类设置）处进行即时球体跟踪。可以`URPGTargetType`在 C++ 或蓝图中进行子类化以创建自己的定位类型。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 5. 常用的能力和效果



### 5.1 眩晕

通常，对于眩晕，我们希望取消所有活动`Character's`，`GameplayAbilities`防止新的`GameplayAbility`激活，并防止在眩晕期间发生移动。示例项目的流星`GameplayAbility`会对命中的目标造成眩晕。

要取消目标的活动`GameplayAbilities`，我们在[添加](https://github.com/tranek/GASDocumentation#concepts-gt-change)`AbilitySystemComponent->CancelAbilities()`眩晕时调用。[`GameplayTag`](https://github.com/tranek/GASDocumentation#concepts-gt-change)

为了防止新人`GameplayAbilities`在被击晕时激活，他们`GameplayAbilities`会`GameplayTag`在他们的[`Activation Blocked Tags` `GameplayTagContainer`](https://github.com/tranek/GASDocumentation#concepts-ga-tags).

为了防止被击晕时移动，我们重写该`CharacterMovementComponent's` `GetMaxSpeed()`函数，在所有者被击晕时返回 0 `GameplayTag`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 5.2 冲刺

示例项目提供了如何冲刺的示例 -`Left Shift`按住时跑得更快。

`CharacterMovementComponent`通过通过网络向服务器发送标志来预测性地处理更快的移动。`GDCharacterMovementComponent.h/cpp`详情请参阅。

手柄`GA`响应输入`Left Shift`，告诉`CMC`开始和停止冲刺，并在`Left Shift`按下时预测性地充电耐力。`GA_Sprint_BP`详情请参阅。





### 5.3 向下瞄准

示例项目以与冲刺完全相同的方式处理此问题，但降低而不是增加移动速度。

`GDCharacterMovementComponent.h/cpp`有关预测性降低移动速度的详细信息，请参阅参考资料。

`GA_AimDownSight_BP`有关处理输入的详细信息，请参阅参考资料。瞄准目标不会消耗体力。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 5.4 吸血

我在伤害内处理吸血[`ExecutionCalculation`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)。上面`GameplayEffect`会有一个`GameplayTag`类似的`Effect.CanLifesteal`。检查`ExecutionCalculation`是否`GameplayEffectSpec`有那个`Effect.CanLifesteal` `GameplayTag`。如果`GameplayTag`存在， 则`ExecutionCalculation` [创建一个动态`Instant` `GameplayEffect`](https://github.com/tranek/GASDocumentation#concepts-ge-dynamic)，将生命值作为修改器给出，并将其应用回`Source's` `ASC`。

```
if (SpecAssetTags.HasTag(FGameplayTag::RequestGameplayTag(FName("Effect.Damage.CanLifesteal"))))
{
	float Lifesteal = Damage * LifestealPercent;

	UGameplayEffect* GELifesteal = NewObject<UGameplayEffect>(GetTransientPackage(), FName(TEXT("Lifesteal")));
	GELifesteal->DurationPolicy = EGameplayEffectDurationType::Instant;

	int32 Idx = GELifesteal->Modifiers.Num();
	GELifesteal->Modifiers.SetNum(Idx + 1);
	FGameplayModifierInfo& Info = GELifesteal->Modifiers[Idx];
	Info.ModifierMagnitude = FScalableFloat(Lifesteal);
	Info.ModifierOp = EGameplayModOp::Additive;
	Info.Attribute = UPAAttributeSetBase::GetHealthAttribute();

	SourceAbilitySystemComponent->ApplyGameplayEffectToSelf(GELifesteal, 1.0f, SourceAbilitySystemComponent->MakeEffectContext());
}
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 5.5 在客户端和服务器上生成随机数

有时需要在 a 内生成一个“随机”数字，`GameplayAbility`例如子弹后坐力或散布。客户端和服务器都希望生成相同的随机数。为此，我们必须将 设为与激活`random seed`时相同`GameplayAbility`。需要在`random seed`每次激活时进行设置`GameplayAbility`，以防客户端错误预测激活并且其随机数序列与服务器的不同步。

| 播种方法                                          | 描述                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ |
| 使用激活预测密钥                                  | 激活`GameplayAbility`预测密钥是一个 int16，保证在`Activation()`. `random seed`可以在客户端和服务器上将其设置为。此方法的缺点是每次游戏开始时预测密钥总是从零开始，并在生成密钥之间不断增加要使用的值。这意味着每场比赛都将具有完全相同的随机数序列。这可能足够随机，也可能不够随机以满足的需求。 |
| 当激活时，通过事件负载发送种子`GameplayAbility` | 激活的`GameplayAbility`事件并通过复制的事件负载将随机生成的种子从客户端发送到服务器。这允许更多的随机性，但客户可以轻松地破解他们的游戏，每次只发送相同的种子值。此外，通过事件激活`GameplayAbilities`将阻止它们从输入绑定激活。 |

如果的随机偏差很小，大多数玩家不会注意到每个游戏的序列都是相同的，并且使用激活预测密钥应该适合`random seed`。如果正在做一些更复杂的事情，需要防黑客，那么使用 a`Server Initiated` `GameplayAbility`可能会更好，因为服务器可以创建预测密钥或生成`random seed`通过事件负载发送的密钥。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 5.6 严重打击

我处理伤害内的重击[`ExecutionCalculation`](https://github.com/tranek/GASDocumentation#concepts-ge-ec)。上面`GameplayEffect`会有一个`GameplayTag`类似的`Effect.CanCrit`。检查`ExecutionCalculation`是否`GameplayEffectSpec`有那个`Effect.CanCrit` `GameplayTag`。如果`GameplayTag`存在，则`ExecutionCalculation`生成一个与暴击几率（`Attribute`从 中捕获）相对应的随机数，如果成功，`Source`则添加暴击伤害（也是`Attribute`从 中捕获）。`Source`由于我不预测损坏，因此我不必担心同步客户端和服务器上的随机数生成器，因为它们`ExecutionCalculation`仅在服务器上运行。如果尝试使用 来预测性地执行此操作`MMC`来进行损害计算，则必须`random seed`从 中获取对 的引用`GameplayEffectSpec->GameplayEffectContext->GameplayAbilityInstance`。

看看[GASShooter](https://github.com/tranek/GASShooter)如何进行爆头。这是相同的概念，只不过它不依赖于随机数，而是检查`FHitResult`骨骼名称。





### 5.7 非叠加的游戏效果，但只有最大的幅度真正影响目标

《Paragon》中的缓慢效果不会叠加。每个慢速实例都正常应用并跟踪它们的生命周期，但只有最大幅度的慢速效果实际上影响了`Character`. GAS 为这种场景提供了开箱即用的`AggregatorEvaluateMetaData`. [`AggregatorEvaluateMetaData()`](https://github.com/tranek/GASDocumentation#concepts-as-onattributeaggregatorcreated)详细信息和实施请参见。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 5.8 游戏暂停时生成目标数据

[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)如果需要在等待播放器生成时暂停游戏`WaitTargetData` `AbilityTask`，我建议不要暂停使用`slomo 0`.





### 5.9 一键交互系统

[GASShooter](https://github.com/tranek/GASShooter)实现了一个一键交互系统，玩家可以按下或按住“E”来与可交互对象进行交互，例如复活玩家、打开武器箱以及打开或关闭滑动门。





## 6. 调试GAS

通常在调试 GAS 相关问题时，想了解以下信息：

> - “我的属性值是多少？”
> - “我有什么游戏标签？”
> - “我现在有什么游戏效果？”
> - “我授予了哪些能力，哪些能力正在运行，哪些能力被阻止激活？”。

GAS 提供了两种在运行时回答这些问题的技术 -[`showdebug abilitysystem`](https://github.com/tranek/GASDocumentation#debugging-sd)以及[`GameplayDebugger`](https://github.com/tranek/GASDocumentation#debugging-gd).

**提示：**虚幻引擎喜欢优化 C++ 代码，这使得某些功能很难调试。当深入跟踪代码时，很少会遇到这种情况。如果将 Visual Studio 解决方案配置设置为仍阻止跟踪代码或检查变量，则可以通过使用 CoreMiscDefines.h 中定义的和宏或船舶变体`DebugGame Editor`包装优化函数来禁用所有优化。除非从源代码重建插件，否则这不能在插件代码上使用。这可能在内联函数上起作用，也可能不起作用，具体取决于它们的作用和位置。完成调试后请务必删除宏！`UE_DISABLE_OPTIMIZATION``UE_ENABLE_OPTIMIZATION`

```
UE_DISABLE_OPTIMIZATION
void MyClass::MyFunction(int32 MyIntParameter)
{
	// My code
}
UE_ENABLE_OPTIMIZATION
```



**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 6.1 显示调试能力系统

`showdebug abilitysystem`在游戏控制台中输入。此功能分为三个“页面”。所有三个页面都会显示`GameplayTags`当前拥有的。在控制台中键入内容`AbilitySystem.Debug.NextCategory`以在页面之间循环。

第一页显示`CurrentValue`的所有`Attributes`： [![显示调试能力系统首页](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage1.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage1.png)

第二页显示了你身上所有的`Duration`和`Infinite` `GameplayEffects`，他们的堆叠数量，`GameplayTags`他们给予的东西，以及`Modifiers`他们给予的东西。 [![显示调试能力系统第二页](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage2.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage2.png)

`GameplayAbilities`第三页显示了已授予的所有权限，当前是否正在运行，是否被阻止激活，以及当前正在运行的状态`AbilityTasks`。 [![显示调试能力系统第三页](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage3.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/showdebugpage3.png)

要在目标（由 Actor 周围的绿色矩形棱柱表示）之间循环，请使用`PageUp`键或`NextDebugTarget`控制台命令转到下一个目标，然后使用`PageDown`键或`PreviousDebugTarget`控制台命令转到上一个目标。

**注意：**为了使能力系统信息根据当前选择的调试Actor进行更新，需要`bUseDebugTargetFromHud=true`在`AbilitySystemGlobals`以下位置进行如下设置`DefaultGame.ini`：

```
[/Script/GameplayAbilities.AbilitySystemGlobals]
bUseDebugTargetFromHud=true
```



**注意：**为了`showdebug abilitysystem`工作，必须在游戏模式中选择实际的 HUD 类。否则找不到该命令并返回“Unknown Command”。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 6.2 游戏调试器

GAS 为游戏调试器添加了功能。使用撇号 (') 键访问游戏调试器。按数字键盘上的 3 启用“能力”类别。根据拥有的插件，类别可能会有所不同。如果的键盘没有像笔记本电脑那样的小键盘，那么可以在项目设置中更改键绑定。

当想查看其他`GameplayTags`、`GameplayEffects`、 和时**，**请使用游戏调试器。不幸的是它没有显示目标的. 它将瞄准屏幕中央的任何内容。可以通过在编辑器的 World Outliner 中选择目标或查看不同的目标并再次按撇号 (') 来更改目标。当前检查的上方有最大的红色圆圈。`GameplayAbilities` `Characters``CurrentValue``Attributes``Character``Character``Character`

[![游戏调试器](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplaydebugger.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gameplaydebugger.png)





### 6.3 气体测井

GAS 源代码包含大量以不同详细级别生成的日志记录语句。很可能会将这些视为`ABILITY_LOG()`陈述。默认详细级别为`Display`。默认情况下，任何更高的值都不会显示在控制台中。

要更改日志类别的详细级别，请在控制台中输入：

```
log [category] [verbosity]
```



例如，要打开`ABILITY_LOG()`语句，可以在控制台中输入：

```
log LogAbilitySystem VeryVerbose
```



要将其重置回默认值，请键入：

```
log LogAbilitySystem Display
```



要显示所有日志类别，请键入：

```
log list
```



值得注意的 GAS 相关日志类别：

| 日志类别           | 默认详细级别 |
| ------------------ | ------------ |
| 日志能力系统       | 展示         |
| LogAbility系统组件 | 日志         |
| 日志游戏提示详情   | 日志         |
| 日志游戏提示翻译器 | 展示         |
| 日志游戏效果详情   | 日志         |
| 日志游戏效果       | 展示         |
| 日志游戏标签       | 日志         |
| 记录游戏任务       | 日志         |
| 视频记录能力系统   | 展示         |

有关详细信息，请参阅[有关日志记录的 Wiki 。](https://unrealcommunity.wiki/logging-lgpidy6i)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 7. 优化



### 7.1 能力批量

[`GameplayAbilities`](https://github.com/tranek/GASDocumentation#concepts-ga)可以将激活、选择性发送`TargetData`到服务器以及结束一帧中的所有内容进行[批处理，以将两到三个 RPC 压缩为一个 RPC](https://github.com/tranek/GASDocumentation#concepts-ga-batching)。这些类型的能力通常用于命中扫描枪。



### 7.2 游戏提示批处理

如果[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc)同时发送多个消息，请考虑[将它们分批放入一个 RPC 中](https://github.com/tranek/GASDocumentation#concepts-gc-batching)。目标是减少 RPC（不可靠的网络多播）的数量`GameplayCues`并发送尽可能少的数据。



### 7.3 能力系统组件复制模式

默认情况下，[`ASC`](https://github.com/tranek/GASDocumentation#concepts-asc)位于[`Full Replication Mode`](https://github.com/tranek/GASDocumentation#concepts-asc-rm). 这会将所有内容复制[`GameplayEffects`](https://github.com/tranek/GASDocumentation#concepts-ge)到每个客户端（这对于单人游戏来说很好）。在多人游戏中，将玩家拥有的角色和 AI 控制的角色设置`ASCs`为。这将复制应用于玩家角色，仅复制到该角色的所有者，而应用于人工智能控制的角色将永远不会复制到客户端。无论. _ 当所有客户端都不需要查看网络数据时，这将减少网络数据的复制。`Mixed Replication Mode``Minimal Replication Mode``GEs``GEs``GEs`[`GameplayTags`](https://github.com/tranek/GASDocumentation#concepts-gt)[`GameplayCues`](https://github.com/tranek/GASDocumentation#concepts-gc)`Replication Mode``GEs`



### 7.4 属性代理复制

在像《堡垒之夜：大逃杀》（FNBR）这样拥有众多玩家的大型游戏中，会有很多人[`ASCs`](https://github.com/tranek/GASDocumentation#concepts-asc)靠始终相关的`PlayerStates`复制来维持生计[`Attributes`](https://github.com/tranek/GASDocumentation#concepts-a)。为了优化这个瓶颈，Fortnite 禁用了`ASC`及其在**模拟玩家控制的代理**上[`AttributeSets`](https://github.com/tranek/GASDocumentation#concepts-as)的复制。自主代理和人工智能控制仍然完全根据它们的复制。FNBR没有在始终相关的 上进行复制，而是在玩家的 上使用复制的代理结构。当服务器上的更改时，代理结构上的它们也会更改。客户端收到复制的`PlayerState::ReplicateSubobjects()``Pawns`[`Replication Mode`](https://github.com/tranek/GASDocumentation#concepts-asc-rm)`Attributes``ASC``PlayerStates``Pawn``Attributes``ASC``Attributes`从代理结构并将更改推回其本地`ASC`. 这允许`Attribute`复制使用 的`Pawn`相关性 和`NetUpdateFrequency`。`GameplayTags`此代理结构还复制位掩码中的一小部分白名单集合。这种优化减少了网络上的数据量，并使我们能够利用典当相关性。人工智能控制的`Pawns`已经使用了其相关性，因此他们不需要这种优化。`ASC``Pawn`

> 我不确定自那时以来所做的其他服务器端优化（复制图等）是否仍然有必要，并且它不是最可维护的模式。

*Epic 的 Dave Ratti 对[社区问题 #3 的回答](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)*



### 7.5 ASC 延迟加载

`AActors`Fortnite Battle Royale (FNBR)世界上有很多可损坏的物体（树木、建筑物等），每个物体都有一个[`ASC`](https://github.com/tranek/GASDocumentation#concepts-asc). 这会增加内存成本。`ASCs`FNBR通过仅在需要时（当它们第一次受到玩家伤害时）延迟加载来优化这一点。这减少了总体内存使用量，因为某些内存`AActors`可能永远不会在比赛中损坏。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 8. 生活质量建议



### 8.1 游戏效果容器

[GameplayEffectContainers](https://github.com/tranek/GASDocumentation#concepts-ge-containers)[`GameplayEffectSpecs`](https://github.com/tranek/GASDocumentation#concepts-ge-spec)将、[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)、[简单定位](https://github.com/tranek/GASDocumentation#concepts-targeting-containers)和相关功能组合到易于使用的结构中。这些非常适合转移`GameplayEffectSpecs`到由能力产生的射弹，然后将它们应用于稍后的碰撞。



### 8.2 绑定到 ASC 委托的蓝图 AsyncTasks

`ASC`为了增加设计人员友好的迭代时间，特别是在设计 UI 的 UMG Widget 时，请创建 Blueprint AsyncTasks（在 C++ 中）以直接从 UMG Blueprint 图表绑定到公共更改委托。唯一需要注意的是，它们必须手动销毁（就像销毁小部件时一样），否则它们将永远存在于内存中。示例项目包括三个蓝图 AsyncTask。

监听`Attribute`变化：

[![监听BP节点属性变化](https://github.com/tranek/GASDocumentation/raw/master/Images/attributeschange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/attributeschange.png)

监听冷却时间的变化：

[![监听冷却变化BP节点](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownchange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/cooldownchange.png)

监听`GE`堆栈变化：

[![监听 GameplayEffect Stack Change BP 节点](https://github.com/tranek/GASDocumentation/raw/master/Images/gestackchange.png)](https://github.com/tranek/GASDocumentation/raw/master/Images/gestackchange.png)

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 9. 故障排除



### 9.1`LogAbilitySystem: Warning: Can't activate LocalOnly or LocalPredicted ability %s when not local!`

需要[在客户端上](https://github.com/tranek/GASDocumentation#concepts-asc-setup)[初始化`ASC`](https://github.com/tranek/GASDocumentation#concepts-asc-setup)。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 9.2`ScriptStructCache`错误

你需要打电话[`UAbilitySystemGlobals::InitGlobalData()`](https://github.com/tranek/GASDocumentation#concepts-asg-initglobaldata)。





### 9.3 动画蒙太奇不会复制到客户端

确保使用的是`PlayMontageAndWait`Blueprint 节点，而不是[GameplayAbilities](https://github.com/tranek/GASDocumentation#concepts-ga)`PlayMontage`中的节点。该[AbilityTask](https://github.com/tranek/GASDocumentation#concepts-at)通过自动复制蒙太奇，而节点则不会。`ASC``PlayMontage`





### 9.4 复制蓝图 Actor 将 AttributeSets 设置为 nullptr

[虚幻引擎中](https://issues.unrealengine.com/issue/UE-81109)存在一个错误，对于从现有蓝图 Actor 类复制的蓝图 Actor 类，该错误会将`AttributeSet`类上的指针设置为 nullptr。有一些解决方法。我已经成功地不在`AttributeSet`我的类上创建定制指针（.h 中没有指针，不在`CreateDefaultSubobject`构造函数中调用），而是直接添加`AttributeSets`到`ASC`in `PostInitializeComponents()`（示例项目中未显示）。复制的`AttributeSets`仍将存在于`ASC's` `SpawnedAttributes`数组中。它看起来像这样：

```
void AGDPlayerState::PostInitializeComponents()
{
	Super::PostInitializeComponents();

	if (AbilitySystemComponent)
	{
		AbilitySystemComponent->AddSet<UGDAttributeSetBase>();
		// ... any other AttributeSets that you may have
	}
}
```



`AttributeSet`在这种情况下，将使用 上的函数读取和设置值，`ASC`而不是[调用`AttributeSet`由宏创建的](https://github.com/tranek/GASDocumentation#concepts-as-attributes)函数。

```
/** Returns current (final) value of an attribute */
float GetNumericAttribute(const FGameplayAttribute &Attribute) const;

/** Sets the base value of an attribute. Existing active modifiers are NOT cleared and will act upon the new base value. */
void SetNumericAttributeBase(const FGameplayAttribute &Attribute, float NewBaseValue);
```



所以`GetHealth()`看起来像这样：

```
float AGDPlayerState::GetHealth() const
{
	if (AbilitySystemComponent)
	{
		return AbilitySystemComponent->GetNumericAttribute(UGDAttributeSetBase::GetHealthAttribute());
	}

	return 0.0f;
}
```



设置（初始化）健康状况`Attribute`将类似于：

```
const float NewHealth = 100.0f;
if (AbilitySystemComponent)
{
	AbilitySystemComponent->SetNumericAttributeBase(UGDAttributeSetBase::GetHealthAttribute(), NewHealth);
}
```



提醒一下，`ASC`唯一期望每个类最多有一个`AttributeSet`对象`AttributeSet`。





### 9.5 未解析的外部符号 UEPushModelPrivate::MarkPropertyDirty(int,int)

如果收到类似以下的编译器错误：

```
error LNK2019: unresolved external symbol "__declspec(dllimport) void __cdecl UEPushModelPrivate::MarkPropertyDirty(int,int)" (__imp_?MarkPropertyDirty@UEPushModelPrivate@@YAXHH@Z) referenced in function "public: void __cdecl FFastArraySerializer::IncrementArrayReplicationKey(void)" (?IncrementArrayReplicationKey@FFastArraySerializer@@QEAAXXZ)
```



这是来自尝试`MarkItemDirty()`调用`FFastArraySerializer`. `ActiveGameplayEffect`我在更新冷却时间时遇到过这种情况。

```
ActiveGameplayEffects.MarkItemDirty(*AGE);
```



正在发生的事情是`WITH_PUSH_MODEL`在不止一个地方对其进行了定义。`PushModelMacros.h`将其定义为 0，而在多个地方将其定义为 1。`PushModel.h`将其视为 1，但`PushModel.cpp`将其视为 0。

解决方案是将其添加`NetCore`到的项目`PublicDependencyModuleNames`中`Build.cs`。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



### 9.6 枚举名称现在由路径名称表示

如果收到类似以下的编译器警告：

```
warning C4996: 'FGameplayAbilityInputBinds::FGameplayAbilityInputBinds': Enum names are now represented by path names. Please use a version of FGameplayAbilityInputBinds constructor that accepts FTopLevelAssetPath. Please update your code to the new API before upgrading to the next release, otherwise your project will no longer compile.
```



UE 5.1 已弃用`FString`在 的构造函数中使用`BindAbilityActivationToInputComponent()`。相反，我们必须传入一个`FTopLevelAssetPath`.

旧的、已弃用的方式：

```
AbilitySystemComponent->BindAbilityActivationToInputComponent(InputComponent, FGameplayAbilityInputBinds(FString("ConfirmTarget"),
	FString("CancelTarget"), FString("EGDAbilityInputID"), static_cast<int32>(EGDAbilityInputID::Confirm), static_cast<int32>(EGDAbilityInputID::Cancel)));
```



新方法：

```
FTopLevelAssetPath AbilityEnumAssetPath = FTopLevelAssetPath(FName("/Script/GASDocumentation"), FName("EGDAbilityInputID"));
AbilitySystemComponent->BindAbilityActivationToInputComponent(InputComponent, FGameplayAbilityInputBinds(FString("ConfirmTarget"),
	FString("CancelTarget"), AbilityEnumAssetPath, static_cast<int32>(EGDAbilityInputID::Confirm), static_cast<int32>(EGDAbilityInputID::Cancel)));
```



请参阅`Engine\Source\Runtime\CoreUObject\Public\UObject\TopLevelAssetPath.h`获取更多信息。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 10. 常见气体缩写词

| 姓名                                                         | 缩略语          |
| ------------------------------------------------------------ | --------------- |
| 能力系统组件                                                 | ASC             |
| 能力任务                                                     | 在              |
| [Epic 的动作角色扮演示例项目](https://www.unrealengine.com/marketplace/en-US/product/action-rpg) | ARPG, ARPG 示例 |
| 角色动作组件                                                 | 羧甲基纤维素钠  |
| 游戏能力                                                     | 遗传算法        |
| 游戏能力系统                                                 | 气体            |
| 游戏提示                                                     | GC              |
| 游戏效果                                                     | 通用电气        |
| 游戏效果执行计算                                             | ExecCalc，执行  |
| 游戏标签                                                     | 标签，GT        |
| 修改量计算                                                   | ModMagCalc、MMC |

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



## 11.其他资源

- [官方文档](https://docs.unrealengine.com/en-US/Gameplay/GameplayAbilitySystem/index.html)

- 源代码！

  - 尤其`GameplayPrediction.h`

- [Epic 的 Lyra 示例项目](https://unrealengine.com/marketplace/en-US/learn/lyra)

- [Epic 的动作角色扮演示例项目](https://www.unrealengine.com/marketplace/en-US/product/action-rpg)

- Unreal Slackers Discord

  有一个专门针对 GAS 的文本频道

  ```
  #gameplay-ability-system
  ```

  - 检查固定消息

- [Dan 'Pan' 的 GitHub 资源库](https://github.com/Pantong51/GASContent)

- [SabreDartStudios 的 YouTube 视频](https://www.youtube.com/channel/UCCFUhQ6xQyjXDZ_d6X_H_-A)



### 11.1 Epic Game 的 Dave Ratti 问答



#### 11.1.1 社区问题 1

[Dave Ratti 回答了 Unreal Slackers Discord Server 社区有关 GAS 的问题](https://epicgames.ent.box.com/s/m1egifkxv3he3u3xezb9hzbgroxyhx89)：

1. 我们如何根据外部或无关的需求创建范围预测窗口`GameplayAbilities`？`GameplayEffect`例如，发射后不管的射弹如何在击中敌人时局部预测伤害？

> PredictionKey 系统并不是真的要这样做。从根本上讲，该系统的工作原理是客户端启动预测操作，用密钥告诉服务器有关该操作的信息，然后客户端和服务器都运行相同的操作，并将预测副作用与给定的预测密钥相关联。例如，“我正在预测性地激活一项能力”或“我已经生成了目标数据，并将在 WaitTargetData 任务之后预测性地运行能力图的一部分”。
>
> 通过这种模式，PredictionKey 从服务器“弹回”并通过 UAbilitySystemComponent::ReplicatedPredictionKeyMap（复制属性）返回客户端。一旦密钥从服务器复制回来，客户端就能够撤消所有本地预测副作用（GameplayCues、GameplayEffects）：复制的版本将在*那里*如果不是，那就是一个错误的预测。准确地知道何时消除预测副作用至关重要：如果太早，会看到差距，如果太晚，将看到“双重”。（请注意，这是指状态预测，例如基于持续时间的游戏效果的循环 GameplayCue。“突发”GameplayCues 和即时游戏效果永远不会“撤消”或回滚。如果存在预测键，它们只会在客户端上跳过与他们有关）。
>
> 为了进一步切中要害：至关重要的是，预测操作是服务器不会自行执行的操作，而是仅在客户端告诉它们时才执行。因此，通用的“按需创建密钥并告诉服务器以便我可以运行某些内容”是行不通的，除非该“某些内容”是服务器仅在客户端告诉一次后才会执行的操作。
>
> 回到最初的问题：像着火后忘记弹丸之类的东西。Paragon 和 Fornite 都有使用 GameplayCues 的投射物 Actor 类。然而，我们不使用预测密钥系统来执行这些操作。相反，我们有一个关于非复制游戏提示的概念。仅在本地触发并被服务器完全跳过的游戏提示。本质上，所有这些都是对 UGameplayCueManager::HandleGameplayCue 的直接调用。它们不通过 UAbilitySystemComponent 进行路由，因此不会进行预测密钥检查/提前返回。
>
> 非复制 GameplayCues 的缺点是，它们没有被复制。因此，由射弹类/蓝图来确保调用这些函数的代码路径在每个人上运行。我们有启动（在 BeginPlay 中调用）、爆炸、撞墙/角色等提示。
>
> 这些类型的事件已经在客户端生成，因此调用非复制的游戏提示没什么大不了的。复杂的蓝图可能很棘手，并且需要作者确保他们了解什么在哪里运行。

1. 当使用`WaitNetSync` `AbilityTask`with`OnlyServerWait`在本地预测中创建范围预测窗口时`GameplayAbility`，玩家是否可能通过延迟发送到服务器的数据包来控制`GameplayAbility`时间来作弊，因为服务器正在等待带有预测密钥的 RPC？Paragon 或 Fortnite 中是否曾出现过这个问题？如果是，Epic 采取了什么措施来解决这个问题？

> 是的，这是一个合理的担忧。在等待客户端“信号”的服务器上运行的任何能力蓝图都可能容易受到滞后开关类型的攻击。
>
> Paragon 有一个类似于 UAbilityTask_WaitTargetData 的自定义定位任务。在此任务中，我们有超时或“最大延迟”，我们将在客户端上等待瞬时定位模式。如果目标模式正在等待用户确认（按下按钮），那么它将被忽略，因为用户可以慢慢来。但对于立即确认目标的能力，我们只会等待一定的时间，然后A）生成目标数据服务器端或B）取消该能力。
>
> 我们从未有过这样的 WaitNetSync 机制，我们很少使用它。
>
> 我不相信《堡垒之夜》会使用这样的东西。《堡垒之夜》中的武器能力经过特殊处理，批量发送到单个《堡垒之夜》特定的 RPC：一个 RPC 可以激活该能力、提供目标数据并结束该能力。因此，在大逃杀中，武器能力本质上不会受到此影响。
>
> 我的看法是，这可能是可以在整个系统范围内解决的问题，但我认为我们不会很快做出改变。现场修复 WaitNetSync 以包括提到的情况的最大延迟可能是一项合理的任务，但同样 - 我们不太可能在不久的将来这样做。

1. Paragon 和 Fortnite 使用了哪`EGameplayEffectReplicationMode`一个？Epic 对于何时使用它们的建议是什么？

> 这两款游戏本质上都对玩家控制的角色使用混合模式，对人工智能控制的角色使用最小模式（人工智能小兵、丛林小兵、人工智能尸壳等）。这是我建议大多数人在多人游戏中使用该系统的方式。在项目中越早设置这些越好。
>
> 《堡垒之夜》在优化方面更进一步。实际上，它根本不会为模拟代理复制 UAbilitySystemComponent。组件和属性子对象在拥有的 Fortnite 玩家状态类上的 ::ReplicateSubobjects() 内跳过。我们确实将最基本的复制数据从能力系统组件推送到 pawn 本身的结构（基本上，我们在位掩码中复制的属性值的子集和标签的白名单子集）。我们称之为“代理”。在接收端，我们获取在 pawn 上复制的代理数据，并将其推回到玩家状态的能力系统组件中。因此，FNBR 中的每个玩家确实都有一个 ASC，它只是不直接复制：相反，它通过 pawn 上的最小代理结构复制数据，然后路由回接收端的 ASC。
>
> 我不确定自那时以来所做的其他服务器端优化（复制图等）是否仍然有必要，并且它不是最可维护的模式。

1. `GameplayEffects`由于我们无法预测的删除`GameplayPrediction.h`，是否有任何策略可以减轻延迟对删除的影响`GameplayEffects`？例如，当移除移动速度较慢时，我们目前必须等待服务器复制移除操作，`GameplayEffect`从而导致玩家角色位置的捕捉。

> 这是一个很难的问题，我没有一个好的答案。我们通常通过公差和平滑来回避这些问题。我完全同意能力系统和与角色运动系统的精确同步不是一个好的地方，也是我们确实想要修复的地方。
>
> 我有一个允许预测性删除 GE 的架子，但在必须继续之前永远无法解决所有边缘情况。但这并不能解决所有问题，因为角色移动仍然有一个内部保存的移动缓冲区，它对能力系统和可能的移动速度修改器等一无所知。即使在无法进行的情况下，仍然有可能进入校正反馈循环预测 GE 的去除。
>
> 如果你认为你遇到了真正绝望的情况，你可以预测性地添加一个会抑制你移动速度的 GE。我自己从来没有这样做过，但之前已经对此进行了理论分析。它可能能够帮助解决某一类问题。

1. 我们知道Paragon 和 Fortnite 以及Action RPG Sample 中`AbilitySystemComponent`的生命。Epic 的内部规则、指南或建议是什么？`PlayerState``Character``Owner`

> 一般来说，我会说任何不需要重生的东西都应该让所有者和阿凡达演员是同一件事。任何 AI 敌人、建筑物、世界道具等。
>
> 任何重生的东西都应该有不同的所有者和头像，这样能力系统组件就不需要在重生后保存/重新创建/恢复。PlayerState 是逻辑选择，它被复制到所有客户端（而 PlayerController 则不然）。缺点是 PlayerStates 总是相关的，因此可能会在 100 名玩家的游戏中遇到问题（请参阅问题 #3 中 FN 所做的说明）。

1. 是否可以拥有多个`AbilitySystemComponents`具有相同所有者但不同头像的东西（例如，在典当和武器/物品/射弹上`Owner`设置为`PlayerState`）？

> 我看到的第一个问题是在拥有的 Actor 上实现 IGameplayTagAssetInterface 和 IAbilitySystemInterface。前者可能是可能的：仅聚合来自所有 ASC 的标签（但请注意 - HasAllMatchingGameplayTags 可能只能通过跨 ASC 聚合来满足。仅将调用转发到每个 ASC 并将结果或在一起是不够的）。但后者更加棘手：哪一个 ASC 才是权威的？如果有人想申请 GE - 哪一个应该获得它？也许你可以解决这些问题，但问题的这一面将是最难的：所有者将在他们下面放置多个 ASC。
>
> 不过，棋子和武器上的单独 ASC 本身就有意义。例如，区分描述武器的标签和描述拥有棋子的标签。也许授予武器的标签也“适用于”所有者而不是其他东西确实有意义（例如，属性和 GE 是独立的，但所有者将像我上面描述的那样聚合拥有的标签）。我确信这会成功。但同一所有者拥有多个 ASC 可能会很冒险。

1. 有没有办法阻止服务器覆盖拥有客户端的本地预测能力的冷却时间？在高延迟的情况下，这将使拥有的客户端在其本地冷却时间到期但在服务器上仍处于冷却状态时“尝试”再次激活该能力。当拥有客户端的激活请求通过网络到达服务器时，服务器可能已停止冷却，或者服务器可能能够在其剩余的毫秒内将激活请求排队。否则，与延迟较低的客户端相比，延迟较高的客户端在重新激活功能之前会有更长的延迟。这在冷却时间非常低的能力（例如冷却时间可能少于一秒的基本攻击）中最为明显。如果没有办法阻止服务器覆盖本地预测能力的冷却时间，那么 Epic 减轻高延迟对重新激活能力的影响的策略是什么？换句话说，Epic是如何设计Paragon的基础攻击和其他能力，让高延迟玩家能够以与低延迟玩家相同的速度进行本地预测的攻击或激活？

> 简而言之，没有办法阻止这种情况发生，Paragon 肯定有这个问题。较高的延迟连接在基本攻击中具有较低的 ROF。
>
> 我尝试通过添加“GE 协调”来解决此问题，其中在计算 GE 持续时间时考虑了延迟。本质上是允许服务器占用总 GE 时间的一部分，以便 GE 客户端的有效时间与任何延迟量都 100% 一致（尽管波动仍然可能导致问题）。然而，我从来没有让它在可以交付的状态下工作，而且项目进展得很快，我们只是从未完全解决它。
>
> Fortnite 自己记录武器射击频率：它不使用 GE 来计算武器的冷却时间。如果这对的游戏来说是一个关键问题，我会推荐这样做。

1. Epic 针对 GameplayAbilitySystem 插件的路线图是什么？Epic 计划在 2019 年及以后添加哪些功能？

> 我们认为目前整个系统相当稳定，我们没有任何人致力于主要的新功能。有时会针对《堡垒之夜》或 UDN/拉取请求进行错误修复和小改进，但现在就是这样。
>
> 从长远来看，我认为我们最终会进行“V2”或一些重大改变。我们从编写这个系统中学到了很多东西，并且感觉我们有很多正确的地方，也有很多错误的地方。我希望有机会纠正这些错误并改进上面指出的一些致命缺陷。
>
> 如果 V2 即将到来，提供升级路径将至关重要。我们永远不会制作 V2，而将《堡垒之夜》永远保留在 V1 上：会有一些路径或程序会尽可能自动迁移，尽管几乎肯定仍然需要一些手动重制。
>
> 高优先级修复将是：
>
> - 与角色移动系统更好的互操作性。统一客户预测。
> - GE 去除预测（问题#4）
> - GE 延迟协调（问题#7）
> - 通用网络优化，例如批处理 RPC 和代理结构。主要是我们为《堡垒之夜》所做的事情，但找到了将其分解为更通用形式的方法，至少这样游戏就可以更轻松地编写自己的游戏特定优化。
>
> 我会考虑进行更一般的重构类型的更改：
>
> - 我希望从根本上摆脱让 GE 直接引用电子表格值的做法，相反，它们将能够发出参数，并且这些参数可以由绑定到电子表格值的一些更高级别的对象来填充。当前模型的问题在于，GE 由于与曲线表行紧密耦合而变得不可共享。我认为可以编写一个通用的参数化系统，并将其作为 V2 系统的基础。
> - 减少 UGameplayAbility 上的“策略”数量。我会删除 ReplicationPolicy 和 InstancingPolicy。在我看来，复制实际上几乎从未被需要，并且会导致混乱。应通过将 FGameplayAbilitySpec 设为可子类化的 UObject 来替换 InstancingPolicy。这应该是具有事件且可蓝图化的“非实例化能力对象”。UGameplayAbility 应该是“每次执行实例化”对象。如果需要实际实例化，它可以是可选的：相反，“非实例化”能力将通过新的 UGameplayAbilitySpec 对象来实现。
> - 系统应该提供更多“中层”构造，例如“过滤的 GE 应用程序容器”（数据驱动哪些 GE 应用到具有更高级别游戏逻辑的参与者）、“重叠卷支持”（应用基于“过滤的 GE 应用程序容器”）碰撞原语重叠事件）等。这些是每个项目最终以自己的方式实现的构建块。让它们正确并不是一件小事，所以我认为我们应该做得更好，提供一些基本的实现。
> - 一般来说，减少项目启动和运行所需的样板文件。可能是一个单独的模块“Ex库”或任何可以提供诸如被动能力或开箱即用的基本命中扫描武器之类的东西。该模块是可选的，但可以让快速启动并运行。
> - 我想将 GameplayCues 移至不与能力系统耦合的单独模块。我认为这里可以进行很多改进。

> 这仅是我个人的意见，不代表任何人的承诺。我认为最现实的行动方案将是随着新的引擎技术计划的实施，能力系统将需要更新，这将是做此类事情的时候。这些举措可能与脚本、网络或物理/角色运动有关。不过，这一切都是非常遥远的未来，所以我无法对时间表做出承诺或估计。

**[⬆回到顶部](https://github.com/tranek/GASDocumentation#table-of-contents)**



#### 11.1.2 社区问题2

社区成员[iniside](https://github.com/iniside)与 Dave Ratti 的问答：

1. 是否计划支持解耦固定报价？我希望修复游戏线程（例如 30/60fps）并让渲染线程疯狂运行。我问这是否是我们未来应该期待的事情，对游戏玩法应该如何运作做出一些假设。我问这个问题主要是因为现在物理有一个固定的异步刻度，这提出了一个问题：系统的其余部分将来如何工作。我并不隐瞒，能够拥有固定的滴答游戏线程而不同时修复引擎其余部分的滴答率将是非常棒的。

> 没有计划将渲染帧速率和游戏线程滴答帧速率解耦。我认为由于这些系统的复杂性以及保持与先前发动机版本的向后兼容性的要求，这艘船已经在这种情况下航行了。
>
> 相反，我们的方向是拥有一个异步“物理线程”，它以固定的滴答率运行，独立于游戏线程。需要以固定速率运行的东西可以在这里运行，游戏线程/渲染可以按照它们一贯的方式运行。
>
> 值得澄清的是，网络预测支持所谓的独立计时和固定计时模式。我的长期计划是保持独立计时在网络预测中的大致样子，它以可变帧速率在游戏线程上运行，并且没有“组/世界”预测，它只是经典的“客户端预测自己的棋子并拥有的演员”模型。固定滴答将使用异步物理内容，并允许预测非客户端控制/拥有的参与者，例如物理对象和其他客户端/典当/车辆/等。

1. 网络预测与能力系统的整合有什么计划吗？例如，固定帧能力激活（因此服务器获取激活能力并执行任务的帧，而不是预测密钥）？

> 是的，计划是重写/删除能力系统的预测密钥并用网络预测结构替换它们。NetworkPredictionExtras 中的 MockAbility 示例展示了其工作原理，但它们比 GAS 所需的更加“硬编码”。
>
> 主要思想是我们删除 ASC RPC 中显式的客户端->服务器预测密钥交换。将不再有预测窗口或范围预测键。相反，一切都将围绕 NetworkPrediction 框架进行。重要的是客户端和服务器在事情发生时达成一致。例子是：
>
> - 能力何时被激活/结束/取消
> - 何时应用/删除游戏效果
> - 属性值（帧 X 处的属性值是什么）
>
> 我认为这通常可以在能力系统层面上完成。但实际上使 UGameplayAbility 内的用户定义逻辑完全可回滚仍然需要更多工作。我们最终可能会得到一个完全可回滚的 UGameplayAbility 子类，并且可以访问一组更有限的功能，或者只能访问标记为回滚友好的能力任务。类似的事情。对于动画事件和根运动以及它们的处理方式也有很多影响。
>
> 希望我有一个更明确的答案，但在再次接触 GAS 之前，我们必须打好基础，这一点非常重要。在改变更高层次的系统之前，运动和物理必须是可靠的。

1. 是否有计划将网络预测开发移向主分支？不会撒谎，我真的很想检查最新的代码。不管它的状态如何。

> 我们正在为此努力。系统工作仍然全部在 NetworkPrediction 中完成（请参阅 NetworkPhysics.h），并且底层异步物理内容应该全部可用（RewindData.h 等）。但我们在《堡垒之夜》中也有我们一直关注的用例，但显然不能公开。我们正在解决错误、性能优化等。
>
> 更多背景信息：在开发该系统的早期版本时，我们非常关注事物的“前端”——如何定义和编写状态和模拟。我们在那里学到了很多东西。但随着异步物理的东西已经上线，我们更加专注于让一些真实的东西在这个系统中工作，而代价是抛弃我们早期的一些抽象。这里的目标是回到真正的事情正在发挥作用并重新统一事物的时候。例如，回到“前端”并在我们现在正在研究的核心技术之上制作最终版本。

1. 一段时间以来，主分支上有一个用于发送游戏消息的插件（看起来像事件/消息总线），但它已被删除。有计划恢复吗？借助游戏功能/模块化游戏插件，拥有通用事件总线调度程序将非常有用。

> 我认为指的是 GameplayMessages 插件。这可能会在某个时候再次出现——API 还没有真正最终确定，而且作者并没有打算将其公开。我同意它对于模块化游戏设计应该很有用。但这不是我的领域，所以我没有更多信息。

1. 我最近一直在玩异步固定物理，结果很有希望，但如果将来会有 NP 更新，我可能只会玩玩并等待，因为要让它工作，我仍然需要将整个引擎放入固定刻度，另一方面我尝试将物理速度保持在 33 毫秒。如果一切都是 30 fps (:.

我注意到有一些关于 Async CharacterMovementComponent 的工作，但不确定这是否会使用网络预测，或者这是一项单独的工作？

由于我注意到了这一点，我也继续尝试以固定的滴答率实现我的自定义异步运动，这工作得很好，但除此之外，我还需要添加一个单独的插值更新。设置是在单独的工作线程上以固定的 33 毫秒更新运行模拟刻度，进行计算，保存结果，并在游戏线程中对其进行插值以匹配当前帧速率。并不完美，但它完成了工作。

我的问题是，这是否是将来更容易设置的东西，因为需要编写相当多的样板代码（插值部分），并且单独插值每个移动对象并不是特别有效。

异步的东西真的很有趣，因为它允许真正以固定的更新速率运行游戏模拟（这将使得不需要固定线程）并获得更可预测的结果。这是未来的打算，还是对某些系统有更多好处？据我记得，演员变换不是异步更新的，蓝图也不完全是线程安全的。换句话说，是计划在更多框架级别上提供支持，还是每个游戏都必须自己解决？

> 异步角色移动组件
>
> 这基本上是 CMC 移植到物理线程的早期原型/实验。我还不认为它是 CMC 的未来，但它可能会发展成那样。目前还没有网络支持，所以我不会真正关注它。从事这项工作的人主要关心的是测量该系统将增加的输入延迟以及如何减轻这种延迟。
>
> 我仍然需要让整个引擎进入固定滴答状态，另一方面我尝试将物理速度保持在 33 毫秒。如果一切都是 30 fps (:.
>
> 异步的东西真的很有趣，因为它可以让你真正以固定的更新速率运行游戏模拟（这将使固定线程变得不需要）
>
> 是的。这里的目标是，启用异步物理后，可以以可变滴答速率运行引擎，而物理和“核心”游戏模拟可以以固定速率运行（例如角色移动、车辆、气体等）。
>
> 这些是现在需要设置来启用此功能的 cvar：（我认为已经弄清楚了）
> `p.DefaultAsyncDt=0.03333`
> `p.RewindCaptureNumFrames=64`
>
> Chaos 确实提供了物理状态的插值（例如，被推回到 UPrimitiveComponent 并对游戏代码可见的变换）。现在有一个 cvar，`p.AsyncInterpolationMultiplier`如果想查看它，它可以控制它。应该看到物理体的平滑连续运动，而无需编写任何额外的代码。
>
> 如果想插入非物理状态，现在仍然由决定。该示例就像想要在异步物理线程上更新（勾选）的冷却，但在游戏线程上看到平滑的连续插值，以便更新每个渲染帧的冷却可视化。我们最终会谈到这一点，但还没有例子。
>
> 只需要编写相当多的样板代码，
>
> 是的，到目前为止，这一直是系统的一个大问题。我们希望提供一个界面，经验丰富的程序员可以使用它来最大限度地提高性能和安全性（能够编写可预测的“正常工作”的游戏代码，而不会出现大量危险和可以做但更好不做的事情）。因此，像CharacterMoverment这样的东西可能会做一些自定义的事情来最大化其性能 - 例如，编写模板代码并进行批量更新，扩大范围，将更新循环分成不同的阶段等。我们希望提供一个良好的“低级”接口此用例的异步线程和回滚系统。在这种情况下 - 角色移动系统本身以自己的方式进行扩展仍然是合理的。
>
> 但我们认识到，对于并不真正需要自己的“系统”的简单游戏对象来说，这是不可接受的。我们需要的是更符合虚幻的东西。例如，使用反射系统、具有通用蓝图支持等。还有在其他线程上使用蓝图的示例（请参阅 BlueprintThreadSafe 关键字以及动画系统一直在努力的方向）。所以我认为有一天会以某种形式出现。但同样，我们还没有到那一步。
>
> 我知道你只是在问插值，但这是一般的答案：现在我们让你手动完成所有事情，如 NetSerialize、ShouldReconcile、Interpolate 等，但最终我们会有一种方法，就像“如果你想只使用反射系统，你不必手动编写这些东西”。我们只是不想*强迫*每个人都使用反射系统，因为这会带来其他限制，我们认为我们不想在系统的最低级别上采用这些限制。
>
> 然后将其与我之前所说的联系起来 - 现在我们真正专注于让一些非常具体的示例工作和高性能，然后我们将把注意力转回前端并使事情易于使用和迭代，减少样板文件等供其他人使用。





## 12. GAS 变更日志

这是根据官方虚幻引擎升级变更日志和我遇到的未记录的更改编译的 GAS 显着更改（修复、更改和新功能）的列表。如果发现此处未列出的内容，请提出问题或拉取请求。



### 5.2

- 错误修复：修复了函数中的崩溃问题`UAbilitySystemBlueprintLibrary::MakeSpecHandle`。
- 错误修复：修复了游戏能力系统中的逻辑，其中非受控 Pawn 将被视为远程，即使它是在服务器本地生成的（例如车辆）。
- 错误修复：正确设置被服务器拒绝的预测实例能力的激活信息。
- 错误修复：修复了可能导致 GameplayCues 卡在远程实例上的错误。
- 错误修复：修复了链接调用 WaitGameplayEvent 时的内存占用问题。
- `GetOwnedGameplayTags()`Bug 修复：当多次执行同一节点时，调用 Blueprint 中的 SkillSystemComponent函数不再保留上一次调用的返回值。
- 错误修复：修复了 GameplayEffectContext 复制对永远不会复制的动态对象的引用的问题。
  - 这使得 GameplayEffect 无法`Owner->HandleDeferredGameplayCues(this)`像`bHasMoreUnmappedReferences`往常一样调用。
- 新功能：[游戏定位系统](https://docs.unrealengine.com/en-US/gameplay-targeting-system-in-unreal-engine/)是一种创建数据驱动的定位请求的方法。
- 新增内容：添加了对 GameplayTag 查询的自定义序列化支持。
- 新增内容：添加了对复制派生 FGameplayEffectContext 类型的支持。
- 新增内容：资产中的游戏属性现在在保存时注册为可搜索名称，允许在参考查看器中查看对属性的引用。
- 新增内容：为AbilitySystemComponent 添加了一些基本单元测试。
- 新增内容：游戏能力系统属性现在尊重核心重定向。这意味着现在可以在代码中重命名属性集及其属性，并通过向 DefaultEngine.ini 添加重定向条目，将它们正确加载到使用旧名称保存的资源中。
- 更改：允许从代码更改游戏效果修改器的评估通道。
- 更改：`FGameplayModifierInfo::Magnitude`从游戏能力插件中删除了以前未使用的变量。
- 更改：删除了能力系统组件和智能对象实例标签之间的同步逻辑。

https://docs.unrealengine.com/5.2/en-US/unreal-engine-5.2-release-notes/



### 5.1

- 错误修复：修复了复制的松散游戏标签未复制给所有者的问题。
- 错误修复：修复了能力任务错误，该错误可能会阻止及时进行垃圾收集。
- 错误修复：修复了根据标签监听激活的游戏能力无法激活的问题。如果有多个游戏能力正在侦听此标签，并且列表中的第一个游戏能力无效或无权激活，就会发生这种情况。
- 错误修复：修复了加载警告时正确使用数据注册表的 GameplayEffects，并改进了警告文本。
- 错误修复：从 UGameplayAbility 中删除了代码，该代码错误地仅使用蓝图调试器注册最后一个实例化能力的断点。
- 错误修复：修复了如果在 ApplyGameplayEffectSpecToTarget 内锁定期间调用 EndAbility，游戏能力系统能力会卡住的问题。
- 新增内容：添加了对游戏效果的支持，以添加阻止的能力标签。
- 新增内容：添加了 WaitGameplayTagQuery 节点。一种基于 UAbilityTask，另一种基于 UAbilityAsync。该节点指定一个 TagQuery，并根据配置在查询变为 true 或 false 时触发其输出引脚。
- 新增功能：修改了控制台变量中的 SkillTask 调试，以在非发布版本中默认启用调试记录和打印（能够根据需要打开/关闭热修复功能）。
- 新增功能：现在可以将 SkillSystem.AbilityTask.Debug.RecordingEnabled 设置为 0 来禁用，设置为 1 来在非发布版本中启用，设置为 2 来启用所有构建（包括发布）。
- 新增内容：可以使用AbilitySystem.AbilityTask.Debug.AbilityTaskDebugPrintTopNResults 仅打印日志中的前N 个结果（以避免日志垃圾邮件）。
- 新增功能：STAT_AbilityTaskDebugRecording 可用于测试这些默认调试更改对性能的影响。
- 新增内容：添加了一个调试命令来过滤 GameplayCue 事件。
- 新增内容：向游戏能力系统添加了新的调试命令AbilitySystem.DebugAbilityTags、AbilitySystem.DebugBlockedTags 和AbilitySystem.DebugAttribute。
- 新增内容：添加了蓝图函数来获取游戏属性的调试字符串表示形式。
- 新增内容：添加了新的游戏任务资源重叠策略以取消现有任务。
- 更改：现在能力任务应确保仅在对能力指针执行所需操作后才调用 Super::OnDestroy，因为调用它后它将被清空。
- 更改：将 FGameplayAbilitySpec/Def::SourceObject 转换为弱引用。
- 更改：将能力任务中的能力系统组件引用设为弱指针，以便垃圾收集可以将其删除。
- 更改：删除了多余的枚举 EWaitGameplayTagQueryAsyncTriggerCondition。
- 更改：GameplayTasksComponent 和AbilitySystemComponent 现在支持注册的子对象API。
- 更改：添加了更好的日志记录以指示游戏功能无法激活的原因。
- 更改：删除了 SkillSystem.Debug.NextTarget 和 PrevTarget 命令，以支持全局 HUD NextDebugTarget 和 PrevDebugTarget 命令。

https://docs.unrealengine.com/5.1/en-US/unreal-engine-5.1-release-notes/



### 5.0

https://docs.unrealengine.com/5.0/en-US/unreal-engine-5.0-release-notes/



### 4.27

- 崩溃修复：修复了根运动源问题，当 Actor 完成使用带有强度随时间修改器的恒力根运动任务的能力时，联网客户端可能会崩溃。
- 错误修复：修复了使用 GameplayCues 时编辑器加载时间的回归。
- 错误修复：如果设置相同的 EffectLevel，GameplayEffectsContainer 的`SetActiveGameplayEffectLevel`方法将不再弄脏 FastArray。
- 错误修复：修复了 GameplayEffect 混合复制模式中的一个边缘情况，其中未明确拥有网络连接但使用该连接的 Actor`GetNetConnection`将不会收到混合复制更新。
- 错误修复：修复了 GameplayAbility 的类方法中发生的无限递归，该方法是通过再次`EndAbility`调用来调用的。`EndAbility``K2_OnEndAbility`
- 错误修复：如果在注册标签之前加载 GameplayTags 蓝图引脚，则它们将不再被静默清除。它们现在与 GameplayTag 变量的工作方式相同，并且可以使用项目设置中的 ClearInvalidTags 选项更改两者的行为。
- 错误修复：改进了 GameplayTag 操作的线程安全性。
- 新增内容：将 SourceObject 暴露给 GameplayAbility 的`K2_CanActivateAbility`方法。
- 新内容：本机游戏标签。引入一个新的`FNativeGameplayTag`，使得在加载和卸载模块时正确注册和取消注册的一次性本机标签成为可能。
- 新增内容：更新`GiveAbilityAndActivateOnce`为传入 FGameplayEventData 参数。
- 新增内容：改进了 GameplayAbilities 插件中的 ScalableFloats，以支持从新的数据注册表系统动态查找曲线表。添加了 ScalableFloat 标头，以便更轻松地在功能插件之外重用通用结构。
- 新增内容：添加了通过 GameplayTagsEditorModule 在其他编辑器自定义中使用 GameplayTag UI 的代码支持。
- 新增内容：修改了 UGameplayAbility 的 PreActivate 方法以选择性地接收触发事件数据。
- 新增内容：添加了更多支持，以使用特定于项目的过滤器在编辑器中过滤 GameplayTags。`OnFilterGameplayTag`提供引用属性和标签源，因此可以根据请求标签的资产来过滤标签。
- `SetContext`新增内容：添加了在初始化后调用GameplayEffectSpec 的类方法时保留原始捕获的 SourceTags 的选项。
- 新增内容：改进了用于从特定插件注册 GameplayTags 的 UI。新的标签 UI 现在允许为新添加的 GameplayTag 源选择磁盘上的插件位置。
- 新增内容：Sequencer 中添加了一个新轨道，以允许触发使用 GameplayAbiltiySystem 构建的 Actor 上的通知状态。与通知一样，GameplayCueTrack 可以利用基于范围的事件或基于触发器的事件。
- 更改：更改了 GameplayCueInterface 以通过引用传递 GameplayCueParameters 结构。
- 优化：对加载和重新生成 GameplayTag 表进行了多项性能改进，以便优化此选项。

https://docs.unrealengine.com/en-US/WhatsNew/Builds/ReleaseNotes/4_27/



### 4.26

- GAS 插件不再标记为测试版。
- 崩溃修复：修复了在没有选择有效标签源的情况下添加游戏标签时发生的崩溃问题。
- 崩溃修复：将路径字符串 arg 添加到消息中以修复 UGameplayCueManager::VerifyNotifyAssetIsInValidPath 中的崩溃。
- 崩溃修复：修复了在使用 ptr 而不检查它时，AbilitySystemComponent_Abilities 中的访问冲突崩溃。
- 错误修复：修复了堆叠 GE 时不会重置所应用效果的其他实例的持续时间的错误。
- 错误修复：修复了导致 CancelAllAbilities 仅取消非实例能力的问题。
- 新增内容：为游戏能力提交功能添加了可选标签参数。
- 新增内容：向 PlayMontageAndWait 能力任务添加了 StartTimeSeconds 并改进了注释。
- 新增内容：向 FGameplayAbilitySpec 添加了标签容器“DynamicAbilityTags”。这些是与规范一起复制的可选能力标签。它们还被应用的游戏效果捕获为源标签。
- 新增内容：现在可以从蓝图调用 GameplayAbility IsLocallyControlled 和 HasAuthority 函数。
- 新增内容：如果我们当前正在记录可视记录数据，可视记录器现在将仅收集和存储有关即时 GE 的信息。
- 新增内容：增加了对蓝图节点中游戏属性引脚重定向器的支持。
- 新增内容：添加了新功能，当与根运动相关的能力任务结束时，它们会将运动组件的运动模式返回到任务开始之前的运动模式。

https://docs.unrealengine.com/en-US/WhatsNew/Builds/ReleaseNotes/4_26/



### 4.25.1

- 固定的！UE-92787 使用“获取浮动属性”节点保存蓝图时出现崩溃，且属性引脚设置为内联
- 固定的！UE-92810 实例可编辑游戏标签属性已内联更改的崩溃生成 Actor



### 4.25

- 固定预测`RootMotionSource` `AbilityTasks`
- [`GAMEPLAYATTRIBUTE_REPNOTIFY()`](https://github.com/tranek/GASDocumentation#concepts-as-attributes)现在另外接受旧`Attribute`值。我们必须将其作为可选参数提供给我们的`OnRep`函数。以前，它是读取属性值来尝试获取旧值。但是，如果从复制函数调用，则在到达 SetBaseAttributeValueFromReplication 之前旧值已被丢弃，因此我们将获得新值。
- 添加[`NetSecurityPolicy`](https://github.com/tranek/GASDocumentation#concepts-ga-netsecuritypolicy)到`UGameplayAbility`.
- 崩溃修复：修复了在没有选择有效标签源的情况下添加游戏标签时发生的崩溃问题。
- 崩溃修复：删除了攻击者通过能力系统使服务器崩溃的几种方法。
- 崩溃修复：我们现在确保在检查标签要求之前有 GameplayEffect 定义。
- 错误修复：修复了游戏标签类别不适用于蓝图中的函数参数（如果它们是函数终止符节点的一部分）的问题。
- 错误修复：修复了游戏效果标签未通过多个视口复制的问题。
- 错误修复：修复了循环触发能力时，InternalTryActivateAbility 函数可能会使游戏能力规范失效的错误。
- 错误修复：更改了我们处理更新标签计数容器内的游戏标签的方式。当推迟父标签的更新同时删除游戏标签时，我们现在将在父标签更新后调用与更改相关的委托。这确保了代表广播时标签表处于一致的状态。
- 错误修复：我们现在在确认目标时在内部迭代之前创建生成的目标 actor 数组的副本，因为某些回调可能会修改该数组。
- 错误修复：修复了以下错误：堆叠 GameplayEffects 不会重置正在应用的其他效果实例的持续时间，并且由调用者设置持续时间，只会为堆栈上的第一个实例正确设置持续时间。堆栈中的所有其他 GE 规范的持续时间均为 1 秒。添加了自动化测试来检测这种情况。
- 错误修复：修复了处理游戏事件委托修改游戏事件委托列表时可能发生的错误。
- 错误修复：修复了导致 GiveAbilityAndActivateOnce 行为不一致的错误。
- 错误修复：重新排序 FGameplayEffectSpec::Initialize 中的一些操作以处理潜在的排序依赖性。
- 新增内容：UGameplayAbility 现在具有 OnRemoveAbility 函数。它遵循与 OnGiveAbility 相同的模式，并且仅在能力的主实例或类默认对象上调用。
- 新增内容：显示被阻止的能力标签时，调试文本现在包括被阻止的标签总数。
- 新增内容：将 UAbilitySystemComponent::InternalServerTryActiveAbility 重命名为 UAbilitySystemComponent::InternalServerTryActivateAbility。调用InternalServerTryActiveAbility 的代码现在应该调用InternalServerTryActivateAbility。
- 新增内容：添加或删除标签时，继续使用过滤文本来显示游戏标签。先前的行为清除了过滤器。
- 新增：当我们在编辑器中添加新标签时，不要重置标签源。
- 新增内容：添加了查询能力系统组件以获取具有一组指定标签的所有活动游戏效果的功能。新函数称为 GetActiveEffectsWithAllTags，可以通过代码或蓝图访问。
- 新增内容：当与根运动相关的能力任务结束时，它们现在会将运动组件的运动模式返回到任务开始之前的运动模式。
- 新增内容：使 SpawnedAttributes 变得短暂，因此它不会保存可能变得陈旧和不正确的数据。添加了空检查以防止传播任何当前保存的陈旧数据。这可以防止与存储在 SpawnedAttributes 中的不良数据相关的问题。
- API 更改：AddDefaultSubobjectSet 已被弃用。应改用 AddAttributeSetSubobject。
- 新增内容：游戏能力现在可以指定要在其上播放蒙太奇的动画实例。

https://docs.unrealengine.com/en-US/WhatsNew/Builds/ReleaseNotes/4_25/



### 4.24

- 修复了编译时`Attribute`重置为蓝图节点变量的问题。`None`

- 需要调用才能[`UAbilitySystemGlobals::InitGlobalData()`](https://github.com/tranek/GASDocumentation#concepts-asg-initglobaldata)使用[`TargetData`](https://github.com/tranek/GASDocumentation#concepts-targeting-data)，否则会出现`ScriptStructCache`错误并且客户端将与服务器断开连接。我的建议是现在在每个项目中始终调用它，而在 4.24 之前它是可选的。

- 修复了将 setter 复制`GameplayTag`到之前没有定义变量的蓝图时发生的崩溃问题。

- `UGameplayAbility::MontageStop()`函数现在可以正确使用该`OverrideBlendOutTime`参数。

- 修复了`GameplayTag`编辑时组件上的查询变量未被修改的问题。

- 

  ```
  GameplayEffectExecutionCalculations
  ```

  添加了针对不需要属性捕获支持的“临时变量”支持作用域修饰符的 功能。

  - 实现基本上允许`GameplayTag`创建识别的聚合器，作为执行公开要使用作用域修饰符操作的临时值的一种手段；现在可以构建需要可操作值的公式，而无需从源或目标捕获这些值。
  - 要使用，执行必须向新成员变量添加一个标记`ValidTransientAggregatorIdentifiers`；这些标签将显示在底部范围 mod 的计算修饰符数组中，标记为临时变量 - 相应地更新详细信息自定义以支持功能

- 添加了有限的标签生活质量改进。删除了限制源的默认选项`GameplayTag`。添加受限标签时，我们不再重置源，以便更轻松地连续添加多个标签。

- `APawn::PossessedBy()`现在将 的所有者设置`Pawn`为新的`Controller`。很有用，因为[混合复制模式](https://github.com/tranek/GASDocumentation#concepts-asc-rm)期望 的所有者是`Pawn`，`Controller`如果`ASC`存在于 上`Pawn`。

- 修复了`FAttributeSetInitterDiscreteLevels`.

https://docs.unrealengine.com/en-US/WhatsNew/Builds/ReleaseNotes/4_24/