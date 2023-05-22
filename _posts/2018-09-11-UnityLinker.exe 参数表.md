---
title: UnityLinker.exe 参数表
date: 2018-09-11 22:41:00 +0800
categories: [Unity,构建]
tags: [UnityLinker]
---

# UnityLinker

| Options                             | 描述                                                         |
| :---------------------------------- | :----------------------------------------------------------- |
| --search-directory=<value,value,..> | Add a directory where the linker will look for assemblies    |
| --descriptor-directory=<value>      | Add a directory where the linker will look for descriptor files |
| --out=<value>                       | Specify the output directory, default to `output'            |
| --core-action=<value>               | Action on the core assemblies, skip, copy or link, default to skip |
| --custom-step=<value,value,..>      | Add a new step to the pipeline.                              |
| --include-link-xml=<value,value,..> | Link from an XML descriptor                                  |
| --include-assembly=<value,value,..> | Link from a list of assemblies                               |
| --include-x-api=<value,value,..>    | Link from an mono-api-info descriptor                        |
| --i18n=<value>                      | List of i18n assemblies to copy to the output directory. Separated with a comma: none,all,cjk,mideast,other,rare,west. Default is all |
| --link-symbols                      | Enables generation of debug symbols for each linked module   |
| --disable-regen-guid                | Disables generation of a new unique guid for each linked module |
| --disable-keep-facades              | Disables keeping facade assemblies                           |
| --version                           | Print the version number                                     |
| --api=<value>                       | The .NET API version of the assemblies                       |
| --enable-report                     | Enables generation of a preservation report.                 |