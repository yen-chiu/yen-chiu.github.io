---
title: UE5 Sample FPS
date: 2023-04-01 12:34:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/32435756-how-to-create-a-simple-fps-in-unreal-engine-5

---

第一人称射击游戏 (FPS) 是一种玩家使用枪支并通过可玩角色的视角体验游戏的游戏类型。*FPS 游戏非常受欢迎，拥有《使命召唤》*和*《战地风云》*等知名系列。

虚幻引擎是为创建 FPS 游戏而构建的，因此使用它创建一个游戏是有意义的。

- 创建一个可以移动和环顾四周的第一人称 Pawn。
- 创建一把枪并将其附加到玩家 Pawn 上。
- 使用线迹射出子弹——也称为光线投射。
- 对Actor造成伤害。

## 入门

使用本文开头或末尾的*“下载材料”*按钮下载项目材料，然后解压缩。*导航到名为BlockBreakerStarter 5.0*的项目文件夹，然后打开*BlockBreaker.uproject*。你会看到下面的场景：

![Unreal Engine 5 主窗口中项目的初始视图。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-01-ue5.png)

绿墙由多个目标组成，这些目标在受到伤害时会变成红色。一旦他们的生命值降为零，他们就会消失。红色按钮重置所有目标。

首先，您将创建玩家的 Pawn。

## 创建玩家 Pawn

如果您来自 UE4，您可能已经注意到文件夹面板似乎不见了。不要绝望，因为它是隐藏的，允许几乎全屏查看项目。要查找项目文件夹，只需单击屏幕左下角的*内容抽屉。*

![屏幕左下角的内容抽屉。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034681.png)

现在，您可以看到导航面板，包括文件夹结构和游戏资产。如果您想让它在屏幕底部永久打开，只需单击此面板右侧的*布局中的停靠。*

[![突出显示布局中停靠的内容抽屉面板。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034794.png)](https://koenig-media.raywenderlich.com/uploads/2022/05/DockNavigationPanel.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

导航到*Blueprints*文件夹并右键单击面板背景以创建一个新的*Blueprint Class*。选择*Character*作为父类并将其命名为*BP_Player*。

![在 UE5 中创建蓝图类](https://koenig-media.raywenderlich.com/uploads/2022/04/CreatingBlueprint.gif)

*Character*是一种具有附加功能的 Pawn，例如自动处理行走和跳跃等运动的*CharacterMovement*组件。您只需调用适当的函数，它就会移动 Pawn。您还可以在该组件内设置步行速度和跳跃速度等变量。

[![选择角色移动。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034212.png)](https://koenig-media.raywenderlich.com/uploads/2022/05/ComponentView.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

在您可以让 Pawn 移动之前，它需要知道玩家何时按下移动键。为此，您需要将移动映射到*W*、*A*、*S*和*D*键。

*注意*：如果您想了解映射，可以在此[蓝图教程](https://www.raywenderlich.com/156038/unreal-engine-4-blueprints-tutorial?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)中了解它们。键映射是您定义哪些键将执行操作的方式。

### 创建运动映射

通过键映射，您可以更改玩家角色的属性——例如他们在 XY 平面中的位置或视口的摄像机角度——并将其应用到游戏世界中。这就是您操纵角色位移和视角的方式。

选择*编辑 ▸ 项目设置*并打开*引擎*部分下的*输入*设置。

[![项目设置屏幕](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034303.png)](https://koenig-media.raywenderlich.com/uploads/2022/05/EngineInput.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

单击*Axis Mappings旁边的**+*两次，添加两个Axis Mappings。您可能必须通过单击添加第一个映射后出现的轴映射前面的*展开三角形来展开轴映射列表。*将它们重命名为*MoveForward*和*MoveRight*。*MoveForward*将处理向前和向后移动。*MoveRight*将处理左右移动。

![定义键绑定的输入菜单。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034769.png)

对于*MoveForward* ，通过首先选择*None*下拉列表将键更改为*W。*然后，展开*键盘*列表，最后选择列表底部的字母*W。*

[![按键映射](https://koenig-media.raywenderlich.com/uploads/2022/05/SelectKey.png)](https://koenig-media.raywenderlich.com/uploads/2022/05/SelectKey.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

之后，通过单击*MoveForward*旁边的*+*创建另一个键，并将其设置为*S*。*将S*的*比例*更改为*-1.0*。

![调整键映射中的比例，向前移动，比例为 1.0，向后移动，-1.0。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034679.png)

*注意*：如果您想了解有关*Scale*字段的更多信息，可以参考上面提到的相同[蓝图教程。](https://www.raywenderlich.com/156038/unreal-engine-4-blueprints-tutorial?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)轴*值和输入比例*部分描述了它是什么以及如何使用它。

稍后，您会将比例值与 Pawn 的前向向量相乘。如果比例为*正*，这将为您提供一个指向*前方*的矢量。如果比例为*负*，则矢量指向*后方*。使用生成的矢量，您可以让您的 Pawn 向前和向后移动。

![显示比例值如何影响角色移动的折线图。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-scaledirection.jpg)

接下来，您需要为左右移动做同样的事情。*将MoveRight*的键更改为*D*。之后，创建一个新密钥并将其设置为*A*。*将A*的*比例*更改为*-1.0*。

![调整键映射中的比例，向右移动，比例为 1.0，向左移动，-1.0。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034851.png)

现在您已经设置了映射，您需要使用它们来移动。

### 实施运动

双击*BP_Player*打开它，您将看到 Viewport 视图。使用窗口顶部的选项卡导航到*事件图。*

![UE5 编辑器窗口中的 EventGraph 选项卡位置。](https://koenig-media.raywenderlich.com/uploads/2022/05/EventGraph.png)

右键单击视图背景以添加*MoveForward*事件，该事件列在*Axis Events*下。这个事件将在每一帧执行，即使你没有按下任何东西。

![通过右键单击屏幕背景创建 MoveForward 蓝图节点。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034540.gif)

它还输出一个*Axis Value*，这是您之前设置的*Scale*值。如果按*W*则输出*1*，如果按*S则输出**-1*。如果您不按任何一个键，它会输出*0*。

![向前移动事件节点。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034752.jpg)

接下来，您需要告诉 Pawn 移动。添加一个*Add Movement Input*，并像这样连接它：

![连接节点以将运动应用于角色。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034521.png)

*Add Movement Input*获取一个向量并将其乘以*Scale Value*，将其转换为适当的方向。由于您使用的是*Character*，因此*CharacterMovement*组件会将 Pawn 朝适当的方向移动。

现在，您需要指定要移动的方向。因为你想向前移动，所以使用*Get Actor Forward Vector*返回一个指向前方的向量。创建一个并像这样连接它：

![设置角色移动的方向。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-07-ue5.png)

所以，总结一下：

- *MoveForward*运行每一帧并输出一个*Axis Value*。如果按*W*则此值为*1* ，如果按*S则此值为**-1*。如果您不按任何一个，则为*0*。
- *Add Movement Input*将 Pawn 的*前向向量*与*Scale Value*相乘。这会导致矢量指向前方或后方，具体取决于您按下的键。如果您不按任何键，则向量没有方向，这意味着 Pawn 不会移动。
- CharacterMovement组件从*Add Movement Input*获取结果并*在*适当的方向上移动 Pawn。

*对MoveRight*重复该过程，但将*Get Actor Forward Vector*替换为*Get Actor Right Vector*。

![将相同过程应用于 moveRight 事件后的结果。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034469.png)

在测试移动之前，您需要在游戏模式中设置默认 Pawn。

### 设置默认 Pawn

单击窗口左上角的*编译，然后返回主编辑器。*在您单击它之前，它会显示一个带问号的黄色圆圈。单击后，它应该有一个绿色圆圈，表示该过程成功。

![编译按钮的行为](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034702.gif)

打开*世界设置*面板并找到*游戏模式*部分。*将默认 Pawn 类*更改为*BP_Player*。

![定义主要角色类别的字段。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034359.png)

*注意*：如果您没有“世界设置”面板，请转到窗口右上角的*“设置” ，然后单击**“世界设置”*。
![进入“世界设置”对话框的替代方法。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-09-ue5.png)

现在，您将在游戏开始时自动使用*BP_Player ，它会自动放置在**Player Start*资产的位置。按*播放键*并使用*W*、*A*、*S*和*D*键四处移动。您可能必须先在游戏窗口内单击鼠标才能为该窗口提供键盘焦点。

![现在，您可以移动了！](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-01.gif)

接下来，您将创建环顾四周的映射。

## 创建外观映射

再次打开*项目设置。*再创建两个名为*LookHorizontal*和*LookVertical 的**轴映射*。

![为鼠标事件创建轴映射以处理水平查看。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034995.png)

*将LookHorizontal*的键更改为*Mouse X*。

![为鼠标事件创建轴映射以处理垂直查看。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034484.png)

*当您向右*移动鼠标时，此映射输出一个正值，反之亦然。

*接下来，将LookVertical*的键更改为*Mouse Y*。

![定义鼠标输入，考虑到相机移动。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034621.png)

*当您向上*移动鼠标时，此映射输出正值，反之亦然。

现在，您需要创建环顾四周的逻辑。

### 实施寻找

如果 Pawn 没有*相机*组件，Unreal 会自动为您创建一个相机。*默认情况下，此相机使用控制器*的旋转。

*注意*：如果您想了解有关控制器的更多信息，请查看有关[人工智能的](https://www.raywenderlich.com/238-unreal-engine-4-tutorial-artificial-intelligence?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)教程。

尽管控制器是非物理的，但它们仍然有自己的轮换。这意味着您可以使 Pawn 和相机朝向不同的方向。例如，在第三人称游戏中，角色和镜头并不总是朝向同一个方向。

![应用于第三人称游戏的相机外观。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034793.gif)

要在第一人称游戏中旋转相机，您只需更改控制器的旋转。这与您为移动所做的过程几乎相同——您只是使用旋转而不是平移。

打开*BP_Player*并创建一个*LookHorizontal*事件。

![调用事件来处理鼠标外观交互的水平分量。](https://koenig-media.raywenderlich.com/uploads/2022/04/unreal-simple-fps-12.9-ue5.png)

要使相机向左或向右看，您需要调整控制器的*偏航角*。创建一个*添加控制器偏航输入*并连接它：

[![添加控制器偏航输入](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034512.jpg)](https://koenig-media.raywenderlich.com/uploads/2022/06/AddControllerYawInput.jpg?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

当您水平移动鼠标时，控制器会向左或向右偏转。由于相机使用控制器的旋转，它也会偏航。

*对LookVertical*重复该过程，将*Add Controller Yaw Input*替换为*Add Controller Pitch Input*。

![将鼠标垂直输入连接到相机旋转节点。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-16.jpg)

如果您现在测试游戏，您会注意到垂直方向是*倒置的*。*这意味着当您向上*移动鼠标时，相机*向下*看。如果您更喜欢非反转控件，请添加一个*乘法*运算符并将*轴值*乘以*-1*。这会*反转轴值*和控制器俯仰。

[![反转鼠标外观。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034711.jpg)](https://koenig-media.raywenderlich.com/uploads/2022/06/AddControllerPitchInput.jpg?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

单击*“编译”*，然后按*“播放”*。使用鼠标开始环顾四周。

![环顾游戏世界。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-03.gif)

现在你已经完成了运动和观察，是时候制造一把枪了！

## 制造枪支

您知道创建蓝图类时如何选择父类吗？那么，您也可以选择自己的蓝图作为父级。当您拥有共享共同功能或属性的不同类型的对象时，这很有用。

假设您想拥有多种类型的汽车。您可以创建一个包含速度和颜色等变量的基本汽车类。然后，您可以创建使用基本汽车类作为父类的子类。每个孩子也将包含相同的变量。现在，您可以轻松地创建具有不同速度和颜色值的汽车。

![汽车蓝图的变化。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034624.jpg)

您可以使用相同的方法来制造枪支。您只需要先创建一个基类。

### 创建基础枪类

回到主编辑器，创建一个*Actor*类型的*蓝图类*。将其命名为*BP_BaseGun*，然后双击打开它。

接下来，您将创建变量来定义枪支属性。为此，请转到蓝图窗口的*“变量”*部分，然后单击框架右上角的*+按钮。*

![在 UE5 蓝图窗口中创建变量。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034829.gif)

创建以下*浮点*变量：

- *MaxBulletDistance*：每颗子弹可以移动多远。
- *Damage*：当子弹击中 actor 时应用多少伤害。
- *FireRate*：枪可以发射另一颗子弹的时间，以秒为单位。

![定义枪支蓝图类的变量。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034841.png)

*注意*：每个变量的默认值为零，这对本教程来说很好。但是，如果您希望新的枪支类别具有默认值，您可以在*BP_BaseGun*中设置它。

现在，您需要枪支的物理表示。单击*Add*，键入*Static Mesh*，选择组件*Static Mesh*将其添加到蓝图类中，并将其命名为*GunMesh*。

![将枪支网格组件添加到枪支类中。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034700.png)

现在不要担心选择静态网格物体。您将在下一节中创建儿童枪支类时执行此操作。在这个父类中，您只需定义一把枪必须有一个在游戏中显示枪支几何形状的静态网格组件。

### 创建儿童枪类

单击*Compile*，然后返回到主编辑器。要创建子类，请右键单击*BP_BaseGun*并选择*创建子蓝图类*。

![创建枪支类的子对象。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034951.gif)

将其命名为*BP_Rifle*，然后打开它。打开窗口右上角的*Class Defaults ，并设置变量值：*

- *最大子弹距离*：5000
- *伤害*：2
- *射速*：0.1

![更改 BP_Rifle 类的类默认值。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-18-ue5.png)

*这意味着每颗子弹最多可以飞行5000*距离。如果它击中了一个演员，它会造成*2 点*伤害。连续射击时，每次射击之间的持续时间至少为*0.1*秒。

接下来，您需要指定枪应该使用哪个网格。选择屏幕左侧的*GunMesh*组件，注意右侧的*Details选项卡已更改其内容。*查找*Static Mesh*部分并使用下拉菜单将其设置为*SM_Rifle*。

![设置 BP_Rifle 网格。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034554.gif)

枪是完整的。单击*编译*，然后关闭*BP_Rifle*。

接下来，您将创建自己的相机组件以更好地控制相机放置。它还可以让您将枪连接并保持在相机前面。

## 创建相机

打开*BP_Player* ，并以与创建*BP_BaseGun*类的*静态网格*组件相同的方式添加一个*Camera*组件。将其命名为*FpsCamera*。

![创建 FPS 相机。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034119.png)

默认位置有点太低，这可能会让玩家觉得自己很小。在*Details*面板上，将*FpsCamera*的*位置*设置为*(X:0, Y:0, Z:90)*。

![FPS 相机定位。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034210.png)

默认情况下，相机组件不使用控制器的旋转。要解决此问题，请转到*Details*面板并启用*Camera Options ▸ Use Pawn Control Rotation*。

![将枪支旋转定义为与 Pawn 的旋转相同。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034676.png)

接下来，您需要定义枪支的位置。

## 定义枪支位置

要创建枪支位置，您将使用*场景*组件。这些组件非常适合定义位置，因为它们只包含一个转换。确保选择了*FpsCamera*，然后添加一个*Scene*组件以将其附加到相机。将其命名为*GunLocation*。

![将枪连接到 FPS 相机。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-22-ue5.png)

通过将*GunLocation*附加到*FpsCamera*，枪将保持相对于相机的相同位置，始终保持枪在视野中。

接下来，在*Details*面板中，将*GunLocation*的*位置*设置为*(X:30, Y:14, Z:-12)*以将其放置在摄像机的前方并稍微偏向一侧。

![调整枪相对于相机的位置。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034019.png)

之后，将*旋转*设置为*(X:0, Y:0, Z:-95)*使其看起来好像在瞄准屏幕中心。

![调整枪相对于相机的旋转。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034498.png)

现在，您需要生成枪并将其附加到*GunLocation*。

### 产卵和附加枪

在*BP_Player*事件图上找到*Event BeginPlay*，创建一个*Spawn Actor From Class*并将其连接到它。将*类*设置为*BP_Rifle*。

![创建游戏开始时生成枪支的节点。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034592.png)

如果您现在编译，您将收到一条错误消息，指出 Spawn Transform 节点必须有一个连接到其中的输入。发生这种情况是因为，在当前形式中，此 pin 是一个结构，需要适当的初始化。为避免此错误，请右键单击*Pawn Transform*并选择*Split Struct Pin*。这将显示构成引脚的变量并为其分配初始值。现在代码编译成功。

![分裂节点生成变换。](https://koenig-media.raywenderlich.com/uploads/2022/07/SpawnActor.gif)

由于您稍后需要使用这把枪，因此您将把它存储在一个变量中，就像您之前为基枪类创建变量一样。现在，创建一个*BP_BaseGun*类型的变量，并将其命名为*EquippedGun*。

*注意*：重要的是变量*不是**BP_Rifle*类型。这是因为玩家可以使用不同类型的枪支，而不仅仅是步枪。如果生成不同类型的枪支，则无法将其存储在*BP_Rifle*类型的变量中。这就像试图将一个圆放入一个矩形孔中。

*通过创建BP_BaseGun*类型的变量，您创建了一个可以接受多种形状的大洞。

接下来，将*EquippedGun*设置为*Spawn Actor From Class*的*返回值*。

![从实例化的枪中获取变量。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034443.png)

要附加枪支，您可以使用*AttachActorToComponent*。创建一个并将*位置规则*和*旋转规则*设置为*对齐目标*以使枪与其父枪具有相同的位置和旋转。

![创建将枪连接到角色的节点](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-27-ue5.png)

*接下来，创建对GunLocation*的引用并连接所有内容：

![游戏开始时制作枪支的最终蓝图脚本。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034704.png)

所以，总结一下：

- 当*BP_Player产生时，它会产生一个**BP_Rifle*的实例。
- *EquippedGun*保留对生成的*BP_Rifle 的*引用以供以后使用。
- *AttachToComponent*将枪附加到*GunLocation*。

单击*“编译”*，然后按*“播放”*。现在，当你重生时，你就有了一把枪！当你环顾四周时，枪总是在镜头前。

![枪跟随相机的位置和旋转。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034552.gif)

## 射击子弹

现在是有趣的部分：射击子弹！要检查子弹是否击中某物，您将使用*line trace*。

线轨迹是一个函数，它接受起点和终点，形成一条线。然后它会检查这条线上的每个点，从开始到结束，直到它碰到什么东西。这是游戏中最常见的检查子弹是否击中物体的方法。

由于射击是枪支的功能，因此它应该属于枪支类而不是玩家。打开*BP_BaseGun*并通过单击屏幕左侧*Functions*面板顶部的*+创建一个名为**Shoot*的函数。

![在蓝图文件中创建 UE5 中的函数。](https://koenig-media.raywenderlich.com/uploads/2022/07/CreateFunction.gif)

输入 Shoot 函数的名称后，UE5 应该会在屏幕中央自动打开一个带有紫色*Shoot*节点的蓝图选项卡。如果它没有自动打开，请双击左侧面板上新创建的函数。

然后，在右侧的*Input面板上，单击**+*创建两个*Vector*输入。将它们命名为*StartLocation*和*EndLocation以表示您将从**BP_Player*传入的线轨迹的起点和终点。请注意，Inputs 被添加到*Shoot*节点，就像函数参数一样。

![定义枪范围的开始和结束位置。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034184.png)

*您可以使用LineTraceByChannel*执行线路跟踪。*此节点使用可见性*或*相机*碰撞通道检查命中。创建一个并连接它：

![定义用于确定对象是否被拍摄的光线跟踪节点。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-30-ue5.png)

接下来，您需要检查线路跟踪是否命中任何东西。创建一个*分支*并连接它：

![确定线轨迹是否击中目标。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-31-ue5.png)

如果命中则*返回值*输出*真，否则**输出假*。

接下来，为了向玩家提供子弹击中位置的视觉反馈，您将使用粒子效果。

### 生成子弹冲击粒子

首先，您需要获取跟踪命中的位置。*拖动单击*Out *Hit*并在图中释放*左键单击。*从菜单中选择*Break Hit Result*。

![从命中结果中获取更多信息。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-32-ue5.png)

这为您提供了一个节点，其中包含与线路跟踪结果相关的各种引脚。

在 Location创建一个*Spawn Emitter*并将*Emitter Template*设置为*PS_BulletImpact*。然后，将其*Location*连接到*Break Hit Result*的*Location*。

![设置粒子发射器并在正确的位置生成它。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034686.png)

这是到目前为止的功能：

![生成粒子发射器的过程的完整结果。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034791.png)

所以，总结一下：

- 当*Shoot*执行时，它会使用提供的起点和终点执行线条跟踪。
- 如果命中，*Spawn Emitter at Location*在命中位置生成*PS_BulletImpact 。*

现在拍摄逻辑已经完成，您需要使用它。

### 调用拍摄功能

首先，您需要创建用于拍摄的键映射。单击*编译*并打开*项目设置*。创建一个名为*Shoot的新**轴映射*。将其键设置为*Left Mouse Button*，然后关闭*Project Settings*。

![输入映射到鼠标射击事件。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034796.png)

接下来，打开*BP_Player*并创建一个*Shoot*事件。

![添加拍摄事件。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034500.png)

要检查玩家是否按下了*Shoot*键，您只需检查*Axis Value*是否等于*1*。创建突出显示的节点。一个是*Branch*，另一个是*Equal operator*：

![验证按下的按钮的状态。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034576.jpg)

*接下来，创建对EquippedGun 的*引用，然后调用其*Shoot*函数。

[![再添加两个节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034637.png)](https://koenig-media.raywenderlich.com/uploads/2022/07/ShootFunction.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

现在，您需要计算线条轨迹的起点和终点。

### 计算线迹位置

在许多 FPS 游戏中，子弹从相机而不是枪开始，因为相机已经与十字准线完美对齐。所以如果你用相机射击，子弹肯定会射到十字准线所在的地方。

*注意*：有些游戏*确实是*用枪射击的。然而，它需要额外的计算才能射向十字准线。

仍然在*BP_Player Blueprint Class*中，创建一个*GetWorldLocation (FpsCamera)*。

![获取相机的位置。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034301.png)

接下来，您需要向 FpsCamera添加一个*GetForwardVector 。*从 FpsCamera*单击并拖动并键入**getforwardvector*。

[![添加了一个获取前向矢量节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034477.png)](https://koenig-media.raywenderlich.com/uploads/2022/07/ForwardVector.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

现在，您需要结束位置。枪支有一个*MaxBulletDistance*变量，因此结束位置必须是距离相机的*MaxBulletDistance单位。*单击*EquippedGun*变量并将其拖到蓝图图表中，然后*单击并拖出*该节点。然后，键入*Max Bullet Distance*，并在窗口中选择它。要执行所需的数学计算，从*Max Bullet Distance中**单击并拖动*，键入***以创建乘法节点，从乘法节点*单击并拖动并键入**+*以创建加法节点。该过程应如下所示：

![创建和连接节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034920.gif)

然后，通过连接节点完成：

![计算击中某物的击球距离。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034421.png)

之后，连接一切：

[![连接所有节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034591.png)](https://koenig-media.raywenderlich.com/uploads/2022/07/connecteverything.png?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.6.1680278382804&__hsfp=3393399156)

所以，总结一下：

- 当玩家按下或按住*左键单击*时，枪从*相机*开始发射子弹。
- 子弹向前行进由*MaxBulletDistance*指定的距离。

单击*“编译”*，然后按*“播放”*。按住*左键*开始射击。

![子弹之间没有间隔的枪射击。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034551.gif)

目前，枪在每一帧中射击。这太快了，所以下一步是降低枪的射速。

## 降低射速

首先，您需要一个变量来决定玩家是否可以射击。打开*BP_Player*并创建一个名为*CanShoot的**布尔*变量。将其默认值设置为*true*。如果*CanShoot*等于*true*，则玩家可以射击，反之亦然。

将*CanShoot*变量拖到蓝图图中并放置一个节点以获取其值。从此变量*单击并拖动，键入**AND*，然后选择相应的逻辑运算。将*分支*部分更改为：

![验证玩家是否可以射击。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034081.png)

现在，玩家只能在按下*Shoot键**且* *CanShoot*等于*true*时进行射击。

枪射击后，需要冷却时间。因此，您需要在*Shoot*功能之后添加更多节点。为此，*单击并拖动**Shoot*函数调用上的箭头，然后键入*CanShoot*以添加*SetCanShoot*节点。确保未选中此节点上的复选框以将变量设置为 false。接下来，*单击并*从*SetCanShoot*箭头拖动，添加一个*Delay*节点和一个*SetCanShoot*节点。现在，确保选中复选框以将变量设置为 true，从而允许发射下一枪。还记得枪有一个*FireRate*变量吗？获取*射速*从*EquippedGun获取变量的方式与获取**MaxBulletDistance 的*方式相同。最终结果应如下所示：

![调整火炮射速。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034460.png)

您刚刚进行了以下更改：

- 玩家只有在按住*左键单击*且*CanShoot*等于*true*时才能射击。
- 玩家发射子弹后，*CanShoot*将设置为*false*。这可以防止玩家再次射击。
- *CanShoot在**FireRate*提供的持续时间后设置回*true*。

单击*Compile*，然后关闭*BP_Player*。按*Play*并测试新的射速。

![新玩家命中率。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034488.gif)

*接下来，您将通过对目标和按钮施加伤害*来使它们响应子弹。

## 施加伤害

在 Unreal 中，每个演员都有能力受到伤害。但是，由您决定演员如何*回应*。

例如，当受到伤害时，格斗游戏角色会失去健康。但是，像气球这样的东西不会有生命值——你可以将它编程为在受到伤害时弹出。

在处理演员如何受到伤害之前，您首先需要*应用*伤害。打开*BP_BaseGun ，并在**Shoot*函数的末尾添加*Apply Damage*。

![Apply Damage 节点。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034812.png)

接下来，您需要指定被线迹击中的演员应该受到伤害。将*Damaged Actor*连接到*Break Hit Result*的*Hit Actor*。

![将 Apply Damage 节点与其余的蓝图代码连接起来。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034519.png)

最后，您需要指定要应用多少损坏。*获取对Damage 的*引用并将其连接到*Base Damage*。

![选择应该对另一个角色造成多少伤害。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034736.png)

现在，当您调用*Shoot*时，它会损坏任何被线迹击中的演员。单击*Compile*，然后关闭*BP_BaseGun*。

现在，您需要处理每个演员如何受到伤害。

### 处理损坏

首先，您将处理目标如何受到伤害。打开*BP_Target*，并创建一个*事件 AnyDamage*。只要演员受到不*为零*的伤害，就会执行此事件。

![使目标做好受到伤害的准备。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034207.png)

接下来，调用*TakeDamage*函数并连接*Damage*引脚。这将从目标的*健康*变量中减去健康并更新目标的颜色。

![受到射击伤害。](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-simple-fps-45-ue5.png)

现在，当目标受到伤害时，它会失去生命值。单击*Compile*，然后关闭*BP_Target*。

接下来，您需要处理按钮如何受到损坏。打开*BP_ResetButton*并创建一个*事件 AnyDamage*。然后，调用*ResetTargets*函数。

![让重置按钮响应损坏。](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034355.png)

当按钮受到损坏时，这会重置所有目标。单击*Compile*，然后关闭*BP_ResetButton*。

按*播放键*，开始射击目标。要重置目标，请按下按钮。

![最终项目运行](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010034664.gif)