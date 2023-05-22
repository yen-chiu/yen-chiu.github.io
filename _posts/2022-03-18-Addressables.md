---
title: Unity Addressables
date: 2022-03-18 22:41:00 +0800
categories: [Unity,资源管理]
tags: [Addressables]

---



- 可以直接加载非Resources的资源，那么是怎么实现的？

    > 底层设计与我的框架设计一致，都是通过分化加载单元；
    >
    > 异步逻辑是通过延迟，然后利用反射实现；
    >
    > 加载接口 Assetdatabase.LoadAtPath

- 加载出来的对象是实例还是prefab?

    > prefab

- 编辑器模式下是怎么卸载资源的？ AssetBundle是怎么实现LRU机制的？如何判别0引用

    - Addressable的卸载也还是由用户主动调用
    - LRU机制，可以学习一下他是怎么做的
    - 另外把之前那个计算卸载的评价函数也可以结合到LRU里；

- 资源加密是怎么处理的？有性能问题吗？

    - 用Stream实现，会有部分语言调用和解密算法的开销；
