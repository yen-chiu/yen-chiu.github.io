---
title: Android Native热更新
date:  2020-02-21 14:13:23 +0800
categories: [Android, 热更新]
tags: [Native热更新,SO热更新]
# Ref
# - http://wereadteam.github.io/2016/07/26/AndroidPatch/
---



# 怎么更新 so 文件？

在 Android 项目中使用 native 函数前需要先调用 `System.loadLibrary(libName)`。

当 lib 文件需要更新或者有 bug 时候怎么办？

首先想到的是在代码中把加载 so 文件的代码改成`System.load(libFilePath)`，让系统加载自己指定的 `libFilePath` 文件。

然而这样的改动需要

- 在源代码中修改或者使用工具在编译期把 `loadLibrary` 接口改为 `load`
- patch 库把 so 文件从 patch 文件中复制到特定目录

这样在运行期才有可能加载更新后的 so 文件。

通过分析系统加载 so 文件的方式后，我们使用了更简单的处理方法。

查找 lib 文件是通过调用 `PathClassLoader` 的 `findLibrary`，最终调用到 `DexPathList` 的 `findLibrary`。

`DexPathList` 会在自己维护的列表目录中查找对应的 lib 文件是否存在。

所以我们在发现 patch 文件中有 so 文件变更的时候，会在 `PathClassLoader` 的 `nativeLibraryDirectories`（Android6.0以下）或者`nativeLibraryPathElements` （Android 6.0及以上）的最前面**插入自定义的lib文件目录**。

这样 `ClassLoader` 在 `findLibrary` 的时候会先在自定义的 lib 目录中查找，优先加载变更过的 so 文件。

# 关于系统适配性
在 Android 5.1 arm64 的真机上

- 通过 `System.load` 一个 app_libs 路径下的 so，**可以正常加载，但是无法正常使用**（原因未知，System.load 没有产生任何警告和异常）
- 但是通过将 app_libs 注入到 `PathClassLoader` 的 `NativeLibraryDirectories`
- 再通过 `System.loadLibrary` 是可以正常加载和使用的

但是注入的方式，不同的 SDK Version 并不一致，代码兼容性不好。因此，

- SDK 14~22 使用Hook `NativeLibraryDirectories` 的方法加载 library
- 其他SDK版本使用系统接口

----

```java
private static void createNativeLibraryDirectories(Context context, File appLibDir) {
    PathClassLoader pathClassLoader = (PathClassLoader) context.getClassLoader();
    Object pathList = getLoaderPathList(pathClassLoader);
    if (pathList != null) {
        try {
            Field nativeLibraryDirectoriesField = pathList.getClass().getDeclaredField("nativeLibraryDirectories");
            nativeLibraryDirectoriesField.setAccessible(true);
            Object list = nativeLibraryDirectoriesField.get(pathList);
            if (list instanceof List) {
                ((List) list).add(appLibDir);
            } else if (list instanceof File[]) {
                File[] newList = new File[((File[]) list).length + 1];
                System.arraycopy(list, 0, newList, 0, ((File[]) list).length);
                newList[((File[]) list).length] = appLibDir;
                nativeLibraryDirectoriesField.set(pathList, newList);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

