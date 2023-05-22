---
title: UE5 Blueprints 
date: 2023-03-15 18:47:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/663-unreal-engine-4-blueprints-tutorial

---

## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/04/BananaCollectorStarter.zip)并解压缩。要打开项目，请转到项目文件夹并打开*BananaCollector.uproject*。

> *注意：*如果您收到一条消息说该项目是使用早期版本的 Unreal 编辑器创建的，那没关系（引擎经常更新）。您可以选择打开副本的选项，也可以选择就地转换的选项。

你会看到下面的场景。玩家将在这里四处走动并收集物品。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/01-1.jpg)

我已将项目文件分类到文件夹中以便于导航，如下所示：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/02.png)

如果您愿意，可以使用上面以红色突出显示的按钮来显示或隐藏源面板。

## Creating the Player

在内容浏览器中，导航到 *Blueprints* 文件夹。单击 *Add New* 按钮并选择 *Blueprint Class*。

由于您希望演员能够接收来自玩家的输入，因此*Pawn*类很合适。从弹出窗口中选择*Pawn并将其命名为*BP_Player。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/03-1.png)

> *注意：* Character类也可以*。*它甚至默认包含一个运动组件。
>
> 但是，您将实现自己的移动系统，因此*Pawn*类就足够了。

### Attaching a Camera

相机是玩家观察世界的方式。您将创建一个俯视玩家的相机。

在内容浏览器中，*双击 BP_Player* 以 在蓝图编辑器中将其打开。

要创建相机，请转到“组件”面板。单击*添加组件*并选择*相机*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/04.png)

为了使相机处于自上而下的视图中，您需要将其放置在播放器上方。选择相机组件后，转到“视口”选项卡。

*按W*键激活移动操纵器，然后将其移动到**(-1100, 0, 2000)**。*或者，您可以在位置*字段中输入坐标。它位于“详细信息”面板中的*“转换”部分下。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/04-1-1.gif)

如果您看不到相机，请按*F*键聚焦它。

接下来，按*E*键激活旋转操纵器。*在Y 轴上*将相机向下旋转至*-60*度。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/04-2.gif)

### Representing the Player

红色立方体将代表玩家，因此您需要使用静态网格体组件来显示它。

首先，通过*左键单击*“组件”面板中的空白区域来取消选择*“相机”组件。*如果不这样做，下一个添加的组件将是 Camera 的子组件。

单击*添加组件*并选择*静态网格体*。

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16788673855571678867384581.png)

要显示红色立方体，请选择*Static Mesh*组件，然后转到 Details 选项卡。单击*静态网格体*右侧的*下拉菜单*并选择*SM_Cube*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/03-2.png)

这是你应该看到的（如果你没有看到它，你可以在视口中点击*F来关注它）：*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/03-3.jpg)

现在，是时候生成玩家 Pawn 了。单击*编译*并返回到主编辑器。

## Spawning the Player

在玩家可以控制 Pawn 之前，您需要指定两件事：

1. 玩家将控制的 Pawn 类
2. Pawn 生成的位置

您通过创建一个新的 Game Mode 来完成第一个步骤。

### Creating a Game Mode

游戏模式是控制玩家如何进入游戏的类。

例如，在多人游戏中，您可以使用游戏模式来确定每个玩家的生成位置。

更重要的是，游戏模式决定了玩家将使用哪个 Pawn。

转到 Content Browser 并确保您位于*Blueprints*文件夹中。单击*添加新*按钮并选择*蓝图类*。

从弹出窗口中，选择*Game Mode Base*并将其命名为*GM_Tutorial*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/05.png)

现在，您需要指定默认的 Pawn 类。*双击* GM_Tutorial将其打开。

转到“Details ”面板并查看*“*Classes”*部分下的内容。单击* Default Pawn Class的下拉菜单*并选择* *BP_Player*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/06.png)

在您可以使用新的游戏模式之前，关卡需要知道要使用哪种游戏模式。您可以在*World Settings*中指定它。单击*编译*并关闭蓝图编辑器。

每个级别都有自己的设置。*您可以通过选择Window\World Settings*来访问设置。或者，您可以转到工具栏并选择*Settings\World Settings*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/07.png)

一个新的世界设置选项卡将在详细信息选项卡旁边打开。从这里，单击*GameMode Override*的*下拉菜单*并选择*GM_Tutorial*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/08.png)



![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/09.png)

最后，您需要指定玩家生成的位置。您可以通过在关卡中放置一个*Player Start* actor来完成此操作。

### Placing the Player Start

在生成玩家的过程中，游戏模式会寻找 Player Start actor。如果游戏模式找到一个，它将尝试在那里生成玩家。

![image-20230315160558037](https://raw.githubusercontent.com/Rootjhon/img_note/empty/image-20230315160558037.png)

要放置 Player Start，请转到 Modes 面板并搜索*Player Start*。*左键单击*并将*Player Start*从“模式”面板拖动到视口中。释放*左键单击*将放置它。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/10.gif)

你可以把它放在任何你喜欢的地方。完成后，转到工具栏并单击*“播放”*。您将在放置 Player Start 的位置生成。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/11-1.jpg)

要退出游戏，请单击工具栏中的*停止按钮或按* Esc*键。如果看不到光标，请按 *Shift+F1*。

## Setting Up Inputs

将键分配给操作称为键绑定。

在 Unreal 中，您可以设置键绑定，当您按下它们时会触发一个*事件*。

事件是在某些操作发生时执行的节点（在本例中，当您按下绑定键时）。当事件被触发时，任何连接到事件的节点都将执行。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/12.png)

这种绑定键的方法很有用，因为它意味着您不必对键进行硬编码。

例如，您绑定左键单击并将其命名为 Shoot。任何可以射击的演员都可以使用 Shoot 事件来了解玩家何时按下了左键单击。

如果要更改对应的按键，请在输入设置中进行更改。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/12-1-2.png)

如果您对其进行了硬编码，则必须遍历每个演员并单独更改密钥。

### Axis and Action Mappings

要查看输入设置，请转到 *Edit\Project Settings*。在左侧，选择*“*Engine”部分下的 *Input* 。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/14.png)

绑定部分是您设置输入的地方*。*
![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16788729309971678872930063.png)

Unreal 提供了两种创建键绑定的方法：

- **Action Mapping** *动作映射：*这些只能处于两种状态：按下或未按下。动作事件只会在您按下或释放按键时触发。用于没有中间状态的动作，例如开枪。
- **Axis Mapping** *轴映射：这些输出一个称为* 轴值的数值（稍后会详细介绍）。轴事件将在每一帧触发。通常用于需要摇杆或鼠标的操作。

对于本教程，您将使用*轴* 映射。

### Creating Movement Mappings

首先，您将创建两个*轴映射组*。组允许您将多个键绑定到一个事件。

要创建新的*轴映射组*，请单击*Axis Mappings*右侧的*+*号。创建两个组并将它们命名为*MoveForward*和*MoveRight*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16-5.png)

*MoveForward*将处理向前和向后移动。*MoveRight*将处理左右移动。

您将把移动映射到四个键：*W*、*A*、*S*和*D。*目前，只有两个插槽可以映射键。通过单击*组名称*字段旁边的*+*号向每个组添加另一个*轴映射*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16-1-5.png)

要映射键，请单击*下拉*菜单以显示键列表。*将W*和*S*键映射到*MoveForward*。*将A*和*D*键映射到*MoveRight*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16-2-2.png)

接下来，您将设置*比例*字段。

### 轴值和输入比例

在设置比例字段之前，您需要了解它们如何使用*轴值*。

轴值是一个数值，由输入类型及其使用方式决定。按钮和按键在按下时输出 1。Thumbsticks 输出一个介于 -1 和 1 之间的值，具体取决于方向和你推动它的距离。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16-4-1.png)

您可以使用轴值来控制 Pawn 的速度。例如，如果将摇杆推到边缘，轴值将为 1。如果将其推到一半，则轴值为 0.5。

通过将轴值与速度变量相乘，您可以使用摇杆调整速度。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/17-1.png)

您还可以使用轴值指定沿轴的方向。如果将 Pawn 的速度乘以正轴值，您将得到正偏移量。使用负轴值将导致负偏移。将此偏移量添加到 Pawn 的位置将决定它移动的方向。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/18-3.png)

由于键盘按键只能输出1或0的轴值，可以使用*scale*将其转换为负值。它的工作原理是获取轴值并将其乘以比例。

如果将正数（轴值）乘以负数（刻度），您将得到负数。

通过单击*Scale*字段并输入-1来设置 *S*和 *A* 键的比例。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16-3-1.png)

接下来是有趣的部分：让 Pawn 移动！关闭项目设置，然后在蓝图编辑器中双击打开*BP_Player 。*

## Moving the Player

首先，您需要获取运动映射的事件。

- *右键单击*事件图表中的空白区域以获取节点列表。

- 从菜单中搜索*MoveForward*。

- 添加*Axis Events*下列出的*MoveForward*节点。

  > 请注意，您正在寻找 Axis Events 下的红色节点，而不是 Axis Values 下的绿色节点。

*对MoveRight*重复该过程。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/22-1.gif)

*现在，您将为MoveForward*设置节点。

### 使用变量

要移动，您需要指定 Pawn 移动的速度。指定速度的一种简单方法是将其存储在*变量*中。

要创建一个，请转到“我的蓝图”选项卡并单击*“变量”*部分右侧的*+*号。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/24-1.png)

选择新变量后，转到“详细信息”选项卡。将变量重命名为*MaxSpeed*。然后，将变量类型更改为*Float*。通过单击*“变量类型”*旁边的*下拉菜单*并选择*“浮点”*来执行此操作。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/25-1.png)

接下来，您需要设置默认值。不过，在您设置它之前，您需要单击工具栏中的*编译。*

在您的变量仍处于选中状态的情况下，返回到“详细信息”选项卡。转到*Default Value部分并将**MaxSpeed*的默认值更改为*10*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/26-2.png)

接下来，将MaxSpeed*变量从 My Blueprint 选项卡**拖动*到 Event Graph 中。从菜单中选择*获取。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/27.gif)

您现在将*MaxSpeed*与*轴值*相乘以确定最终速度和方向。添加一个*float \* float*节点并将*Axis Value*和*MaxSpeed*连接到它。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/28.gif)

### 获取玩家方向

要前进，您需要知道 Pawn 面向的位置。幸运的是，Unreal 有一个用于此目的的节点。添加一个*Get Actor Forward Vector*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/29.png)

接下来，添加一个*Add Movement Input*节点。该节点将接受方向和值并将其转换为存储的偏移量。像这样连接节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/30.png)

白线代表一个执行链。换句话说，当玩家移动输入轴时，将生成一个事件来执行*InputAxis MoveForward*节点。白线表示一旦发生这种情况，您将执行*Add Movement Input*节点。

添加*运动输入*节点采用以下输入：

- *Target*：设置为自己，在本例中是玩家（红色框）。
- *World Direction*：移动目标的方向，在本例中是玩家面对的方向。
- *Scale Value*：移动玩家多少，在这种情况下是最大速度 * 轴值（记住是 -1 到 1 范围内的值）。

*对MoveRight*重复该过程，但将*Get Actor Forward Vector*替换为*Get Actor Right Vector*。看看您可以在不查看上述说明的情况下自己做多少！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/31.jpg)

### Adding the Offset - 动起来

要实际移动 Pawn，您需要获取通过 Add Movement Input 计算的偏移量并将其添加到 Pawn 的位置。

基本上，您的策略是让玩家在游戏的每一帧移动少量，因此您需要将移动添加到每帧生成的*Event Tick事件中。*

导航到事件图表中的*Event Tick*节点。它应该在左侧变灰，但如果没有，请创建一个。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/32.jpg)

要获取偏移量，请创建一个*Consume Movement Input Vector*节点。要添加偏移量，请创建一个*AddActorLocalOffset*节点。之后，像这样链接它们：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/33-2.jpg)

基本上，这意味着游戏的每一帧，您都会获得任何存储的移动输入，并将其添加到演员的当前位置。

单击*Compile*，然后返回到主编辑器并单击*Play*。您现在可以四处走动了！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/34-2.gif)

不过有一个小问题。高端机器能够以更快的速度渲染帧。由于每帧都会调用 Event Tick，因此运动节点将更频繁地执行。这导致 Pawn 在高端机器上以更快的速度移动，反之亦然。

要解决此问题，您的**移动需要与*帧速率无关***。

*注意：*我已经设置了一些键绑定，可以向您展示帧速率依赖性的影响。按*0*将帧速率上限设为 60，然后按*1*重置上限。在两个帧速率中四处移动以查看速度差异。

## 帧率独立性

帧率独立性意味着无论帧率如何，一切都会有相同的结果。值得庆幸的是，在 Unreal 中实现帧速率独立性很容易。

退出游戏，然后打开*BP_Player*。接下来，导航到您的*Event Tick*节点并查看*Delta Seconds*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/35.jpg)

Delta Seconds 是自上次 Event Tick 以来经过的时间量。通过将您的偏移量乘以 Delta Seconds，您的运动将与帧速率无关。

例如，您的 Pawn 的最大速度为 100。如果自上次 Event Tick 后经过一秒，您的 Pawn 将移动整整 100 个单位。如果半秒过去了，它将移动 50 个单位。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/36-2.png)

如果移动取决于帧速率，则 Pawn 将每帧移动 100 个单位，而不管帧之间的时间间隔。

要将偏移量乘以 Delta Seconds，请添加一个*vector \* float*节点。之后，像这样连接你的节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/37-2.jpg)

由于帧之间的时间（Delta Seconds）非常小，您的 Pawn 移动速度会慢很多。*通过将MaxSpeed*的默认值更改为*600*来解决此问题。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/38.png)

您可能已经注意到立方体正好穿过所有东西。要解决这个问题，您需要了解*collisions*。

戴上你的安全头盔，因为你即将与一些理论发生正面*碰撞！*

## Actor Collisions

为了能够碰撞，actor 需要其可碰撞空间的表示（通常称为碰撞）。您可以使用以下其中一项：

- **Collision mesh** *碰撞网格：*这些是在导入网格时自动生成的（如果启用它）。用户还可以使用 3D 软件创建自定义碰撞网格。红色框已经有一个自动生成的碰撞网格。
- **Collision component** *碰撞组件：*它们有三种形状：盒子、胶囊和球体。您可以通过“组件”面板添加它们。一般用于简单的碰撞。

下面是角色及其碰撞的示例。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/42.jpg)

当一个 actor 的碰撞触及另一个 actor 的碰撞时，就会发生碰撞。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/41-1.png)

现在，是时候启用碰撞了。

### 启用碰撞

您可能想知道为什么盒子没有碰撞，即使它有碰撞网格。当您移动一个 actor 时，Unreal 只考虑碰撞的*根*组件。由于您的 Pawn 的根组件没有任何碰撞，因此它会穿过所有东西。

*注意：*没有碰撞作为根的 actor 仍然可以阻挡其他 actor。但是，如果您*移动*actor，它不会与任何东西发生碰撞。

因此，要使用碰撞网格，*StaticMesh*需要成为*root*。为此，请转到“组件”面板。接下来，*左键单击*并将*StaticMesh**拖动* 到*DefaultSceneRoot*。释放*左键单击*以使*StaticMesh*成为新的根。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/43.gif)

在碰撞起作用之前还有一件事要做。切换到 Event Graph 并转到*AddActorLocalOffset*节点。找到  *Sweep*  并通过*左键单击*复选框将其设置为*真*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/44.jpg)

基本上，*AddActorLocalOffset*将演员传送到新位置。*Sweep*确保 actor 与新旧位置之间的任何东西发生碰撞。

返回主编辑器并单击*Play*。立方体现在将与关卡发生碰撞！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/45.gif)

您要做的最后一件事是创建一个在玩家触摸时消失的*物品。*

### 禁用碰撞 & 自定义碰撞层

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16789360941591678936093236.png)



## Creating an Item

通常，物品是玩家可以收集的任何东西。您将使用*BP_Banana*作为项目。

要检测立方体何时接触到物品，您需要一个在发生碰撞时触发的事件节点。您可以使用*碰撞响应*来生成此类事件。

碰撞响应还决定了一个 actor 在与另一个 actor 发生碰撞时的反应。

共有三种类型的碰撞响应：Ignore、Overlap、Block。

以下是它们如何相互作用：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/45-0-3.png)

尽管您可以使用 Overlap 或 Block，但本教程只会向您展示如何使用 Overlap。

### 设置碰撞响应

退出游戏，然后打开*BP_Banana*。选择*StaticMesh*组件，然后转到 Details 面板。碰撞部分是您设置碰撞响应的地方*。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/46.png)

正如您所看到的，大多数设置都是灰色的。要使它们可编辑，*请左键单击**Collision Presets*旁边的*下拉*菜单。从列表中选择*自定义。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/47.png)

现在，您需要指定项目和立方体之间的碰撞响应。

*组件有一个称为对象类型的*属性。对象类型只是将相似的参与者组合在一起的一种便捷方式。

您可以[在此处](https://docs.unrealengine.com/latest/INT/Engine/Physics/Collision/Reference/index.html)阅读有关对象类型的更多信息。

由于立方体的类型是*WorldDynamic*，您希望将碰撞响应更改为该类型。

在*Collision Responses部分下，将*WorldDynamic*的碰撞响应更改为*Overlap*。*通过左键单击*WorldDynamic*右侧的*中间复选框*来执行此操作。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/49-1.png)

### 处理碰撞

要处理碰撞，您需要使用*重叠*事件。转到 Components 面板并*右键*单击*StaticMesh*。

从上下文菜单中，选择*添加事件\添加 OnComponentBeginOverlap*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/50.gif)

这会将*OnComponentBeginOverlap (StaticMesh)*节点添加到您的事件图表中。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/51.jpg)

最后，创建一个*DestroyActor*节点并将其链接到*OnComponentBeginOverlap (StaticMesh)*节点。

顾名思义，它将目标演员从游戏中移除。但是，由于没有目标，它会销毁*调用*它的演员。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/52.jpg)

### 放置项目

关闭蓝图编辑器，然后确保您位于*蓝图*文件夹中。

*通过左键单击*并将*BP_Banana拖到* 视口中，开始将香蕉放入关卡中。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/53.gif)

点击*Play*开始收集香蕉！

![img](https://koenig-media.raywenderlich.com/uploads/2017/03/54.gif)



## 蓝图Debug

![image-20230316112419725](https://raw.githubusercontent.com/Rootjhon/img_note/empty/image-20230316112419725.png)

