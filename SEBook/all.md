---
title: SE Book
layout: sebook-combined
---


{% for topic in site.data.sebook_nav.topics %}
    {% capture topic.name %}{% include topic.url %}{% endcapture %}
    {{ topic.name | markdownify }}
    
    {% if topic.subtopics %}
        {% for subtopic in topic.subtopics %}
            {% capture subtopic.name %}{% include subtopic.url %}{% endcapture %}
            {{ item.name | markdownify }}
            {% if subtopic.items %}
                {% for item in subtopic.items %}
                    {% capture item.name %}{% include item.url %}{% endcapture %}
                    {{ item.name | markdownify }}
                {% endfor %}
            {% endif %}
        {% endfor %}
    {% endif %}
{% endfor %}