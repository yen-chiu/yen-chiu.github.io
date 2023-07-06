---
title: unity-android-profile真机 ADB
date: 2019-09-05 22:41:00 +0800
categories: [Unity,Profile]
tags: [性能优化]

# Ref
# - https://www.jianshu.com/p/340944d4159f
# - https://zhuanlan.zhihu.com/p/30247546
---

转播应用信息

`adb forward tcp:55000 localabstract:Unity-com.xx.xx.xx`


> 连接Mumu模拟器

```
adb connect 127.0.0.1:7555
```

## 获取手机\模拟器硬件使用情况

### 内存占用

关于内存涉及几个概念：
```
Terms
    VSS- Virtual Set Size 虚拟耗用内存（包含共享库占用的内存）
    RSS- Resident Set Size 实际使用物理内存（包含共享库占用的内存）
    PSS- Proportional Set Size 实际使用的物理内存（比例分配共享库占用的内存）
    USS- Unique Set Size 进程独自占用的物理内存（不包含共享库占用的内存）
一般来说内存占用大小有如下规律：VSS >= RSS >= PSS >= USS
```

```bash
方法1. 基于adb shell dumpsys meminfo的方式，打印详细的当前环境PSS使用信息
adb shell "dumpsys meminfo | grep package"     //其中package为具体应用的包名信息
例如： adb shell "dumpsys meminfo | 具体应用包名"  //当前系统某个APP的总体情况

例如： adb shell dumpsys meminfo 具体应用包名       //当前系统某个APP的详细信息
```

### CPU占用率
```
方法1. 基于adb shell dumpsys cpuinfo的方式，此方式可以测试手机中任意packageName的app
adb shell "dumpsys cpuinfo | grep package"     //其中package为具体应用的包名信息
例如： adb shell "dumpsys cpuinfo | grep com.android.browser"  //当前系统浏览器的情况
```
方法2. 基于Linux的top命令
```
adb shell top
常用参数一般有如下：
    -m：表示需要展示的进程数目
    -n：结束前需要刷新多少次
    -d：刷新间隔（单位秒）
    -s：按照什么列排序（CPU，VSS，RSS，THR）

输出的信息里面主要包括：
    PID（进程ID），CPU%（CPU使用率），VSS（虚拟内存使用量），RSS（实际物理内存使用量）等等。

我们一般关心的数据列就是我们CPU%。
例如：adb shell top -m 1 -d 0 -n 1
```
### 启动时间

 - 冷启动：应用程序首次启动，进程首次创建并加载资源的过程；
```
 启动APP命令： adb shell am start -W -n package/activity
停止APP命令： adb shell am force-stop package

package为应用的包名，activity为具体页面，启动测试可以是launcher配置的页面
例如,测试浏览器的启动时间：
    adb shell am start -W -n com.android.browser/.BrowserActivity
    adb shell am force-stop com.android.browser
```
 - 热启动：应用程序启动后点“back”键、“Home”键，应用程序退到后台，并未被完全“Kill”的状态，再次启动；
```
启动APP命令： adb shell am start -W -n package/activity
停止APP命令： adb shell input keyevent 3  (发送一个keyevent事件，3代表点击手机上的“back”键)

例如,依旧是测试浏览器的启动时间：
    adb shell input keyevent 3  //关掉上面程序已经冷启动的页面
    adb shell am start -W -n com.android.browser/.BrowserActivity  //重新打开APP
```

### 消耗流量

```
获取某个应用的PID，再获取该pid的消耗流量值
首先要获取进程的ID，命令：adb shell "ps | grep 具体包名"
然后获取报告：adb shell "cat/proc/pid/net/dev"   注意替换这个pid为上一行命令获取的pid
```


## 获取手机\模拟器上的文件

下载到本地

```bash
adb pull storage/emulated/0/logsample/xlog/LOGSAMPLE_20190611.xlog  [保存到本地的位置(可选)]
```

上传 

```bash
abd push [要上传的文件位置] [要保存的设备目录]  
```

----

结论： 
 `adb forward tcp:55000 localabstract:Unity-`
 `链接ip填写127.0.0.1`


对于Android平台，Unity3D提供了两种原生的性能分析方法：Wi-Fi 与 ADB。

最为常见的是勾上Development Build 以及 Autoconnect Profiler。只要保证手机连接的Wi-Fi与正在Profiling的桌面电脑在同一网段，大多数情况下，游戏启动后Profiler都能正常找到手机。

对于Android平台，Unity3D提供了两种原生的性能分析方法：Wi-Fi 与 ADB。

最为常见的是勾上Development Build 以及 Autoconnect Profiler。只要保证手机连接的Wi-Fi与正在Profiling的桌面电脑在同一网段，大多数情况下，游戏启动后Profiler都能正常找到手机。

通过Wi-Fi连接有很大局限性，例如：
 - 有时运行几十秒到几分钟后编辑器就收不到数据了
 - 数据严重延迟，并随着时间的推移延迟越来越大
 - 信号干扰大出现卡顿
 - 连接的Wi-Fi与电脑不在一个网段
 - 遇到这些问题的时候你就需要通过ADB的方式来连接手机了


ADB的方式
你按照文档所说，勾了Development Build 与 Autoconnect Profiler，端口映射也做了

> `adb forward tcp:34999 localabstract:Unity-包名`

接着，你选择了AndroidPlayer(ADB@127.0.0.1:34999)

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16762621409261676262140621.png)

注：不同版本默认端口有所不同

**可Unity一点反应也没有**

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16762621539161676262153035.png)

**然后使用默认的端口映射34999或54999是为什么还是不行？**


![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16762621639161676262163131.png)

ConnectToPlayer() 的流程概括如下

0. 从55000端口开始尝试连接
0. 直至55511端口
0. 尝试4600端口
0. 若没有成功的，返回第1步，最多重复三次这样的行为

说到这，想必已经知道该怎么做了

**IP填写127.0.0.1**

**adb forward 端口号选用55000 ~ 55511范围，或者4600 （5.x ~ 2017）**

**4.X版本，引擎代码中写死了常量55000**

 - **并且要在Android的平台下**
