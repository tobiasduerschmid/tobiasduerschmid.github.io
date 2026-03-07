---
title: SE Book -- User Stories
layout: framework
---

{% assign projects = site.data.researchprojects.projects | where: 'key', 'sebook' %}
{% assign project  = projects.first %}

{% include navbar_project_subpage.html title=project.title pubssize=pubs.size project=project %}

{% include header_project.html title=project.title description=project.subtitle%}

## Table of Contents
{:toc}

---

# User Stories

## INVEST

### Independent


### Negotiable


### Valuable


### Estimable


### Small


### Testable