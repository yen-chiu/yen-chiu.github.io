---
title: UE5 Artificial Intelligence
date: 2023-04-01 12:34:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/238-unreal-engine-4-tutorial-artificial-intelligence

---

人工智能 (AI) 通常是指非玩家角色如何做出决定。这可能就像敌人看到玩家然后攻击一样简单。它也可以是更复杂的东西，例如实时策略中的 AI 控制玩家。

在虚幻引擎中，可以使用*行为树*来创建 AI 。行为树是用于确定AI 应该执行哪种*行为的*系统。

例如，可能有打架和逃跑行为。可以创建行为树，以便 AI 在生命值高于 50% 时进行战斗。如果低于50%，它就会跑掉。

- 创建可以控制 Pawn 的 AI 实体
- 创建和使用行为树*（behavior trees）*和黑板*（blackboards）*
- 使用 AI Perception 给 Pawn 视线
- 创建行为以使 Pawn 漫游并攻击敌人



## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/12/MuffinWarStarter.zip?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.5.1680278382804&__hsfp=3393399156)并解压缩。导航到项目文件夹并打开*MuffinWar.uproject*。

按*播放*开始游戏。*在围栏区域内左键单击*以生成松饼。

![虚幻引擎 4 粒子教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029175.gif)

在本教程中，将创建一个会四处游荡的 AI。

当敌人的松饼进入 AI 的视野范围内时，AI 会移动到敌人身边并对其进行攻击。

要创建 AI 角色，需要三样东西：

1. *身体：*这是角色的物理表现。在这种情况下，松饼就是身体。
2. *灵魂：*灵魂是控制角色的实体。这可能是玩家或 AI。
3. *大脑：*大脑是人工智能做出决定的方式。可以用不同的方式创建它，例如 C++ 代码、蓝图或行为树。

既然已经有了身体，那么所需要的只是灵魂和大脑。首先，将创建一个作为灵魂的*控制器。*

## 什么是控制器？

控制器是可以*拥有*Pawn 的非物理参与者。Possession 允许控制器（猜对了）*控制*Pawn。但在这种情况下，“控制”是什么意思？

对于玩家来说，这意味着按下按钮并让 Pawn 做某事。控制器接收来自玩家的输入，然后它可以将输入发送到 Pawn。控制器也可以改为处理输入，然后告诉 Pawn 执行操作。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029440.jpg)

在 AI 的情况下，Pawn 可以从控制器或大脑接收信息（取决于对其进行编程的方式）。

要使用 AI 控制松饼，需要创建一种特殊类型的控制器，称为*AI 控制器*。

### 创建一个人工智能控制器

导航到 `Characters\Muffin\AI`并创建一个新的 `Blueprint Class` 。选择 `AIController` 作为父类并将其命名为 `AIC_Muffin` 。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029609.jpg)

接下来，需要告诉松饼使用的新 AI 控制器。导航到 `Characters\Muffin\Blueprints` 并打开 *BP_Muffin*。

默认情况下，Details 面板应显示蓝图的默认设置。如果没有，请单击工具栏中的*类默认值。*

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202305051157409.jpeg)

转到 Details 面板并找到*Pawn*部分。将*AI 控制器类*设置为*AIC_Muffin*。这将在松饼生成时生成控制器的一个实例。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029469.jpg)

由于要生成松饼，因此还需要将*Auto Possess AI*设置为*Spawned*。这将确保*AIC_Muffin*在生成时自动拥有*BP_Muffin*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029704.jpg)

单击*Compile*，然后关闭*BP_Muffin*。

现在，将创建驱动松饼行为的逻辑。为此，可以使用*行为树*。

## 创建行为树

导航到 `Characters\Muffin\AI` 并选择 `Add New\Artificial Intelligence\Behavior Tree` 。将其命名为`BT_Muffin` 然后打开它。

### 行为树编辑器

行为树编辑器包含两个新面板：

![](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202305051216738.jpeg)

1. *行为树：*此图是创建节点以制作行为树的位置
2. *详细信息：*选择的节点将在此处显示其属性
3. *黑板：*此面板将显示黑板键（稍后会详细介绍）及其值。**只会在游戏运行时显示。**

与蓝图一样，行为树由节点组成。

行为树中有四种类型的节点。

前两个是**tasks**和**composites**。

### 什么是任务和组合？ tasks &  composites

顾名思义，任务是一个“做”某事的节点。

这可能是一些复杂的事情，例如执行组合。也可以是简单的事情，比如等待。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029074.jpg)

要执行任务，需要使用复合材料。行为树由许多分支（行为）组成。每个分支的根是一个组合。不同类型的组合有不同的方式来执行它们的子节点。

例如，有以下操作序列：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029362.jpg)

要按顺序执行每个操作，可以使用*Sequence*组合。这是因为 Sequence 从左到右执行其子级。

这是它的样子：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029996.jpg)

*注意：*从组合开始的一切都可以称为*子树*。通常，这些是的行为。

在这个例子中，*序列*、*移动到敌人*、*旋转到敌人*和*攻击*可以被认为是“攻击敌人”行为。

如果一个Sequence的任何一个孩子*失败*，序列将停止执行。

例如，如果 Pawn 无法移动到敌人，*Move To Enemy*将失败。这意味着*Rotate Towards Enemy*和*Attack*将不会执行。但是，如果 Pawn 成功移动到敌人，它们就会执行。

稍后，还将了解*Selector*组合。现在，将使用Sequence让 Pawn 移动到随机位置，然后等待。

### 移动到随机位置

创建一个*Sequence*并将其连接到*Root*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202305051157592.gif)

接下来，需要移动 Pawn。创建一个*MoveTo*并将其连接到*Sequence*。该节点会将 Pawn 移动到指定位置或角色。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202305051203127.jpeg)

然后，创建一个*Wait*并将其连接到*Sequence*。确保将它放在*MoveTo*的*右侧*。顺序在这里很重要，因为孩子们将从左到右执行。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029636.jpg)

*注意：*可以通过查看每个节点右上角的数字来检查执行顺序。编号较低的节点优先于编号较高的节点。

恭喜，刚刚创建了第一个行为！它会将 Pawn 移动到指定位置，然后等待五秒钟。

要移动 Pawn，需要指定一个位置。但是，*MoveTo*只接受通过 *blackboards* 提供的值，因此需要创建一个。

## 创建黑板 blackboards

黑板是一种资产，其唯一功能是保存变量（称为*键*）。可以将其视为 AI 的记忆。

虽然不需要使用它们，但黑板提供了一种方便的方式来读取和存储数据。

这很方便，**因为行为树中的许多节点只接受黑板键**。

要创建一个，返回内容浏览器并选择 *添加新 \ 人工智能 \ 黑板* 。将其命名为 *BB_Muffin* 然后打开它。

### 黑板编辑器

黑板编辑器由两个面板组成：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029972.jpg)

1. *黑板：*此面板将显示的按键列表
2. *黑板详细信息：*此面板将显示所选键的属性

现在，需要创建一个密钥来保存目标位置。

### 创建目标位置键

由于在 3D 空间中存储位置，因此需要将其存储为矢量。点击*New Key*并选择*Vector*。将其命名为*TargetLocation*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029179.jpg)

接下来，需要一种方法来生成随机位置并将其存储在黑板中。为此，可以使用第三种行为树节点：*服务*。

## 什么是服务？ Service

服务就像任务一样，可以使用它们来做某事。但是，不是让 Pawn 执行操作，而是使用服务来执行检查或更新黑板。

服务不是单独的节点。相反，它们附加到任务或复合材料。这会导致更有条理的行为树，因为需要处理的节点更少。这是使用任务的样子：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029561.jpg)

这是使用服务的样子：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029755.jpg)

现在，是时候创建一个将生成随机位置的服务了。

### 创建服务 

返回*BT_Muffin*并单击*New Service*。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-16.jpg)

这将创建一个新服务并自动打开它。将其命名为*BTService_SetRandomLocation*。需要返回到内容浏览器来重命名它。

该服务只需要在 Pawn 想要移动时执行。为此，需要将其附加到*MoveTo*。

打开*BT_Muffin*，然后*右键*单击*MoveTo*。选择*添加服务\BTService 设置随机位置*。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-03.gif)

现在，*BTService_SetRandomLocation将在* *MoveTo*激活时激活。

接下来，需要生成一个随机目标位置。

### 生成随机位置

打开*BTService_SetRandomLocation*。

要知道服务何时激活，请创建一个*事件接收激活 AI*节点。这将在服务的父级（它附加到的节点）激活时执行。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029724.jpg)

*注意：*还有另一个名为*Event Receive Activation*的事件执行相同的操作。这两个事件的区别在于*Event Receive Activation AI*还提供了*Controlled Pawn*。

要生成随机位置，请添加突出显示的节点。确保将*半径*设置为*500*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029020.jpg)

这将为提供一个在Pawn *500 个*单位范围内的随机导航位置。

*注意：* *GetRandomPointInNavigableRadius*使用导航数据（称为*NavMesh*）来确定一个点是否可导航。在本教程中，我已经为创建了 NavMesh。可以通过转到视口并选择*Show\Navigation*来可视化它。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029233.jpg)

如果想创建自己的 NavMesh，请创建一个*Nav Mesh Bounds Volume*。缩放它，以便它封装想要导航的区域。

接下来，需要将位置存储到黑板中。有两种方法可以指定使用哪个键：

1. *可以通过在Make Literal Name*节点中使用其名称来指定密钥
2. 可以向行为树公开一个变量。这将允许从下拉列表中选择一个键。

将使用第二种方法。*创建Blackboard Key Selector*类型的变量。将其命名为*BlackboardKey*并启用*Instance Editable*。当在行为树中选择服务时，这将允许变量出现。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029401.jpg)

然后，创建突出显示的节点：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029770.jpg)

概括：

1. *事件接收激活 AI*在它的父级（在本例中为*MoveTo*）激活时执行
2. *GetRandomPointInNavigableRadius*返回受控松饼*500*个单位内的随机导航位置
3. *Set Blackboard Value as Vector将黑板键（由* *BlackboardKey*提供）的值设置为随机位置

点击*Compile*然后关闭*BTService_SetRandomLocation*。

接下来，需要告诉行为树使用的黑板。

### 选择黑板

打开*BT_Muffin*并确保没有选择任何东西。转到“详细信息”面板。在*Behavior Tree*下，将*Blackboard Asset*设置为*BB_Muffin*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029757.jpg)

之后，*MoveTo*和*BTService_SetRandomLocation*将自动使用第一个黑板键。在这种情况下，它是*TargetLocation*。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-22.jpg)

最后，需要告诉 AI 控制器运行行为树。

## 运行行为树

打开*AIC_Muffin*并将*Run Behavior Tree*连接到*Event BeginPlay*。*将BTAsset*设置为*BT_Muffin*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029157.jpg)

这将在*AIC_Controller*生成时运行*BT_Muffin*。

单击*编译*，然后返回到主编辑器。按*Play*，生成一些松饼并观察它们四处游荡。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-04.gif)

这是很多设置，但做到了！接下来，将设置 AI 控制器，以便它可以检测其视野范围内的敌人。

为此，可以使用*AI Perception*。

## 设置 AI 感知 - AI Perception

AI Perception 是可以添加到 Actor 的组件。使用它，可以为的 AI 提供*感官*（例如视觉和听觉）。

打开*AIC_Muffin*，然后添加一个*AIPerception*组件。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029313.jpg)

接下来，需要添加一种感觉。由于想要检测另一个松饼何时进入视野，因此需要添加*视觉*感官。

选择*AIPerception*，然后转到“详细信息”面板。*在AI Perception*下，向*Senses Config*添加一个新元素。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-25.jpg)

将元素*0*设置为*AI Sight 配置*，然后将其展开。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029897.jpg)

视线主要有以下三种设置：

1. **Sight Radius** *视线半径：*松饼可以看到的最大距离。将其保留为*3000*。
2. **Lose Sight Radius**：如果松饼看到敌人，这是在松饼看不见敌人之前敌人必须移动多远。将其保留在*3500*。
3. **Peripheral Vision Half Angle Degrees**：松饼的视野有多宽。将其设置为*45*。这将使松饼具有*90*度的视野范围。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029856.jpg)

默认情况下，AI Perception 仅检测敌人（分配给不同*团队*的演员）。

但是，默认情况下，演员没有团队。当演员没有团队时，AI Perception 认为它是*中立的*。

在撰写本文时，还没有使用蓝图分配团队的方法。相反，可以只让 AI Perpcetion 检测中立演员。

为此，展开*Detection by Affiliation*并启用*Detect Neutrals*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029228.jpg)

单击*编译*，然后返回到主编辑器。按*播放*并生成一些松饼。按 `‘ `键显示 AI 调试屏幕。按*小键盘*上的`4`可视化 AI 感知。当松饼进入视野时，会出现一个绿色球体。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-05.gif)

接下来，将把松饼移向敌人。为此，行为树需要了解*敌人*。可以通过在黑板上存储对敌人的引用来做到这一点。

## 创建敌人钥匙

打开*BB_Muffin ，然后添加一个* *Object*类型的键。将其重命名为*Enemy*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029188.jpg)

现在，将无法在*MoveTo*中使用*Enemy*。这是因为键是一个*对象*，但*MoveTo只接受**Vector*或*Actor*类型的键。

要解决此问题，请选择*Enemy*然后展开*Key Type*。将*基类*设置为*Actor*。这将允许行为树将*Enemy*识别为*Actor*。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-30.jpg)

关闭*BB_Muffin*。现在，需要创建一种行为来向敌人移动。

### 走向敌人

打开*BT_Muffin*然后断开*Sequence*和*Root*。可以通过*按住 alt 键并单击**连接它们的电线*来执行此操作。暂时将 roam 子树移到一边。

接下来，创建突出显示的节点并将其*Blackboard Key*设置为*Enemy*：

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-31.jpg)

这会将 Pawn 移向*Enemy*。在某些情况下，Pawn 不会完全面向其目标，因此还可以使用*Rotate 来面向 BB 入口*。

现在，当 AI Perception 检测到另一个松饼时，需要设置*Enemy*。

### 设置敌人键

打开*AIC_Muffin*，然后选择*AIPerception*组件。添加*On Perception Updated*事件。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029747.jpg)

只要感知更新，就会执行此事件。在这种情况下，每当 AI 看到或看不到某物时。此事件还提供了它当前检测到的参与者列表。

添加突出显示的节点。确保将*Make Literal Name*设置为*Enemy*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029017.jpg)

这将检查 AI 是否已经有敌人。如果没有，需要给它一个。为此，添加突出显示的节点：

[![虚幻引擎4人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029257.jpg)](https://koenig-media.raywenderlich.com/uploads/2018/01/unreal-ai-34.jpg?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.5.1680278382804&__hsfp=3393399156)

概括：

1. *IsValid*将检查*Enemy*键是否已设置
2. 如果没有设置，循环遍历所有当前感知到的actors
3. *Cast To BP_Muffin*将检查演员是否是松饼
4. 如果是松饼，检查它是否死了
5. 如果*IsDead*返回*false*，将松饼设置为新的*Enemy*然后中断循环

单击*Compile*，然后关闭*AIC_Muffin*。按*播放键*，然后生成两个松饼，一个在另一个前面。后面的松饼会自动走向另一个松饼。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-06.gif)

接下来，将创建一个自定义任务来让松饼进行攻击。

## 创建攻击任务

可以在内容浏览器而不是行为树编辑器中创建任务。创建一个新的*蓝图类*并选择*BTTask_BlueprintBase*作为父类。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029843.jpg)

将其命名为*BTTask_Attack*然后打开它。添加*事件接收执行 AI*节点。该节点将在行为树执行*BTTask_Attack*时执行。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-37.jpg)

首先，需要制作松饼。*BP_Muffin*包含一个*IsAttacking*变量。设置后，松饼将进行攻击。为此，添加突出显示的节点：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029346.jpg)

如果在当前状态下使用任务，执行将卡在它上面。这是因为行为树不知道任务是否已经完成。要解决此问题，请将*Finish Execute*添加到链的末尾。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029518.jpg)

接下来，启用*Success*。由于使用的是*Sequence*，这将允许执行*BTTask_Attack之后的节点。*

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029273.jpg)

图表应该是这样的：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029235.jpg)

概括：

1. *Event Receive Execute AI*会在行为树运行*BTTask_Attack时执行*
2. *Cast To BP_Muffin*将检查*Controlled Pawn*是否为*BP_Muffin类型*
3. 如果是，则设置其*IsAttacking变量*
4. *Finish Execute*会让行为树知道任务已经*成功完成*

单击*Compile*，然后关闭*BTTask_Attack*。

现在，需要将*BTTask_Attack*添加到行为树中。

### 向行为树添加攻击

打开*BT_Muffin*。然后，将*BTTask_Attack添加到**序列*的末尾

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029183.jpg)

接下来，将*Wait添加到**Sequence*的末尾。将其*等待时间*设置为*2*。这将确保松饼不会不断发作。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029307.jpg)

返回主编辑器并按*Play*。像上次一样生成两个松饼。松饼会向敌人移动和旋转。之后，它会攻击并等待两秒钟。如果它看到另一个敌人，它将再次执行整个序列。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029836.gif)

在最后一节中，将把攻击子树和漫游子树组合在一起。

## 合并子树

要组合子树，可以使用*Selector*组合。与序列一样，它们也是从左到右执行的。但是，选择器将在孩子**成功**时停止。通过使用此行为，可以确保行为树只执行一个子树。

打开*BT_Muffin*，然后在*Root*节点后创建一个*Selector*。然后，像这样连接子树：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029337.jpg)

此设置一次只允许一个子树运行。以下是每个子树的运行方式：

- *攻击：* *选择器*将首先运行攻击子树。如果所有任务都成功，*序列*也将成功。选择*器*将检测到这一点，然后停止执行。这将阻止漫游子树运行。
- *漫游：*选择器将首先尝试运行攻击子树。如果没有设置*Enemy ，* *MoveTo*将失败。这也会导致*Sequence*失败。由于攻击子树失败，*选择器*将执行它的下一个子树，即漫游子树。

返回主编辑器，按*Play*。产生一些松饼来测试它。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029508.gif)

“等等，松饼为什么不立即攻击另一个？”

在传统的行为树中，每次更新都从根开始执行。这意味着每次更新，它都会先尝试攻击子树，然后再尝试漫游子树。*这意味着如果Enemy*的值发生变化，行为树可以立即更改子树。

**但是，Unreal 的行为树的工作方式不同**。

在 Unreal 中，执行从最后执行的节点开始。由于 AI Perception **不会立即**感知到其他参与者，因此漫游子树开始运行。行为树现在必须等待漫游子树完成，然后才能重新评估攻击子树。

要解决此问题，可以使用最终类型的节点：**decorators**。

## 创建装饰器 - decorators

与服务一样，装饰器附加到任务或组合。通常，使用装饰器来执行检查。如果结果为真，装饰器也将返回真，反之亦然。通过使用它，可以控制装饰器的父级是否可以执行。

*装饰器也有中止*子树的能力。这意味着一旦设置了*Enemy*，就可以停止漫游子树。这将使松饼在检测到敌人后立即攻击敌人。

要使用中止，可以使用*黑板*装饰器。这些只是检查是否设置了黑板键。打开*BT_Muffin*，然后*右键单击*攻击子树的*序列。*选择*添加装饰器\黑板*。这会将黑板装饰器附加到序列。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029798.jpg)

接下来，选择*Blackboard*装饰器并转到 Details 面板。将*Blackboard Key*设置为*Enemy*。

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029854.jpg)

这将检查是否设置了*Enemy 。*如果不设置，装饰器将失败并导致*Sequence*失败。这将允许漫游子树运行。

为了中止漫游子树，需要使用*Observer Aborts*设置。

### 使用观察者中止

如果选定的黑板键已更改，观察者中止将中止子树。有两种类型的中止：

1. *Self：*此设置将允许攻击子树在*Enemy*变得无效时自行中止。如果*敌人*在攻击子树完成之前死亡，就会发生这种情况。
2. *Lower Priority：*此设置将导致较低优先级的树在设置*Enemy*时中止。由于漫游子树在攻击之后，它的优先级较低。

*将Observer Aborts*设置为*Both*。这将启用两种中止类型。

![虚幻引擎 4 人工智能教程](https://koenig-media.raywenderlich.com/uploads/2017/12/unreal-ai-47.jpg)

现在，如果攻击子树不再有敌人，它可以立即进入漫游状态。此外，一旦检测到敌人，漫游子树就可以立即进入攻击模式。

这是完整的行为树：

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029498.jpg)

攻击子树总结：

1. 如果设置了*敌人，**选择器*将运行攻击子树
2. 如果已设置，Pawn 将向敌人移动和旋转
3. 之后，它将执行攻击
4. 最后，Pawn 将等待两秒钟

漫游子树总结：

1. 如果攻击子树失败，*选择器将运行漫游子树。*在这种情况下，如果没有设置*Enemy*，它将失败。
2. *BTService_SetRandomLocation*将生成一个随机位置
3. Pawn 将移动到生成的位置
4. 之后，它将等待五秒钟

关闭*BT_Muffin*，然后按*Play*。生成一些松饼，为有史以来最致命的大逃杀做准备！

![虚幻引擎 4 人工智能教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010029153.gif)



## 扩展

如果想创建更高级的 AI，请查看[环境查询系统](https://docs.unrealengine.com/latest/INT/Engine/AI/EnvironmentQuerySystem/index.html)。该系统将允许的 AI 收集有关环境的数据并对其做出反应。
