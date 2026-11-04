# htmlproofer 的本地替身
#
# htmlproofer 只在「检查外链」时才会真的发请求（typhoeus → ethon → ffi → libcurl）。
# Windows 上如果 ffi 加载不到 libcurl，连 `htmlproofer --version` 都会起不来；
# 而 CI 用的是 `--disable-external`，网络层根本用不到。
#
# 用法（PowerShell）：
#   $env:RUBYLIB="$PWD\tools\htmlproofer-stub"
#   bundle exec jekyll build --quiet
#   bundle exec htmlproofer "_site" --disable-external --ignore-urls "/^http:\/\/127.0.0.1/,/^http:\/\/0.0.0.0/,/^http:\/\/localhost/"
#
# Linux / macOS 上一般不需要它，直接 bash tools/test.sh 即可。

module Typhoeus
  VERSION = '1.4.1'

  class Response
    def initialize(_opts = {})
      @code = 200
    end

    def code
      @code
    end

    def headers
      {}
    end

    def return_code
      :ok
    end

    def body
      ''
    end

    def total_time
      0.0
    end
  end

  class Request
    def initialize(_opts = {})
    end

    def run
      Response.new
    end
  end

  class Hydra
    def initialize(_opts = {})
    end

    def add(_request)
    end

    def run
      []
    end
  end

  def self.get(*)
    Response.new
  end

  def self.head(*)
    Response.new
  end
end
