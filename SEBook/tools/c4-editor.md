---
title: "C4 Editor"
layout: sebook
permalink: /SEBook/tools/c4-editor
description: 'Build a C4 model of a software architecture as one design.yml file and see every view of it: context, containers, components, code, and more.'
c4: true
c4_editor: true
static_uml: true
---

# C4 Editor

Describe an architecture as one model and look at it through C4 views. Each element you add, each responsibility you give it, and each relationship you name goes into one `design.yml` file. The context, container, component, and code views are all drawn from that file, so a change in one view shows up in every other view. The [C4 model chapter](/SEBook/architecture/c4) explains the levels and the checks.

{% if page.layout == 'sebook-combined' %}This copy in the combined book keeps your edits only until you leave the page. The [C4 Editor page](/SEBook/tools/c4-editor) adds the examples, the profile switch, and a draft kept in your browser.{% else %}Start from an example or a blank model.{% endif %} The **View** buttons and the **Scope** list choose what you see, and the **YAML** tab shows the file itself. The **Problems** tab lists what the checks found, and **Review** asks the questions no check can answer. The [keyboard shortcuts](/shortcuts/#c4-editor) work while the drawing has focus.

{% include c4-editor.html model="course-registration" size="tall" standalone="true" %}

{% unless page.layout == 'sebook-combined' %}
## Your work stays in this browser

After your first edit, this page keeps your model as a draft in this browser (the `c4-editor-draft` entry on the [storage page](/cookies/), where you can delete it). Nothing is sent to this site. If you open this page in two tabs, the tab you edited last owns the draft, and the other tab tells you. Use **Download YAML** to keep a copy or to hand your model in, and **Open…** to continue from a file.

An **Open in the C4 editor** link below a C4 figure in the book opens that figure's model here. The model travels in the link itself, so nothing is stored until you edit it. If you already have a draft, the editor asks before replacing it.
{% endunless %}
