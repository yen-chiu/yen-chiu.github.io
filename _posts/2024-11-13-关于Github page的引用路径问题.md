---
title: 关于Github page的引用路径问题
date: 2024-11-13 18:57:46 +0800
categories: [Blog,路径]
tags: [Bug]
---

1.使用相对路径
- 在你需要插入图片的位置使用Markdown语法：`![图片描述](相对路径)`。
- 相对路径是相对于Markdown文件的当前位置来指定图片位置。例如，如果你的博客文件位于_posts文件夹下，图片位于images文件夹下，那么相对路径应为：`![图片描述](../images/图片文件名.jpg)`。
- 如果图片位于上级目录中，使用 .. 来回退到上级目录。例如，../images/photo.jpg。
<!-- ![](../images/img-post/2023/维纳斯.jpg)  -->

2.使用绝对路径
- 在你需要插入图片的位置使用Markdown语法：`![图片描述](绝对路径)`。
- 绝对路径是指图片的完整URL路径。你可以将图片上传到图床（如imgur、sm.ms等）并获取其外链URL，然后使用该URL作为绝对路径插入图片。
- 绝对路径可以直接引用图片的链接地址。例如，可以使用以下代码引用图片：`![图片描述](https://example.com/images/图片文件名.jpg)`。
<!-- ![]({{site.baseurl}}/img-post/2023/维纳斯.jpg) -->

3.用GitHub的相对路径
- 在你需要插入图片的位置使用Markdown语法：`![图片描述](GitHub仓库相对地址)`。
- GitHub会自动将该地址与仓库的根目录拼接，从而获取到正确的图片URL。例如：`![图片描述](images/图片文件名.jpg)`。
<!-- ![](images/img-post/2023/维纳斯.jpg)  -->

4.使用GitHub仓库中的Issue引用图片
- 将图片上传到GitHub仓库的Issue中，然后在博客文章中使用Issue引用图片。首先，在GitHub仓库的Issue中创建一个新的Issue，并将图片作为附件上传。然后，在博客文章中使用以下代码引用该图片：`![图片描述](https://github.com/用户名/仓库名/issues/Issue编号/附件名)`。

5. 使用GitHub仓库中的图片链接
- 将图片上传到GitHub仓库的某个文件夹中，并获取该图片的链接地址。然后，在博客文章中使用以下代码引用该图片：`![图片描述](https://raw.githubusercontent.com/用户名/仓库名/分支名/文件夹名/图片文件名.jpg)`。
<!-- ![](https://raw.githubusercontent.com/XiaoWendell/XiaoWendell.github.io/master/images/img-post/2023/维纳斯.jpg "维纳斯") -->

6. 使用第三方图床服务
- 除了在GitHub仓库中存储图片，还可以使用第三方的图床服务来存储图片。上传图片到图床服务后，获取图片的链接地址，然后在博客文章中使用该链接地址引用图片。