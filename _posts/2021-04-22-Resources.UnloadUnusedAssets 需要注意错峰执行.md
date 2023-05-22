---
title: Resources.UnloadUnusedAssets 需要注意错峰执行
date: 2021-04-22 22:41:00 +0800
categories: [Unity,性能优化]
tags: [资源管理]
---

场景objects数量在Loading进战场时达到118060，此时触发`UnloadUnusedAssets`，引擎通过`FindAllLiveObjects`收集所有Object，并为其建立ObjectState结构，每个ObjectState 20个字节，`20*118060=2.25M`

其后调用`CreateObjectToIndexMappingFromNonRootObjects`并分配 2倍的内存的Dictionary空间`（2*2.25M=4.5M）`，把`FindAllLiveObjects`的ObjectState插入临时变量里以供后面使用

所以`UnloadUnusedAssets`时产生了约**6.75M**内存

```c++
struct ObjectState
{
    Object* object;
    RuntimeTypeIndex typeIndex : 29;
    UInt32  marked        : 1;
    UInt32  isPersistent  : 1;
    UInt32  dontUnload      : 1;
};
```

```c++
#if ASSET_REMAP_TABLE
static void CreateObjectToIndexMappingFromNonRootObjects(GarbageCollectorState& gcState)
{
    PROFILER_AUTO(gGCBuildLiveObjectMaps, NULL);

    gcState.instanceIDToIndex.set_empty_key(-1);
    gcState.instanceIDToIndex.set_deleted_key(-2);

    SInt32 largestInstanceID = 0;

    for (size_t i = 0; i < gcState.liveObjects.size(); ++i)
    {
        ObjectState& state = gcState.liveObjects[i];
        if (state.marked == 0)
        {
            int instanceID = state.object->GetInstanceID();

            if (instanceID > 0)
            {
                largestInstanceID = std::max<SInt32>(largestInstanceID, instanceID);
            }
            else
            {
                gcState.instanceIDToIndex.insert(std::make_pair(instanceID, i));
            }
        }
    }

    // Cap the memory of dense assetRemapTable
    if (largestInstanceID < (kMaximumAssetRemapTableSize / sizeof(UInt32)))
    {
        gcState.assetRemapTable.resize_initialized(largestInstanceID + 1, -1);
        for (size_t i = 0; i < gcState.liveObjects.size(); ++i)
        {
            ObjectState& state = gcState.liveObjects[i];
            if (state.marked == 0)
            {
                int instanceID = state.object->GetInstanceID();

                if (instanceID > 0)
                    gcState.assetRemapTable[instanceID] = i;
            }
        }
    }
    // Use hashtable for all instance ids as a fallback
    else
    {
        for (size_t i = 0; i < gcState.liveObjects.size(); ++i)
        {
            ObjectState& state = gcState.liveObjects[i];
            if (state.marked == 0)
            {
                int instanceID = state.object->GetInstanceID();

                if (instanceID > 0)
                    gcState.instanceIDToIndex.insert(std::make_pair(instanceID, i));
            }
        }
    }
}

#else
static void CreateObjectToIndexMappingFromNonRootObjects(GarbageCollectorState& gcState)
{
    gcState.instanceIDToIndex.reserve(gcState.liveObjects.size() * 2);

    for (int i = 0; i < gcState.liveObjects.size(); ++i)
    {
        ObjectState& state = gcState.liveObjects[i];
        if (state.marked == 0)
        {
            InstanceID instanceID = state.object->GetInstanceID();

            gcState.instanceIDToIndex.insert(instanceID, i);
        }
    }
}

#endif
```