---
title: IOS防止误触SwipeBar
date: 2023-02-19 15:42:00 +0800
categories: [IOS,方案]
tags: [手势交互]

# Ref:
# - https://blog.csdn.net/tom_221x/article/details/96695537
# - https://developer.apple.com/forums/thread/93310
# - https://cloud.tencent.com/developer/article/2149936
---



在全屏的app中，屏幕的4个边缘都会默认触发系统的手势操作，然后才会把事件传递给app处理。

首先触发系统的edge手势，在某些app中没有什么问题，比如返回上一级。但在有些app中，比如全屏游戏，就会带来触摸延迟——非常明显，亦或是误触Home回到了主页。

> - 无限制
>   - ![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16768793073630f04eac97ac34cf19c29fcfd50cba9d8.gif)



IOS官方给出的解决方案就是，在UIViewController中重载preferredScreenEdgesDeferringSystemGestures属性。有些文章说是函数，但我在IOS12的SDK中看到的是属性，具体如下：

```objc
@interface UIViewController (UIScreenEdgesDeferringSystemGestures)

// Override to return a child view controller or nil. If non-nil, that view controller's screen edges deferring system gestures will be used. If nil, self is used. Whenever the return value changes, -setNeedsScreenEdgesDeferringSystemGesturesUpdate should be called.
@property (nonatomic, readonly, nullable) UIViewController *childViewControllerForScreenEdgesDeferringSystemGestures API_AVAILABLE(ios(11.0)) API_UNAVAILABLE(watchos, tvos);

// Controls the application's preferred screen edges deferring system gestures when this view controller is shown. Default is UIRectEdgeNone.
@property (nonatomic, readonly) UIRectEdge preferredScreenEdgesDeferringSystemGestures API_AVAILABLE(ios(11.0)) API_UNAVAILABLE(watchos, tvos);

// This should be called whenever the return values for the view controller's screen edges deferring system gestures have changed.
- (void)setNeedsUpdateOfScreenEdgesDeferringSystemGestures API_AVAILABLE(ios(11.0)) API_UNAVAILABLE(watchos, tvos);

@end

```

preferredScreenEdgesDeferringSystemGestures是一个只读属性，返回`UIRectEdge`对象，其代表屏幕的哪些边缘不需要首先响应系统手势——有上下左右4个边缘可选。

```objc
typedef NS_OPTIONS(NSUInteger, UIRectEdge) {
    UIRectEdgeNone   = 0,
    UIRectEdgeTop    = 1 << 0,
    UIRectEdgeLeft   = 1 << 1,
    UIRectEdgeBottom = 1 << 2,
    UIRectEdgeRight  = 1 << 3,
    UIRectEdgeAll    = UIRectEdgeTop | UIRectEdgeLeft | UIRectEdgeBottom | UIRectEdgeRight
} NS_ENUM_AVAILABLE_IOS(7_0);

```

在`UIViewController`的子类，重写这个属性，返回不需要首先触发系统边缘手势的`UIRectEdge`对象即可。如下

```objc
- (UIRectEdge)preferredScreenEdgesDeferringSystemGestures
{
    return UIRectEdgeBottom;
}
- (BOOL)prefersHomeIndicatorAutoHidden
{
    return false;
}
```

----

在对应的 ViewControll 中添加如下代码，我们这边开启的是所有边界限制其中包括了上、下边界。在下拉或者上拉的话会先触发 App 内部手势，同时出现一个小箭头然后在箭头消失之前再次滑动就会触发系统手势。

```objc
-(UIRectEdge)preferredScreenEdgesDeferringSystemGestures
{
    return UIRectEdgeAll;
}
```

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16768793974850d16ed2427c1bfc62b440babc3952af1.gif)
