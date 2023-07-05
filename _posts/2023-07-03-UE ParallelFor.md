---
title: UE ParallelFor
date: 2023-07-03 14:10:08 +0800
categories: [Unreal,UE-C++]

---



ParallelFor允许我们在一分钟内对任何 for 循环进行多线程处理，从而通过在多个线程之间拆分工作来划分执行时间。



```c++
#include "Runtime/Core/Public/Async/ParallelFor.h"

//例1
ParallelFor(num, [&](int32 i) {sum += i; });

//例2
FCriticalSection Mutex;
ParallelFor(Input.Num(), [&](int32 Idx){
    if(Input[Idx] % 5 == 0){
        Mutex.Lock();
        Output.Add(Input[Idx]);
        Mutex.Unlock();
    }
});
```

