---
title: UE5 Getting Started
date: 2023-03-15 13:47:37 +0800
categories: [Unreal,Beginner]
tags: []
# Ref
# - https://www.kodeco.com/31800833-unreal-engine-5-tutorial-for-beginners-getting-started

---

## 虚幻引擎

Unreal Engine 是一组游戏开发工具，能够制作 2D 手机游戏到 AAA 主机游戏。

虚幻引擎 5 用于开发下一代游戏，包括*Senua's Saga: Hellblade 2*、*Redfall——*来自 Arkane Austin 的合作射击游戏、*勇者斗恶龙 XII：命运之火*、*战争机器 6、* *Ashes of Creation*和*古墓丽影*的下一部。

虚幻引擎 5 (UE5) 为现实环境带来了全新的工具：

- 流明，一种全新的照明技术。
- Nanite，一个用于详细模型和环境的系统。
- 世界分区，允许流式传输大世界。
- 每个参与者一个文件，这使得开发人员更容易处理同一个项目。
- 与 Quixel Megascans 库集成。
- MetaHuman——一种用于逼真的化身的技术。
- [还有很多！](https://docs.unrealengine.com/5.0/en-US/unreal-engine-5-0-release-notes/)

在虚幻引擎 5 中进行开发对于初学者来说很简单。使用*Blueprints Visual Scripting 系统*，无需编写一行代码即可创建整个游戏！结合易于使用的界面，可以快速启动并运行原型。

本虚幻引擎 5 教程侧重于帮助初学者入门。本教程将涵盖几个要点，包括：

- 安装引擎。
- 导入资产。
- 创建材料。
- 使用蓝图创建具有基本功能的对象。

使用本教程顶部或底部的链接下载该项目的资产。准备好深入虚幻引擎的深处！

## 安装虚幻引擎 5

Unreal Engine 5 使用*Epic Games Launcher*进行安装。前往[虚幻引擎网站](https://www.unrealengine.com/)并单击右上角的*下载按钮。*

![image-20230315151654362](https://raw.githubusercontent.com/Rootjhon/img_note/empty/image-20230315151654362.png)

可以选择*Publishing*或*Creators*许可证。如果打算发布的项目或从中获利，请选择*发布*选项。现在选择下载*Epic Games 启动器*。

下载并安装启动器后，将其打开。系统将提示使用 Epic 帐户登录：

![Epic Games 登录屏幕](https://raw.githubusercontent.com/Rootjhon/img_note/empty/00_signin.png)

使用与下载启动器时相同的方法登录。登录后，单击右上角的*安装引擎。*如果没有安装任何版本的虚幻引擎，启动器将带进入一个屏幕，可以在其中选择安装位置和要安装的组件。

![Epic Games 启动器](https://raw.githubusercontent.com/Rootjhon/img_note/empty/00_download_unreal.png)

如果已经安装了某个版本，请单击*“库”*选项卡，然后单击“*引擎版本+”*按钮以选择安装新版本的虚幻引擎。选择 Unreal Engine 5.0.0 版本开始安装。

![选择要安装的虚幻引擎版本](https://raw.githubusercontent.com/Rootjhon/img_note/empty/01_download_unreal_ann.png)

接下来，单击图标上的安装。需要选择一个安装目录。

![安装虚幻引擎 5](https://raw.githubusercontent.com/Rootjhon/img_note/empty/03_installing_icon.png)

*注意：* Epic Games 不断更新 Unreal Engine，因此的引擎版本可能与此不同。本教程的 2022 更新现在包含在 Unreal Engine 5 版本中拍摄的图像，并且视图可能会随着引擎的发展而改变。

## 创建项目

安装引擎后，返回*Epic Games Launcher*并选择左侧的 Unreal Engine 选项卡。

单击*启动 UE5*按钮打开项目浏览器。这可能需要一段时间，尤其是对于初始运行。

![启动虚幻引擎 5](https://raw.githubusercontent.com/Rootjhon/img_note/empty/02_launch_ue5_ann.png)

项目浏览器打开后，单击左侧的*“游戏”按钮以查找可用于启动新项目的模板。*

在这里，选择一个模板。因为是从头开始，所以选择*空白*模板。*在Project Defaults*下，保留 Blueprint 的默认设置而不是 C++。

![虚幻项目浏览器](https://raw.githubusercontent.com/Rootjhon/img_note/empty/06_games_new_project.png)

以下是下一个选项的作用：

- *目标平台：*选择*手机或平板电脑*将禁用一些后处理效果。它还将允许使用鼠标作为触摸输入。将其设置为*Desktop*。
- *质量预设：*选择*可缩放*将禁用一些后处理效果。将此设置为*最大值*。
- *Starter Content：*此选项包括一些 Starter Content。取消选中*Starter Content*以创建一个干净的项目。
- *光线追踪：*这可以实现实时微妙的照明。不选中此选项。

最后，必须指定项目文件夹的位置和项目名称。

项目名称不代表游戏名称，所以如果以后想更改名称，请不要担心。*选择Project Name*字段中的文本并输入*Submarine*。

最后，单击*“创建”*开始的 UE5 之旅！

## 导航界面

创建项目后，编辑器将打开。如果使用过 UE4，会看到新的编辑器视图简化了控件和侧边栏以专注于游戏视图。

编辑器分为多个面板：

![虚幻引擎编辑器，用数字注释](https://raw.githubusercontent.com/Rootjhon/img_note/empty/07_WelcomeToNewEditor_Ann.png)

1. *视口：*虚幻引擎 5 使的关卡视图成为主要焦点，而其他面板则减少了占地面积。*按住鼠标右键*并*移动鼠标*环顾四周。要移动，请按住*右键单击*并使用*WASD*键。
2. *模式：此面板可让在**地形工具*和*植物工具*等工具之间进行选择。放置*工具*是默认工具。它允许将多种类型的对象放置到的关卡中，包括灯光和相机。
3. *World Outliner：*显示当前关卡中的所有对象。可以通过将相关项目放入文件夹来组织列表，并且可以按类型搜索和过滤。
4. *详细信息：*选择的任何对象都将在此处显示其属性。使用面板编辑对象的设置。所做的更改只会影响该对象的实例。例如，如果有两个球体并更改其中一个的大小，则只会影响选定的对象。
5. *工具栏：*包含多种功能。最常使用的是*Play*。
6. *内容抽屉：*此面板显示所有项目文件。使用它来创建文件夹和组织文件。可以使用搜索栏或过滤器搜索文件。展开以显示项目中的所有资产。

## 导入资产

将需要一艘船来开始探索虚幻引擎，所以抓住一艘潜艇吧！下载的材料包括低聚潜艇模型。在 zip 文件中，会找到模型的3D 模型 (fbx) *submarine-low-poly/submarine.fbx*和纹理*submarine-low-poly/\*.png 。*

在 Unreal 可以使用任何文件之前，必须导入它们。导航到 Content Drawer 并*右键单击*Content文件夹并创建一个名为*Models**的*新文件夹。

![内容抽屉](https://raw.githubusercontent.com/Rootjhon/img_note/empty/10_content_drawer.png)

单击*导入*按钮。使用文件浏览器，找到的潜艇材质*submarine.fbx*和*Submarine\*.png*所在的文件夹。选择 FBX 模型并将其放入的*模型*文件夹中。

![FBX 导入选项](https://raw.githubusercontent.com/Rootjhon/img_note/empty/11_import_fbx_b.png)

Unreal 将为提供一些 .fbx 文件的导入选项。将模型的*Import Uniform Scale*更改为*100*以统一按比例放大潜艇模型。

现在将*Material Import Method*设置为*Do Not Create Material*并*取消选中* *Import Textures*。将分别导入纹理和创建材质。

接下来，单击*全部导入*按钮。FBX 中包含的模型将出现在的*内容浏览器*文件夹中。请注意，在 Unreal 中，这些模型称为*static meshes*。

![FBX潜艇模型的不同部分](https://raw.githubusercontent.com/Rootjhon/img_note/empty/11_submarine_parts.png)

当导入文件时，除非明确这样做，否则它不会保存到的项目中。通过*右键单击*文件并选择*保存来保存文件，或者通过选择**文件 ▸ 全部保存*来一次保存所有文件。经常保存！

现在在你的 Content Drawer 中创建一个名为*Materials*的文件夹，并将五个 PNG 纹理导入到你的*Materials*文件夹中。同样，在导入纹理后保存文件。

![导入的潜艇纹理](https://raw.githubusercontent.com/Rootjhon/img_note/empty/12_imported_textures.png)

接下来，将重新组装模型组件和纹理部件以构建完整的潜艇。

## 创建你的第一个演员

Actor是放置在关卡中的对象，无论是摄像机、静态网格物体还是游戏关卡的起始位置*。*

将创建一种称为蓝图的特殊类型的*Actor*，它可以将网格组件组合成游戏中使用的单个对象。

*蓝图*比简单地连接 3D 模型更强大——它们还可以将复杂的逻辑与模型集成在一起，并共同创建可重用的部分以添加到游戏中。

在最简单的意义上，蓝图代表一个“事物”。蓝图可让为对象创建自定义行为。的对象可以是物理的东西（例如潜艇）或抽象的东西，例如卫生系统。

想做一辆移动的汽车吗？*制作蓝图*。会飞的猪呢？*使用蓝图*。一只在撞击时爆炸的小猫怎么样？*蓝图*。

要创建的 owm 蓝图，首先在内容抽屉中创建一个名为*Blueprints的文件夹。*

接下来，*右键单击*的*Blueprints*文件夹并选择创建一个*Blueprint Class*。选择制作一个 Actor，并将其命名为*Submarine*。

![潜艇演员制作过程](https://koenig-media.raywenderlich.com/uploads/2022/04/12_Create_Blueprint_Actor.gif)

现在*双击*该蓝图 Actor 以打开蓝图 Actor 的编辑器。是时候建造你的潜艇模型了！

### 蓝图编辑器

蓝图编辑器有五个主要面板：

1. *组件：*包含当前组件的列表。
2. *我的蓝图：*此部分主要用于管理的图形、函数和变量。
3. *事件图：*这就是魔法发生的地方。你所有的节点和逻辑都在这里。按住*右键*并*移动*鼠标进行平移。*滚动**鼠标滚轮*进行缩放。
4. *Viewport：*任何具有视觉元素的组件都会出现在这里。使用与主编辑器中的视口相同的控件移动和环顾四周。
5. *详细信息：*这将显示所选项目的属性。

![蓝图编辑器](https://raw.githubusercontent.com/Rootjhon/img_note/empty/13_BlueprintEditor.png)

潜艇模型可以使用*组件*进行组装。

### 什么是组件？

如果正在为潜艇绘制蓝图，它会描述构成船只的组件：主体、窗户、潜望镜和螺旋桨。在虚幻引擎中，这些都是蓝图组件的例子。

### 添加组件

在可以看到任何组件之前，如果还没有切换到 Viewport 视图。单击*“视口”*选项卡进行切换。

DefaultSceneRoot是模型的最顶层成员，但它只会显示在编辑器中*。*将每个模型部件从内容浏览器拖到*DefaultSceneRoot*下的此蓝图中。这些模型零件将再次组装成潜艇。

![将模型部件添加到 DefaultSceneRoot](https://raw.githubusercontent.com/Rootjhon/img_note/empty/13_Build_the_submarine.gif)

在蓝图编辑器中选择*编译*并*保存。*更新蓝图后始终执行这些步骤，以便能够查看更改对游戏的影响。

## 关于材质

如果你仔细观察这艘潜艇，你会发现它的表面有一个棋盘格，而不是正常的外观。要赋予潜艇颜色和细节，将创建*材质*。

### 什么是材料？

材质决定了物体表面的外观。从根本上说，材料定义了四个元素：

- ***Base Color*** *基色：*表面的颜色或纹理。用于添加细节和颜色变化。

- ***Metallic*** *金属：*一个表面有多“像金属”。通常，纯金属的金属值最大，而织物的金属值为零。

- ***Specular*** *镜面反射：*控制非金属表面的光泽度。例如，陶瓷会有很高的镜面反射值，但粘土不会。

- ***Roughness*** 粗糙度：具有最大粗糙度的表面不会有任何光泽。它用于岩石和木材等表面。

  以下是三种材料的示例。它们具有相同的颜色但具有不同的属性。每种材料都有其各自属性的高值。其他属性设置为零。

![金属、镜面和粗糙材质的示例](https://raw.githubusercontent.com/Rootjhon/img_note/empty/15_Materials_Ann.png)

### 创建材料

关闭潜艇蓝图并返回到 Content Drawer，选择 Materials 文件夹并单击绿色的*Add*按钮。将出现一个菜单，其中包含可以创建的资产列表。单击*材质*。

![通过右键单击并单击 Material 在 Materials 文件夹中添加新材料](https://raw.githubusercontent.com/Rootjhon/img_note/empty/14_Create_material.gif)

### 材质编辑器

将材质命名为*SubmarineMaterial*，然后*双击*该文件以在材质编辑器中将其打开。

![材质编辑器，用数字注释](https://raw.githubusercontent.com/Rootjhon/img_note/empty/14_MaterialEditor_Ann.png)

材质编辑器有几个面板：

1. ***Viewport*** *视口：*包含一个将显示的材质的预览网格。*通过按住左键单击*并*移动*鼠标来旋转相机。*滚动**鼠标滚轮*进行缩放。
2. ***Details*** *详细信息：*选择的任何节点都将在此处显示其属性。如果未选择节点，面板将改为显示材料的属性。
3. ***Material Graph*** *材质图：*此面板将包含的所有节点和*结果*节点。按住*右键*并*移动*鼠标进行平移。*滚动**鼠标滚轮*进行缩放。
4. ***Palette*** *调色板：*材料可用的所有节点的列表。

### 什么是节点？

在开始制作材料之前，需要了解图形的*节点*和*引脚*。

节点构成了材料的大部分。许多节点可用并提供不同的功能。

节点可以有输入和输出，也称为*引脚*，由带箭头的圆圈表示。输入在左侧，输出在右侧。

例如，使用*Multiply*和*Constant3Vector*节点将黄色添加到纹理：

![样品材料图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/20-1.png)

### 添加纹理

要为模型添加颜色和细节，需要*纹理*。纹理是二维图像。通常，它会投影到 3D 模型上以赋予它们颜色和细节。

*材料有一个称为结果*节点的特殊节点，在本例中已为创建为*SubmarineMaterial*。这是所有节点结束的地方。无论插入此节点，都将决定最终材质的外观。

![SubmarineMaterial 节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/17_submarine_material_result.png)

查看*Result*节点的一些组件：

1. *Base Color*：这描述了最重要的纹理，它提供了 3D 网格表面的基本颜色映射。
2. *Normal* *法线*：法线贴图通过在沿表面的每个像素处提供法线向量，允许将重要的额外细节添加到网格中。
3. *Ambient Occlusion* *环境光遮挡*：描述光线更难到达的表面区域。

从此窗口底部打开内容抽屉。从 Materials 文件夹中将五个纹理中的每一个拖到图中。

在图表中，通过在两个节点的引脚之间拖放一条线，使纹理节点的*RGB*引脚与材质中的适当连接之间的每个连接。

![底色材质连接到Submarine Material节点的过程](https://raw.githubusercontent.com/Rootjhon/img_note/empty/16_Texturing.gif)

最后，的材质应该包括所有五种纹理：

![完成的材质图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/18_submarine_material_completed.png)

单击工具栏中的*“应用”*和*“保存”以更新的材料并关闭“材料”编辑器——到这里就完成了。*

## 使用材料

要将的材料用于潜艇，请分配它。

返回 Content Drawer 并*双击* *Submarine*蓝图将其打开。选择*视口*选项卡并缩小以查看整个潜艇：

![查看潜艇蓝图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/27_Submarine-1.png)

选择蓝图中的所有五个模型，然后转到 Details 面板并找到*Materials*部分。

单击*Element 0*右侧的*下拉菜单*并选择*SubmarineMaterial*。

![将材料添加到蓝图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/28_AssignTexture.gif)

*编译* 并*保存* 的*潜艇* 蓝图。已准备好通过动画使该资产栩栩如生！

## 向蓝图添加逻辑

要探索虚幻引擎的深度，我们需要更多地了解蓝图。

与材质类似，蓝图中的脚本通过基于节点的系统工作。这意味着需要做的就是创建节点并链接它们。无需编码。

Unreal Engine 也支持使用 C++ 编写逻辑，但我建议从 Blueprint 系统开始。

蓝图的一些好处：

- 通常，使用蓝图进行开发比使用 C++ 更快。
- 轻松组织。可以将节点分成函数和图形等区域。
- 如果与非程序员一起工作，修改蓝图会很容易，因为它具有视觉和直观的特性。

一个好的方法是使用蓝图创建的对象。当需要额外的性能时，将它们转换为 C++。

## 关于蓝图节点

是时候让这艘潜艇动起来了——在*蓝图* 中为螺旋桨设置动画很容易。这就是*蓝图节点的* 用武之地。

与其同类材料节点不同，蓝图节点具有称为*执行*引脚的特殊引脚。

左边的引脚是输入，右边的引脚是输出。所有节点都将至少拥有其中之一。

如果一个节点有一个输入引脚，它必须有一个连接才能执行。如果一个节点未连接，则任何后续节点都不会执行。

这是一个例子：

![缺少连接的示例节点图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/43-1.png)

*节点 A* 和*节点 B* 将执行，因为它们的输入引脚已连接。*节点 C* 和*节点 D* 永远不会执行，因为 *节点 C 的* 输入引脚没有连接。

## 旋转螺旋桨

打开潜艇*蓝图*。要开始编写脚本，请切换到 **Event Graph** 选项卡。

![查看事件图表选项卡](https://raw.githubusercontent.com/Rootjhon/img_note/empty/43_Switch_To_Event_Graph.png)

使对象旋转非常简单，只需要创建一个节点。*右键单击*图形上的空间以显示可用节点的菜单。

搜索*AddLocalRotation*。旋转*submarine_Motor*组件。选择*AddLocalRotation (submarine_Motor)*。

> *注意：* 如果未列出该节点，请取消选中菜单右上角的*“上下文相关” 。*

![选择将局部旋转添加到蓝图](https://raw.githubusercontent.com/Rootjhon/img_note/empty/49_AddLocalRotation.png)

的图形现在将具有一个新的*AddLocalRotation*节点。*目标* 输入将自动连接到所选组件。

要设置旋转值，请转到*Delta Rotation*输入并将*Y*值更改为*2.0*。这将导致蓝图围绕其 Y 轴旋转。较高的值将使螺旋桨旋转得更快。

![设置电机旋转的Y值](https://raw.githubusercontent.com/Rootjhon/img_note/empty/50_AddLocalRotation_Values.png)

要不断旋转转盘，需要每帧调用*AddLocalRotation*。要每帧执行一个节点，请使用*Event Tick*节点。它应该已经在你的图表中了。如果不是，请使用与之前相同的方法创建一个。

*将Event Tick*节点的输出引脚拖到*AddLocalRotation*节点最上面的输入引脚。

![将 Event Tick 节点连接到 Add Local Rotation 节点](https://raw.githubusercontent.com/Rootjhon/img_note/empty/50_Connect_EventTick.gif)

*注意：*在这个实现中，旋转速率取决于帧速率——螺旋桨将在较慢的机器上以较慢的速率旋转，反之亦然。这对本教程来说很好。

最后，转到工具栏并单击*编译*以更新的蓝图，然后关闭蓝图编辑器。

![编辑器工具栏](https://raw.githubusercontent.com/Rootjhon/img_note/empty/51_compile.png)

## Bring an Actor to the Scene

添加蓝图与添加网格的过程相同。从内容抽屉中，*将*潜艇蓝图拖到视口中。

![将潜艇蓝图拖到视口中并四处移动](https://raw.githubusercontent.com/Rootjhon/img_note/empty/51_Add_Submarine.gif)

关卡中的对象可以*移动*、*旋转*和*缩放*。这些的键盘快捷键是*W*、*E*和*R*。

## Just Add Water!

这艘潜艇看起来像是搁浅在沙漠中！添加一些效果使场景看起来像在水下怎么样？

首先，在*Outliner* 中选择 *VolumetricCloud* 并将其从场景中删除以移除云。

创建蓝色海洋的一种简单方法是添加后期处理效果，将世界染成蓝色。后处理效果是在渲染帧后应用的那些更改。

后处理效果通常用于提供风格变化，例如运动模糊、光晕和黑白照片风格。

通过单击工具栏中的*快速添加按钮并选择**体积 ▸ 后处理体积，将后处理体积**添加*到场景中：

![添加 PostProcessVolume 的菜单](https://raw.githubusercontent.com/Rootjhon/img_note/empty/52_PostProcessVolume.png)

这将创建一个框。如果相机在其范围内，则会应用后期处理效果。在*Outliner*树中选择新添加的*PostProcessVolume*并查看详细信息。*通过将变换*设置为*(X: 0.0, Y: 0.0, Z: 0.0)*的*位置*和*(X: 50.0, Y: 50.0, Z: 50.0)*的*比例*，确保框位于原点并覆盖视图.

![设置 PostProcessVolume 的位置和比例](https://raw.githubusercontent.com/Rootjhon/img_note/empty/51_PostProcess_box.png)

*要更改世界的显示方式，请找到名为颜色分级的*部分并将*全局对比度*和*伽玛*设置为偏蓝的值：

![更改 PostProcessVolume 上的颜色设置](https://raw.githubusercontent.com/Rootjhon/img_note/empty/55_Postprocess_Blue.png)

现在应该看起来你在水下。屏住呼吸，但不要太久，因为仍然需要测试所有努力工作的结果！
导航到工具栏并点击*播放*以查看潜艇在其自然栖息地中的活动。

![我们的水下潜艇 :](https://raw.githubusercontent.com/Rootjhon/img_note/empty/52_Submarine_Final.gif)

