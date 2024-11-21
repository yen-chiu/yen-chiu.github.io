# 粘贴图片

直接从剪贴板粘贴图片到 markdown/asciidoc（或其他文件）！
**支持 Mac/Windows/Linux！**并支持配置目标文件夹。
![粘贴图片](https://raw.githubusercontent.com/mushanshitiancai/vscode-paste-image/master/res/vscode-paste-image.gif)
现在可以启用 `pasteImage.showFilePathConfirmInputBox` 来在保存前修改文件路径：
[confirm-inputbox](https://raw.githubusercontent.com/mushanshitiancai/vscode-paste-image/master/res/confirm-inputbox.png)

## 使用方法

1. 截取屏幕到剪贴板
2. 打开命令调板： `Ctrl+Shift+P` (Mac 上为 `Cmd+Shift+P`)
3. 输入 “粘贴图像 "或使用默认键盘绑定： `Ctrl+Alt+V` （Mac 上为 `Cmd+Alt+V`）。
4. 图像将保存在包含当前编辑文件的文件夹中
5. 相对路径将粘贴到当前编辑文件

## 配置

- 图片默认名称
  默认图像文件名。
  此配置的值将传递给 moment 库（一个 js 时间处理库）的'format'函数，你可以阅读文档 https://momentjs.com/docs/#/displaying/format/ 了解高级用法。
  您还可以使用变量
  - `${currentFileName}`：当前文件名，带扩展名。
  - `${currentFileNameWithoutExt}`：当前文件名，不带扩展名。
    默认值为 `Y-MM-DD-HH-mm-ss`。
- 图片粘贴路径
  保存图像文件的路径。
  可以使用变量：
  - ${currentFileDir}：包含当前编辑文件的目录路径。
  - ${projectRoot}`： 在 vscode 中打开的项目路径。
  - `${currentFileName}`：当前文件名，带扩展名。
  - `${currentFileNameWithoutExt}`：当前文件名，不含扩展名。
    默认值为 `${currentFileDir}`。
- `pasteImage.basePath`（粘贴图片的基本路径
  图片 url 的基本路径。
  可以使用变量
  - `${currentFileDir}`：当前编辑文件所在目录的路径。
  - `${projectRoot}`：在 vscode 中打开的项目路径。
  - `${currentFileName}`：当前文件名，带扩展名。
  - `${currentFileNameWithoutExt}`：当前文件名，不含扩展名。
    默认值为 `${currentFileDir}`。
- `pasteImage.forceUnixStyleSeparator`：强制设置文件分隔符样式为 “取消”。
  强制设置文件分隔符为 unix 风格。如果设置为 false，分隔符样式将沿用系统样式。
  默认为 `true`。
- `pasteImage.prefix`前缀
  粘贴前预置到已解析图像路径的字符串。
  默认为`“”`。
- `pasteImage.suffix` 后缀
  粘贴前添加到已解析图像路径的字符串。
  默认为`“”`。
- `pasteImage.encodePath` 在粘贴前对已解析的图像路径进行编码的字符串。
  插入编辑器前对图片路径的编码方式。支持选项：
  - `none`：什么也不做，只插入图像路径到文本中
  - `urlEncode`：对整个图像路径进行 url 编码
  - `urlEncodeSpace`：url 只编码空格字符（空格至 %20）
    默认为 `urlEncodeSpace`.
- `pasteImage.namePrefix`名称前缀
  图像文件名的前缀字符串。
  可以使用变量

  - `${currentFileDir}`：包含当前编辑文件的目录路径。
  - `${projectRoot}`：在 vscode 中打开的项目路径。
  - `${currentFileName}`：当前文件名，带扩展名。
  - `${currentFileNameWithoutExt}`：当前文件名，不含扩展名。
    默认为 `“”`。

- `pasteImage.nameSuffix`

附加到图像名称的字符串。

您可以使用变量：

- `${currentFileDir}`：包含当前编辑文件的目录的路径。

- `${projectRoot}`：在 vscode 中打开的项目的路径。

- `${currentFileName}`：带扩展名的当前文件名。

- `${currentFileNameWithoutExt}`：不带扩展名的当前文件名。

默认值为 `""`。

- `pasteImage.insertPattern`

粘贴到文本的字符串模式。

您可以配置替代文本和文件路径。

例如，`![${imageFileNameWithoutExt}](${imageFilePath})` 将添加文件名作为替代文本，而不是默认值（空白）。

您可以使用以下变量：

- `${imageFilePath}`：图片文件路径，带有 `pasteImage.prefix`、`pasteImage.suffix` 和 url 编码。
- `${imageOriginalFilePath}`：图片文件路径。
- `${imageFileName}`：带扩展名的图片文件名。
- `${imageFileNameWithoutExt}`：不带扩展名的图片文件名。
- `${currentFileDir}`：包含当前编辑文件的目录路径。
- `${projectRoot}`：在 vscode 中打开的项目路径。
- `${currentFileName}`：带扩展名的当前文件名。
- `${currentFileNameWithoutExt}`：不带扩展名的当前文件名。
- `${imageSyntaxPrefix}`: 在 markdown 文件中为 <code>![](</code>，在 asciidoc 文件中为 <code>image::</code>，在其他文件中为空字符串
- `${imageSyntaxSuffix}`: 在 markdown 文件中为 <code>)</code>，在 asciidoc 文件中为 <code>[]</code>，在其他文件中为空字符串

默认为 `${imageSyntaxPrefix}${imageFilePath}${imageSyntaxSuffix}`。

- `pasteImage.showFilePathConfirmInputBox`

启用此 `boolean` 设置将使 Paste Image 要求您确认文件路径（或文件名）。如果您想更改当前粘贴的图像的文件路径，这将非常有用。默认值为 `false`。

- `pasteImage.filePathConfirmInputBoxMode`

- `fullPath`: 在输入框中显示完整路径，因此您可以更改路径或名称。默认值。
- `onlyName`: 在输入框中仅显示文件名，因此可以轻松更改名称。

## 配置示例

我使用 vscode 编辑我的 hexo 博客。文件夹结构如下：

```
blog/source/_posts (文章)
blog/source/img (图片)
```

我想将所有图片保存在 `blog/source/img` 中，并将图片网址插入文章。而 hexo 会生成 `blog/source/` 作为网站根目录，因此图片网址应该是 `/img/xxx.png`。因此，我可以像这样在`blog/.vscode/setting.json`中配置 pasteImage：

```
"pasteImage.path": "${projectRoot}/source/img",
"pasteImage.basePath": "${projectRoot}/source",
"pasteImage.forceUnixStyleSeparator": true,
"pasteImage.prefix": "/"
```

如果您想将图像保存在单独的目录中：

```
"pasteImage.path": "${projectRoot}/source/img/${currentFileNameWithoutExt}",
"pasteImage.basePath": "${projectRoot}/source",
"pasteImage.forceUnixStyleSeparator": true,
"pasteImage.prefix": "/"
```

如果您想以文章名称作为前缀保存图像：

```
"pasteImage.namePrefix": "${currentFileNameWithoutExt}_",
"pasteImage.path": "${projectRoot}/source/img",
"pasteImage.basePath": "${projectRoot}/source",
"pasteImage.forceUnixStyleSeparator": true,
"pasteImage.prefix": "/"
```

如果您想在 markdown 中使用 html：

```
"pasteImage.insertPattern": "<img>${imageFileName}</img>"
"pasteImage.path": "${projectRoot}/source/img",
"pasteImage.basePath": "${projectRoot}/source",
"pasteImage.forceUnixStyleSeparator": true,
"pasteImage.prefix": "/"
```

## 格式

### 文件名格式

如果您在编辑器中选择了一些文本，则扩展程序将使用它作为图像文件名。 **选定的文本可以是子路径，如 `subFolder/subFolder2/nameYouWant`。**

如果不是，图像将以以下格式保存：“Y-MM-DD-HH-mm-ss.png”。您可以通过 `pasteImage.defaultName` 配置默认图像文件名。

### 文件链接格式

当您编辑 markdown 时，它将粘贴为 markdown 图像链接格式 `![](imagePath)`。

当您编辑 asciidoc 时，它将粘贴为 asciidoc 图像链接格式 `image::imagePath[]`。

在其他文件中，它只粘贴图像的路径。

现在您可以使用配置 `pasteImage.insertPattern` 来配置文件链接和替代文本的格式。

## 联系

如果您有任何问题或建议，欢迎访问 [issue](https://github.com/mushanshitiancai/vscode-paste-image/issues)

## TODO

- [x] 支持 win (by @kivle)
- [x] 支持 linux
- [x] 支持使用所选文本作为图像名称
- [x] 支持配置 (@ysknkd in #4)
- [x] 支持配置相对/绝对路径 (@ysknkd in #4)
- [x] 支持 asciidoc
- [x] 支持在配置中使用变量 ${projectRoot} 和 ${currentFileDir}
- [x] 支持配置 basePath
- [x] 支持配置 forceUnixStyleSeparator
- [x] 支持配置前缀
- [x] 支持配置后缀
- [x] 支持在配置中使用变量 ${currentFileName} 和 ${currentFileNameWithoutExt}
- [x] 支持检查目标目录是否为文件
- [x] 支持选择文本作为具有多个新目录的子路径，如 `a/b/c/d/imageName` 或`../a/b/c/d/imageName`
- [x] 支持配置默认图像名称模式
- [x] 支持配置文本格式
- [x] 支持文件路径确认框 (by @DonMartin76)

## 许可证

扩展和源代码根据 [MIT 许可证](LICENSE.txt) 获得许可。
