---
title: VideoStation 音频 DTS\EAC3\TureHD 音轨格式支持
date: 2021-04-07 20:51:47 +0800
categories: [NAS,群晖]
tags: []
---

# 群晖 VideoStation 音频 DTS\EAC3\TureHD 音轨格式支持

"不支持当前所选音频的文件格式，因此无法播放视频。请尝试其它音轨，确定其是否支持"


### 首先安装社区版 FFMPEG。(套件中心 -> 社群 -> 搜索 `FFMPEG` )

\>> [http://packages.synocommunity.com](https://link.zhihu.com/?target=http%3A//packages.synocommunity.com/)

社群无法刷新出套件信息： 控制面板 -> 网络 -> 手动配置DNS服务器
首选填自己的默认网关地址；
备选 **三选一**：

- 223.5.5.5 *（阿里公共DNS）*
- 223.6.6.6*（阿里公共DNS）*
- 180.76.76.76*（百度公共DNS）*

### 手动安装方式

\>> [https://synocommunity.com/package/ffmpeg](https://link.zhihu.com/?target=https%3A//synocommunity.com/package/ffmpeg) 下载对应架构和DSM的spk

![img](https://pic3.zhimg.com/80/v2-87483bbe1c8e086089da5de7bf256606_1440w.webp)

## Wrapper Shell

https://github.com/darknebular/Wrapper_VideoStation

https://raw.githubusercontent.com/darknebular/Wrapper_VideoStation/main/installer.sh

```bash
bash -c "$(curl "https://raw.githubusercontent.com/darknebular/Wrapper_VideoStation/main/installer.sh")"
```

