---
title: "UML Playground"
layout: sebook
permalink: /SEBook/tools/uml-playground
---

# UML Playground

Edit the **Diagram spec** textarea and the playground re-renders the SVG output live. Switch between diagram types using the selector, then download the SVG when you're happy with the result.

Choose **CRC cards** to sketch a class's responsibilities and collaborators. Each card has a class name and two independent lists: what it knows or does, and the other objects it collaborates with. Read the [CRC card syntax reference](/SEBook/tools/uml-reference#crc-cards) for a worked example.

{% include uml-editor.html types="class,sequence,state,component,deployment,usecase,activity,freeform,gitgraph,folder-tree,venn,er,crc" default_type="class" default_layout="square" start="example" persistence="true" reset_label="Example" %}
