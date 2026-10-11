---
title: "UML Editor"
layout: sebook
permalink: /SEBook/tools/uml-editor
hide_archuml: true
---

# UML Editor

Create diagrams from a blank ArchUML model. This editor supports the full ArchUML surface: UML diagrams plus freeform, Git graph, folder tree, Venn, ER diagrams, and CRC cards. CRC cards record a class name, responsibilities, and collaborators; see the [CRC card syntax reference](/SEBook/tools/uml-reference#crc-cards).

{% include uml-editor.html types="class,sequence,state,component,deployment,usecase,activity,freeform,gitgraph,folder-tree,venn,er,crc" default_type="class" default_layout="square" start="empty" persistence="false" reset_label="Empty" reset_title="Discard your current draft and return to an empty diagram" %}
