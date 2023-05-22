---
title: Android SO 内存详细信息获取
date: 2022-01-07 22:41:00 +0800
categories: [Android,工具]
tags: [ADB]
---

## 获取内存方法一：dumpsys meminfo

在adb下输入如下命令：


```bash
adb shell dumpsys meminfo <yourpakagename>
```



|                  | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| Pss TOTAL值      | 内存所实际占用的值。                                         |
| Dalvik Heap Size | 从RuntimetotalMemory0获得，DalvikHeap总共的内存大小。        |
| Dalvik HeapAlloc | RuntimetotalMemory()-freeMemory(),Dalvik Heap分配的内存大小。 |
| Dalvik Heap Free | 从RuntimefreeMemory()获得，DalvikHeap剩余的内存大小。 |
| Dalvik Heap Size | 约等于Dalvik HeapAlloc+Dalvik HeapFree。 |
| .so mmap |C库代码占用的内存。|
| .jar mmap | Java文件代码占用的内存。 |
| .apk mmap | apk代码占用的内存。 |
| .ttf mmap | ttf文件代码占用的内存。 |
| .dex mmap | Dex文件代码占用的内存。 |
| Other mmap | 其他文件占用的内存。 |
| Cursor | /dev/ashmem/Cursor Cursor消耗的内存（KB)。 |
| Ashmem | /dev/ashmem,匿名共享内存用来提供共享内存通过分配一个多个进程可以共享的带名称的内存块。 |
| Other dev | /dev/,内部driver占用的在"Otherdev"。 |



这种方法获取内存可能存在一个问题：获取内存不够精准，如果Android应用中的库文件，没有以.so后缀名结尾，那么这部分内存占用不会归为“.so mmap”中，而是归为"Other mmap"中。


## 获取内存方法二：smaps

在adb下输入如下命令：

```bash
# 打印被测应用的进程id
adb -d shell ps | grep com.sohu.inputmethod.sogou | awk '{print$2;}'  
# 把PID对应的smaps文件拷贝到手机的sdcard上。注意必须用cat，不能用cp
adb -d shell su --command=\'cat /[PID]/smaps >/sdcard\'  
# 下载smaps文件
adb –d pull /sdcard/smaps  
```

1. 解析smaps文件

![](https://cdn.jsdelivr.net/gh/Rootjhon/img_note@main/1614154130197-1614154130191.png)

文件结构：
 - 400ca000-400cb000：本段虚拟内存的地址范围
 - r-xp             ：文件权限，r（读）、w（写）、x（执行）、p表示私有，s代表共享，如果不具有哪项权限用"-"代替
 - 00000000         ：映射文件的偏移量
 - b3:11            ：文件设备号
 - 1345             ：被映射到虚拟内存文件的映索节点

![](https://cdn.jsdelivr.net/gh/Rootjhon/img_note@main/1614154141631-1614154141626.png)


## dumpsys meminfo 和 smaps的关系

dumpsys meminfo 命令下的 Pss、Shared Dirty、Private Dirty这三列的数据是读取smaps文件生成。