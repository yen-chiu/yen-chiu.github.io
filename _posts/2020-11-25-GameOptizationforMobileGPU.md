---
title: GameOptizationforMobileGPU
date: 2020-11-25 22:41:00 +0800
categories: [Unity,性能优化]
tags: [图形编程]
---

## FPS

In Android, most of the phones set display refresh rate to 60. the v-Sync signal comes at every 16.67ms. Theoretically, FPS=60/n(n=1, 2, 3)could have stable visual experience. Other FPS has short-long frame(快慢帧) issue. User feels better at stable 30 FPS than 40.

> 简单来说，稳定的帧率比高帧的视觉体验会好很多，应该尽量避免长短帧
 - 那么长短帧又该如何度量？

## Jank

It hurts the user experience, but cannot be measured from the FPS or average FPS
Many reasons
 - CPU bound
 - GPU bound
 - GC
 - Loading resource
 - Long task


## Tips

 - DCVS and how to Measure Rendering Time
    - GPU adjust its frequency based on the load, so measuring the gpu rendering time should always know what frequency it is running

 - Compute Shader
    - Compute shader on mobile is not as efficient as desktop. So we always prefer fragment shader than compute shader
    - If you do need compute shader, the group size need to be tuned carefully for different tiers of GPUs

 - KHR_create_context_no_error
    - This extension allows the creation of an OpenGL or Open GL ES context that doesn't generate errors if the context supports a no error mode
    - It could save about 20% rendering thread cpu time

 - Direct fallback
    - Generally, direct rendering is not power efficient as bin rendering. You need to check carefully if your main surface is fallback to direct rendering This can be found in SDP

 - Load/Store
    - In binning mode use sdp to check the load/store of each surface. Avoid unnecessary load/store
    - glcear
    - gllnvalidateFramebuffer
    - Vulkan load op clear/do not care

 - Shadow
    - Check and use reasonable depth texture size

 - MSAA
    - 4X MSAA has performance impact, try to use 2X if your game performance is not good in 4x Mode

 - UI Size
    - Limit your UI resolution to 1080p, even the screen resolution is 2K on some phones

# Shader

## PCF

 - Adreno support HW PCF in all tiers since A3xx, the gPU can do linear filter on the 2x 2 shadow depth texture
 - To use HW pCF in OpenGL:
    - glTexParameterI(GL__TEXTURE_ 2D, GL_TEXTURE_ MIN_ FILTER, GL_LINEAR);
    - glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_ MAG_FILTER, GL LINEAR);
    - glTexParameteri(GL_TEXTURE_2D, GL- TEXTURE_ COMPARE_ MODE, GL_COMPARE_REF_TO. TEXTURE)
    - glTexParameteri(GL_ TEXTURE_ 2D, GL__TEXTURE_COMPARE_FUNC, GL_LEQUAL;

## Half vs. Float

The Adreno GPU could run 2x performance when calculating 16bit ALU. So the rule is:
 - If your shader could use a lot of midp instead of highp use midp could improve the performance significantly
 - If just several midp in your shader, and these midp need to mixed calculated with highp, just use all as high As the conversion from midp to highp also cost time
 - If you are not sure, use SDP to check the compiled instruction numbers


## Discard and late Z

There are some cases that prevent the GPU from using early Z, which we should avoid
 - Use discard instruction in the fragment shader
 - Fragment shader output depth value or sample coverage
 - Depth/stencil framebuffer fetch is enabled
 - Others

## Texture Sampling

Desktop renderer always uses a lot of texture samplings, But this needs to be very carefully on mobile
 - Please be very careful when your use texture in Vs. t is hard to determine the performance impact but likely to be slow
 - In the fragment shader, the proper number of texture samplings is varying from GPU to GPU. Try your numbers and test the gPU frequency and utilization
 - Always avoid generating the UV on the fly


# Out of Memory

 - Check the kernel log to confirm if your issue is caused by out of vss. Need root permission to run below commands on android:
> adb shell dmesg

 -  Below log means driver failed to allocate 8M virtual memory
> kgsl kgsl-3d0: kgs_get_unmapped_areal_get svm_area: pid 27003 mmap_ base eaed9000 addr 0 pgoff 7fa len 8388608 failed error-12

 - It could happen in many functions, but most likely in draw. The reason is very complex, it could be vss fragmentation, and also could be other non-graphics module use too many VSS and etc.
 - How to debug/check
    - showmap -a [pid]
    - cat /proc/[pid]/maps





