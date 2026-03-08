---
title: CS 35L
layout: sebook-combined
project_name: 
---


{% for topic in site.data.sebook_nav.topics %}
    {% assign topic_id = {{topic.name}} | slugify %}
    
    <section id="{{topic_id}}">

    {% capture topic_name %}{% include_relative {{ topic.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
    {% include header_project.html title=topic.name %}
    {% assign topic_parts = topic_name | split: '---' %}
    {% capture topic_body %}{% for p in topic_parts offset:2 %}{{ p }}{% if forloop.last == false %}---{% endif %}{% endfor %}{% endcapture %}
    {{ topic_body | markdownify }}
    
    {% if topic.subtopics %}
        {% for subtopic in topic.subtopics %}
            {% include header_project.html title=subtopic.name %}
            {% capture subtopic_name %}{% include_relative {{ subtopic.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
            {% assign subtopic_parts = subtopic_name | split: '---' %}
            {% capture subtopic_body %}{% for p in subtopic_parts offset:2 %}{{ p }}{% if forloop.last == false %}---{% endif %}{% endfor %}{% endcapture %}
            {{ subtopic_body | markdownify }}
            {% if subtopic.items %}
                {% for item in subtopic.items %}

                {% include header_project.html title=item.name %}
                    {% capture item_name %}{% include_relative {{ item.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
                    {% assign item_parts = item_name | split: '---' %}
                    {% capture item_body %}{% for p in item_parts offset:2 %}{{ p }}{% if forloop.last == false %}---{% endif %}{% endfor %}{% endcapture %}
                    {{ item_body | markdownify }}
                {% endfor %}
            {% endif %}
        {% endfor %}
    {% endif %}
    </section>
{% endfor %}