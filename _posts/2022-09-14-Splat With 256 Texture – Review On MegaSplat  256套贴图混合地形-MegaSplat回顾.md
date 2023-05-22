---
title: Splat With 256 Texture – Review On MegaSplat  256套贴图混合地形-MegaSplat回顾
date: 2022-09-14 11:09:05 +0800
categories: [Unity,图形渲染相关]
tags: [地形系统]
---

# Splat With 256 Texture – Review On MegaSplat | 256套贴图混合地形-MegaSplat回顾

![256套贴图混合地形-MegaSplat回顾](http://ma-yidong.com/wp-content/uploads/2018/09/5.png)

最近看到[MegaSplat](https://assetstore.unity.com/packages/tools/terrain/megasplat-76166)这个插件感觉很有意思，在这里做一介绍。作者[Jason Booth](https://github.com/slipster216)是有二十多年经验的程序员，现在是Disruptor Beam工作室的客户端和图形架构师，最近unity官方博客还推了[行尸走肉：行军作战移动端优化经验](http://forum.china.unity3d.com/thread-32642-1-1.html)，便是这位大神所写

MegaSplat是一套地形的shader，支持很多的feature，另外有写的很好的顶点色绘制工具，shader编译代码，以及最重要的，用顶点混合256张贴图的方法。

雪的混合，代码在DoSnow函数中，基本思路是用height和ao来生成一个snowAmount，这个snowAmount来lerp颜色法线等等

![img](http://ma-yidong.com/wp-content/uploads/2018/09/1-500x263.png)

比如还有岩浆，下图是unity截图，在DoLava函数中

![img](http://ma-yidong.com/wp-content/uploads/2018/09/2-500x312.png)

比如还有小溪， 在DoPuddle里，会有泡沫和水波涟漪的计算，另外还会用法线重采样原有地形贴图造成折射效果

另外还有tessellation，triplar，parallax， macromap等等很多特性。

另外一点有意思的是它的所有shader都是预先写好片段，修改feature后组装编译出来的。 基本思路是会有一个feature类，不同的shader启用不同feature，按feature来组装写好的片段，需要的property和define写进去。当然函数主体是一样的，只是不同的define控制的分支。

看代码感觉最精巧的是用顶点色支持到256张贴图的操作了。以往的方法会使用一张IDMap，比如在Ghost Recon Wildland中，就是一个texel有一个id，混合的时候去采样周边texel的id，然后再做bilinear插值。

![img](http://ma-yidong.com/wp-content/uploads/2018/09/6-500x231.png)

在顶点上存ID的主要问题是，v2f会插值计算，这样像素上抓不到需要使用的ID。

MegaSplat巧妙用了一个mask的方式.

![img](http://ma-yidong.com/wp-content/uploads/2018/09/3-500x271.png)

每个顶点上存两个index，分别是这里混合的两层贴图的id，还会存一个顶点色，这个顶点色就是通道mask。

对于某一个三角形，三个vertex存的颜色分别是(1,0,0), (0,1,0), (0,0,1).

之后vertex shader里来做插值。

这里假设顶点色存的是上图的颜色，UV3的x是第一层id，UV3的y是第二层id，UV3的z是两层的混合强度

Vertex Shader

```glsl
struct Input{
    half3 vertexWeights;
    half3 index0;
    half3 index1;
    half blendWeight;
}

void vert(inout appdata v, out Input o){
    o.vertexWeights= v.color;
    o.index0 = v.color * v.texcoord2.x;
    o.index1 = v.color * v.texcoord2.y;
    o.blendWeight = v.texcoord2.z;
}
```



之后再surf/frag里面这样就可以了，用Input的index0除以vertexWeights，就得到了这个pixel所在的三角形，三个顶点处的ID，就可以来用它采样texturearray

```glsl
void surf(Input IN, inout SurfaceOutoutStandard o){
    half3 index0f = IN.index0 / IN.vertexWeights;
    half3 index1f = IN.index1 / IN.vertexWeights;
    int3 index0 =  round(index0f * 255);
    int3 index1 = round(index1f * 255);
 
    half3 diffuse0 =UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index0.x)) * IN.vertexWeights.x + 
                            UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index0.y)) * IN.vertexWeights.y + 
                            UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index0.z)) * IN.vertexWeights.z + 
 
    half3 diffuse1 =UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index1.x)) * IN.vertexWeights.x + 
                            UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index1.y)) * IN.vertexWeights.y + 
                            UNITY_SAMPLE_TEX2DARRAY(_Albedo, float3(uv, index1.z)) * IN.vertexWeights.z + 
 
    half3 diffuse = lerp(diffuse1, diffuse0, IN.blendWeight);
}
```

神奇的事情发生在顶点插值计算的时候，vertexWeights的通道特性决定了index0的xyz分别是该pixel所在的三角面上三个vertex的id，于是用这个id正好和vertexWeights进行混合

上面示例代码中，用了顶点色和UV3来存储mask和id，但其实可以pack起来，一套顶点色就能装下

```
x - 主贴图Index,0-255
y - 次贴图Index,0-255
z - 前三位是mask,100 010 001三种，vertexshader里面unpack作为interpolator;后五位是主次贴图blend权重，范围0-31，精度足够
```



以下就是一个用houdini procedural生成的地形，采用了这种splat的方式

![img](http://ma-yidong.com/wp-content/uploads/2018/09/4.png)