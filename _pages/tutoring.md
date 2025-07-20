---
layout: archive            # or 'single' if you just want one page of prose
title: "Tutoring"
permalink: /tutoring/      # must end with trailing slash to match your menu link
author_profile: true       # shows the left sidebar profile
---

Write *any* introductory content here.  
You can come back later to structure rates, courses, philosophy, etc.

If you later want to auto-list posts (e.g. “teaching tips” tagged tutoring), you can insert:

{% raw %}{% include base_path %}{% for post in site.posts %}
{% if post.tags contains "tutoring" %}
* [{{ post.title }}]({{ post.url | relative_url }}) – {{ post.date | date: "%Y-%m-%d" }}
{% endif %}
{% endfor %}{% endraw %}
