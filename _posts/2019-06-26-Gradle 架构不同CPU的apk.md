---
title: Gradle 架构不同CPU的apk
date: 2019-06-26 22:41:00 +0800
categories: [Android,构建]
tags: [Gradle]
---

## split分包

首先是splits命令，这个命令可以按照各种规则去分包，比如按照abi,屏幕密度（即ldpi,hdpi等）分包。 
语法如下：
```
splits {
        abi {
            enable true
            reset()
            include 'x86'
            exclude 'armeabi', 'armeabi-v7a', "arm64-v8a"
            universalApk true
        }
    }
```

include就是包括，exclude就是不包括。包括的配置每一个项都会生成一个apk包。 
即

```
include 'x86','armabi'
```


如果这样配置，会生成两个包，一个只包含x86的so库，一个只包含armabi的so库。不能满足项目的要求，项目要求的是一个只包含x86的库，一个包含armabi,armabi-v7a,armabi64-v8a这3个的库文件。

## ndk{abiFilters:}过滤

这个指令可以配置只打包你配置的so库，没有配置的就不打包，很灵活。

```
//过滤x86的so库
ndk {
    abiFilters 'armeabi', 'armeabi-v7a', 'arm64-v8a'
}
```

这样配置会将armeabi，armeabi-v71,arm64-v8a这3个包下的so库都打包到一个apk,而不像splits会每一个包打一个apk.

```
//过滤x86的so库
ndk {
    abiFilters 'x86'
}
```

这样配的话就只会打包x86的so库。

## Gradle构建的中间产物

`build/intermediates` 下,可查看 manifest 等最终合并后的资源是什么