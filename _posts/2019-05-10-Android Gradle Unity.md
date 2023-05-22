---
title: Android Gradle Unity
date: 2019-05-10 22:41:00 +0800
categories: [Android,构建]
tags: [Gradle]
---

# 编译并安装到设备

```bash
@echo off

gradle assembleDebug && adb install -r build\outputs\apk\debug\CurlCompatibility-debug.apk && pause

pause
```

# 测试设备是否支持Andorid 64bit （安装指定的CPU架构）

```bash
:: Command Line
    # A successful install:
    > adb install --abi armeabi-v7a YOUR_APK_FILE.apk
    Success

    # If your APK does not have the 64-bit libraries:
    > adb install --abi arm64-v8a YOUR_APK_FILE.apk
    adb: failed to install YOUR_APK_FILE.apk: Failure [INSTALL_FAILED_NO_MATCHING_ABIS: Failed to extract native libraries, res=-113]

    # If your device does not support 64-bit, an emulator, for example:
    > adb install --abi arm64-v8a YOUR_APK_FILE.apk
    ABI arm64-v8a not supported on this device
```