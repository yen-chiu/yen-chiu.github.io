---
title: Visual Assist 安装
date: 2023-05-22 10:08:16 +0800
math: true
categories: [Uncategories,杂项]
# Ref
# - https://www.chinapyg.com/thread-74596-1-1.html

---

Visual Assist 2440的安装包启动闪退、无法启动

> 官方的更新日志-2443： 
>
> - Fix for installer crash which could occur if Visual Studio 17.1 Preview 2.0 or later has ever been installed. 

### 解决方案一

- 下载exe资源提取器[[resources_extract](https://www.nirsoft.net/utils/resources_extract.html)]

- 资源提取出来有2个比较大的文件就是vs2019和vs2022的vsix文件，后缀名改成`vsix`就可以安装了。 

  > 顺便提一下，凡是安装了最新的VS2022的，VAX的老版本安装包全部闪退，想安装老版本只能提取vsix安装。

### 解决方案二

- 使用7z解压
- 文件位于解压后`.\.rsrc\BINARY`目录

----

VS扩展安装目录

- `C:\Users\<UserName>\AppData\Local\Microsoft\VisualStudio\17.0_7\Extensions\<random Name>`{: .filepath}



