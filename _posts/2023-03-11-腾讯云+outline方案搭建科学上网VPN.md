---
title: 腾讯云+outline方案搭建科学上网VPN
date: 2023-03-11 16:10:46 +0800
categories: [Uncategories,网络环境]
tags: [科学上网]
---

# 腾讯云+outline方案搭建科学上网VPN

 - 支持多个平台：iOS/Android/Mac/PC
    - APK: [APK](https://github.com/Jigsaw-Code/outline-releases/blob/master/client/Outline.apk)
    - IOS 直接Appstore下载

# 搭建步骤：

## 购买腾讯云服务器，选你想要的地区

- https://buy.cloud.tencent.com/cvm?tab=lite
- 比如：中国香港
- CentOS 7.2 64位
- 购买完成后会收到账号等信息

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16705529135921670552912900.png)

## 部署腾讯云服务器

- 登录云服务器
![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16705528845941670552884417.png)
- 登录成功后，在web终端逐条运行以下命令
```bash
yum update
yum install docker
systemctl enable docker
systemctl start docker
```
- 至此腾讯云部署已完成（后面还有一步命令配合outline manager完成）


 - 下载Outline Manager和Outline
       > https://github.com/Jigsaw-Code/outline-releases
    - 下载链接: https://github.com/Jigsaw-Code/outline-server/releases
    - Outline Manager是刚才配置的腾讯云docker远程VP配置管理端app
    - Outline是配置设备上开启VPN的app
     > https://github.com/Jigsaw-Code/outline-client/releases
     > Mac 可以直接在 AppStore里下载

 - 安装Outline Manager，并运行
    ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16705527855931670552784659.png)

    ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16705528176021670552817392.png)

    ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16705528336041670552833459.png)



## CentOS 8 - Docker

报错信息：

```
Failed to enable unit: Unit file docker.service does not exist
```



1. 运行以下命令，安装dnf。

   dnf是新一代的rpm软件包管理器。

   ```bash
   yum -y install dnf
   ```

2. 运行以下命令，安装Docker存储驱动的依赖包。

   ```bash
   dnf install -y device-mapper-persistent-data lvm2
   ```

3. 运行以下命令，添加稳定的Docker软件源。

   ```bash
   dnf config-manager --add-repo=https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
   ```

4. 运行以下命令，查看已添加的Docker软件源。

   ```bash
   dnf list docker-ce
   ```

   正确的返回示例如下。

   ```console
   docker-ce.x86_64        3:19.03.13-3.el7        docker-ce-stable
   ```

5. 运行以下命令安装Docker。

   ```bash
   dnf install -y docker-ce --nobest
   ```

6. 运行以下命令启动Docker。

   ```bash
   systemctl start docker
   ```
---
**声明：本文转载自[rootjhon](https://github.com/Rootjhon/rootjhon.github.io)**
