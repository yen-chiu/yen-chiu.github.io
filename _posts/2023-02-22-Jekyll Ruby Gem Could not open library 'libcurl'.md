---
title: Jekyll Ruby Gem Could not open library 'libcurl'
date: 2023-02-22 08:30:36 +0800
categories: [博客建设, 异常处理]
tags: [writing]
---



## 问题

本地执行

```bash
bundle exec htmlproofer _site --disable-external --check-html --allow_hash_href
```



报错

```bash
C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ffi-1.15.5-x64-mingw-ucrt/lib/ffi/library.rb:145:in `block in ffi_lib': Could not open library 'libcurl': 找 不到指定的模块。\r (LoadError)
.
Could not open library 'libcurl.dll': 找不到指定的模块。\r
.
Could not open library 'libcurl.so.4': 找不到指定的模块。\r
.
Could not open library 'libcurl.so.4.dll': 找不到指定的模块。\r
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ffi-1.15.5-x64-mingw-ucrt/lib/ffi/library.rb:99:in `map'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ffi-1.15.5-x64-mingw-ucrt/lib/ffi/library.rb:99:in `ffi_lib'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curls/settings.rb:10:in `<module:Curl>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curls/settings.rb:3:in `<module:Ethon>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curls/settings.rb:2:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curl.rb:28:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curl.rb:28:in `<module:Curl>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curl.rb:14:in `<module:Ethon>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon/curl.rb:9:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon.rb:16:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/ethon-0.16.0/lib/ethon.rb:16:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/typhoeus-1.4.0/lib/typhoeus.rb:2:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/typhoeus-1.4.0/lib/typhoeus.rb:2:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer/url_validator.rb:3:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer/url_validator.rb:3:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer.rb:7:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer.rb:7:in `block in require_all'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer.rb:6:in `each'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer.rb:6:in `require_all'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/lib/html-proofer.rb:12:in `<top (required)>'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/bin/htmlproofer:8:in `require'
        from C:/Ruby31-x64/lib/ruby/gems/3.1.0/gems/html-proofer-3.19.4/bin/htmlproofer:8:in `<top (required)>'
        from C:/Ruby31-x64/bin/htmlproofer:25:in `load'
        from C:/Ruby31-x64/bin/htmlproofer:25:in `<main>'

```



## 解决方案

- 下载对应系统版本的 [curl](https://curl.se/download.html)  *(32bit/64bit)*
- 解压，获取 `bin/libcurl.dll`{: .filepath}*（**注意如果你有一个 64 位系统，dll 可能被称为 `libcurl-x64.dll`{: .filepath} 你必须将它重命名为 `libcurl.dll`{: .filepath}**）*并将它放入你的 ruby bin（对于我是 `C:/Ruby31-x64/bin`{: .filepath})
- 确保你的` ruby bin`{: .filepath} 在你的 Path 环境变量中





