---
title: 关于
icon: icon-info
order: 5
hide_panel: true
description: 关于 Wendell：数据分析、代码、阅读与生活，以及这个博客的更新日志。
---

{% assign visible_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% assign post_count = visible_posts.size %}
{% assign visible_categories = '' | split: '' %}
{% assign visible_tags = '' | split: '' %}
{% for post in visible_posts %}
  {% for category in post.categories %}
    {% assign visible_categories = visible_categories | push: category %}
  {% endfor %}
  {% for tag in post.tags %}
    {% assign visible_tags = visible_tags | push: tag %}
  {% endfor %}
{% endfor %}
{% assign category_count = visible_categories | uniq | size %}
{% assign tag_count = visible_tags | uniq | size %}
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

  {% include about/hero.html %}
  {% include about/bento.html %}
  {% include about/writing.html %}
  {% include about/recent.html %}
  {% include about/comments.html %}

  <p class="wx-about-sign">
    <span>读书，买花，长大。</span>
    <span aria-hidden="true">— Wendell</span>
  </p>
</div>

<script src="{{ '/assets/js/about.js' | relative_url }}" defer></script>
