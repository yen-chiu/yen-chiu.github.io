---
title: 期刊
icon: icon-journal
order: 1.5
hide_panel: true
journal_css: true
description: 《余白》Margin —— 独立出版的中文学术期刊，按卷期出版，开放获取，文章附 A4 版 PDF。
---

{% assign jr = site.data.journal %}
{% assign docs = site.journal | sort: 'date' | reverse %}

<div class="j-hero">
<p class="j-hero__kicker">{{ jr.name_en }} · {{ jr.publisher }}</p>
<h1 class="j-hero__title">{{ jr.title }}</h1>
<p class="j-hero__tagline">{{ jr.tagline }}</p>
<p class="j-hero__meta">
{% if docs.size > 0 %}
第 {{ jr.volume }} 卷 · 第 {{ jr.issue }} 期 · {{ jr.year }} <span class="j-dot">·</span> 共 {{ docs.size }} 篇
{% else %}
创刊筹备中
{% endif %}
<span class="j-dot">·</span> 开放获取 <span class="j-dot">·</span> <a href="{{ jr.license_url }}">{{ jr.license }}</a>
</p>
</div>

{% if docs.size > 0 %}
{% assign vols = docs | group_by: 'volume' %}
{% for vol in vols %}
{% assign issues = vol.items | group_by: 'issue' %}
{% for iss in issues %}
<section class="j-issue">
<h2 class="j-issue__head">第 {{ vol.name }} 卷　第 {{ iss.name }} 期<span class="j-issue__count">{{ iss.items.size }} 篇</span></h2>
<ul class="j-list">
{% for paper in iss.items %}
<li class="j-item">
<a class="j-item__title" href="{{ paper.url | relative_url }}">{{ paper.title }}</a>
{% if paper.title_en %}
<p class="j-item__title-en">{{ paper.title_en }}</p>
{% endif %}
<p class="j-item__authors">{{ paper.authors }}{% if paper.affiliation %}　·　{{ paper.affiliation }}{% endif %}</p>
<p class="j-item__abs">{{ paper.abstract | strip_html | strip | truncate: 170 }}</p>
<p class="j-item__meta">pp. {{ paper.pages }} <span class="j-dot">·</span> 收稿 {{ paper.received | date: '%Y-%m-%d' }} <span class="j-dot">·</span> 接受 {{ paper.accepted | date: '%Y-%m-%d' }}</p>
<p class="j-item__links">
<a class="j-btn" href="{{ paper.url | relative_url }}">阅读</a>
{% if paper.pdf %}<a class="j-btn j-btn--ghost" href="{{ site.data.journal.docs_base }}/{{ paper.pdf }}">PDF</a>{% endif %}
</p>
</li>
{% endfor %}
</ul>
</section>
{% endfor %}
{% endfor %}
{% else %}
<p class="j-empty">第一期还在排版中。</p>
{% endif %}

<section class="j-about">
<h2 class="j-issue__head">关于本刊</h2>
<ul class="j-about__list">
{% for line in jr.statement %}
<li>{{ line }}</li>
{% endfor %}
</ul>
<p class="j-about__contact">联系：<a href="mailto:{{ jr.contact }}">{{ jr.contact }}</a></p>
</section>
