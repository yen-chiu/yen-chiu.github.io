# Night Radio · 夜间留声

独立音乐页：[/music/](https://yenchiu.com/music/)，授权档案：[/music/credits/](https://yenchiu.com/music/credits/)。首页使用同一个播放器组件的 compact 模式。

## 架构

| 文件 | 职责 |
| --- | --- |
| `src/data/music.ts` | 曲目、音源、许可、署名、封面与歌词 |
| `src/utils/music-engine.ts` | 单一 Audio 实例、播放状态、音量、队列、循环与随机 |
| `src/components/music/MusicPlayer.astro` | 完整及紧凑播放器，订阅共享状态 |
| `src/data/music-waveforms.json` | 每首曲目预计算 64 个波形值 |
| `src/pages/music/credits/index.astro` | 自动从曲目目录生成署名、许可、搜索与分页 |
| `public/images/music/` | 透明唱片与唱臂 WebP 素材 |

Audio 使用 preload=none，用户点击后才设置音源。站内 Astro 导航尽量保持播放；完整刷新、离站或浏览器限制可能中断。播放列表中的可播放音源必须有相应录音许可，外部平台使用官方入口，不抓取付费音源。

## 新增曲目

编辑 music.ts，为每个条目指定唯一 id、title、artist、source、url、provider、attribution、license、sourceUrl；有适用许可链接时填写 licenseUrl。cover、lyrics 为可选项，使用前也要核对权利。授权档案自动读取这些字段，不手工重复维护列表。作品公有领域不代表具体录音公有领域。

需要刷新波形时，在已安装 Python 3 和 FFmpeg 的维护电脑上运行：

```bash
python scripts/generate-music-waveforms.py
```

脚本联网读取曲目音源并计算 RMS，仅提交生成的 JSON，不提交录音缓存。检查失败曲目和旧数据，不能将生成失败视为全部更新成功。构建不依赖实时生成波形。

## 动效与维护

唱片素材固定路径 vinyl.webp（768×768）、tonearm.webp（314×512）。唱片播放时旋转，唱臂围绕固定轴在 -29° 与 0° 之间用 900ms 缓动切换。低性能移动端仍保留播放交互动效；系统减少动效或显式关闭时停止对应动画，后台页面暂停唱片动画。

不要将整个专辑封面覆盖唱片纹理，不要用删除素材测试规避缺图。音源失败先检查来源、浏览器网络与许可，不应直接改用未知镜像。

## 验证

```bash
node --test scripts/music-ui.test.mjs
npm test
npm run build
```

[Music browser validation](../../.github/workflows/music-browser.yml) 验证实际浏览器桌面/移动端播放与暂停、唱臂过渡等；合成音频不代表远端真实音源成功。验收还应检查无自动播放、跨页播放、触摸操作、授权入口与减少动效。回滚通过新 PR revert 对应改动，不回退整个 main。
