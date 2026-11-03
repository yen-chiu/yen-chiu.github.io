---
title: 关于
icon: icon-info
order: 5
description: 关于 Wendell：数据分析、代码、阅读与生活，以及这个博客的更新日志。
---

{% assign post_count = site.posts.size %}
{% assign category_count = site.categories.size %}
{% assign tag_count = site.tags.size %}
{% assign changelog_count = site.data.changelog.size %}
{% assign now_ts = site.time | date: '%s' | plus: 0 %}
{% assign start_ts = site.uptime_since | date: '%s' | plus: 0 %}
{% assign uptime_days = now_ts | minus: start_ts | divided_by: 86400 %}

{% capture avatar_url %}{% include media-url.html src=site.avatar %}{% endcapture %}
{% assign avatar_url = avatar_url | strip %}

<div class="wx-about">
  <script>
    document.documentElement.classList.add('wx-reveal-ready');
    window.setTimeout(function () {
      if (!window.__wxAboutReady) {
        document.documentElement.classList.remove('wx-reveal-ready');
      }
    }, 2500);
  </script>

  <!-- 01 · 首屏 -->
  <section class="wx-about-hero" aria-labelledby="wx-about-title">
    <div class="wx-about-hero-main" data-wx-reveal>
      <p class="wx-about-eyebrow">
        <span class="wx-about-status-dot" aria-hidden="true"></span>
        Changsha · Data &amp; Code
      </p>

      <h1 class="wx-about-title" id="wx-about-title">
        你好，我是<br />
        <span class="wx-grad">Wendell</span>
      </h1>

      <p class="wx-about-typing" aria-hidden="true">
        <span class="wx-about-prompt">~$</span>
        <span class="wx-about-typing-text" data-wx-typing='["读书，买花，长大。","用 Python / R / MATLAB 做数据分析。","记录本身就是一种整理。"]'>读书，买花，长大。</span>
        <span class="wx-about-caret"></span>
      </p>

      <p class="wx-about-lede">
        一名做数据分析的业余编程爱好者，现旅居长沙。白天和数字、模型打交道，晚上折腾 Linux、博客和自动化小工具。
      </p>

      <div class="wx-about-actions">
        <a class="wx-about-btn wx-about-btn-primary" href="{{ '/archives/' | relative_url }}">
          <i class="iconfont icon-archive" aria-hidden="true"></i><span>读文章</span>
        </a>
        <a class="wx-about-btn" href="{{ '/feed.xml' | relative_url }}">
          <i class="iconfont icon-stream" aria-hidden="true"></i><span>RSS</span>
        </a>
        <a class="wx-about-btn" href="https://github.com/yen-chiu" target="_blank" rel="noopener">
          <i class="iconfont icon-github" aria-hidden="true"></i><span>GitHub</span>
        </a>
      </div>

      <ul class="wx-about-meta">
        <li><span aria-hidden="true">📍</span> 长沙</li>
        <li><span aria-hidden="true">🧪</span> 数据分析 / 建模仿真</li>
        <li><span aria-hidden="true">🕰</span> 写着第 <strong id="wx-about-days" data-since="{{ site.uptime_since }}">{{ uptime_days }}</strong> 天</li>
      </ul>
    </div>

    <aside class="wx-about-profile" data-wx-reveal aria-label="个人资料卡">
      <div class="wx-about-avatar-ring">
        <div class="wx-about-avatar" style="background-image: url('{{ avatar_url }}')" role="img" aria-label="Wendell 的头像"></div>
      </div>

      <p class="wx-about-profile-name">Wendell <span>@yen-chiu</span></p>
      <p class="wx-about-profile-bio">{{ site.tagline }}</p>

      <dl class="wx-about-profile-stats">
        <div>
          <dt>文章</dt>
          <dd data-wx-count="{{ post_count }}">{{ post_count }}</dd>
        </div>
        <div>
          <dt>分类</dt>
          <dd data-wx-count="{{ category_count }}">{{ category_count }}</dd>
        </div>
        <div>
          <dt>标签</dt>
          <dd data-wx-count="{{ tag_count }}">{{ tag_count }}</dd>
        </div>
      </dl>

      <a class="wx-about-profile-link" href="https://github.com/yen-chiu" target="_blank" rel="noopener">
        <span>在 GitHub 找到我</span>
        <span aria-hidden="true">↗</span>
      </a>

      <p class="wx-about-profile-foot">Jekyll · Chirpy · Cloudflare R2</p>
    </aside>
  </section>

  <!-- 02 · 关于我 -->
  <section class="wx-about-section" id="about" aria-labelledby="wx-about-about-title">
    <header class="wx-about-section-head">
      <div>
        <p class="wx-about-kicker">01 / About</p>
        <h2 class="wx-about-section-title" id="wx-about-about-title">关于我，和这个站</h2>
      </div>
      <a class="wx-about-head-link" href="#changelog">这个站最近改了什么 <span aria-hidden="true">↓</span></a>
    </header>

    <div class="wx-about-bento">
      <article class="wx-about-card wx-about-span-7" data-wx-reveal>
        <p class="wx-about-label">Who am I</p>
        <h3>把复杂的事，讲得简单一点。</h3>
        <p>
          我是 Wendell，一名做数据分析的业余编程爱好者，现旅居长沙。平时主要用
          Python / R / MATLAB 做数据分析与建模仿真，也折腾 Linux、博客和各类自动化小工具。
        </p>
        <p>
          我相信「记录本身就是一种整理」，于是有了这个长期维护的个人博客。这里不追热点，也不定更新频率，
          只把技术笔记、读书与生活里那些值得留下的片段，慢慢放进来。
        </p>
        <ul class="wx-about-tags" aria-label="兴趣与方向">
          <li>数据分析</li>
          <li>建模仿真</li>
          <li>Linux</li>
          <li>摄影</li>
          <li>阅读</li>
          <li>旅行</li>
        </ul>
      </article>

      <figure class="wx-about-card wx-about-card-quote wx-about-span-5" data-wx-reveal>
        <blockquote>我希望在这里的世界是豁达平静的。</blockquote>
        <figcaption>—《MyBlog》，2023.10</figcaption>
      </figure>

      <article class="wx-about-card wx-about-span-4" data-wx-reveal>
        <p class="wx-about-label">Now</p>
        <h3>最近在做</h3>
        <ul class="wx-about-now">
          <li>给博客做减法，把入口慢慢收拢</li>
          <li>用 Python / R / MATLAB 做数据分析与建模</li>
          <li>维护写作台、聊天页和一些自动化小工具</li>
          <li>读书、拍照，在长沙散步</li>
        </ul>
      </article>

      <article class="wx-about-card wx-about-span-4" data-wx-reveal>
        <p class="wx-about-label">Toolbox</p>
        <h3>常用工具</h3>
        <ul class="wx-about-skills" aria-label="常用工具">
          <li>Python</li>
          <li>R</li>
          <li>MATLAB</li>
          <li>Linux</li>
          <li>Git</li>
          <li>LaTeX</li>
          <li>Markdown</li>
          <li>Bash</li>
          <li>VS Code</li>
          <li>MySQL</li>
          <li>Jekyll</li>
          <li>Cloudflare</li>
        </ul>
      </article>

      <article class="wx-about-card wx-about-span-4" data-wx-reveal>
        <p class="wx-about-label">This site</p>
        <h3>这个站</h3>
        <dl class="wx-about-facts">
          <div><dt>框架</dt><dd>Jekyll + Chirpy</dd></div>
          <div><dt>托管</dt><dd>GitHub Pages</dd></div>
          <div><dt>媒体</dt><dd>Cloudflare R2</dd></div>
          <div><dt>写作台</dt><dd>自建 <code>/admin/</code></dd></div>
        </dl>
        <a class="wx-about-inline-link" href="#changelog">看更新日志 <span aria-hidden="true">→</span></a>
      </article>
    </div>
  </section>

  <!-- 03 · 最近在写 -->
  <section class="wx-about-section" id="writing" aria-labelledby="wx-about-writing-title">
    <header class="wx-about-section-head">
      <div>
        <p class="wx-about-kicker">02 / Writing</p>
        <h2 class="wx-about-section-title" id="wx-about-writing-title">最近在写</h2>
      </div>
      <a class="wx-about-head-link" href="{{ '/archives/' | relative_url }}">全部文章 <span aria-hidden="true">→</span></a>
    </header>

    <div class="wx-about-posts">
      {% for post in site.posts limit: 3 %}
        {% assign desc = post.description | default: post.content | strip_html | strip_newlines | truncate: 92 %}
        <a class="wx-about-post" href="{{ post.url | relative_url }}" data-wx-reveal>
          <div class="wx-about-post-top">
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%Y.%m.%d' }}</time>
            {% if post.categories.size > 0 %}<span>{{ post.categories | first }}</span>{% endif %}
          </div>
          <h3>{{ post.title }}</h3>
          <p>{{ desc | strip }}</p>
          <span class="wx-about-post-more">阅读 <span aria-hidden="true">→</span></span>
        </a>
      {% endfor %}
    </div>
  </section>

  <!-- 04 · 时间线 -->
  <section class="wx-about-section" id="journey" aria-labelledby="wx-about-journey-title">
    <header class="wx-about-section-head">
      <div>
        <p class="wx-about-kicker">03 / Journey</p>
        <h2 class="wx-about-section-title" id="wx-about-journey-title">一些时间点</h2>
      </div>
      <p class="wx-about-head-note">不着急，慢慢来。</p>
    </header>

    <ol class="wx-about-timeline">
      <li>
        <time datetime="{{ site.uptime_since | date_to_xmlschema }}">{{ site.uptime_since | date: '%Y.%m' }}</time>
        <h3>站点开始运行</h3>
        <p>从一台 Ubuntu 虚拟机开始，这个博客有了自己的地址。</p>
      </li>
      <li>
        <time datetime="2023-10-11">2023.10</time>
        <h3>写下《MyBlog》</h3>
        <p>写为什么想搭一个自己的网站，也写下「我希望在这里的世界是豁达平静的」。</p>
      </li>
      <li>
        <time datetime="2024-11-13">2024.11</time>
        <h3>继续折腾，也开始记录</h3>
        <p>解决 GitHub Pages 的引用路径问题，把踩过的坑写成笔记。</p>
      </li>
      <li>
        <time datetime="2026-11-03">2026.11</time>
        <h3>一次集中改版</h3>
        <p>设计令牌、动效、更新日志、写作台、R2 迁移，还有你现在看到的这一页。</p>
      </li>
    </ol>
  </section>

  <!-- 05 · 更新日志 -->
  <section class="wx-about-section" id="changelog" aria-labelledby="wx-about-changelog-title">
    <header class="wx-about-section-head">
      <div>
        <p class="wx-about-kicker">04 / Changelog</p>
        <h2 class="wx-about-section-title" id="wx-about-changelog-title">更新日志</h2>
      </div>
      <p class="wx-about-head-note">{{ changelog_count }} 条记录 · 最后更新 {{ site.data.changelog.first.date | date: '%Y.%m.%d' }}</p>
    </header>

    <div class="wx-about-changelog-card" data-wx-reveal>
      <p class="wx-about-changelog-intro">这个站最近在发生什么。一次发布记一条，不按 commit。</p>
      {% include changelog-list.html %}
    </div>

    <p class="wx-about-changelog-foot">
      <span>更早的改动都留在这条时间线里。</span>
      <a href="{{ '/feed.xml' | relative_url }}">订阅 RSS <span aria-hidden="true">→</span></a>
    </p>
  </section>

  <!-- 06 · 留言 -->
  <section class="wx-about-section wx-about-comments" id="comments" aria-labelledby="wx-about-comments-title">
    <header class="wx-about-section-head">
      <div>
        <p class="wx-about-kicker">05 / Say hi</p>
        <h2 class="wx-about-section-title" id="wx-about-comments-title">说点什么</h2>
      </div>
      <p class="wx-about-head-note">留言会同步到 GitHub Discussions。</p>
    </header>

    <p class="wx-about-comments-lede">
      如果你也在做类似的事，或者只是想打个招呼，欢迎在下面留句话。也可以
      <a href="mailto:{{ site.social.email }}">写信给我</a>。
    </p>

    <div
      class="wx-about-giscus"
      id="wx-about-giscus"
      data-repo="{{ site.comments.giscus.repo }}"
      data-repo-id="{{ site.comments.giscus.repo_id }}"
      data-category="{{ site.comments.giscus.category }}"
      data-category-id="{{ site.comments.giscus.category_id }}"
      data-mapping="{{ site.comments.giscus.mapping | default: 'pathname' }}"
    ></div>
  </section>

  <p class="wx-about-sign">
    <span>读书，买花，长大。</span>
    <span aria-hidden="true">— Wendell</span>
  </p>
</div>

<script src="{{ '/assets/js/about.js' | relative_url }}" defer></script>
