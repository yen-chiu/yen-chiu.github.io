---
title: UE5 EnhancedInput
date: 2023-03-20 08:27:47 +0800
categories: [Unreal,Beginner]
tags: []

# Ref
# - https://docs.unrealengine.com/5.1/zh-CN/enhanced-input-in-unreal-engine/
# - https://zhuanlan.zhihu.com/p/470949422
# - https://www.bilibili.com/video/BV14r4y1r7nz/?vd_source=fdb276fc298ea6fa0c6e79ca8cc45bfd

---

## 新系统的定义及目标

它以模块化的方式解耦了从输入的按键配置到事件处理的逻辑处理过程，通过提供

- **输入动作(UInputAction)** 
- **输入修改器（UInputModifier)** 
- **输入触发器（UInputTrigger）** 
- **输入映射环境（UInputMappingContext）**

这些可组合功能，在新的增强玩家输入(*UEnhancedPlayerInput*)和增强输入组件( *UEnhancedInputComponent*)的配合下提供了更灵活和更便利的输入配置和处理功能。

### 目标：

- 重新梳理简化： Axis/Action —> Action（统一）

- 运行时重新映射输入场景： UInputMappingContext

- 对初级用户易配置。大量默认行为实现，Tap/Hold...

- 对高级用户易扩展，可继承子类扩展

- - 修改器：修改输入值
  - 触发器：决定触发条件
  - 优先级：配置输入场景优先级

- 模块化，不再只依赖Ini配置，以资源asset方式配置，堆栈式分隔逻辑

- 提高性能，不需要检查所有输入，只需要关心当前的场景和绑定

- UE5正式替换掉旧有输入系统

此插件实现了多种功能，例如

- 径向死区
- 同时按键
- 上下文输入
- 优先级安排
- 并且能够在基于 **资产** 的环境中，拓展对于原始输入数据的筛选和处理功能。

## 动态和上下文输入映射

使用增强输入时，可以在运行时为玩家添加和删除 **映射上下文（Mapping Contexts）** 。

这样可更轻松地管理大量 **操作（Actions）** 。

可以根据玩家的当前状态更改特定输入的行为。

例如，如果有一个可以行走、冲刺、俯卧的玩家角色。

- 对于其中每种角色移动类型，可以交换映射上下文，让CTRL键执行不同的操作。
  - 行走时按下CTRL键，角色应该蹲伏。
  - 冲刺时按下CTRL键，角色应该滑行。
  - 俯卧时按下CTRL键，角色应该重新站起来。

## 创建增强输入资产

增强输入默认启用。可以从内容浏览器点击 **添加（Add）** ( **+** )并找到 **输入（Input）** 类别，创建输入资产。

![image_0.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201221983.jpeg)

## 核心概念


![截屏2023-03-20 21.29.45](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222901.png)

增强输入系统有四个主要概念：

- **输入动作（Input Actions）** 

- **输入映射上下文（Input Mapping Contexts）** 

- **输入修饰符（Input Modifiers）**

- **输入触发器（Input Triggers)** 


### Input Actions - 输入动作

**输入动作（Input Actions）** 是增强输入系统与项目代码之间的**通信**链接。

- 在概念上相当于 **操作（Action）** 和 **轴（Axis）** 映射名称，只是它们是数据资产。

- 每个IA该表示用户可以执行的某件事。

  > 例如 : 
  >
  > - 蹲伏
  > - 发射武器

可以在蓝图或C++中添加 **输入侦听器（Input Listeners）** ，侦听输入动作的状态何时发生变化。

IA 可以是多种不同的类型，这些类型将确定行为。可以创建简单的布尔动作或更复杂的3D轴。动作类型将决定值的类型。

| ActionType | ValueType |
| ---------: | --------- |
|    Digital | Bool      |
|     Axis1D | float     |
|     Axis2D | FVector2D |
|     Axis3D | Fvector   |

![image_1.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201412799.jpeg)

输入动作可以是不同的值类型，这些类型将确定行为。

- 应该将布尔动作用于状态为开或关的输入。这相当于旧版输入系统中的较旧动作映射。
- 对于游戏手柄控制杆值等控制点，可以使用2D轴动作来保存控制杆位置的X和Y值。
- 可以使用3D轴保存更复杂的数据，例如运动控制器信息。

例如，

- "拾取道具"动作可能仅需要一个开/关状态，用于指示用户是否想要角色捡起某个东西，
- 而"行走"动作可能需要两个轴，来描述用户想要角色行走的方向和速度。

![image_2.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201412100.jpeg)

> Lyra游戏示例中使用的不同输入动作。



#### TriggerState - 触发状态

触发状态表示动作的当前状态

- **已开始（Started）** 

  - 发生了开始触发器求值的某个事件。

    > 例如，"双击"触发器的第一次按下将调用"已开始"状态一次。

- **进行中（Ongoing）** 

  - 触发器仍在进行处理。

    > 例如，当用户按下按钮时，在达到指定持续时间之前，"按住"动作处于进行中状态。
    >
    > 根据触发器，此事件将在收到输入值之后对动作求值时触发每次更新。

- **已触发（Triggered）** 

  - 动作已触发。这意味着它完成了所有触发器要求的求值。

    > 例如，"按下并松开"触发器会在用户松开按键时发送。

- **已完成（Completed）** 

  - 触发器求值过程已完成。

- **已取消（Canceled）** 

  - 例如，"按住"动作还没触发之前，用户就松开了按钮。


通常，将使用 <kbd>Triggered </kbd>状态。

#### BindAction - 监听IA触发

要在蓝图中添加输入动作侦听器，可以在蓝图的事件图表中右键点击，然后键入的输入动作数据资产的名称。

![image_3.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201424213.jpeg)

![image_4.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201424193.jpeg)

添加输入动作事件并将其设置为执行打印字符串。

还可以绑定C++中的输入动作

```c++
void AFooBar::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    // 可以通过更改"ETriggerEvent"枚举值，绑定到此处的任意触发器事件
    Input->BindAction(AimingInputAction, ETriggerEvent::Triggered, this, &AFooBar::SomeCallbackFunc);
}

void AFooBar::SomeCallbackFunc(const FInputActionInstance& Instance)
{
    // 获取此处所需任意类型的输入动作的值...
    FVector VectorValue = Instance.GetValue().Get<FVector>();
    FVector2D 2DAxisValue = Instance.GetValue().Get<FVector2D>();
    float FloatValue = Instance.GetValue().Get<float>(); 
    bool BoolValue = Instance.GetValue().Get<bool>();

    // 在此处实现的精彩功能！
} 
```

### Input Mapping Contexts - 输入映射上下文

**输入映射上下文（Input Mapping Contexts）** 是输入动作的集合，表示玩家可以处于的特定上下文。

它们描述了关于什么会触发给定输入动作的规则。映射上下文可以动态地为每个用户添加、移除或优先安排次序。

创建输入映射上下文步骤：

 <kbd>上下文浏览器（**Context Browser**） </kbd> ->  <kbd>输入（**Input**）</kbd> ->  <kbd>输入映射上下文（**Input Mapping Context**）</kbd>

![image_5.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201431911.jpeg)

IMC的基本结构是一个在顶层具有输入操作列表的层级。

输入操作层下面是一个用户输入列表，该列表可以触发各个操作，例如键、按钮和动作轴。

底层包含各个用户输入的输入触发器和输入修饰符列表，

- 该列表可以用于确定**如何过滤或处理输入的原始值**，
- 以及它必须**满足哪些限制才能在其层级的顶层驱动输入操作**。

![image_6.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201433762.jpeg)

可以通过 本地玩家的增强输入本地玩家子系统（**Enhanced Input Local Player Subsystem**）将**一个或多个**IMC应用到本地玩家，并安排它们的优先次序，避免多个操作由于尝试使用同一输入而发生冲突。

- 在这里将实际的键与输入动作绑定，并为每个动作指定额外触发器或修饰符。
- 将输入映射上下文添加到增强输入子系统时，还可以为其提供优先级。

如果有多个上下文映射到同一个输入动作，那么在触发输入动作时，将考虑优先级最高的IMC，而忽略其他IMC。

例如：为一个可以游泳、行走、驾驶载具的角色提供多个输入映射上下文。

- IMC - 1 :  常见动作的映射

- IMC - N：特定行为的动作映射

可以将与载具相关的输入操作放入单独的输入映射上下文中，而该上下文随后在进入载具时添加到本地玩家，并在退出载具时从本地玩家身上移除。

这样做有助于确保不合适的输入操作无法运行，从而优化并预防bug。

此外，使用互斥的输入映射上下文有助于避免输入冲突，这意味着当用户输入用于不同的输入动作时，输入绝不会意外触发错误的动作。

可以在蓝图或C++中将映射上下文添加到玩家

```c++
// .h 将映射上下文公开为头文件中的属性...
UPROPERTY(EditAnywhere, Category="Input")
TSoftObjectPtr<UInputMappingContext> InputMapping;

// .cpp
if (ULocalPlayer* LocalPlayer = Cast<ULocalPlayer>(Player))
{
    if (UEnhancedInputLocalPlayerSubsystem* InputSystem = LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
    {
        if (!InputMapping.IsNull())
        {
            InputSystem->AddMappingContext(InputMapping.LoadSynchronous(), Priority);
        }
    }
}
```

![image_7.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201443582.jpeg)

### Input Modifiers - 输入修饰符

**输入修饰符（Input Modifiers）** 是预处理器，能够修改UE接收的原始输入值，然后再将其发送到输入触发器上。

增强输入插件有各种输入修饰符，可以执行多种任务，例如

- 更改轴顺序
- 实现"死区"
- 将轴输入转换为世界空间。

输入修饰符很适合用于应用灵敏度设置，在多个帧上平滑输入，或基于玩家状态更改输入的行为。

**由于在创建自己的修饰符时可以访问 `UPlayerInput` 类，可以访问所属玩家控制器，并获取所需的任意游戏状态。**

![image_8.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201452106.jpeg)

可以通过创建 `UInputModifier` 类的子类并覆盖 `ModifyRaw_Implementation` 函数，在C++或蓝图中创建自己的输入修饰符。

还可以通过使用 **输入修饰符（Input Modifier）** 作为父类创建新的 **蓝图子类（Blueprint Child Class）** ，创建自己的输入修饰符。

![image_9.jpg](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201455664.jpeg)

接下来，找到 **我的蓝图（My Blueprint）> 函数（Functions）> 覆盖（Override）** 并从 **下拉菜单** 选择 **Modify Raw** 函数。

![image_10.jpg](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201456730.jpeg)

输出参数是 **输入操作值（Input Action Value）** ，其中包含三个 **浮点** 值，这与 **向量（Vector）** 非常像。

该函数的输入参数包含 **玩家输入（Player Input）** 对象、来自输入硬件或之前输入修饰符的 **当前值（Current Value）** 以及 **增量时间（Delta Time）** 值。

![image_11.jpg](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201456909.jpeg)

从 **Modify Raw** 返回的输入动作值将进入下一个输入修饰符（如有），或进入第一个输入触发器。

![image_12.jpg](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201457795.jpeg)

下面是Lyra游戏示例中使用的输入修饰符示例。

```c++
/ ** 基于Lyra共享游戏设置中的某个设置应用轴值反转 * /
UCLASS(NotBlueprintable, MinimalAPI, meta = (DisplayName = "Lyra Aim Inversion Setting"))
class ULyraInputModifierAimInversion : public UInputModifier
{
    GENERATED_BODY()

protected:
    virtual FInputActionValue ModifyRaw_Implementation(const UEnhancedPlayerInput* PlayerInput, FInputActionValue CurrentValue, float DeltaTime) override
    {
        {
            ULyraLocalPlayer* LocalPlayer = LyraInputModifiersHelpers::GetLocalPlayer(PlayerInput);
            if (!LocalPlayer)
            {
                return CurrentValue;
            }

            ULyraSettingsShared* Settings = LocalPlayer->GetSharedSettings();
            ensure(Settings);

            FVector NewValue = CurrentValue.Get<FVector>();

            if (Settings->GetInvertVerticalAxis())
            {
                NewValue.Y *= -1.0f;
            }

            if (Settings->GetInvertHorizontalAxis())
            {
                NewValue.X *= -1.0f;
            }

            return NewValue;
        }
    }
}; 
```

#### 二维方向输入示例

一个可以良好展示输入修饰符用途的示例是，使用单一输入操作实现二维方向输入。

使用鼠标或游戏手柄的虚拟摇杆时，读取二维移动是很简单的事情，只需创建支持至少两个轴的输入操作，并将相应的输入添加到输入映射上下文即可。

增强输入支持来自一维源的输入，例如键盘的方向键或常用的"WASD"键配置；可通过应用正确的输入修饰符来实现此控制方案。

具体而言，使用 **负（Negate）** 可以将某些键注册为负值，而使用 **交换输入轴值（Swizzle Input Axis Values）** 可以将某些键注册为Y轴，而不是默认的X轴值：

| **字母键** | **方向键** | **所需输入解译** | **必需输入修饰符**                                           |
| ---------: | ---------: | ---------------: | :----------------------------------------------------------- |
|          W |       向上 |            正Y轴 | 交换输入轴值（YXZ或ZXY）（Swizzle Input Axis Values (YXZ or ZXY)） |
|          A |       向左 |            负X轴 | 负（Negate）                                                 |
|          S |       向下 |            负Y轴 | 负交换输入轴值（YXZ或ZXY）（Negate Swizzle Input Axis Values (YXZ or ZXY)） |
|          D |       向右 |            正X轴 | （无）                                                       |

![image_13.jpg](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201500854.jpeg)

这种解译方向键或"WASD"键的方式可以**将一维输入映射到二维输入**操作。

由于每个键报告一维正值，此值将始终占据X轴，并将在任意给定更新函数上具有值0.0或1.0。

通过为向左和向下输入设置负值，并切换轴的顺序使输入的X轴值移至Y轴以用于向上和向下输入，可以使用输入修饰符将一组一维输入解译为单个二维输入值。

### Input Triggers - 输入触发器

输入触发器确定用户输入在**经历过输入修饰符的可选列表之后**，**是否**会**激活**输入映射上下文中的**相应输入动作**。

大部分输入触发器都会分析输入本身，检查最小动作值并验证各种模式，例如短暂点击、长时间按住或典型的"按下"或"释放"事件。

此规则的一个例外是"**组合键**"输入触发器，该触发器仅通过另一个输入操作触发。

默认情况下，输入上的任意用户活动都会在每个更新函数上触发。

输入触发器有三种类型：

- **显式（Explicit）** 类型将导致输入在输入触发器成功时成功。
- **隐式（Implicit）** 类型将导致输入仅在输入触发器和所有其他隐式类型输入触发器都成功时成功。
- **阻碍（Blocker）** 类型将导致输入在输入触发器成功时失败。

下面是关于每种触发器类型在针对其他触发器类型的情形下如何交互的逻辑示例：

| 条件                            | 结果                                     |
| ------------------------------- | ---------------------------------------- |
| $ Implicit == 0,Explicit == 0 $ | 始终触发，除非值为0                      |
| $ Implicit == 0,Explicit > 0 $  | 至少一个`Explicit`已触发                 |
| $ Implicit > 0,Explicit == 0 $  | 所有`Implicit`已触发                     |
| $ Implicit > 0,Explicit > 0 $   | 所有`Implicit`和至少一个`Explicit`已触发 |
| $ Blocker $                     | 覆盖其他所有触发器以强制触发器失败       |

处理用户输入后，输入触发器可能返回三种状态之一：

- **无（None）** 表明未满足输入触发器的条件，因此输入触发器失败。
- **持续（Ongoing）** 表明部分满足了输入触发器的条件，并且输入触发器正在处理，但尚未成功。
- **已触发（Triggered）** 表明已满足输入触发器的所有条件，因此输入触发器成功。

可以通过扩展输入触发器基类，即 **输入触发器的计时库（Input Trigger Timed Base）** 来，创建自己的输入触发器。

![image_14.jpg](https://docs.unrealengine.com/5.1/Images/making-interactive-experiences/Input/enhanced-input/image_14.jpg)

**输入触发器的计时库（Input Trigger Timed Base）** 会检查输入是否已被按住特定时长，如是，则接受该输入并返回 **持续（Ongoing）** 状态。

插件提供的"输入触发器的计时库（（Input Trigger Timed Base））"类永远不会返回 **已触发（Triggered）** 状态。要在新建的输入触发器子类覆盖该函数，来确定它如何响应用户输入。

函数 **Get Trigger Type** 将确定输入触发器的类型。

**更新状态（Update State）** 将接受玩家的输入对象、当前输入操作值、增量时间，并返回 **无（None）** 、 **持续（Ongoing）** 或 **已触发（Triggered）** 状态。

作为C++示例，可以找到 `InputTriggers.h` 并观察 `UInputTriggerHold` 实现。

#### **UInputTriggerHold.H**

```c++
/** UInputTriggerHold
    触发器会在输入保持激活达到HoldTimeThreshold秒之后触发。
    触发器可以选择触发一次或反复触发。
*/
UCLASS(NotBlueprintable, MinimalAPI, meta = (DisplayName = "Hold"))
class UInputTriggerHold final : public UInputTriggerTimedBase
{
    GENERATED_BODY()

    bool bTriggered = false;

protected:

    virtual ETriggerState UpdateState_Implementation(const UEnhancedPlayerInput* PlayerInput, FInputActionValue ModifiedValue, float DeltaTime) override;

public:
    virtual ETriggerEventsSupported GetSupportedTriggerEvents() const override { return ETriggerEventsSupported::Ongoing; }

    // 输入要保持多久才能导致触发？
    UPROPERTY(EditAnywhere, Config, BlueprintReadWrite, Category = "Trigger Settings", meta = (ClampMin = "0"))
    float HoldTimeThreshold = 1.0f;

    // 此触发器应该仅触发一次，还是在满足保持时间阈值之后每帧触发？
    UPROPERTY(EditAnywhere, Config, BlueprintReadWrite, Category = "Trigger Settings")
    bool bIsOneShot = false;

    virtual FString GetDebugState() const override { return HeldDuration ? FString::Printf(TEXT("Hold:%.2f/%.2f"), HeldDuration, HoldTimeThreshold) : FString(); }
};
```

#### **UInputTriggerHold.cpp**

```c++
ETriggerState UInputTriggerHold::UpdateState_Implementation(const UEnhancedPlayerInput* PlayerInput, FInputActionValue ModifiedValue, float DeltaTime)
{
    // 更新HeldDuration并派生基础状态
    ETriggerState State = Super::UpdateState_Implementation(PlayerInput, ModifiedValue, DeltaTime);

    // 在HeldDuration达到阈值时触发
    bool bIsFirstTrigger = !bTriggered;
    bTriggered = HeldDuration >= HoldTimeThreshold;
    if (bTriggered)
    {
        return (bIsFirstTrigger || !bIsOneShot) ? ETriggerState::Triggered : ETriggerState::None;
    }

    return State;
} 
```

## 玩家可映射输入配置（PMI）

可映射配置是输入映射上下文的集合，表示映射的一个"配置"或"预设"。

例如，可以有一个"默认"和"左撇子"可映射配置，保存了用于瞄准的不同输入映射上下文。

可以使用这些配置预定义一组上下文及其优先级，以便一次性全部添加，而不必手动添加一组输入映射上下文。

映射提供了各种各样的元数据选项，可用于更轻松地处理编程UI设置屏幕。

## 调试命令

可以使用多个与输入相关的调试命令，来调试可能在处理的与输入相关的行为。

使用命令 `showdebug enhancedinput` 会显示的项目使用的可用输入动作和轴映射。

![image_15.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201530844.jpeg)

使用命令：`showdebug devices`

![image_16.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201530209.jpeg)

## InjectInputForAction - 注入输入

可以**调用蓝图、C++中的函数，或使用控制台命令模拟玩家的输入**。

可以输入 `Input.+key` 控制台命令开始模拟输入。

下面是设置 `Gamepad_Left2D` 键的示例：

```c++
Input.+key Gamepad_Left2D X=0.7 Y=0.5

Input.-key Gamepad_Left2D
```

键名称是实际的FKey名称，可在 `InputCoreTypes.cpp` 文件中找到，如果在显示的键名称中删除了空格，还可在键选择器控件中找到。

![image_17.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201532532.jpeg)

```c++
UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer());

UEnhancedPlayerInput* PlayerInput = Subsystem->GetPlayerInput();

FInputActionValue ActionValue(1.0f); // 这可以是布尔、浮点、FVector2D或FVector
PlayerInput->InjectInputForAction(InputAction, ActionValue); 
```

## 平台设置 - Enhanced Input Platform Data

可能希望将不同的输入设置用于不同的平台，例如<kbd>Nintendo Switch</kbd>上的旋转脸部按钮，或改变移动设备上可用的动作。

增强输入提供了逐个平台的 **映射上下文重定向（Mapping Context Redirect）** ，可帮助轻松做到。

可以基于 **增强输入平台数据（Enhanced Input Platform Data）** 类创建蓝图。

可以在该基类上构建，为的游戏添加特定于平台的选项。

默认情况下，它包含输入映射上下文的映射，允许将一个上下文重定向到另一个上下文。

只要在特定平台上引用该映射上下文，它都将在重建映射之后替换为映射中的值。

![image_18.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201534482.jpeg)

要应用此重定向，将其添加到

<kbd>项目设置（**Project Settings**）</kbd> => <kbd>增强输入（**Enhanced Input**）</kbd> => <kbd>平台设置（**Platform Settings**）</kbd> => <kbd>输入数据（**Input Data**）</kbd>

![image_19.png](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303201534810.jpeg)

这些项目设置会添加到平台 `DefaultInput.ini` ，这样它们**可进行热修复并可轻松更改**。

由于平台设置提供了基类 `UEnhancedInputPlatformData` ，可以通过创建自己的蓝图或C++子类来创建自定义平台设置，该子类可用于从任意地方访问设置。



# 新旧的InputSystem演变

## PlayerInput - 旧版

### InputStack

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850079243631685007923751.png)

### PlayerInput

- 存储按键映射： Key -> ActionName/AxisName
- 存储按键的状态信息

![image-20230320200131928](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202001563.png)

### InputComponent

- 存储键轴名字和回调的映射： ActionName/AxisName -> Delegate
- 实现BindXXX

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850081123681685008111723.png)

### Input处理流程

1. KetStateMap 存储按键状态信息
2. 通过Key状态获取激活的Action和Axis
3. 通过Action和Axis在InputComponent中获取相应的Delegate
4. 触发所有搜集到的Delegate
5. 重置KeyStateMap

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850081493621685008148504.png)

## Enhanced Input

### Enhanced Framework

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850073112151685007309480.png)

**按键映射**

| PlayerInput               | EnhancedPlayerInput |
| ------------------------- | ------------------- |
| Key - ActionName/AxisName | Key - InputAction   |

- *EnhancedPlayerInput*

> ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850074253591685007424773.png)

**键轴回调映射**

| InputComponent                 | EnhancedInputComponent |
| ------------------------------ | ---------------------- |
| ActionName/AxisName - Delegate | InputAction - Delegate |

- *EnhancedInputComponent*
  - 存储InputAction和回调的映射InputAction -> Delegate
  - 实现BindAction

> ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850076443671685007644242.png)

### InputModifier

> `<EnginSrcDir>\Engine\Plugins\EnhancedInput\Source\EnhancedInput\Public\InputModifiers.h`

- Mapping.Modifiers / Triggers针对当前IMC场景
- InputAction.Modifiers / Triggers针对全局
- 链式处理

#### 内置的Modifier

- **DeadZone**: 限定值的范围
- **Scalar**: 缩放一个标量
- **Negate**: 取反
- **Smooth**: 多帧之间平滑
- **CurveExponential**: 指数曲线，XYZ
- **CurveUser**: 自定义指数曲线，CurveFloat
- **FOVScaling**: FoV缩放 - `UInputModifierFOVScaling`
- **ToWorldSpace**: 输入设备坐标系向世界坐标系转换（调换XYZ顺序）
- **SwizzleAxis**: 互换轴值
- **Collection**: 嵌套子修改器集合

### InputTrigger

`ETriggerEvent::ETriggerState` 发生变化时触发的事件，`BindXXX` 的时候关注某个事件

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850083653631685008364706.png)

- **Dow**: 值大于阈值（默认0.5）就触发
- **Pressed**: 不激活到激活
- **Released**: 激活到不激活
- **Hold**: 按住大于某个时间
- **HoldAndRelease**: 按住大于某个时间后松开
- **Tap**: 按下后快速抬起（默认0.2）
- **Chorded**: 根据别的Action联动触发 (*可应用于组合键*)

### InputAction

| FInputActionValue                 | FInputActionlnstance |
| --------------------------------- | -------------------- |
| Action的值： $ XYZ $,   $ 0 / 1 $ | Action的运行时状态   |

- C++:
  - void()
  - void(const FInputActionValue&)
  - void(const FInputActionlnstance&)
- BP:
  - void(FInputActionValue ActionValue , float ElapsedTime , float TriggeredTime)

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16850088603651685008859421.png)

### InputMappingContext

![截屏2023-03-20 21.38.44](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222187.png)

### EnhancedInput处理流程

![截屏2023-03-20 21.39.33](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222208.png)

### Delegate运行流程

![截屏2023-03-20 21.44.24](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222257.png)

### AddMappingContext流程

![截屏2023-03-20 21.44.38](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222334.png)

EnhancedInputSubsystem

![截屏2023-03-20 21.45.18](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222370.png)

### IMC BindAction

初始情况应该在哪里开始应用IMC？

后续运行时在蓝图中应该如何切换IMC?

何时Remove IMC?

在哪里绑定 Action 和Axis？

在蓝图中如何BindAction?

![截屏2023-03-20 21.47.47](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222660.png)

![截屏2023-03-20 21.50.31](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202224385.png)

![截屏2023-03-20 21.52.58](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222439.png)

![截屏2023-03-20 21.54.10](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222465.png)

![截屏2023-03-20 21.59.11](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202224154.png)

![截屏2023-03-20 22.02.02](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202224166.png)

![截屏2023-03-20 22.02.21](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222694.png)

![截屏2023-03-20 22.02.30](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202222029.png)

![截屏2023-03-20 22.05.04](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202223765.png)

![截屏2023-03-20 22.07.13](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303202223875.png)



----

## OtherTips

### 引擎Bug - "张冠李戴"

`Engine\UnrealEngine\Engine\Source\Runtime\Engine\Private\InputVectorAxisDelegateBinding.cpp` - 35行

错误：

```c++
InputComponent->AxisKeyBindings.RemoveAt(ExistingIndex);
```


正确：

```c++
InputComponent->VectorAxisBindings.RemoveAt(ExistingIndex);
```

