---
title: Android Multidex正确使用方式
date: 2020-02-11 22:41:00 +0800
categories: [Android,原生]
tags: [Multidex正确使用方式]

# Ref
#  - https://www.youtube.com/watch?v=W45-fsnPhJY&t=794s
#  - https://medium.com/@abhpatidar/solving-unity-dex-issue-538e134c8809
#  - https://github.com/iabhipatidar/MultidexProject.git
#  - https://blog.csdn.net/a2241076850/article/details/77942633
#  - https://blog.csdn.net/fan7983377/article/details/73850282
#  - https://www.cnblogs.com/wingyip/p/4496028.html

---

# 一、概述

Android 应用 (APK) 文件包含 Dalvik Executable (DEX) 文件形式的可执行字节码文件，其中包含用来运行的应用的已编译代码。Dalvik Executable 规范将可在单个 DEX 文件内可引用的方法总数限制在 65,536，其中包括 Android 框架方法、库方法以及自己代码中的方法。在计算机科学领域内，术语千（简称 K）表示 1024（或 2^10）。由于 65,536 等于 64 X 1024，因此这一限制也称为“64K 引用限制”，详细介参考谷歌官方配置文档。
[谷歌官方配置使用文档](https://developer.android.com/studio/build/multidex)

# 二、Multidex使用简单配置


```
// 1. Gralde 配置
android {
    defaultConfig {
        ...
        minSdkVersion 15 
        targetSdkVersion 28
        multiDexEnabled true
    }
    ...
}

dependencies {
     api 'com.android.support:multidex:1.0.3'
     api 'com.android.support:multidex-instrumentation:1.0.3'
}

// 2. 清单配置
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.myapp">
    <application
            android:name="com.xxx.MyApplication" >
        ...
    </application>
</manifest>

// 3. Application初始化
public class MyApplication extends SomeOtherApplication {
  @Override
  protected void attachBaseContext(Context base) {
     super.attachBaseContext(base);
     MultiDex.install(this);
  }
}
```


# 三、高级配置，multiDexKeepFile 属性

如果APP安装失败，调试日志出现 `NoClassDefFoundError`、`ClassNotFoundException`、`NoSuchMethodException`等异常，就需要将这些找不到的类，配置到主的DEX 文件中，以至于在APP初始化的时候能找到这些类。
配置方法:


 - 在build.gradle文件同级目录下创建一个multidex-config.txt（这里随便命名）配置文件。

 - 在文件中添加找不到的类，如下所示：
com/example/MyClass.class// 普通类配置方式
com/example/MyOtherClass$InnerClass.class// 内部类配置方式

 - 在配置multidex-config.txt前，先release一遍，找到app/build/intermediates/multi-dex/release/maindexlist.txt这个文件的所有内容复制到multidex-config.txt文件中。maindexlist.txt里面的内容是通过一系统列方法算出APP启动所关联的类。

在build.gradle文件配置
```
android {
    buildTypes {
        release {
            multiDexKeepFile file ('multidex-config.txt')// 小括号记得要加上，官方文档没有
            ...
        }
    }
}
```

每个包内方法数上限配置(**对低端机型很重要**)

```
 dexOptions {
        javaMaxHeapSize "4g"
        preDexLibraries = false
        additionalParameters += '--multi-dex'
        additionalParameters += '--set-max-idx-number=35000'//每个包内方法数上限（根据实际项目配置这个数，来适配4.0-4.4一些低端机型，因为拆分的dex太大，这些低端机型加载不了dex）
        additionalParameters += '--minimal-main-dex'
    }
```

注意：每个dex(claasses.dex、claasses1.dex、claasses2.dex...)内方法数上限（根据实际项目配置这个数，来适配4.0-4.4一些低端机型，因为拆分的dex太大，这些低端机型加载不了dex），这个数也不能太小，最多能分7个DEX。

