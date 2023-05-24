---
title: UE5 Materials 
date: 2023-03-16 08:47:37 +0800
categories: [Unreal,Beginner]
tags: []
image:
  path: https://raw.githubusercontent.com/Rootjhon/img_note/empty/Unreal-materials-feature-1.png
# Ref
# - https://www.kodeco.com/504-unreal-engine-4-materials-tutorial

---



## 入门

下载[起始项目](https://koenig-media.raywenderlich.com/uploads/2017/07/BananaCollectorStarter.zip)并解压缩。要打开项目，请转到项目文件夹并打开*BananaCollector.uproject*。

*注意：*如果收到一条消息说该项目是使用早期版本的 Unreal 编辑器创建的，那没关系（引擎经常更新）。可以选择打开副本的选项，也可以选择就地转换的选项。

你会看到一个包含香蕉的小区域。按*播放键使用 W*、*A*、*S*和*D*键控制红色立方体。可以通过进入香蕉来收集香蕉。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/1.jpg)

首先，将修改香蕉材质以更改其亮度。导航到*Materials*文件夹并*双击*M_Banana以在材质编辑器中打开它*。*

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/2.png)

要调整香蕉的亮度，需要操纵其纹理。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/3.jpg)

## Manipulating Textures

最基本的，纹理是图像，而图像是像素的集合。

*在彩色图像中，像素的颜色由其红色 (R)*、*绿色 (G)*和*蓝色 (B)*通道决定。

下面是一个 2×2 图像的示例，每个像素的 RGB 值都已标记。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161140247.png)

> *注意：*在虚幻引擎中，RGB 通道的范围是 0.0 到 1.0。
>
> 然而，在大多数其他应用程序中，RGB 通道的范围是 0 到 255。
>
> 这些只是显示相同信息的不同方式，并不意味着虚幻引擎的颜色范围更小。

纹理操作通过对纹理的每个像素执行操作来工作。操作可以像向通道添加值一样简单。

下面是将每个通道限制在 0.4 到 1.0 范围内的示例。这样做会提高每个通道的最小值，从而使每种颜色更亮。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161146092.png)

以下是在材质编辑器中的操作方式：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161146277.png)

接下来，将使用*乘法*节点来调整纹理的亮度。

### The Multiply Node - 越乘越暗

Multiply 节点的作用正如其名称所示：它将一个输入乘以另一个输入。

使用乘法，可以更改像素的亮度而不影响其色调或饱和度。下面是通过将每个通道乘以 0.5 来将亮度减半的示例。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161146930.png)

通过对每个像素执行此操作，可以更改整个纹理的亮度。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161147535.jpeg)

虽然本教程中未涉及，但可以将乘法节点与遮罩纹理结合使用。使用蒙版，可以指定基础纹理的哪些区域应该更暗。

这是使用瓷砖纹理遮盖石头纹理的示例：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161147117.jpeg)

遮罩起作用是因为灰度表示 0（黑色）到 1（白色）范围。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161148106.jpeg)

白色区域具有全亮度，因为通道乘以 1。灰色区域较暗，因为通道乘以小于 1 的值。黑色区域没有亮度，因为通道乘以 0。

现在，是时候使用 Multiply 节点了。

### 调整纹理亮度

*断开Texture Sample*节点和*Base Color*引脚之间的链接。可以通过*右键单击*任一引脚并选择*Break Link(s)*来执行此操作。或者，可以按住*Alt*键并*左键单击*导线。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161149449.gif)

创建一个*Multiply*和一个*Constant*节点。

可以通过按住**M键（对于乘法节点）或1键（对于常量节点）**然后左键单击图形中的空白区域来快速创建它们。

之后，像这样链接所有内容：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161149470.png)

此设置将遍历每个像素并将每个通道乘以*常量*节点的值。最后，生成的纹理将作为*Base Color*输出。

现在，生成的纹理将是黑色的，因为乘数设置为零（乘以零结果为零）。要更改乘数的值，请选择*Constant*节点并转到 Details 面板。

将*值*字段设置为*5*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161152975.png)

单击*Apply*然后返回到主编辑器。你会看到香蕉现在更亮了。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161152616.jpeg)

让我们通过添加一些不同颜色的香蕉来调味。虽然可以为每种颜色创建新材质，但更简单的方法是创建*材质实例*。

## 关于Material Instances 

材质实例是材质的副本。**在基础材质中所做的任何更改也会在材质实例中进行。**

材质实例很棒，因为可以在不重新编译的情况下对其进行更改。

当在材质中单击 Apply 时，可能已经注意到一条通知，说明着色器正在编译。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161152496.jpeg)

这个过程在基本材料上只需要几秒钟。然而，在复杂材料上，编译时间会急剧增加。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161152498.jpeg)

在以下情况下使用材质实例是个好主意：

- 拥有复杂的材料并希望快速进行更改
- 想要创建基础材料的变体。这些可以是任何东西，例如改变颜色、亮度甚至纹理本身。

下面是一个使用材质实例创建颜色变化的场景。所有实例共享相同的基础材质。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161153460.jpeg)

在创建实例之前，需要在基础材质中创建*参数。*这些将显示在的材质实例中，并允许调整材质的属性。

### 创建材料参数

返回材质编辑器并确保仍在*M_Banana*材质中。

首先，需要一个可以改变纹理色调的节点。可以为此使用*HueShift节点。*将一个添加到的图表并像这样链接它：

> HueShift = 色调偏移

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161154655.jpeg)



- 通过**按住Alt键**并*左键单击*连线来断开Multiply 节点和 M_Banana 节点之间的*连接。*
- *右键单击*蓝图中的空白区域，搜索*HueShift*节点并选择它。
- 如上图所示*连接电线。*



接下来，需要创建一个*标量参数*节点。该节点包含一个值，并且可以在材质实例中进行编辑。

可以通过**按住S键**并*左键单击*图形中的空白区域来快速创建一个。创建后，将其连接到*HueShift节点上的* *Hue Shift Percentage (S)*引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161422134.jpeg)

为的参数命名也是一个好主意。选择*Scalar Parameter*节点，然后转到 Details 面板。将参数名称更改为*HueShiftPercentage*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161422860.png)

还可以将常量节点转换为标量参数。

- *右键单击之前添加的* *Constant*节点，
- 然后选择*Convert to Parameter*。
- 然后，将参数重命名为*Brightness*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161427894.png)

现在已经完成了基础材料的参数化。单击*“应用”*，然后关闭材质编辑器。

接下来，将创建一个材质实例。

### 创建材质实例

转到 Content Browser 并确保位于*Materials*文件夹中。*右键单击*M_Banana*并*选择*创建材质实例*。

将新资产重命名为*MI_Banana_Green*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161427645.png)

*双击*MI_Banana_Green将*其*打开。这将在材质实例编辑器中打开它。

材质实例编辑器由三个面板组成：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161430519.jpeg)

1. **Details** *详细信息：*这是的参数和其他常规设置将出现的地方
2. **Instance Parents**：显示当前实例的父材质列表。在这种情况下，唯一的父母是*M_Banana*
3. **Viewport** *视口：*包含将显示的材质实例的预览网格。*通过按住左键单击*并*移动*鼠标来旋转相机。*滚动* *鼠标滚轮*进行缩放。

要改为查看香蕉网格上的更改，请转至“详细信息”面板并找到*“预览”*部分。

*左键单击* *Preview Mesh*旁边的*下拉菜单*并选择*SM_Banana*。现在将看到香蕉网格而不是球体。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451239.png)

接下来，将编辑参数以将香蕉的颜色调整为绿色。

要使参数可编辑，*请左键单击每个* *参数*旁边的复选框。

![image-20230316143926925](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161439188.png)

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451987.png)

*将亮度*设置为*0.5*并将*HueShiftPercentage*设置为*0.2*。你最终会得到这样的结果：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451207.jpeg)

现在已经创建了材质实例，是时候将它应用到一些香蕉上了！关闭材质实例并转到主编辑器中的视口。

### 应用材质实例

放置在场景中的演员可以单独编辑。

这意味着如果你改变一根香蕉的材料，它不会影响其他香蕉。可以使用此行为将一些香蕉变成绿色。

选择任何香蕉，然后转到“详细信息”面板。在组件列表中，选择*StaticMesh*组件。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451966.png)

*Details 面板将更新为StaticMesh*组件的属性。将材质更改为*MI_Banana_Green*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451824.jpeg)

重复此过程几次以获得更好的黄色和绿色香蕉分布。看看是否可以创建另一个材质实例来制作一些紫色香蕉！

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451530.jpeg)

## 动态变化的材料

材料不必完全是装饰性的；也可以使用它们来帮助游戏设计。

接下来，将学习如何在玩家收集更多香蕉时动态地将立方体的颜色从白色更改为红色。

在创建材质实例之前，需要设置立方体材质。

确保位于*Materials*文件夹中，然后*双击* *M_Cube*将其打开。

首先，需要一种创建颜色的方法。将看到连接到*Base Color 的* *Constant3Vector*节点。这些节点非常适合挑选颜色，因为它们具有红色、绿色和蓝色通道。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161451004.jpeg)

由于已经创建了红色，因此将创建白色。添加另一个*Constant3Vector*节点。

可以通过**按住*3*键**并*左键单击*图形中的空白区域来快速执行此操作。

*双击* *Constant3Vector*节点调出颜色选择器。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161452583.gif)

通过使用滑块或在*R*、*G*和*B*通道中输入值*1.0*将颜色设置为白色。然后，按*确定*按钮。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161452046.jpeg)

要将颜色从白色更改为红色，需要一种在它们之间平滑过渡的方法。一种简单的方法是使用*线性插值*。

### 什么是线性插值？

线性插值是一种查找 A 和 B 之间的值的方法。例如，可以使用线性插值来查找介于 100 和 200 之间的值。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161452617.jpeg)

当控制 alpha 时，线性插值变得更加强大。

可以将 alpha 视为 A 和 B 之间的百分比。alpha 为 0 将返回 A，而 alpha 为 1 将返回 B。

例如，可以随时间增加 alpha 以平滑地将对象从点 A 移动到点 B。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161452706.gif)

在本教程中，将使用收集的香蕉数量来控制 alpha。

### 使用 LinearInterpolate 节点

首先，添加一个*LinearInterpolate*节点。可以通过按住*L*键并*左键单击*图形中的空白区域来快速完成此操作。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161453682.jpeg)

接下来，创建一个*标量参数*节点并将其命名为*ColorAlpha*。之后，像这样连接你的节点（注意现在顶部是白色的）：

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161454308.jpeg)

总结：*LinearInterpolate节点将输出* *A*输入的值。*这是因为* *alpha*的初始值为0 。随着*alpha*接近*1 ，输出将接近* *B*输入的值。

材料现已完成。还有更多工作要做，但要查看目前的进度，请单击*“应用”*，然后关闭材质编辑器。

如果你按*Play*，你会看到立方体现在是白色而不是红色。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161454697.jpeg)

要使立方体改变颜色，需要编辑*ColorAlpha*参数。

但是，存在一个问题。不能在游戏运行时编辑材质实例的参数。解决方案是使用*动态材质实例*。

## 关于动态材质实例 - Dynamic Material Instances

与常规实例不同，可以在游戏过程中编辑动态材质实例。可以使用蓝图或 C++ 执行此操作。

可以通过多种方式使用动态实例，例如更改对象的不透明度以使其不可见。或者，可以在物体变湿时增加物体的镜面反射度。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161517155.gif)

动态材质实例的另一个好处是可以单独编辑它们。

下面是更新单个实例以屏蔽对象区域的示例。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161517752.gif)

让我们从创建一个动态材质实例开始。

### 创建动态材质实例

**只能在游戏过程中创建动态材质实例**。可以使用蓝图（或 C++）来执行此操作。

在内容浏览器中，转到*Blueprints*文件夹并*双击* *BP_Player*将其打开。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518824.jpeg)

要做的第一件事是创建一个新的动态材质实例，然后将其应用于立方体网格。

最好在 Unreal 生成 actor 时执行此操作，这是*Event BeginPlay*节点的用途。

确保位于事件图表中，然后找到*Event BeginPlay*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518554.jpeg)

现在，添加一个 ***Create Dynamic Material Instance (StaticMesh)***  节点。该节点将同时创建一个新的动态材质实例并将其应用于立方体网格。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518758.jpeg)

接下来，需要指定立方体应使用的材料。单击*Source Material*下的*下拉菜单*并选择*M_Cube*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518248.jpeg)

为了以后方便地引用材料，最好将其存储在变量中。一种简单的方法是*右键单击* *“创建动态材质实例”*节点上的*“返回值”*引脚。然后，选择*Promote to Variable*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518048.gif)

如果查看“我的蓝图”选项卡，会注意到有一个新变量。将其重命名为*CubeMaterial*。可以通过按*F2*键快速执行此操作。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518085.jpeg)

最后，将*Event BeginPlay*节点链接到*Create Dynamic Material Instance*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161518172.jpeg)

总结：

- 一旦 Unreal 生成*BP_Player*，它就会创建一个新的动态材质实例并将其应用到*StaticMesh*组件。
- 然后它将材质存储到一个名为*CubeMaterial*的变量中。

下一步是创建一个计数器来跟踪收集的香蕉数量。

## 创建香蕉柜台

*如果从Event BeginPlay*节点向下平移一点，将看到下面的设置。将在此处更新香蕉计数器和材料。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161529802.jpeg)

当立方体与另一个角色重叠时，*On Component Begin Overlap*节点将执行。

接下来，*Cast to BP_Banana*节点检查重叠的演员是否是香蕉。如果演员是香蕉，*DestroyActor*节点将销毁它，使其从游戏中消失。

首先要做的是创建一个变量来存储收集到的香蕉数量。之后，每当立方体与香蕉重叠时，变量就会递增 1。

创建一个新的*Float*变量并将其命名为*BananaCounter*。将BananaCounter 变量*拖动到 Event Graph 中并选择* *Get*。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161529100.gif)

要将计数器递增 1，请添加一个*IncrementFloat*节点。创建后，将*BananaCounter*连接到它。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161529021.jpeg)

接下来，将*DestroyActor*节点连接到*IncrementFloat*节点。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161529732.jpeg)

现在，每当玩家收集香蕉时，*BananaCounter*变量就会递增 1。

如果现在使用*BananaCounter*作为 alpha，会得到意想不到的结果。这是因为*LinearInterpolation*节点需要 0 到 1 范围内的值。可以使用归一化将计数器转换为 0 到 1 的范围。

要标准化，只需将*BananaCounter*除以最大值即可。这个值是玩家在立方体完全变红之前需要收集多少香蕉。

添加一个*float / float*节点并将其*顶部引脚连接到* *IncrementFloat*节点的其余引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533383.jpeg)

*将float/float*节点的*底部*输入设置为*6*。这意味着一旦玩家收集了 6 个香蕉，立方体就会完全变红。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533730.jpeg)

有一个小问题。当玩家收集超过 6 个香蕉时，将获得大于 1 的 alpha。要解决此问题，请使用 Clamp *（浮动）*节点将 alpha 保持在 0 到 1 的范围内。

添加一个*Clamp (float)*节点并将*Value*引脚连接到*float/float*节点的*右侧*引脚 。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533353.jpeg)

现在，有了一个 alpha，是时候将它发送到材质了。

## 更新材料

将CubeMaterial*变量* *拖动*到 Event Graph 中并选择*Get*。

接下来，将*CubeMaterial*变量的引脚*拖动*到空白区域，然后释放*左键单击*。这将显示可以使用此类变量的节点列表。选择的任何节点将自动与变量链接。添加一个*设置标量参数值*节点。此节点会将指定参数设置为提供的值。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533666.gif)

现在，需要指定要更新的参数。将*参数名称*字段设置为*ColorAlpha*。这是在立方体材质中创建的参数。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533600.jpeg)

*将Clamp（浮动）*节点的结果链接到*Set Scalar Parameter Value 节点*的 Value 引脚。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161533642.jpeg)

最后，将*IncrementFloat*节点链接到*Set Scalar Parameter Value 节点*。

[![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161537419.jpeg)

以下是执行顺序：

1. *On Component Begin Overlap (StaticMesh)：*当立方体网格与另一个演员重叠时执行
2. *Cast to BP_Banana：*检查重叠的演员是否是香蕉
3. *DestroyActor：*如果重叠的 actor 是香蕉，则销毁它使其消失
4. *IncrementFloat：将* *BananaCounter*变量递增1
5. *float / float：*将计数器除以指定的数字以对其进行归一化
6. *Clamp (float)：*限制除法的结果，这样你就不会得到高于 1 的值
7. *设置标量参数值：将立方体材质的* *ColorAlpha*参数设置为提供的值。*在这种情况下，该值是BananaCounter*的规范化和限制版本

是时候测试一下了！单击*编译*，然后关闭蓝图编辑器。

单击*播放*并开始收集香蕉。立方体一开始是白色的，随着你收集香蕉逐渐变得更红。一旦你收集到 6 个香蕉，它就会完全变红。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202303161538907.gif)
