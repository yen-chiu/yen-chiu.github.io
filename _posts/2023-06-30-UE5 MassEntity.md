---
title: UE5 MassEntity
date: 2023-06-30 13:47:37 +0800
categories: [Unreal,Beginner]
tags: [ECS]
# Ref
# - https://www.youtube.com/watch?v=f9q8A-9DvPo&ab_channel=UnrealEngine
# - https://docs.unrealengine.com/5.0/en-US/mass-entity-in-unreal-engine/
# - https://github.com/Megafunk/MassSample/
# - https://dev.epicgames.com/community/learning/tutorials/JXMl/unreal-engine-your-first-60-minutes-with-mass
# - https://www.bilibili.com/video/BV1nB4y1y7cX/?vd_source=fdb276fc298ea6fa0c6e79ca8cc45bfd
# - https://docs.unity3d.com/Manual/com.unity.entities.html
# - https://forum.unity.com/threads/why-ecs-make-things-faster.549739/
# - https://github.com/Rootjhon/OnAllFronts-Public
# - https://github.com/Rootjhon/UE5.2-MassEntityDemo
# - https://zhuanlan.zhihu.com/p/599364815

---



![16884637104601688463709522.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16884637104601688463709522.png)



MassEntity is a gameplay-focused framework for data-oriented calculations.



## Mass术语

| ECS       | Mass      |
| --------- | --------- |
| Entity    | Entity    |
| Component | Fragment  |
| System    | Processor |



在 ECS 中，

- `entity` 仅由  `fragments` 组成
- `entity` 实际上只是一个指向某些`fragments`的小的唯一标识符(简单的整数ID)
- `Processor ` 定义一个查询，仅过滤具有特定片段的实体
  - "movement" Processor : 可以查询拥有 `transform ` `velocity ` 的`entity`
- `archetypes` 指 内存中相同`fragment `紧密排列的数组



## 流程



## Entity's How to 

### 直接创建

```c++
// Get EntityManager
TSharedPtr<FMassEntityManager> EntityManager = World->GetSubsystem<UMassEntitySubsystem>()->GetMutableEntityManager().AsShared();

// CreateArchetype
FMassArchetypeHandle MoverArchetype =  EntityManager->CreateArchetype(
{
    FTransformFragment::StaticStruct(),
    FMassVelocityFragment::StaticStruct()
});

// CreateEntity by Archetype
FMassEntityHandle NewEntity = EntityManager->CreateEntity(MoverArchetype);

// Add Tag
EntityManager->AddTagToEntity(NewEntity,FMSGravityTag::StaticStruct());
// Add Fragment
EntityManager->AddFragmentToEntity(NewEntity,FSampleColorFragment::StaticStruct());


// changing NewEntity's data on a fragment
EntityManager->GetFragmentDataChecked<FMassVelocityFragment>(NewEntity).Value = FMath::VRand()*100.0f;
EntityManager->GetFragmentDataChecked<FSampleColorFragment>(NewEntity).Color = FColor::Blue;


```

### 延迟创建 <常用/CommandBuffer> 

```c++
// We reserve an entity here, this way the system knows not to give this index out to other processors/deferred actions etc
FMassEntityHandle ReserverdEntity = EntityManager->ReserveEntity();

FTransformFragment MyTransformFragment;
MyTransformFragment.SetTransform(FTransform::Identity);

FSampleColorFragment MyColorFragment;

// We build a new entity and add fragments to it in one command!
EntityManager->Defer().PushCommand<FMassCommandBuildEntity>(ReserverdEntity,MyColorFragment);


// Flush the commands so this new entity is actually around
EntityManager->FlushCommands();


// Sets fragment data on an existing entity
EntityManager->Defer().PushCommand<FMassCommandAddFragmentInstances>(ReserverdEntity,MyColorFragment,MyTransformFragment);


// Reserve yet another entity...
ReserverdEntity = EntityManager->ReserveEntity();

FMSExampleSharedFragment SharedFragmentExample;
SharedFragmentExample.SomeKindaOfData = FMath::Rand() * 10000.0f;
FMassArchetypeSharedFragmentValues SharedFragmentValues;

// This is what traits use to create their shared fragment info as well
FConstSharedStruct& SharedFragmentSharedStruct = EntityManager->GetOrCreateConstSharedFragment(SharedFragmentExample);
SharedFragmentValues.AddConstSharedFragment(SharedFragmentSharedStruct);

EntityManager->Defer().PushCommand<FMassCommandBuildEntityWithSharedFragments>(ReserverdEntity, MoveTemp(SharedFragmentValues), MyTransformFragment, MyColorFragment);


```



## How to Query Entity



## How to Execute Business



## Why ECS make things faster

- Cache Memory > Main RAM



## Replication

![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202307201805955.png)
