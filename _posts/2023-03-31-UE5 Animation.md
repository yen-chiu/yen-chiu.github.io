---
title: UE5 Animation 
date: 2023-03-31 23:15:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/383-unreal-engine-4-animation-tutorial

---

- 导入带有骨架的网格
- 导入动画
- 创建动画蓝图以过渡到不同的动画
- 在动画之间混合

## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/09/SkywardMuffinStarter.zip?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680275990206.1&__hssc=149040233.1.1680275990206&__hsfp=3393399156)并解压缩。在根目录中，您将看到一个名为*Animation Assets*的文件夹。

此文件夹包含您将要导入的角色和动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320604.jpg)

*通过导航到项目文件夹并打开SkywardMuffin.uproject*打开项目。

游戏的目标：

是在不掉落的情况下接触尽可能多的云。

单击鼠标左键跳到第一朵云。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320600.gif)

让我们控制这个可爱的小松饼，而不是普通的红色圆圈：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320610.jpg)

这个松饼包含一个*骨架*，可以让你为它制作动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320420.jpg)

## 什么是骨架？

在 3D 应用程序中，骨架是一组相互连接的点，称为**关节**。

在下图中，每个球体都是一个关节。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320738.jpg)

*注意：*虚幻引擎的术语 **关节**  = **骨骼**。

通过操纵这些关节，您可以为角色创建不同的姿势。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312323591.jpg)

当您从一个姿势转到另一个姿势时，您正在创建一个*动画*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320119.gif)

如果你在之前的姿势之间创建更多的姿势，你可以得到这样的东西：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320349.gif)

在 Unreal 中，任何带有骨架的网格物体都是 *Skeletal Mesh*。

让我们从导入松饼的骨架网格体开始。

## 导入骨架网格物体

转到内容浏览器并导航到*Characters\Muffin*。

单击*导入*，然后转到*SkywardMuffinStarter\Animation Assets*。选择*SK_Muffin.fbx*，然后单击*打开*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312332300.jpg)

在导入窗口中，转到*Mesh*部分并取消选中*Create Physics Asset*选项。

> 物理资源用于创建布娃娃效果。由于本教程不涉及这些内容，因此您不需要。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320973.jpg)

该项目已包含松饼材质和纹理，因此您无需导入它们。

取消选中“导入材料”和“导入纹理”选项。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320217.jpg)

将其他所有内容保留为默认设置，然后单击*“导入”*。

这将创建以下资产：

- **SK_Muffin**：骨架网格体资产。
  - 这基本上只是一个带有指向骨架资产的链接的网格。

- **SK_Muffin_Skeleton**：骨架资产。
  - 这包含一个关节列表和其他信息，例如它们的层次结构。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320495.jpg)


现在您已经导入了松饼，是时候使用它了。

## 使用骨架网格物体

在你使用你的新骨架网格体之前，你应该给它一个材质，这样它就不仅仅是一个灰色的斑点。

- *双击*SK_Muffin将其打开。

- 转到 Asset Details 面板并找到*Material Slots*部分。

- 分配*M_Muffin*材质，然后关闭*SK_Muffin*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320723.jpg)

现在，让我们使用*SK_Muffin*作为玩家角色。

返回内容浏览器并双击 BP_Muffin将其打开。

- 转到 Components 面板并选择*Mesh (Inherited)*组件。

- 导航到 Details 面板并找到*Mesh*部分。将*骨架网格体*属性设置为*SK_Muffin*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320949.jpg)

单击*编译*，然后返回到主编辑器。按*Play*像松饼一样玩游戏！

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320070.gif)

游戏已经看起来好多了！下一步是导入一些将为松饼增添活力的动画。

## 导入动画

转到内容浏览器并单击*导入*。

确保您在*SkywardMuffinStarter\Animation Assets*中，选择以下文件：

- SK_Muffin_Death.fbx
- SK_Muffin_Fall.fbx
- SK_Muffin_Idle.fbx
- SK_Muffin_Jump.fbx
- SK_Muffin_Walk.fbx

完成后，单击*打开*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320444.jpg)

在导入窗口中，**转到*“网格”*部分并取消选中“导入网格”选项，这将确保骨架网格体不会再次导入。**

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320689.jpg)

接下来，确保*Skeleton*属性设置为*SK_Muffin_Skeleton*，这指定动画将使用哪个骨架。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312336228.jpg)

最后，单击*全部导入*。这将使用您刚刚指定的设置导入所有动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320426.jpg)

现在您已经有了所有的动画，您需要一种播放它们的方法。

您可以使用**动画蓝图**来执行此操作。

## 创建动画蓝图

动画蓝图就像一个普通的蓝图。但是，它还有一个专用于动画任务的图表。

要创建一个，请转到内容浏览器并单击添加新按钮。选择*动画\动画蓝图*。

在弹出窗口中，找到*Target Skeleton*属性并选择*SK_Muffin_Skeleton*。

接下来，单击*确定*按钮创建动画蓝图。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312338263.jpg)

将资产重命名为*ABP_Muffin*。之后，*双击*它以在动画蓝图编辑器中将其打开。

### 动画蓝图编辑器

动画蓝图编辑器类似于蓝图编辑器，但有四个额外的面板：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312339317.jpeg)

1. *动画图：*此图专用于动画。这是您将播放动画的地方。
2. *预览场景设置：*此面板允许您在视口中调整预览场景
3. *动画预览编辑器：*您创建的变量也会显示在这里。使用此面板可以预览变量对最终动画的影响。
4. *资产浏览器：*该面板包含当前骨架可以使用的动画列表

要定义每个动画何时播放，您可以使用**状态机**。

## 什么是状态机？

状态机是一组**状态**和**规则**。

状态机一次只能处于一种状态。要转换到不同的状态，必须满足某些由规则定义的条件。

下面是一个简单状态机的示例。它显示了跳跃的状态以及转换到每个状态的规则。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320558.jpg)

状态也可以有双向关系。在下面的示例中，Jump 和 Fall 状态可以相互转换。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320875.jpg)

没有这种双向关系，角色将无法进行二段跳。这是因为角色只能从空闲状态进入跳跃状态。

### 创建状态机

确保您位于动画图表中，然后右键单击空白区域。从菜单中选择*添加新状态机*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312341679.jpg)

这会将状态机节点添加到您的图表中。将状态机重命名为*运动*。然后，将*运动状态*机连接到*最终动画姿势*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320500.jpg)

现在，*运动状态*机将决定松饼的最终动画。

接下来，双击运动状态机将其打开。在内部，您将看到一个*Entry*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312342364.jpg)

连接到此节点的状态是默认状态。对于本教程，默认状态为空闲动画。

通过右键单击图形上的空白区域来创建此状态。从菜单中选择*Add State*并将其重命名为*Idle*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320864.jpg)

现在，您需要将*Entry*节点连接到*Idle*状态。将Entry引脚拖动到*Idle*状态的*灰色*区域。释放*左键单击*以连接它们。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320131.gif)

当您使用上下文菜单创建状态时，它不会有链接到它的动画。让我们解决这个问题。

### 将动画链接到状态

*双击*Idle状态将其打开*。*

要链接动画，请转到资源浏览器，然后拖动并单击SK_Muffin_Idle动画。释放*左键单击*图表中的空白区域以添加它。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312343431.gif)

接下来，将*Play SK_Muffin_Idle*节点连接到*Final Animation Pose*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312343618.jpg)

要使用动画蓝图，您需要更新*BP_Muffin*。

### 使用动画蓝图

单击*Compile*，然后切换到*BP_Muffin*。

转到 Components 面板，然后选择*Mesh (Inherited)*组件。转到“详细信息”面板，然后找到*“动画”*部分。

将**动画模式**设置为*使用动画蓝图*。接下来，将*动画类*设置为*ABP_Muffin*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320493.jpg)

现在，骨架网格体将使用*ABP_Muffin*作为其动画蓝图。

单击*Compile*，然后关闭*BP_Muffin*。转到主编辑器并按下*Play*来测试动画蓝图。

由于*空闲*是默认状态，松饼会自动使用空闲动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320669.gif)

## 创建跳跃和下降状态

返回ABP_Muffin ，然后切换回运动状态机的图表。

您可以通过单击位于图表顶部的Locomotion标签来执行此操作。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320075.jpg)

您可以创建一个带有已链接动画的状态，而不是创建状态然后链接动画。让我们为跳跃状态这样做。

转到资源浏览器，然后拖动并单击SK_Muffin_Jump动画。在图中的空白区域上松开左键。这将创建一个已链接动画的状态。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320473.gif)

将状态重命名为*Jump*。

使用*SK_Muffin_Fall*动画重复该过程并将状态重命名为*Fall*。

您现在将拥有三种状态：*Idle*、*Jump*和*Fall*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320877.jpg)

接下来，您将把状态相互链接起来。您可以通过拖动单击要从中转换的状态的*灰色*区域来执行此操作。释放*左键单击目标*状态的*灰色*区域以创建过渡。

创建以下转换：

- **Idle** to **Jump**
- **Jump** to **Fall**
- **Fall** to **Jump**
- **Fall** to **Idle**

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312346923.jpg)

现在您有了转换，您需要定义何时可以发生转换。您可以使用*Transition Rules*来做到这一点。

## 过渡规则

此图标代表一个转换规则：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320457.jpg)

每个转换规则都包含一个带有单个布尔输入的*结果节点。*

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320585.jpg)

如果此输入为*true*，则可以发生转换。

接下来，您将创建变量来通知您玩家是在跳跃还是在坠落。然后您将在转换规则中使用这些变量。

### 检查玩家是否在跳跃或坠落

创建两个名为*IsJumping*和IsFalling 的布尔变量。

首先，您将设置IsJumping的值。切换到事件图表并找到事件蓝图更新动画节点。该节点的功能类似于*Event Tick*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312348274.jpg)

要检查玩家是否在跳跃，请创建以下设置：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312358213.jpeg)

这将检查玩家在Z 轴上的速度是否大于*0*。如果是，则玩家正在跳跃并且*IsJumping*将被设置为*true*。

*注意：*确保投射到将使用动画蓝图的类。这对于能够使用动画预览编辑器预览变量至关重要。

要检查玩家是否正在坠落，您只需执行相反的检查。添加高亮节点：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010000940.jpeg)

现在，如果玩家的*Z-Velocity*小于*0 ，* *IsFalling*将被设置为*true*。

是时候使用这些变量来定义转换规则了。

### 定义转换规则

首先，您将定义*Idle to Jump* Transition Rule。切换回*运动*状态机。*双击*Idle *to Jump* Transition Rule 将其打开。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312350692.jpg)

创建一个*IsJumping*节点并将其连接到*Result*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320427.jpg)

现在，当*IsJumping*为*true时，* *Idle*状态可以转换为*Jump*状态。

*对跳到坠落*和*坠落到跳跃*过渡规则重复该过程。使用以下变量：

- *跳到坠落：* IsFalling
- *跌倒跳跃：* IsJumping

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320691.jpg)

现在，*Jump*和*Fall*状态可以相互转换。

还有一个转换规则需要定义。继续并打开*Fall to Idle* Transition Rule。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312350875.jpg)

要转换到*空闲*状态，玩家不能跳跃或坠落。要执行此检查，

您可以使用*NOR*节点。该节点仅在其两个输入均为*false*时才返回*true*。

创建一个*NOR*节点并将*IsJumping*和*IsFalling*节点连接到它。然后，将*NOR*节点连接到*Result*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320376.jpg)

现在，当*IsJumping*和*IsFalling*为*false时，* *Fall*状态可以转换为*Idle*状态。

单击*编译*，然后返回到主编辑器。按*播放*测试转换。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320248.gif)

*注意：*您还可以通过在动画预览编辑器中编辑变量来测试过渡。

现在，松饼在地面上移动时只是滑动。这是因为你还没有使用走路动画！

*您可以使用Blend Space*将其与空闲动画混合，而不是为行走创建新状态。

## 什么是混合空间？

混合空间是一种动画资产。它根据输入值在不同的动画之间进行插值。在本教程中，您将使用玩家的*速度*作为输入。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320870.gif)

混合空间还可以帮助简化您的状态机。如果您不使用混合空间进行行走，*运动*状态机将如下所示：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312351415.jpg)

使用混合空间，您所要做的就是替换空闲动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312351238.jpg)

现在您已经了解了混合空间的魔力，让我们来创建一个吧。

### 创建混合空间

转到内容浏览器并单击*添加新的*。选择*Animation\Blend Space 1D*。

> 注意：Blend Space和*Blend Space 1D*之间的区别在于前者可以有两个输入。后者只能有*一个*。

从弹出窗口中，选择*SK_Muffin_Skeleton*。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320742.jpg)

将资产重命名为*BS_IdleWalk*，然后*双击*它以在动画编辑器中将其打开。

打开混合空间时，您会在底部看到一个面板。这是混合空间编辑器，您将在此处添加动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320016.jpg)

让我们向混合空间添加一些动画。

### 将动画添加到混合空间

首先，您将更改轴值（输入）的名称。

转到“资产详细信息”面板并找到*“轴设置”*部分。将*Horizontal Axis\Name*属性更改为*Speed*。

现在，您将添加动画。转到资源浏览器并拖动单击SK_Muffin_Idle动画。将它移动到混合空间网格的*左侧*，以便它捕捉到*0.0*值。释放*左键单击*以添加动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312353598.gif)

注意：要显示动画名称，请按混合空间网格 左上角的标签图标。

然后，在*100.0*值处添加*SK_Muffin_Walk*动画。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320774.jpg)

现在，混合空间将根据输入值混合空闲和行走动画。

如果输入为*0*，则只会播放空闲动画。如果输入为*100*，则只会播放行走动画。**介于两者之间的任何东西都是混合的。**

> 注意：这些值是任意的。

例如，您可以将最大值更改为 500。这将导致步行动画仅以更高的速度播放。

您可以更改“资产详细信息”面板中 *“轴设置”*部分下的值。

是时候使用混合空间了。

## 使用混合空间

关闭*BS_IdleWalk*然后打开*ABP_Muffin*。切换到*Locomotion* State Machine，然后打开*Idle*状态。

首先，删除*Play SK_Muffin_Idle*节点。

接下来，使用拖放方法添加*BS_IdleWalk混合空间。*然后，将*BS_IdleWalk*节点连接到*Final Animation Pose*节点。

![虚幻引擎 4 动画教程](https://koenig-media.raywenderlich.com/uploads/2017/09/44.jpg)

现在，*BS_IdleWalk*将自动播放，因为它是默认状态。但是，它只会显示空闲动画。这是因为其*速度*输入保持为*0*。

要解决此问题，您需要为其提供玩家的速度。

### 获得玩家的速度

创建一个名为Speed的新浮点变量。

然后，切换到事件图表。向Sequence节点添加一个新的 pin ，然后将突出显示的节点添加到其中：

![](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312357878.jpeg)

此设置会不断将*Speed*变量设置为玩家的速度。

切换回*空闲*状态的图表。将*Speed*变量连接到*BS_IdleWalk*节点的*Speed*输入。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320684.jpg)

现在，*BS_IdleWalk*将能够混合闲置动画和行走动画。

单击*编译*，然后返回到主编辑器。按*Play*测试混合空间。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320153.gif)

您还需要使用另一种动画：死亡动画！

## 使用死亡动画

在这个游戏中，你只能在*Idle*状态（在地面上）时死亡。但是，让我们想象一下您可能死于任何状态。

你的第一个想法可能是创建一个死亡状态并将每个状态连接到它。虽然这是一个选项，但它会很快导致图表混乱。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320374.jpg)

一个解决方案是使用*bool*节点的 Blend Poses。该节点可以根据输入布尔值在两个动画之间切换。

在创建之前，您需要一个保存玩家死亡状态的变量。

### 检查玩家是否死亡

返回*ABP_Muffin*并创建一个名为IsDead的布尔变量。然后，切换到事件图表。

*向Sequence*节点添加一个新的 pin ，然后将突出显示的节点添加到其中：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010003381.jpeg)

这将根据玩家的死亡状态设置*IsDead变量。*

接下来，您将使用*Blend Poses by bool*节点。

### 使用 Bool 节点的混合姿势

切换到动画图表并添加*SK_Muffin_Death*动画。选择它后，转到“详细信息”面板并取消选中“循环动画”属性。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010003538.jpg)

这将确保死亡动画只播放一次。

接下来，创建一个*Blend Poses by bool*节点。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320149.jpg)

*选择Blend Poses by bool*节点后，转到 Details 面板。在*Option*部分下，*选中*Reset *Child on Activation*属性。

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303312320595.jpg)

由于死亡动画只播放一次，此选项将确保动画在播放前重置。

最后，添加*IsDead*变量并像这样连接所有内容：

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010004375.jpg)

现在，如果*IsDead*为*true*，将播放死亡动画。如果*IsDead*为*false* ，则将播放*运动*状态机的当前动画。

单击*Compile*，然后关闭*ABP_Muffin*。按*播放*并测试新的死亡动画！

![虚幻引擎 4 动画教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010005601.gif)

