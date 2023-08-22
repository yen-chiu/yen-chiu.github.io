---
title: LightMap优化tricks
date: 2023-08-21 18:32:00 +0800
categories: [图形编程, 性能优化]
tags: [LightMap]

# Ref
# - http://www.codersnotes.com/notes/lightmap-tricks/
# - http://www.ludicon.com/castano/blog/2017/10/lightmap-optimizations-ios/
---

### 无缝

如果需要黑色像素来阻止图表相互渗透，那么计算出的 UV 是错误的。

![16926920565471692692055610.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16926920565471692692055610.png)



### 压缩同色像素

如果图表中的所有像素的颜色完全相同（或接近足够），则无需浪费空间来存储所有像素。

只需将整个图表缩小到单个像素即可。

此外（见下文），对所有缩小的图表使用相同的单个像素。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202308221614274.png)

### 共享相同的图表

大部分光照贴图空间可能被一千个微小的碎片占据。

其中许多仅占据光照贴图上的单个 2x2 或 3x3 块。

对于每个图表，搜索所有先前具有相同大小且具有相同内容（在给定像素误差内）的图表。

如果关卡中有任何面向相同方向的实例几何体，那么它们通常也会具有相同的光照贴图。一个例子是公寓楼的一侧，有许多阳台。由于太阳是定向光，因此每个阳台上都会投射相同的阴影。因此，您可以在比您想象的更多的地方重用图表。

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202308221618255.png)

### 调整纹理使之更适应block压缩算法

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202308221619627.png)

通过对纹理使用块压缩方案（DXT/BC/等），您可以获得很大的好处。但不要不先思考就压缩纹理！DXT 为每个 4x4 块存储两种颜色。您未在光照贴图上写入的像素将是空黑色。

**对于每个 4x4 块，用同一块中的其他像素之一填充未使用的像素（实际上哪个像素并不重要）。**
