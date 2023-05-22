---
title: Unreal Python
date: 2022-07-01 12:26:08 +0800
categories: [Unreal,编辑器]
tags: []
---

# Unreal Python

- 构建可将虚幻编辑器与你在贵组织中使用的其他3D应用程序连接在一起的大型资源管理流程或工作流程。
- 在虚幻编辑器中使耗时的资源管理任务实现自动化，例如，为静态网格体生成细节级别（LOD）。
- 以程序化的方式将内容放置在关卡中。
- 从你自己在Python中创建的UI控制虚幻编辑器。

> 免编译！！！ 人生苦短

虚幻编辑器中的Python支持由 **Python编辑器脚本插件（Python Editor Script Plugin）** 提供。需要先为当前项目启用该插件，然后才能在编辑器中运行Python脚本。



### 代码调用

> https://docs.unrealengine.com/5.0/en-US/scripting-the-unreal-editor-using-python/

#### 命令行模式

- 编辑器都会在运行 Python 脚本后立即关闭
- 会启动GUI界面

  > ```bash
  > UE4Editor-Cmd.exe "C:\projects\MyProject.uproject" -ExecutePythonScript="c:\my_script.py"
  > ```
- CI模式

  > ```bash
  > UE4Editor-Cmd.exe "C:\projects\MyProject.uproject" -run=pythonscript -script="c:\\my_script.py"
  > ```



#### 编辑器模式

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16595822807101659582279762.png) 



#### 带参数调用

```bash
UE4Editor-Cmd.exe "C:\projects\MyProject.uproject" -run=pythonscript -script="c:\\my_script.py param1 param2"
```

```python
import sys
for arg in sys.argv:
	print(arg,flush=True)
	pass
# argv[0]: python_file_path
# argv[1:N]：args
```

### init_unreal.py 文件

如果编辑器在任何已配置其使用的路径中检测到名称为`init_unreal.py`的脚本文件（请参阅下面的"虚幻编辑器中的Python路径"），编辑器会立即运行该脚本。

如果你参与了一个项目或插件的开发工作，且知道使用该内容的每个人都需要在每次编辑器启动时运行相同的初始化代码，该方法非常有效。可以将初始化代码放在具有该名称的脚本中，并将脚本放在该项目或插件的 **Content/Python** 文件夹中。



### 处理资源

如果需要在项目中处理资源，请始终使用虚幻Python API中的函数来进行。绝不要使用Python中内置的文件管理模块来直接处理磁盘上的资源文件。例如，如果需要将资源移动到不同的文件夹中，不要使用Python函数，如`os.rename` or `shutil.move`。如果不遵守此规则，虚幻项目和资源中包含的内部内容引用可能会失效。

我们建议你使用编辑器脚本实用程序（Editor Scripting Utilities）插件提供的`unreal.EditorAssetLibrary` API，或虚幻Python API中内置的`unreal.AssetTools`类。



### 支持撤销和重复

```python
with unreal.ScopedEditorTransaction("My Transaction Test") as trans:
	#do something
    pass
```



### 进度条

```python
    total_frames = 10000000
    text_label = "Working!"
    with unreal.ScopedSlowTask(total_frames, text_label) as slow_task:
        slow_task.make_dialog(True)               # 如果对话不可见，使其可见
        for i in range(total_frames):
            if slow_task.should_cancel():# 如果用户已在UI中按了"取消（Cancel）"则为True
                break
            slow_task.enter_progress_frame(1)     # 使进度前进一帧。
            # 如果希望，也可以更新本调用中的对话文本。
            # 现在在此处执行针对当前帧的工作！
        pass
```



### 语法高亮 & 提示



1. **编辑器偏好设置（Editor Preferences）> 插件（Plugins）> Python**，选择 **开发人员模式（Developer Mode）**，之后重新启动编辑器。生成的存根文件将位于 **(ProjectDirectory)/Intermediate/PythonStub**
2. 前往 **设置（Settings）> 扩展（Extension）> Python** 并找到 **自动完成：更多路径（Auto Complete: Extra Paths）**。点击链接打开 **settings.json** 文件，将路径添加到 **python.autoComplete.extraPaths** 下的存根文件。

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16553652057441655365205312.png) 

![](https://fastly.jsdelivr.net/gh/Rootjhon/img_note@empty/16553652927471655365292667.png) 



### 代码调试

1. ```bash
   D:\Program Files\Epic Games\UE_5.0\Engine\Binaries\ThirdParty\Python3\Win64>python.exe -m pip install ptvsd
   ```

2. **Content/Python**/init_unreal.py

   > ```python
   > #!/usr/bin/env python
   > # -*- encoding: utf-8 -*-
   > """
   > @File    :   init_unreal.py
   > @Time    :   2022/06/17 16:45:00
   > @Author  :   JunQiang
   > @Contact :   354888562@qq.com
   > @Desc    :   
   > https://github.com/microsoft/ptvsd
   > """
   > 
   > # here put the import lib
   > import os
   > import ptvsd
   > import unreal
   > 
   > LOCAL_HOST = "127.0.0.1"
   > DEBUG_PORT = 8562
   > 
   > 
   > def Enable_attach(block_wait_attach: bool = False):
   >     print("Python enable_attach...", flush=True)
   >     log_dir = f"{unreal.Paths.project_dir()}/Log/ptvsd"
   >     os.makedirs(log_dir,exist_ok=True)
   >     ptvsd.enable_attach(address=(LOCAL_HOST, DEBUG_PORT),log_dir=log_dir)
   >     if block_wait_attach:
   >         print("Python wait_for_attach...", flush=True)
   >         ptvsd.wait_for_attach()  # blocks execution until debugger is attached
   >     pass
   > 
   > 
   > if __name__ == "__main__":
   >     Enable_attach()
   >     pass
   > 
   > ```

3. VS Code

   > launch.json
   >
   > ```json
   > {
   >     "version": "0.2.0",
   >     "configurations": [
   >         {
   >             "name": "Python: 远程连接",
   >             "type": "python",
   >             "request": "attach",
   >             "connect": {
   >                 "host": "localhost",
   >                 "port": 8562
   >             },
   >             "pathMappings": [
   >                 {
   >                     "localRoot": "${workspaceFolder}",
   >                     "remoteRoot": "${workspaceFolder}"
   >                 }
   >             ],
   >             "justMyCode": true
   >         }
   >     ]
   > }
   > ```

