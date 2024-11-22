# 使用 extensions.json 文件

## 简介

`extensions.json` 是一个配置文件，用于在 Visual Studio Code (VSCode) 中管理和安装扩展。通过编辑这个文件，你可以批量安装、更新或卸载扩展，而无需手动在 VSCode 的扩展市场中进行操作。

## 文件结构

一个典型的 `extensions.json` 文件包含以下字段:

- `recommendations`: 推荐的扩展列表。
- `unwantedRecommendations`: 不希望推荐的扩展列表。
- `extensionsGallery`: 扩展市场的配置信息。

### 示例

```json
{
  "recommendations": [
    "ms-python.python",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
  ],
  "unwantedRecommendations": ["ms-vscode.cpptools"],
  "extensionsGallery": {
    "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
    "cacheUrl": "https://vscode.blob.core.windows.net/gallery/index",
    "itemUrl": "https://marketplace.visualstudio.com/items"
  }
}
```

## 使用方法

### 1. 创建或编辑 `extensions.json` 文件

在你的项目根目录下创建一个名为 `extensions.json` 的文件，或者编辑已有的文件。

### 2. 添加推荐扩展

在 `recommendations` 数组中添加你想要推荐的扩展 ID。例如:

```json
"recommendations": [
    "ms-python.python",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
]
```

### 3. 添加不希望推荐的扩展

在 `unwantedRecommendations` 数组中添加你不希望推荐的扩展 ID。例如:

```json
"unwantedRecommendations": [
    "ms-vscode.cpptools"
]
```

### 4. 配置扩展市场（可选）

如果你需要自定义扩展市场的 URL，可以在 `extensionsGallery` 对象中进行配置。例如:

```json
"extensionsGallery": {
    "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
    "cacheUrl": "https://vscode.blob.core.windows.net/gallery/index",
    "itemUrl": "https://marketplace.visualstudio.com/items"
}
```

### 5. 保存并应用配置

保存 `extensions.json` 文件后，VSCode 会自动读取和应用这些配置。你可以在 VSCode 的扩展视图中查看和管理这些扩展。

![](https://raw.githubusercontent.com/XiaoWendell/XiaoWendell.github.io/master/_posts/images/使用%20extensions.json%20文件/2024-11-21-11-04-04.png)

```
团队其他成员拉代码后, 打开vscode, 依次点击1,2,3, 会自动输入@recommended,
工作区推荐的插件就是.vscode/extensions.json文件推荐的。
```

## 注意事项

- 确保扩展 ID 是正确的，否则会导致安装失败。
- 如果你的项目是公开的，请谨慎处理敏感信息，如 API 密钥等。
- 定期更新 `extensions.json` 文件以保持扩展的最新状态。
