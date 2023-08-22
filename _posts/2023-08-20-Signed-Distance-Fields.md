---
title: Signed Distance Fields
date: 2023-08-21 18:32:00 +0800
categories: [图形编程, 性能优化]
tags: [SDF]

# Ref
# - http://www.codersnotes.com/notes/signed-distance-fields/
---



## 什么是有符号距离场？

想象一下，有一个黑白图像，其中**黑色**部分被视为*内部*，**白色**部分被视为*外部*。想要的是一种快速的方法来查找从任何给定点到内部的距离。

SDF 只是一个图像，其中每个像素包含到边界上最近点的距离。

因此，如果一个像素在外部，那么如果距离 10 个像素，它可能会包含 +10。如果它*在里面*，它将包含-10。

- 原始图像

  > ![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202308221646157.png)

- SDF

  > ![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202308221646314.jpeg)



## 实现

> 有一个简单的**线性时间**算法来计算 SDF。（如果你想在 GPU 上执行，还有一个  n-log-n 算法>，但我在这里只给出简单的 CPU 情况）。该算法称为**8SSEDT ，**[这里](http://www.lems.brown.edu/vision/people/leymarie/Refs/CompVision/DT/DTpaper.pdf)有一篇关于它的论文。不过要小心，因为论文中存在一些错误。

定义像素网格

```c++
struct Point
{
    int dx, dy;

    int DistSq() const { return dx*dx + dy*dy; }
};

struct Grid
{
    Point grid[HEIGHT][WIDTH];
};
```

dx/dy 包含从该像素到相对侧最近像素的偏移量。

我们实际上需要 两个 Grid，因为每个 Grid 仅包含正距离。为了获得真实的有符号距离，我们必须执行两次并合并结果。

如果像素

- 位于“内部”，则我们将网格初始化为 (0,0)，
- 位于"外部"，`(+INF,+INF)`

>  注意：不要让你的`+INF`值太大，否则当你平方它时它会溢出。

```c++
if ( g < 128 )
{
    Put( grid1, x, y, inside );
    Put( grid2, x, y, empty );
} else {
    Put( grid2, x, y, inside );
    Put( grid1, x, y, empty );
}
```

现在我们要做的就是运行*传播算法*。请参阅论文，了解这里到底发生了什么，但基本上的想法是查看相邻像素的 dx/dy，然后尝试将其添加到我们的像素中，看看它是否比我们已有的更好。

```c++
void Compare( Grid &g, Point &p, int x, int y, int offsetx, int offsety )
{
    Point other = Get( g, x+offsetx, y+offsety );
    other.dx += offsetx;
    other.dy += offsety;

    if (other.DistSq() < p.DistSq())
        p = other;
}

void GenerateSDF( Grid &g )
{
    // Pass 0
    for (int y=0;y<HEIGHT;y++)
    {
        for (int x=0;x<WIDTH;x++)
        {
            Point p = Get( g, x, y );
            Compare( g, p, x, y, -1,  0 );
            Compare( g, p, x, y,  0, -1 );
            Compare( g, p, x, y, -1, -1 );
            Compare( g, p, x, y,  1, -1 );
            Put( g, x, y, p );
        }

        for (int x=WIDTH-1;x>=0;x--)
        {
            Point p = Get( g, x, y );
            Compare( g, p, x, y, 1, 0 );
            Put( g, x, y, p );
        }
    }

    // Pass 1
    for (int y=HEIGHT-1;y>=0;y--)
    {
        for (int x=WIDTH-1;x>=0;x--)
        {
            Point p = Get( g, x, y );
            Compare( g, p, x, y,  1,  0 );
            Compare( g, p, x, y,  0,  1 );
            Compare( g, p, x, y, -1,  1 );
            Compare( g, p, x, y,  1,  1 );
            Put( g, x, y, p );
        }

        for (int x=0;x<WIDTH;x++)
        {
            Point p = Get( g, x, y );
            Compare( g, p, x, y, -1, 0 );
            Put( g, x, y, p );
        }
    }
}
```

就是这样！之后您所要做的就是运行一次快速传递，以根据两个正值重建最终的有符号距离值：

```c++
int dist1 = (int)( sqrt( (double)Get( grid1, x, y ).DistSq() ) );
int dist2 = (int)( sqrt( (double)Get( grid2, x, y ).DistSq() ) );
int dist = dist1 - dist2;
```

这是本文的完整源代码：\>> [URL](https://github.com/Rootjhon/SDF-8ssedt)