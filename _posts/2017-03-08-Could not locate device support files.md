---
title: Could not locate device support files
date: 2017-03-08 18:32:00 +0800
categories: [IOS, xcode]
tags: [真机调试]

# Ref
#  - https://github.com/iGhibli/iOS-DeviceSupport
---

## Could not locate device support files

 - 打开 Finder
 - 打开应用程序文件夹
- 在里面找到Xcode应用
- 点击Xcode，右键 -> 显示包内容
- 在里面按下面目录层级找到支持的真机测试文件：`Contents -> Developer -> Platforms -> iPhoneOS.platform -> DeviceSupport(/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/DeviceSupport)`{: .filepath}
- 上面的目录里面就是当前Xcode支持真机调试的真机iOS版本，如下图所示：
- 然后通过别的渠道拷贝最新的DeviceSupport文件到这个目录里面就可以用最新的iOS设备真机调试了。

----

\>> [Xcode各版本官网下载地址](https://developer.apple.com/download/more/)