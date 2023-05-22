---
title: UE5 Create a Simple Game
date: 2023-03-16 13:27:47 +0800
categories: [Unreal,Beginner]
tags: []
image:
  path: https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161704900.gif

# Ref
# - https://www.kodeco.com/454-how-to-create-a-simple-game-in-unreal-engine-4

---

## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/08/InfiniteMatrixStarterProject.zip)并解压缩。转到项目文件夹并打开*InfiniteMatrix.uproject*。

按*播放*测试运动控制。您可以通过*移动鼠标*进行垂直和水平移动。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710546.gif)

你要做的第一件事就是让玩家不断前进。

## Moving the Player Forward

导航到*Blueprints*文件夹并打开*BP_Player*。

要向前移动玩家，您将在每一帧中为玩家的位置添加一个偏移量。

首先，您需要创建一个变量来定义玩家向前移动的速度。创建一个名为*ForwardSpeed的* *Float*变量并将其默认值设置为*2000*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710530.jpeg)

接下来，确保您位于事件图表中，然后找到*Event Tick*节点。创建以下设置：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710244.jpeg)

通过将*ForwardSpeed*与*Delta Seconds*相乘，您将获得*与帧速率无关的*结果。

*注意：*如果您不熟悉帧速率独立性，请阅读我们的[蓝图](https://rootjhon.github.io/posts/UE5-Blueprints/)教程。我们在*帧速率独立性*部分介绍了它。

接下来，您将使用此结果沿单个轴移动玩家。

### 沿单轴移动

要移动玩家，请创建一个*AddActorWorldOffset*节点。通过*左键单击*其*复选框将* *Sweep*设置为*true*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710818.jpeg)

如果您尝试将*Float*结果连接到*Delta Location*输入，Unreal 会自动将其转换为*Vector*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710516.jpeg)

但是，这会将 Float 值放入 Vector 的 X、Y 和 Z 分量中。

对于这个游戏，向前移动应该只沿着*X 轴*。

幸运的是，您可以将一个 Vector 拆分为三个*Float*组件。

- 确保*AddActorWorldOffset*节点的*Delta Location*引脚没有连接。

- *右键单击* *Delta Location*引脚并选择*Split Struct Pin*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710538.gif)

最后，像这样连接一切：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710905.jpeg)

让我们回顾一下：

1. 每一帧，游戏都会将*ForwardSpeed*和*Delta Seconds*相乘以获得与帧速率无关的结果
2. AddActorWorldOffset将使用结果*沿* *X 轴*移动玩家
3. 由于启用了*Sweep*，如果有任何东西阻挡玩家将停止前进

单击*编译*，然后返回到主编辑器。如果你按下*Play*，你将穿过隧道。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710349.gif)

您可以创建一个自动生成隧道的蓝图，而不是手动放置隧道。

## 创建隧道生成器

转到 Content Browser 并确保您位于*Blueprints*文件夹中。

以*Actor*作为父类创建一个新的蓝图类，将其命名为 *BP_TunnelSpawner* 然后打开它。

由于游戏会不断生成隧道，因此创建一个生成*函数*是个好主意。

转到 My Blueprint 面板并创建一个名为*SpawnTunnel*的新函数。此功能的目的是在提供的位置生成隧道。

要将位置传递给函数，函数需要一个*输入参数*。当您调用该函数时，这些将显示为输入引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710540.jpeg)

它们还将在函数的*入口节点上显示为输出引脚。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710808.jpeg)

让我们继续创建一个输入参数。确保您位于*SpawnTunnel*函数的图表中。选择*Entry*节点，然后转到 Details 面板。单击*“输入”*部分旁边的*+*号。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161710606.jpeg)

将输入参数重命名为*SpawnLocation*并将其类型更改为*Vector*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711513.jpeg)

要生成隧道，请添加一个*Spawn Actor From Class*节点。单击位于*Class*引脚右侧的*下拉菜单*并选择*BP_Tunnel*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711575.jpeg)

要设置生成位置，*请右键单击* *Spawn Transform*引脚并选择*Split Struct Pin*。

然后，将*Spawn Actor From Class*节点链接到*Entry*节点，如下所示：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711607.jpeg)

现在，无论何时调用*SpawnTunnel*函数，它都会在提供的位置生成一个*BP_Tunnel*实例。

让我们测试一下！

### 测试隧道生成器

切换到 Event Graph 并找到*Event BeginPlay*节点。添加一个*SpawnTunnel*节点并将其连接到*Event BeginPlay*节点。

在*SpawnTunnel*节点上，将*Spawn Location*设置为*(2000, 0, 500)*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711737.jpeg)

现在，当游戏开始时，它会在远离玩家的地方生成一条隧道。单击*编译*，然后返回到主编辑器。

首先，从关卡中删除*BP_Tunnel 。* *通过左键单击*World Outliner 中的*BP_Tunnel*来执行此操作。然后，按*Delete*键将其从关卡中删除。

接下来，转到内容浏览器。*左键单击*并将*BP_TunnelSpawner* *拖到* 视口中。这会将它的一个实例添加到关卡中。

如果您按下*Play*，游戏将在玩家上方和远离玩家的地方生成一条隧道。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711564.gif)

完成测试后，返回*BP_TunnelSpawner*。*将SpawnTunnel*节点的*Spawn Location*重置为*(0, 0, 0)*。

然后，单击*编译*，然后返回到主编辑器。

在下一节中，您将为*BP_Tunnel*设置功能。

## 设置隧道蓝图

*BP_Tunnel*将负责两件事。第一个是检测游戏何时应生成新隧道。为此，您将创建一个触发区域。一旦触发，*BP_Tunnel*将告诉*BP_TunnelSpawner*生成一个新隧道。通过这样做，您可以创造出无尽隧道的错觉。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711634.gif)

它要做的第二件事是定义一个重生点。*然后BP_TunnelSpawner*将使用此点作为下一个生成位置。

让我们从创建触发区开始。

### 创建触发区

打开*BP_Tunnel*，然后转到 Components 面板。添加一个*Box Collision*组件并将其命名为*TriggerZone*。

目前碰撞区域很小。转到“详细信息”面板并找到*“形状”*部分。*将Box Extent*属性设置为*(32, 500, 500)*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711894.jpeg)

接下来，将*Location*属性设置为*(2532, 0, 0)*。这会将*TriggerZone*放置在隧道网格的末端。这意味着新隧道只会在玩家到达隧道*尽头时生成。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711449.jpeg)

现在，是时候创建重生点了

### 创建重生点

要定义生成点的位置，您可以使用*场景*组件。这些组件非常适合定义位置，因为它们只包含一个转换。它们在视口中也可见，因此您可以看到重生点的位置。

转到“组件”面板并确保您没有选择任何内容。添加一个*Scene*组件并将其重命名为*SpawnPoint*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711544.jpeg)

隧道网格在*X 轴上的长度为* *2500 个*单位，因此应该是附加点所在的位置。转到 Details 面板并将*Location*属性设置为*(2500, 0, 0)*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711311.jpeg)

接下来要做的是创建一个在*SpawnPoint*生成隧道的函数。

## Spawning Tunnels at the Spawn Point

单击*Compile*，然后切换到*BP_TunnelSpawner*。

下一个*BP_Tunnel*应该在*最远*隧道的*SpawnPoint*处生成。通过这样做，隧道将始终继续。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711315.gif)

由于最远的隧道始终是最后生成的隧道，因此您可以轻松获得对它的引用。

*打开SpawnTunnel*的图表。*右键单击* *Spawn Actor From Class*节点的*Return Value*引脚。选择*Promote to Variable*并将变量重命名为*NewestTunnel*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711512.jpeg)

现在，您将始终参考最远的隧道。

接下来，创建一个新函数并将其命名为*SpawnTunnelAtSpawnPoint*。

创建以下图形：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161711798.jpeg)

*此设置将获取最新的隧道及其SpawnPoint*组件的位置。然后它会在这个位置产生一个新的隧道。

为了让*BP_Tunnel与* *BP_TunnelSpawner*通信，它需要一个引用。

如果没有通信，*BP_TunnelSpawner*将不知道何时生成下一个隧道。

### 创建对 Tunnel Spawner 的引用

单击*Compile*，然后关闭*SpawnTunnelAtSpawnPoint*图。之后，切换到*BP_Tunnel*。

添加一个新变量并将其命名为*TunnelSpawner*。将其*变量类型*设置为*BP_TunnelSpawner\Object Reference*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712662.jpeg)

单击*Compile*，然后切换回*BP_TunnelSpawner*。

*打开SpawnTunnel*的图表并添加指示的节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712864.jpeg)

现在，每个隧道都将引用*BP_TunnelSpawner*。

接下来，您将告诉*BP_TunnelSpawner*在玩家进入*TriggerZone*时生成下一个隧道。

### 编写触发区脚本

单击*Compile*，然后切换到*BP_Tunnel*。

转到 Components 面板并*右键*单击*TriggerZone*。选择*添加事件\添加 OnComponentBeginOverlap*。这会将以下节点添加到您的事件图表中：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712928.jpeg)

只要另一个*Actor与* *TriggerZone*重叠，该节点就会执行。

首先，您应该检查与*TriggerZone*重叠的*Actor*是否是玩家。

*左键单击*并*拖动**Other Actor*引脚。在空白区域上松开鼠标*左键*，然后从菜单中选择*Cast to BP_Player 。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712798.jpeg)

*注意：*由于一条隧道在另一条隧道的*尽头*生成，它会触发该隧道的*TriggerZone*。*如果Other Actor*是隧道，则*转换为 BP_Player*将阻止任何进一步的节点执行。

*接下来，在Cast to BP_Player*节点后添加指示的节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712705.jpeg)

让我们逐步完成：

1. 当*Actor与* *TriggerZone*重叠时，*On Component Begin Overlap (TriggerZone)*节点将执行
2. Cast *to BP_Player*节点检查重叠的 Actor 是否是玩家
3. 如果是玩家，那么*BP_TunnelSpawner*将生成一个新的隧道。它的位置将在最后生成的隧道的*SpawnPoint组件中。*
4. 由于旧隧道不再使用，游戏使用*DestroyActor*节点将其移除

点击*Compile*，回到主编辑器然后点击*Play*。一旦你到达隧道的尽头，游戏就会产生一个新的隧道。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712429.gif)

尽管游戏中不断地生成隧道，但它*看起来*并不是无穷无尽的。您可以通过始终显示一些隧道来缓解这种情况。稍后，当您将其与障碍物结合使用时，玩家将看不到生成的隧道。

## 生成更多隧道

首先要做的是创建一个生成一定数量隧道的函数。

打开*BP_TunnelSpawner并创建一个名为* *SpawnInitialTunnels*的新函数。

要生成指定数量的隧道，您可以使用*ForLoop*节点。该节点将执行连接的节点指定的次数。

添加一个*ForLoop*节点并将其连接到*Entry*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712835.jpeg)

要使*ForLoop*节点执行*n*次，您需要将*Last Index*设置为*n – 1*。

在本教程中，您将生成*三个*隧道。要执行三个循环，请将*Last Index*值设置为*2*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712249.jpeg)

*注意：*如果您不设置*First Index*或*Last Index*字段，它们将默认为*0*

游戏开始时，玩家应始终从隧道开始。为此，您可以在玩家所在位置生成第一条隧道。

### 产生第一个隧道

要确定第一个隧道是否已生成，您可以检查是否设置了*NewestTunnel 。*

如果未设置，则表示第一个隧道尚未生成。这是因为*NewestTunnel*仅在游戏生成隧道*后*设置。

要执行此检查，请在*ForLoop节点之后添加一个* *IsValid*节点（带有问号图标的节点）。

*接下来，获取对NewestTunnel 的*引用并将其连接到*IsValid*节点的*输入对象*引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161712592.jpeg)

如果未设置*NewestTunnel ，则* *Is Not Valid* pin 将执行，反之亦然。

添加以下内容并将其连接到*IsValid*节点的*Is Not Valid*引脚：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713144.jpeg)

此设置将在玩家 Pawn 的位置生成一条隧道。

接下来，您将生成后续隧道。

### 生成后续隧道

添加一个*SpawnTunnelAtSpawnPoint*节点并将其连接到*IsValid*节点的*Is Valid*引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713988.jpeg)

这是最终图表：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713054.jpeg)

概括：

1. *ForLoop*节点一共会执行三次
2. 在第一个循环中，它会在玩家所在位置生成一条隧道
3. 在随后的循环中，它将在最新隧道的*SpawnPoint处生成一个隧道*

接下来，转到事件图表并删除*SpawnTunnel*节点。然后，在*Event BeginPlay之后添加一个* *SpawnInitialTunnels*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713322.jpeg)

现在，当游戏开始时，它会产生三个隧道。

点击*Compile*，回到主编辑器然后点击*Play*。隧道现在更长了！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713408.gif)

游戏目前不是很有挑战性，所以让我们添加一些障碍。

## 制造障碍

以下是您将用作障碍物的网格：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713510.jpeg)

打开*BP_Tunnel*并转到 Components 面板。添加一个*静态网格*组件并将其命名为*WallMesh*。

转到 Details 面板并将其*Static Mesh*属性更改为*SM_Hole_01*。

接下来，将其*Location*属性设置为*(2470, 0, 0)*。这会将它放在隧道的尽头。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713837.jpeg)

为了让游戏更有趣，墙壁也会旋转。添加一个新的*Float*变量并将其命名为*RotateSpeed*。*将默认值*设置为*30*。

切换到 Event Graph 并找到*Event Tick*节点。创建以下设置：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713900.jpeg)

这将使*WallMesh*按提供的量旋转每一帧。

单击*编译*，然后返回到主编辑器。按*播放键*查看旋转的墙壁。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161713387.gif)

让我们通过在墙壁上添加一些变化来增加趣味性。

## 创建墙壁变化

无需为每个变体创建新的蓝图，您只需随机化*WallMesh*即可。

打开*BP_Tunnel并创建一个名为* *RandomizeWall*的新函数。之后，创建以下图形：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714278.jpeg)

顾名思义，*Set Static Mesh节点会将* *WallMesh*设置为提供的网格。

要制作静态网格列表，您可以使用*选择*节点。

*左键单击*并*拖动* *New Mesh*引脚。释放*左键单击*空白区域，然后添加一个*选择*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714501.jpeg)

*选择*节点允许您设置选项列表。Index输入确定*Select节点输出* *的*选项。

由于有四个墙壁网格可用，您需要再创建两个*选项*引脚。您可以通过*右键单击* *Select*节点并选择*Add Option Pin*来执行此操作。这样做直到你有*四个*选项引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714638.jpeg)

接下来，将每个选项设置为以下内容：

- *选项 0：* SM_Hole_01
- *选项 1：* SM_Hole_02
- *选项 2：* SM_Hole_03
- *选项 3：* SM_Hole_04

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714835.jpeg)

现在，让我们选择一个随机选项。

### 随机化墙

您可以使用范围节点中的随机整数来获取随机数。该节点将返回一个>= Min 且 <= Max的值。

在 Range 节点中添加一个*Random Integer*并将其连接到*Select*节点的*Index*引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714690.jpeg)

将*最大值*设置为*3*。这将为您提供四个可能的数字：0、1、2 和 3。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161715343.jpeg)

为了创建更多的随机化，让我们向*WallMesh*添加随机旋转。*在Set Static Mesh*节点后添加以下内容：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161714975.jpeg)

*这将为WallMesh添加* *0*到*360*度之间的随机旋转。

这是最终图表：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161715027.jpeg)

概括：

1. 选择节点*提供*网格列表
2. *使用范围*节点中的随机整数选择随机网格
3. Set *Static Mesh*节点将*WallMesh*设置为选定的网格
4. *AddLocalRotation*节点向*WallMesh*添加随机旋转偏移

单击*Compile*，然后关闭*RandomizeWall*图。

切换到*BP_TunnelSpawner*并打开*SpawnTunnel*图。添加高亮节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718181.jpeg)

现在，每当隧道生成时，它都会有一个随机的墙体网格。

关闭*SpawnTunnel*图，然后单击*Compile*。返回主编辑器并按*“播放”*以查看所有的墙变体！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718081.gif)

如果你撞到墙，你将停止前进。然而，如果你四处走动并穿过一个洞，你将再次开始前进。

下一步是在玩家与墙壁碰撞时禁用向前移动。

## 处理墙壁碰撞

要启用或禁用向前移动，您可以使用*布尔*变量。这些只有两种状态：*true*和*false*。

打开*BP_Player*，然后创建一个名为*IsDead的新* *布尔*变量。

接下来，转到*Event Tick*节点并创建一个*Branch*节点。

*然后，获取对IsDead 的*引用并将其连接到*Branch*节点的*Condition*引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718691.jpeg)

将*Event Tick*节点连接到*Branch*节点。然后，将*Branch*节点的*False*引脚连接到*AddActorWorldOffset*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718884.jpeg)

现在，只要*IsDead*设置为*true*，玩家就会停止前进。

接下来，让我们在玩家撞墙时设置*IsDead变量。*

### 设置 IsDead 变量

单击*Compile*，然后切换到*BP_Tunnel*。在“组件”面板中，*右键单击*WallMesh*并*选择*“添加事件\添加 OnComponentHit”*。这会将以下节点添加到您的事件图表中：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718020.jpeg)

*只要另一个Actor*与*WallMesh*发生碰撞，该节点就会执行。

首先，您需要检查与*WallMesh*发生碰撞的*Actor*是否是玩家。

*左键单击*并*拖动* *Other Actor*引脚。在空白区域上松开鼠标*左键*，然后从菜单中选择*Cast to BP_Player 。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718171.jpeg)

接下来，*左键单击*并*拖动**Cast 到 BP_Player*节点的*BP_Player*引脚。释放*左键单击*空白区域，然后添加一个*Set Is Dead*节点。

通过*左键单击* *复选框*将*IsDead*设置为*true*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161718138.jpeg)

单击*编译*，然后返回到主编辑器。按*播放*并尝试撞墙。如果你绕到一个洞，你将不再穿过它。

![img](https://koenig-media.raywenderlich.com/uploads/2017/08/11.gif)

在下一节中，您将在玩家撞墙时显示一个重新启动按钮。

## 显示重启按钮

您将显示的Widget为*WBP_Restart*。*您可以在UI*文件夹中找到它。这是它的样子：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717711.jpeg)

要显示或隐藏小部件，您需要对它的引用。打开*BP_Player*，然后创建一个名为*RestartWidget*的新变量。*将变量类型*更改为*WBP_Restart\Object Reference*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717221.jpeg)

接下来，转到 Event Graph 并找到*Event BeginPlay*节点。

添加一个*Create Widget*节点并将*Class*值设置为*WBP_Restart*。

然后，添加一个*Set Restart Widget*节点，然后像这样连接所有内容：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717800.jpeg)

现在，当玩家生成时，它将创建*WBP_Restart*的一个实例。下一步是制作一个显示此实例的函数。

### 创建显示功能

创建一个新函数并将其命名为*DisplayRestart*。完成后，创建以下图表：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717956.jpeg)

概括：

1. *添加到视口*将在屏幕上显示*RestartWidget*
2. *设置仅输入模式 UI*将限制玩家与 UI 的交互。这是为了让玩家在死后无法四处走动。
3. 顾名思义，*Set Show Mouse Cursor*只是显示鼠标光标

要显示重启按钮，您需要做的就是在播放器与墙壁碰撞后调用*DisplayRestart 。*

### 调用显示函数

关闭*DisplayRestart*图，然后单击*Compile*。

切换到*BP_Tunnel*，然后找到*On Component Hit (WallMesh)*节点。

将*DisplayRestart*节点添加到节点链的末尾。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717447.jpeg)

单击*Compile*，然后关闭*BP_Tunnel*。返回主编辑器并按*Play*。如果撞墙，就会出现重启按钮。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717281.gif)

最后一步是在玩家单击按钮时重新启动游戏。

## 重启游戏

重启时游戏需要做两件事：

1. 重置播放器。这包括从屏幕上移除重启按钮。
2. 重生隧道。这样玩家就可以从隧道的起点开始。

让我们从重置播放器开始。

### 重置播放器

打开*BP_Player*，然后创建一个名为*RestartGame*的新函数。创建以下图形：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161717220.jpeg)

概括：

1. *Set Is Dead将* *IsDead*设置为*false*。这将重新启用向前运动。
2. *Remove From Parent*从屏幕上移除*RestartWidget*
3. *设置输入模式游戏仅*重新启用游戏输入，以便玩家可以四处移动
4. *设置 Show Mouse Cursor*隐藏鼠标光标

接下来，让我们重生隧道。

### 重生隧道

单击*Compile*，然后关闭*BP_Player*。

打开*BP_TunnelSpawner*并确保您位于*SpawnInitialTunnels*图中。

首先，您需要在生成新隧道之前移除现有隧道。

*在Entry*节点之后添加一个*Sequence*节点。将*Then 1*引脚连接到*ForLoop*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161716191.jpeg)

*注意：**Sequence*节点按顺序执行其输出。这是垂直组织图表的好方法，尤其是因为节点链可能会变得很长。

接下来，创建以下节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161716089.jpeg)

此设置将获取所有现有隧道并将它们从游戏中移除。

最后，将*Sequence*节点的*Then 0*引脚连接到*Get All Actors of Class*节点。这将确保隧道在产卵过程之前被移除。

这是最终图表：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161716499.jpeg)

最后要做的是处理按钮点击。

### 处理按钮点击

单击*Compile*，然后关闭*BP_TunnelSpawner*。

转到内容浏览器并导航到*UI*文件夹。*双击*WBP_Restart将其*打开*。

选择*RestartButton*，然后转到“详细信息”面板。转到*事件*部分并单击*OnClicked*旁边的*按钮*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161715845.jpeg)

*这将创建一个名为On Clicked (RestartButton)*的节点。当玩家点击*RestartButton*时，该节点将执行。

重新创建以下内容：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161716380.jpeg)

概括：

1. *Get Owning Player Pawn*返回玩家当前控制的 Pawn
2. *转换为 BP_Player*检查 Pawn 是否属于*BP_Player类*
3. 如果是，它将调用*RestartGame*函数。此函数重置播放器并隐藏重启按钮。
4. *Get All Actors of Class*并*Get*返回*BP_TunnelSpawner*，然后调用*SpawnInitialTunnels*。此函数将删除现有隧道并生成新隧道。

*注意：*您可能想知道为什么我使用*Get All Actors Of Class而不是使用对* *BP_TunnelSpawner*的引用。主要原因是因为*BP_Tunnel与* *WBP_Restart*没有关系。对于像这样的简单游戏，执行上述方法比弄清楚在哪里存储引用更容易。

单击*编译*，然后关闭蓝图编辑器。按*播放键*测试重启按钮！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161716254.gif)
