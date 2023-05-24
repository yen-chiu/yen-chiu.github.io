---
title: UE4 Particle Systems
date: 2023-04-01 09:34:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/270-unreal-engine-4-particle-systems-tutorial

---



粒子系统是视觉效果的关键组成部分。它们使艺术家可以轻松地创造出爆炸、烟雾和雨水等效果。

虚幻引擎 4 有一个强大且易于使用的系统来创建称为 Cascade 的粒子效果。该系统允许创建模块化效果并轻松控制粒子行为。

- 创建粒子系统
- 设置粒子的速度和大小
- 调整粒子产生率
- 使用曲线缩放粒子在其生命周期内的大小
- 使用 Cascade 设置粒子颜色
- 使用蓝图激活和停用粒子系统
- 使用蓝图设置粒子颜色

## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/11/SpaceshipBattleStarter.zip?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.4.1680278382804&__hsfp=3393399156)并解压缩。导航到项目文件夹并打开*SpaceshipBattle.uproject*。

按*播放*开始游戏。按住*左键*进行射击并使用*W*、*A*、*S*和*D*移动。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-01.gif)

在本教程中，将创建两个粒子效果。一个用于船舶的推进器，一个用于船舶爆炸时。要创建这些，将使用*粒子系统*。

## 什么是粒子系统？

顾名思义，粒子系统是创建和管理*粒子的*系统。粒子基本上是空间中的一个点。使用粒子系统，可以控制粒子的外观和行为。

粒子系统由一个或多个称为*发射器*的组件组成。这些负责产生粒子。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-02.gif)

发射器也有称为*模块的*组件。模块控制发射器产生的粒子的特定属性。例如，粒子的材料和初始速度。在下面的示例中，使用两个模块为每个粒子赋予红色圆圈材质和随机速度。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021634.gif)

还可以更改粒子在其生命周期内的颜色。在此示例中，粒子的颜色从红色变为蓝色：

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-04.gif)

现在知道什么是粒子系统，是时候为船的推进器创建一个了。

## 创建粒子系统

导航到*ParticleSystems*文件夹并单击*添加新\粒子系统*。将粒子系统重命名为*PS_Thruster*然后打开它。

### Cascade：粒子系统编辑器

Cascade 由四个主要面板组成：

[![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021695.jpg)](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-01.jpg?__hstc=149040233.01be257d546be23514458dc177584c40.1680275990206.1680275990206.1680278382804.2&__hssc=149040233.4.1680278382804&__hsfp=3393399156)

1. *视口：*此面板将显示粒子系统的预览。*可以通过按住鼠标右键*并移动鼠标来环顾四周。要移动，请按住*右键单击*并使用*WASD*键。
2. *详细信息：*选择的任何组件（发射器、模块等）都将在此处显示其属性。如果未选择任何内容，它将显示粒子系统的属性。
3. *发射器：*此面板将从左到右显示发射器列表。每个发射器显示其模块的列表。
4. *曲线编辑器：*曲线编辑器允许可视化和调整模块曲线的值。并非所有模块属性都支持曲线。

现在，粒子系统使用默认的粒子材质。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021722.gif)

首先，将用圆形材质替换粒子材质。

### 将材质应用于粒子

转到 Emitters 面板并选择*Required*模块。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021683.jpg)

Required 模块包含必要的属性，例如粒子材质和发射器持续时间。每个发射器都必须有一个 Required 模块。

要更改材质，请转到 Details 面板并将*Material*设置为*M_Particle*。这会将粒子的外观更改为橙色圆圈。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-05.gif)

接下来，将把粒子系统附加到玩家的飞船上。

### 附加粒子系统

返回主编辑器并导航至*Blueprints*文件夹。打开*BP_Player*，然后转到“组件”面板。

要使用粒子系统，可以使用*粒子系统*组件。创建一个并将其重命名为*ThrusterParticles*。确保将它附加到*Collision*组件。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021967.jpg)

要指定粒子系统，请转到“详细信息”面板并找到*“粒子”*部分。*将模板*设置为*PS_Thruster*。

接下来，将*ThrusterParticles*的*位置*设置为*(-80, 0, 0)*。这会将它放在船的后面。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021064.jpg)

最后，将*旋转*设置为*(0, 90, 0)*。这将调整粒子系统的方向，使粒子远离飞船。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-05.jpg)

单击*编译*，然后返回到主编辑器。按*Play*查看粒子系统的效果。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021755.gif)

粒子系统正在运行，但粒子移动有点太慢而且非常小。可以通过设置粒子的初始速度和大小来解决此问题。

## 设置粒子的速度和大小

首先，将设置粒子的初始速度。打开*PS_Thruster*，然后选择*Initial Velocity*模块。然后，展开*Start Velocity\Distribution*。

默认情况下，粒子的初始速度范围从*(-10, -10, 50)*到*(10, 10, 100)*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021877.jpg)

要以更快的速度将粒子从船上移开，需要做的就是增加*Z*速度。*将Min Z*设置为*300*并将*Max Z*设置为*400*。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-07.jpg)

这是原始速度和新速度之间的比较：

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-07.gif)

接下来，将设置粒子的初始大小。

### 设置粒子大小

选择*Initial Size*模块，然后转到 Details 面板。然后，展开*Start Size\Distribution*。

与 Initial Velocity 模块一样，Initial Size 也有最小和最大范围。但是，对于本教程，会将大小设置为一个常量值。为此，将*Distribution*设置为*Distribution Vector Constant*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021588.jpg)

*注意：*分布允许指定恒定值、范围内或曲线上的值。还可以使用蓝图设置值。要了解更多信息，请前往虚幻引擎文档中的 [分发页面。](https://docs.unrealengine.com/latest/INT/Engine/Basics/Distributions/)

然后，将*Constant*设置为*(70, 70, 70)*。下面是尺寸对比：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021721.gif)

返回主编辑器并按*Play*。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-09.gif)

粒子看起来好多了，但它们之间的距离仍然很远。这是因为粒子生成之间的持续时间过长。要解决此问题，可以提高产卵率。

## 增加粒子生成率

要提高产卵率，需要使用*Spawn*模块。该模块控制发射器产生粒子的速度。除了 Required，每个发射器都必须有一个 Spawn 模块。

打开*PS_Thruster*，然后选择*Spawn*。转到 Details 面板，然后展开*Spawn\Rate*部分。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021840.jpg)

*将常量*设置为*50*。这会将生成速率提高到每秒 50 个粒子。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021501.jpg)

返回主编辑器并按*Play*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021531.gif)

如所见，它现在看起来更像是一条小路。为了使粒子看起来更像推进器火焰，可以随着时间的推移缩小它们。

## 随着时间的推移缩小粒子

打开*PS_Thruster*，然后转到 Emitters 面板。

要缩小粒子，可以使用*Size By Life*模块。该模块将在其生命周期内对粒子的大小应用乘数。*通过右键单击*发射器中的空白区域并选择*Size\Size By Life*创建一个。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021812.gif)

默认情况下，这对粒子的大小没有视觉影响。这是因为乘数始终设置为 1。要缩小粒子，需要调整模块的*曲线*，使大小乘数随时间减小。但首先，什么是曲线？

### 什么是曲线？

曲线是点的集合。每个点都有两件事：一个位置和一个值。

当你有两个或更多点时，你就形成了一条线。下面是一个基本线性曲线的例子。*点 A*的位置和值为*0*。*点 B 的*位置为*2*，值为*1*。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-curve_01.jpg)

如果在任意位置对线性曲线进行采样，其功能类似于线性插值。例如，如果在上面的位置*1*对曲线进行采样，将收到一个值*0.5*。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-curve_02.jpg)

如果你创造一条下降的曲线，你得到的价值就会逐渐变小。这是要用于按寿命调整模块的曲线类型。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021116.jpg)

现在，将在 Cascade 中创建上面的曲线。

### 修改模块的曲线

选择*Size By Life*，然后转到 Details 面板。然后，展开*Life Multiplier\Distribution\Constant Curve\Points*。*在这里，将看到Life Multiplier*曲线的点列表。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-09.jpg)

*In Val*是点在曲线上的位置。对于*Size By Life*，值为*0*表示粒子生命的*开始。*值为*1*表示粒子生命的*结束。*

要随时间减小大小乘数，需要减小第二个点的*Out Val 。**将点 1*的*Out Val*设置为*(0, 0, 0)*。随着时间的推移，这会将粒子的大小减小到 0。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021729.jpg)

可以使用曲线编辑器可视化*生命倍增曲线。*为此，请单击*按寿命调整*模块上的*图形图标*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021738.jpg)

这会将*Life Multiplier*添加到曲线编辑器。要使曲线适合视图，请单击曲线编辑器中的*适合。*

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021580.gif)

如所见，在粒子的生命周期内，大小乘数从 1 减少到 0。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021619.jpg)

返回主编辑器并按*播放*

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-12.gif)

粒子现在看起来更像火焰！要添加到此粒子系统的最后一件事是颜色变化。

## 添加颜色变化

要使用 Cascade 设置粒子的颜色，需要正确设置粒子材质。导航到*Materials*文件夹并打开*M_Particle*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021850.jpg)

目前，颜色是在材质中设置的。要使用粒子系统中的颜色，需要使用*ParticleColor*节点。

*首先，删除连接到Emissive Color 的*节点。接下来，添加一个*ParticleColor*节点并像这样连接它：

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-14.jpg)



如果还想控制粒子的不透明度，请添加一个*乘法*并像这样连接它：


![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010024213.jpg)



单击*Apply*然后关闭*M_Particle*。

要设置粒子的颜色，可以使用*初始颜色*模块。

### 初始颜色模块

打开*PS_Thruster*，然后添加一个*Initial Color*模块。*可以在“颜色”*类别下找到它。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021927.jpg)

要添加颜色变化，需要指定颜色的范围。为此，可以使用分布。

选择*初始颜色*，然后转到详细信息面板。展开*Start Color*部分并将*Distribution*更改为*Distribution Vector Uniform*。这将允许为每个颜色通道指定一个范围。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021524.jpg)

对于本教程，颜色应从橙色到红色。为此，将*Max*设置为*(1.0, 0.0, 0.0)*并将*Min*设置为*(1.0, 0.35, 0.0)*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021761.jpg)

如果查看视口，会注意到颜色表现异常。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021876.gif)

这是因为*Color Over Life*模块不断将颜色更新为白色。要解决此问题，请选择*Color Over Life*并按*Delete*。的模块列表现在应该如下所示：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021110.jpg)

关闭*PS_Thruster*，然后在主编辑器中按*Play 。*看看那些推进器的火焰！

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-14.gif)

接下来，将学习如何根据船是否在移动来切换粒子系统。

## 切换粒子系统

要检查船是否在移动，可以检查玩家是否按下了任何移动键。

打开*BP_Player*并找到*Event Tick*节点。将以下设置添加到节点链的末尾：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021613.jpg)

让我们来看看这个设置的作用：

1. 这将检查*MoveUp*和*MoveRight*轴映射。如果两者都返回*0*，则意味着玩家没有按下任何移动键。
2. 如果*Branch*返回*true*（玩家没有按下任何移动键），则停用*ThrusterParticles*
3. 如果*Branch*返回*false*（玩家正在按下移动键），则激活*ThrusterParticles*

单击*Compile*，然后关闭*BP_Player*。按*播放*并在移动和不移动之间切换以查看切换。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-15.gif)

现在到了有趣的部分了：创建一个爆炸粒子系统！

## 创建爆炸效果

将复制推进器粒子，而不是创建新的粒子系统。导航到*ParticleSystems*文件夹，*右键单击*PS_Thruster*并*选择*Duplicate*。将其重命名为*PS_Explosion*然后打开它。

对于爆炸，所有粒子应该同时产生而不是一个接一个。这被称为*突发发射*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021008.gif)

### 创建突发

首先，需要将生成率设置为零，因为不想使用默认的生成行为。选择*Spawn*模块并将*Spawn\Rate\Distribution\Constant*设置为*0*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021456.jpg)

接下来，需要告诉发射器想要创建一个突发。向下滚动到*Burst*部分并向*Burst List*添加一个新条目。可以通过单击*+*图标来执行此操作。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021918.gif)

每个条目将包含三个字段：

1. *计数：*产生多少粒子。将其设置为*20*。
2. *Count Low：*如果大于或等于 0，则生成的粒子数量将介于*Count Low*和*Count*之间。将其保留为*-1*。
3. *时间：*何时产生粒子。值 0 表示发射器生命周期的开始。值为 1 表示发射器的生命周期结束。将其保留为*0.0*。

*注意：可以在**Required*模块中找到发射器的持续时间。它在*持续时间部分下列为**发射器持续时间*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021826.jpg)

这意味着发射器将在其生命*周期之初生成**20 个*粒子。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021217.gif)

为了使它看起来像爆炸，需要设置速度以使粒子向外移动。

### 向外移动粒子

由于这是一个自上而下的游戏，只需指定 X 和 Y 速度。选择*Initial Velocity*模块并展开*Start Velocity\Distribution*。*将最大值*设置为*(1000, 1000, 0)*并将*最小值设置*为*(-1000, -1000, 0)*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021578.jpg)

通过指定从负到正的范围，粒子将从发射器向外移动。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021938.gif)

接下来，需要设置发射器应循环的次数。

### 设置发射器循环

默认情况下，发射器将无限循环。这对于火焰和烟雾等效果非常有用，但爆发应该只播放一次。要解决这个问题，需要告诉发射器只循环一次。

选择*Required*模块，然后找到*Duration*部分。将*发射器循环*设置为*1*。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-23.jpg)

现在，是时候播放敌人死亡时的爆炸了！

### 敌人死亡时生成粒子

返回主编辑器并导航至*Blueprints*文件夹。打开*BP_Enemy*，然后找到*OnDeath*事件。

要生成粒子系统，可以*在 Location*节点使用 Spawn Emitter。创建一个并将其连接到*Destroy Actor*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021474.jpg)

接下来，将*Emitter Template*设置为*PS_Explosion*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021853.jpg)

最后，创建一个*GetActorLocation*并将其连接到*Location*引脚。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-26.jpg)

现在，当一个敌人死亡时，它会在敌人的位置产生一个*PS_Explosion*实例。

单击*编译*，然后返回到主编辑器。按*播放键*开始射击一些坏人。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021532.gif)

看看那些爆炸！接下来，将通过使它们与敌人颜色相同来为它们添加一些额外的香料。

## 将爆炸颜色更改为敌人颜色

要使用敌人的颜色，需要一种从蓝图接收该信息的方法。幸运的是，Cascade 具有允许这样做的分发类型。

打开*PS_Explosion*并选择*Initial Color*模块。*将Start Color\Distribution*设置为*Distribution Vector Particle Parameter*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021654.jpg)

这将为提供一个可以使用蓝图设置的参数。将*参数名称*设置为*PrimaryColor*

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021677.jpg)

对于爆炸，将使用敌人的两种颜色。要使用第二种颜色，将需要另一个发射器。*右键单击*发射器上的空白区域并选择*Emitter\Duplicate and Share Emitter*。这将复制发射器。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021938.jpg)

会注意到现在每个模块旁边都有一个*+号。*通过使用*Duplicate and Share Emitter*而不是*Duplicate*，已经链接了模块而不是复制它们。在一个模块中所做的任何更改也会在另一个发射器的同一模块中发生。如果想更改所有发射器的属性（例如大小），这将很有用。

需要更改的唯一模块是*Initial Color*。但是，如果进行更改，两个发射器都会收到更改。在这种情况下，不希望链接模块，因为它们需要单独的参数名称。取消链接的最简单方法是删除重复的*Initial Color*模块并创建一个新模块。

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-21.gif)

*注意：*截至撰写本文时，还没有取消链接模块的内置方法。

选择新的*Initial Color*并将*Start Color\Distribution*设置为*Distribution Vector Particle Parameter*。接下来，将*参数名称*设置为*SecondaryColor*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021552.jpg)

至此，粒子系统就完成了。关闭*PS_Explosion*。

接下来，需要使用蓝图设置参数。

### 使用蓝图设置粒子参数

打开*BP_Enemy ，然后在**Spawn Emitter at Location*之后添加高亮显示的节点：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021749.jpg)

*这将允许在PS_Explosion*中设置两个参数。

现在，需要设置正确的参数名称。将第一个*Set Color Parameter 的**Parameter Name*设置为*PrimaryColor*。将第二个*Set Color Parameter的**参数名称*设置为*SecondaryColor*

![虚幻引擎 4 粒子系统教程](https://koenig-media.raywenderlich.com/uploads/2017/11/unreal-particles-32.jpg)

最后，需要提供颜色。为了方便起见，颜色已经存储在变量*PrimaryColor*和*SecondaryColor*中。像这样将每个变量连接到它们各自的节点：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021450.jpg)

这是你最终应该得到的：

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021832.jpg)

让我们回顾一下事件的顺序：

1. 当敌人死亡时，它会在其位置产生一个*PS_Explosion实例*
2. 将设置*PS_Explosion*的*PrimaryColor*参数
3. 将设置*PS_Explosion*的*SecondaryColor*参数

单击*Compile*，然后关闭*BP_Enemy*。按*播放*并开始射击敌人，看看粒子混乱！

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010021189.gif)

看看那些多汁的颗粒。看看你是否可以在玩家死亡时添加爆炸！



1. 打开*BP_Player*并找到*OnDeath*事件
2. 将*Spawn Emitter at Location*节点添加到*Sequence*的*Then 1*引脚。将*发射器模板*设置为*PS_Explosion*。
3. 创建一个*GetActorLocation*并将其连接到*Location 的 Spawn Emitter*的*Location引脚*
4. 创建一个*Set Color Parameter*并将其连接到*Location 处的 Spawn Emitter*。*将参数名称*设置为*PrimaryColor*并将*PrimaryColor*变量连接到*Param*。
5. 创建另一个*Set Color Parameter*并将其连接到第一个*Set Color Parameter*。*将参数名称*设置为*SecondaryColor*并将*SecondaryColor*变量连接到*Param*。

![虚幻引擎 4 粒子系统教程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202304010023373.jpg)
