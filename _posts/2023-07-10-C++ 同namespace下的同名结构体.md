---
title: C++ 同namespace下的同名结构体
date: 2023-07-10 13:47:37 +0800
categories: [Uncategories,杂项]
# Ref
# - https://stackoverflow.com/questions/53162484/structs-with-the-same-name-namespace-but-different-members
---



## 问题背景

- 在同一个 namespace 下面，同名的结构体不会报错
- 该同名结构体的数据字段不一致
- Crash在不同平台上的情况不一样
- Crash 堆栈是没有规律的



## 1. 同一个命名空间下的同名结构体不会报错

### 结论

同一个命名空间下的同名结构体

- 如果一个cpp文件**没有同时引用**这俩个同名结构体，编译的时候是不会有任何的警告信息
- 运行也没有任何问题



## 2. 同名结构体的字节数 一致vs不一致的 Crash现象

### Size不一致

- 会导致**Crash**
- 内存写坏了，导致 Crash堆栈是没有规律的

### Size一致

- 不会Crash
- 因为 Size 一致，所以没有越界访问

### 结论

- **两个同名的结构体只会存在一个构造函数**



## 3. 为什么不同平台有差异

### NT IOS 编译结果 - .a静态库

在iOS内核产物中

- **同名结构体**打包的产物里面是**存在两份**的
- 结构体的size不一样
- 对应的构造函数地址空间也不一样

### NT Android 编译结果 - .so动态库

- 只有一个构造函数



## 自动化检测策略

- ASan 是一种基于编译器的快速检测工具，用于检测原生代码中的内存错误。 \>> [URL](https://developer.android.com/ndk/guides/asan?hl=zh-cn)





