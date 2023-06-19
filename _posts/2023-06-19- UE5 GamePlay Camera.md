---
title: UE5 GamePlay Camera
date: 2023-06-19 12:32:00 +0800
categories: [Unreal,Beginner]
# Ref
# - https://docs.unrealengine.com/5.2/zh-CN/using-a-static-camera-in-unreal-engine/
# - https://docs.unrealengine.com/5.2/zh-CN/working-with-camera-components-in-unreal-engine/

---

>  摄像机只和玩家控制的人物有关

- [PlayerController](https://docs.unrealengine.com/5.2/zh-CN/player-controllers-in-unreal-engine)会指定一个摄像机类， 并实例化一个Camera Actor (`ACameraActor`)，以此计算玩家从哪个位置和角度 观察世界。
- [后期处理效果](https://docs.unrealengine.com/5.2/zh-CN/post-process-effects-in-unreal-engine)可以添加至摄像机，并且也可以调整后期处理效果的强度。

## PlayerCameraManager

主要外部职责是要可靠地对各种 `Get()` 函数做出响应，比如 `GetCameraViewPoint`。

## 摄像机责任链

游戏特定的摄像机行为和摄像机可以随时通过 "责任链" 提供（从上到下通过以下类传递，然后转到 `ALocalPlayer`，并以[渲染](https://docs.unrealengine.com/5.2/zh-CN/designing-visuals-rendering-and-graphics-with-unreal-engine), **场景视图（Scene View）** (`FSceneView`) 以及其它相关系统结束）。



## 相机运镜官方Demo参考

使用 **Set View Target With Blend** 切换 CameraActor

- https://docs.unrealengine.com/5.2/zh-CN/using-a-static-camera-in-unreal-engine/
- https://docs.unrealengine.com/5.2/zh-CN/working-with-camera-components-in-unreal-engine/
