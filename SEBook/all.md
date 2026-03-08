---
title: SE Book
layout: sebook-combined
---


{% for topic in site.data.sebook_nav.topics %}
    {% capture topic_name %}{% include_relative {{ topic.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
    {{ topic_name | markdownify }}
    
    {% if topic.subtopics %}
        {% for subtopic in topic.subtopics %}
            {% capture subtopic_name %}{% include_relative {{ subtopic.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
            {{ subtopic_name | markdownify }}
            {% if subtopic.items %}
                {% for item in subtopic.items %}
                    {% capture item_name %}{% include_relative {{ item.url | replace: '/SEBook/', '' | replace: '.html', '.md' }} %}{% endcapture %}
                    {{ item_name | markdownify }}
                {% endfor %}
            {% endif %}
        {% endfor %}
    {% endif %}
{% endfor %}