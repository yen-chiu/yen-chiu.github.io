---
title: 程序化地形 GPU Driven Terrain
date: 2020-06-21 12:32:00 +0800
categories: [图形编程,地形系统]
mermaid: true
tags: [GPUDriven,Terrain]

# 
# Ref
# - https://www.gdcvault.com/play/1025480/Terrain-Rendering-in-Far-Cry
# - https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
# - https://github.com/wlgys8/GPUDrivenTerrainLearn
# - https://zhuanlan.zhihu.com/p/388844386
# - https://www.lfzxb.top/terrain-rendering-in-far-cry5/
# - https://catlikecoding.com/unity/tutorials/procedural-meshes/modified-grid/

---

## 术语

### Sector

最高分辨率的平铺块





## 流程

### CPU 实现版本

```mermaid
stateDiagram-v2
    Stream: Stream quadtree nodes
    Tracerse: Tracerse quadtree. Select nodes to cover the terrain.
    Cull: Cull nodes to view
    Batch: Batch into shading groups
    Render: Render
    
    state CPU {
    	Stream --> Tracerse
    	Tracerse --> Cull
    	Cull --> Batch
    }
    
    state GPU {
        Render
    }
    
    [*] --> CPU
    CPU --> GPU
    GPU --> [*]
    
```

### GPU 实现版本

- 数据仅在GPU处理
- 

```mermaid
stateDiagram-v2
    Stream: Stream quadtree nodes
    Tracerse: Tracerse quadtree. Select nodes to cover the terrain.
    Cull: Cull nodes to view
    Batch: Batch into shading groups
    Render: Render
    
    state CPU {
    	Stream
    	
    }
    
    state GPU {
    	Tracerse --> Cull
    	Cull --> Batch
    	Batch --> Render
    }
    
    [*] --> CPU
    CPU --> GPU
    GPU --> [*]
```





### Stream quadtree nodes

![image-20230626095739177](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306260957778.png)

![image-20230626100050423](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261000604.png)

![image-20230626100224302](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261002507.png)


![image-20230626101050670](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261010327.png)


#### 常见的流式加载策略

1. 加载环绕角色周围的最高级高精度 LOD
2. 下一级LOD的范围将覆盖全地图一半的距离
3. 直到所有低层次的LOD被加载完成

#### 一些细节

- 重叠区域的重复加载

- 加载是异步的

  > ![image-20230626101310675](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261013254.png)



### Tracerse quadtree

![image-20230626112439388](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261124186.png)

- 哪些节点是真正被渲染的？
- 从四叉树根节点深度遍历，直接子节点被加载，并细分该节点

### Cull Nodes To View

![image-20230626112857874](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261128822.png)

- 只需要渲染在视锥内的 Node

![image-20230626113118118](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261131363.png)



### Batch into Shading Groups

![image-20230626113319768](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202306261133773.png)

- Shader的LOD分层，可以与Node的LOD不相关









## Terrain Quad Tree - 四叉树



Node存储的信息

- 高度图
- 世界坐标系法线图
- 地形纹理
- ...





## GPU 四叉树



## LOD





## 接缝处理



## 怎么做离线存储



