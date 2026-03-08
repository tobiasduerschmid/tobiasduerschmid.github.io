---
title: SE Book
layout: sebook-combined
---


{% for topic in site.data.sebook_nav.topics %}
    {% capture topic_name %}{% include {{ topic.url | replace: '.html', '.md' }} %}{% endcapture %}
    {{ topic_name | markdownify }}
    
    {% if topic.subtopics %}
        {% for subtopic in topic.subtopics %}
            {% capture subtopic_name %}{% include {{ subtopic.url | replace: '.html', '.md' }} %}{% endcapture %}
            {{ subtopic_name | markdownify }}
            {% if subtopic.items %}
                {% for item in subtopic.items %}
                    {% capture item_name %}{% include {{ item.url | replace: '.html', '.md' }} %}{% endcapture %}
                    {{ item_name | markdownify }}
                {% endfor %}
            {% endif %}
        {% endfor %}
    {% endif %}
{% endfor %}