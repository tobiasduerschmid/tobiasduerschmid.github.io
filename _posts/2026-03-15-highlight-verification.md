---
layout: blog-post
title: "Highlight Verification Test"
date: 2026-03-15
category: "Testing"
permalink: /blog/highlight-verification/
---

# Highlight Tests

1. Basic highlight: ==this should be highlighted==

2. Nested Italics: ==this should be *italicized and highlighted*==

3. Nested Bold: ==this should be **bold and highlighted**==

4. Mixed Nested: ==this should be **bold and *italicized* highlighted**==

5. Nested with curly quotes: ==”this highlight has quotes”==

6. Code block exclusion (should NOT be highlighted):
```
==this should NOT be highlighted in a code block==
```

7. Inline code exclusion: `==this should NOT be highlighted in inline code==`

8. Pre tag exclusion:
<pre>
==this should NOT be highlighted in a pre tag==
</pre>

9. Script tag exclusion:
<script>
console.log("==this should NOT be highlighted in a script tag==");
</script>
