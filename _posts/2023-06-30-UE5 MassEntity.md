---
title: UE5 MassEntity
date: 2023-06-30 13:47:37 +0800
categories: [Unreal,Beginner]
tags: [ECS]
# Ref
# - https://www.youtube.com/watch?v=f9q8A-9DvPo&ab_channel=UnrealEngine
# - https://docs.unrealengine.com/5.0/en-US/overview-of-mass-entity-in-unreal-engine/
# - https://github.com/Megafunk/MassSample/
# - https://dev.epicgames.com/community/learning/tutorials/JXMl/unreal-engine-your-first-60-minutes-with-mass
# - https://www.bilibili.com/video/BV1nB4y1y7cX/?vd_source=fdb276fc298ea6fa0c6e79ca8cc45bfd
# - https://docs.unity3d.com/Manual/com.unity.entities.html
# - https://forum.unity.com/threads/why-ecs-make-things-faster.549739/
# - https://github.com/Rootjhon/OnAllFronts-Public
# - https://github.com/Rootjhon/UE5.2-MassEntityDemo
# - https://zhuanlan.zhihu.com/p/599364815
# - https://zhuanlan.zhihu.com/p/477803528
# - https://github.com/SanderMertens/ecs-faq#what-is-data-oriented-design
---



## Data-Oriented Design - 数据导向的设计

>  MassEntity is a gameplay-focused framework for data-oriented calculations.   ==> DOTS


 - 其他架构设计优先考虑开发便利性而非效率
 - 如何充分利用现代硬件性能：
   - Cache Memory 的访问效率比 主RAM的效率快几个量级
   - 避免 Cache misses 的发生
   - **使用连续的数据块填充 Cache Memory** 
   - 打包处理相似的数据块




## ECS术语 - Mass

| ECS       | Mass      |
| --------- | --------- |
| Entity    | Entity    |
| Component | Fragment  |
| System    | Processor |

在 Mass - ECS 中，

- `entity` 仅由  `fragments` 组成，`entity` 和`fragments` 都是纯数据元素，不包含任何逻辑；

- `entity` 实际上只是一个指向某些`fragments`的小的唯一标识符(简单的整数ID)；

- `Processor ` 是无状态类，为`fragments`提供处理逻辑；
  
  > ![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091211077.png)
  
  - 定义查询，执行数据运算；
  - eg. "movement" Processor : 可以查询拥有 `transform ` `velocity ` 的`entity`
  
- `archetypes` 指 内存中**相同**`fragment `紧密排列的数组，这确保了从内存中检索与相同原型的实体关联的片段时的最佳性能；

  > ![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091209339.png)



## 原型 - Archetype

>  Enity是Fragment和Tag的独特组合，这些组合称为原型

![大众原型定义](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091429960.png)

每个原型（`FMassArchetypeData`）使用 BitSet 来记录 Tag信息（`TScriptStructTypeBitSet<FMassTag>`），而位集中的每个位代表原型中是否存在标签。



### Fragment 在 Archetype 的内存组织形式

- 在 Archetype  中使用 `TArray<FMassArchetypeChunk>` 持有 fragment  数据
- 数据的组织方式采用 SoA *（[Structure of arrays](https://en.wikipedia.org/wiki/AoS_and_SoA#Structure_of_arrays)）*

![MassArchetypeChunks](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091524027.png)

#### 内存布局示意

![MassArchetypeMemory](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091535045.png)

分块的数据布局设计，使得允许大量的 整体Entity 放入 CPU Cache；

> - 如果在迭代实体时**仅**访问A 片段，则线性方法会很快
> - 但是，通常，当我们迭代实体时，倾向于访问多个片段，因此将它们全部放在缓存中会更高效

![海量原型缓存](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091537039.png)

## Entity's How to 

### Fragment 定义

- FMassFragment  定义的数据是每个实体各自拥有；

- FMassSharedFragment 定义的数据可以在多个实体间共享，通常用于一组实体通用的配置；
- FMassTag 可以看成是不带数据的Fragment，仅用于 Processer的查询过滤；

```c++
USTRUCT()
struct MASSBOIDSGAME_API FBoidsLocationFragment : public FMassFragment
{
	GENERATED_BODY()
	
	UPROPERTY()
	FVector Location;

	FBoidsLocationFragment()
		: Location(ForceInitToZero)
	{
	}
};
```



```c++
USTRUCT(BlueprintType)
struct MASSBOIDSGAME_API FBoidsMeshFragment : public FMassSharedFragment
{
	GENERATED_BODY()

	/** The render mesh for a boid */
	UPROPERTY(BlueprintReadWrite, EditAnywhere)
	UStaticMesh* BoidMesh;

	FBoidsMeshFragment()
		: BoidMesh(nullptr)
	{
	}
};
```



### 运行时创建与销毁

#### 最原始的操作

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

// Destroy
EntityManager->BatchDestroyEntityChunks(Collection);
```

#### 延迟创建 <常用/CommandBuffer> 

- 可以通过添加或删除片段或标签来更改实体的组成。**但是，在处理实体时更改实体的组成将导致该实体从一种原型移动到另一种原型。**

- 在当前处理批次结束时进行批处理

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

// Destroy
EntityManager->Defer().DestroyEntities(Entities);
EntityManager->Defer().DestroyEntity(Entity);

```

## Processor's How to 

- 过滤符合条件的数据实体
- 同时处理这块被打包的内存 => 这块内存是连续且相同类型，避免 Cache miss 的发生

### 如何注册 & 指定Processer的执行顺序

- bAutoRegisterWithProcessingPhases
- ExecutionFlags
- ExecuteAfter、ExecuteBefore
- ExecuteInGroup
- bRequiresGameThreadExecution 是否需要在主线程执行，Processer默认是多线程的

```c++
UBoidsBoundsProcessor::UBoidsBoundsProcessor(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	bAutoRegisterWithProcessingPhases = true;
	ExecutionFlags = (int32)EProcessorExecutionFlags::All;
    ProcessingPhase = EMassProcessingPhase::PrePhysics;
	ExecutionOrder.ExecuteAfter.Add(UBoidsRuleProcessor::StaticClass()->GetFName());
	ExecutionOrder.ExecuteBefore.Add(UBoidsRenderProcessor::StaticClass()->GetFName());
	ExecutionOrder.ExecuteInGroup = MassBoidsGame::ProcessorGroupNames::Boids;
    // This processor should not be multithreaded
    bRequiresGameThreadExecution = true;
}
```



```c++
UENUM()
enum class EMassProcessingPhase : uint8
{
	PrePhysics,
	StartPhysics,
	DuringPhysics,
	EndPhysics,
	PostPhysics,
	FrameEnd,
	MAX,
};
```



```c++
UENUM(meta = (Bitflags, UseEnumValuesAsMaskValuesInEditor = "true"))
enum class EProcessorExecutionFlags : uint8
{
	None = 0 UMETA(Hidden),
	Standalone = 1 << 0,
	Server = 1 << 1,
	Client = 1 << 2,
	Editor = 1 << 3,
	AllNetModes = Standalone | Server | Client UMETA(Hidden),
	All = Standalone | Server | Client | Editor UMETA(Hidden)
};
ENUM_CLASS_FLAGS(EProcessorExecutionFlags);
```





### 如何配置Processer处理的 Entity 查询集合

- EMassFragmentAccess - 指定数据的访问方式
- EMassFragmentPresence - 指定 fragment 在 Entity 的筛选规则
- 可以使用 Tag 来设计一些业务层面的查询隔离

```c++
void UBoidsBoundsProcessor::ConfigureQueries()
{
    // <BoidsBoundsProcessor.h>  FMassEntityQuery Entities ;
	Entities
		.AddRequirement<FBoidsLocationFragment>(EMassFragmentAccess::ReadOnly, EMassFragmentPresence::All)
		.AddRequirement<FMassVelocityFragment>(EMassFragmentAccess::ReadWrite, EMassFragmentPresence::All)
        .AddTagRequirement<FBoidsSpawnTag>(EMassFragmentPresence::Optional);
	Entities.RegisterWithProcessor(*this);
}
```


```c++
UENUM()
enum class EMassFragmentAccess : uint8
{
	/** no binding required */
	None, 

	/** We want to read the data for the fragment */
	ReadOnly,

	/** We want to read and write the data for the fragment */
	ReadWrite,

	MAX
};
```

```c++
UENUM()
enum class EMassFragmentPresence : uint8
{
	/** All of the required fragments must be present */
	All,

	/** One of the required fragments must be present */
	Any,

	/** None of the required fragments can be present */
	None,

	/** If fragment is present we'll use it, but it missing stop processing of a given archetype */
	Optional,

	MAX
};
```



### 对查询后的Entity执行业务逻辑

> *在 UE 5.2 版本中 Mass 的框架废弃了 ParallelForEachEntityChunk 的 支持，如有并行话的需求需要自己处理好数据的关联，并使用 `ParallelFor`;*

- 此时被处理的这些 Entity在内存中是连续的
- **注意** ： 返回的数据顺序并不是稳定的，因此不能缓存 idx的方式来记录某个特征

```c++

void UBoidsBoundsProcessor::Execute(FMassEntityManager& EntitySubsystem, FMassExecutionContext& Context)
{
	QUICK_SCOPE_CYCLE_COUNTER(STAT_BoidsBoundsProcessor);
	
	Entities.ForEachEntityChunk(EntitySubsystem, Context, [this] (FMassExecutionContext& Context)
	{
		const TArrayView<FMassVelocityFragment> Velocities = Context.GetMutableFragmentView<FMassVelocityFragment>();
		const TConstArrayView<FBoidsLocationFragment> Locations = Context.GetFragmentView<FBoidsLocationFragment>();

		const int32 NumEntities = Context.GetNumEntities();
		const float& TurnRate = BoidsSettings->TurnBackRate;

		ParallelFor(NumEntities, [this, &Velocities, &Locations, &TurnRate](int32 Ndx)
			{
				const FVector& Location = Locations[Ndx].Location;
				FVector& Velocity = Velocities[Ndx].Value;

				// ...
			});
	});
}

```



## MassGamePlay Framework

### 相关的插件

- Mass Entity
- Mass AI
- Mass GamePlay
- Mass Crowd

> ![image-20231009112245039](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091122602.png)



### Mass是如何设计 数据导向 的架构？

- Mass 会管理 Entity 的不同代理；
- Entity 会有 若干个 Trait *(特征)*；
  - 可以把这些 Entity 看成是轻量级的Actor
  - Trait 看成是轻量级的 Component
  - 以上说法不严谨，因为 Entity 和Trait 没有函数，只用定义
- 一系列的Trait 组成的 Entity 被称为 Archetype *（原型）*
- 实际的数据存放在 Fragment *（片段）* 中
- Fragment 数据处理业务在 Processer 的函数中被执行

![16884637104601688463709522.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16884637104601688463709522.png)

### 如何使用 Mass GamePlay框架

- MassSpawner
  - Entity Types
    - MassEntityConfigAsset
      - MassEntityTraitBase
  - Spawn Data Generators
    - MassEntitySpawnDataGeneratorBase

#### Trait

**蓝图配置**

![MassEntityConfigAsset](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091553883.jpeg)

在 Mass 提供的许多内置特征中，我们可以找到该`Assorted Fragments`特征，它包含一个数组，`FInstancedStruct`可以从编辑器向该特征添加片段，而无需创建新的 C++  Trait 类。

![Assorted Fragments](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202310091554541.jpeg)

**C++ 新增 Trait**

```c++
// ---- .h
UCLASS(BlueprintType)
class MASSBOIDSGAME_API UBoidsTrait : public UMassEntityTraitBase
{
	GENERATED_BODY()
	
	UPROPERTY(Category="Boids", EditAnywhere)
	FBoidsSpeedFragment Speed;

	UPROPERTY(Category="Boids", EditAnywhere)
	FBoidsMeshFragment Mesh;
	
	// ~ begin UMassEntityTraitBase interface
	//virtual void BuildTemplate(FMassEntityTemplateBuildContext& BuildContext, UWorld& World) const override;
	virtual void BuildTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World) const override;
    virtual void ValidateTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World)const override;
	// ~ end UMassEntityTraitBase interface
};

//----- .cpp

void UBoidsTrait::BuildTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World) const
{
	//UMassEntitySubsystem* EntitySubsystem = UWorld::GetSubsystem<UMassEntitySubsystem>(&World);
	//check(EntitySubsystem);

	TSharedPtr<FMassEntityManager> EntityManager = World.GetSubsystem<UMassEntitySubsystem>()->GetMutableEntityManager().AsShared();

	BuildContext.AddTag<FBoidsSpawnTag>();
	BuildContext.AddFragment<FBoidsLocationFragment>();
	BuildContext.AddFragment<FMassVelocityFragment>();
	BuildContext.AddFragment(FConstStructView::Make(Speed));

	// Mesh Shared Fragment
	{
		const uint32 SharedHash = UE::StructUtils::GetStructCrc32(FConstStructView::Make(Mesh));
		//const FConstSharedStruct SharedFragment = EntitySubsystem->GetOrCreateConstSharedFragment(SharedHash, Mesh);
		const FConstSharedStruct SharedFragment = EntityManager->GetOrCreateConstSharedFragmentByHash(SharedHash, Mesh);

		BuildContext.AddConstSharedFragment(SharedFragment);
	}
}
//为特征提供自定义验证代码
void UBoidsTrait::ValidateTemplate(FMassEntityTemplateBuildContext& BuildContext, const UWorld& World) const
{
	// If BoidMesh is null, show an error!
	if (!Mesh.BoidMesh)
	{
		UE_VLOG(&World, LogMass, Error, TEXT("BoidMesh is null!"));
		return;
	}
}
```



## Mass Debugger

> 相对于 Unity的DebuggerWindows 提供的信息较为简陋，若架构设计中重度依赖需要扩展相关信息的展示于收集便于性能分析

### Archetypes

- EntitiesCount
- EntitiesCountPerChunk 
  - 每个Chunk可以容纳的Entity数量
- ChunksCount
- Allocated memory
- Fragments、Tags、Shared Fragments
- 总原型数量

![16969113972291696911396373.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16969113972291696911396373.png)

### Processors

- Query的相关信息
  - 绿色表示 要求 fragment 是读写访问，灰色为只读
- Processer 间的依赖关系

![16969116132311696911612426.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16969116132311696911612426.png)

### Processing Graphs

- Processer 运行的时机分组
- 当前Processer的运行路径

![16969114352361696911435181.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16969114352361696911435181.png)



## Replication

>  这部分的资料相对较少

主要通过 `CalculateClientReplication` 函数传入 负责CRUD的回调函数 *（Create、Read、Update、Delete）*

相关源码参照

- UMassReplicatorBase
  - UMassCrowdReplicator

> ![16969108782291696910877372.png](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16969108782291696910877372.png)



![MassReplication相关文件](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16969100262291696910025938.png)



![img](https://raw.githubusercontent.com/Rootjhon/img_note/empty/202307201805955.png)
