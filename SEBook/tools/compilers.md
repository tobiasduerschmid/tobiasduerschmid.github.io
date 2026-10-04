---
layout: sebook
sitemap: false
title: 'Compilers: Tokens and Syntax Trees'
description: Explore how regex token rules and EBNF grammars turn source text into syntax trees, and compare ambiguous and factored expressions.
compiler_ambiguity:
  title: One Expression, More Than One Tree
  prediction: Before running, predict the possible roots for x + 3 * 7. Inspect every result, then repeat with x - y - z.
  tokenRules:
    - name: RESERVED
      pattern: break|default|func|interface|select|case|defer|go|map|struct|chan|else|goto|package|switch|const|fallthrough|if|range|type|continue|for|import|return|var
    - name: IDENTIFIER
      pattern: '[A-Za-z_][A-Za-z0-9_]*'
    - name: LITERAL_NUM
      pattern: 0|[1-9][0-9]*
    - name: OP_PLUS
      pattern: \+
    - name: OP_MINUS
      pattern: '-'
    - name: OP_MULT
      pattern: \*
    - name: OP_DIV
      pattern: /
    - name: DELIM_LPAREN
      pattern: \(
    - name: DELIM_RPAREN
      pattern: \)
    - name: SPACE
      pattern: '[ \t\r\n]+'
      skip: true
  ast: auto
  grammar: |
    expr = expr operator expr
         | IDENTIFIER
         | LITERAL_NUM ;
    operator = OP_PLUS | OP_MINUS | OP_MULT | OP_DIV ;
  source: |
    x + 3 * 7
compiler_lab:
  title: The Same Source, With Precedence
  prediction: Keep x + 3 * 7 unchanged and predict which trees remain. Then compare x - y - z with x - (y - z), and try (x + 3) * 7.
  tokenRules:
    - name: RESERVED
      pattern: break|default|func|interface|select|case|defer|go|map|struct|chan|else|goto|package|switch|const|fallthrough|if|range|type|continue|for|import|return|var
    - name: IDENTIFIER
      pattern: '[A-Za-z_][A-Za-z0-9_]*'
    - name: LITERAL_NUM
      pattern: 0|[1-9][0-9]*
    - name: OP_PLUS
      pattern: \+
    - name: OP_MINUS
      pattern: '-'
    - name: OP_MULT
      pattern: \*
    - name: OP_DIV
      pattern: /
    - name: DELIM_LPAREN
      pattern: \(
    - name: DELIM_RPAREN
      pattern: \)
    - name: SPACE
      pattern: '[ \t\r\n]+'
      skip: true
  ast: auto
  grammar: |
    expr = term { add_sub_op term } ;
    term = factor { mul_div_op factor } ;
    factor = IDENTIFIER | LITERAL_NUM | DELIM_LPAREN expr DELIM_RPAREN ;
    add_sub_op = OP_PLUS | OP_MINUS ;
    mul_div_op = OP_MULT | OP_DIV ;
  source: |
    x + 3 * 7
---

<script src="/js/compiler-lab-client.js" defer></script>
<script src="/js/compiler-lab-view.js" defer></script>
<link rel="stylesheet" href="/css/compiler-lab.css">
<link rel="stylesheet" href="/css/print-light.css">

# Front Ends

A compiler's front end discovers a program's structure. The **tokenizer** recognizes names, numbers, and punctuation using regular expressions. The **parser** applies grammar rules and builds a **syntax tree**: an operator's branches point to its operands.

The labs use the lecture's expressions with a small Go token set. Compare the deliberately ambiguous grammar with a repaired one. Basic programming and familiarity with trees are enough to begin.

# Ambiguity

In **Extended Backus–Naur Form (EBNF)**, `=` defines a production, `;` ends it, adjacent items form a sequence, and `|` offers alternatives. Names such as `IDENTIFIER` denote token types; `expr` refers to another production.

The first grammar permits an expression on either side of an operator. Which grouping does that allow? You can replace either lab's grammar: parsing starts at its first production, and token names must match the tokenizer table.

{% include compiler-lab.html config=page.compiler_ambiguity %}

<details markdown="1">
<summary>After inspecting the trees: compare</summary>

For `x + 3 * 7`, the grammar allows `x + (3 * 7)` and `(x + 3) * 7`. The tokens are identical; the root and its operands differ.

For `x - y - z`, it allows `(x - y) - z` and `x - (y - z)`. This is an associativity question, even though every operator is subtraction.

A grammar is **ambiguous** when the same input has more than one grammatical structure. Choosing the first displayed tree would conceal the unresolved choice.

</details>

# Precedence

The lecture's repair gives multiplication/division their own level: `term`. Addition/subtraction combine complete terms in `expr`. A `factor` is a name, number, or parenthesized expression. Braces `{ ... }` mean zero or more repetitions.

The lab applies Go's left-to-right grouping within each operator level. Inspect how the grammar determines which operations belong together.

{% include compiler-lab.html config=page.compiler_lab %}

<details markdown="1">
<summary>After comparing: explain the change</summary>

Only `x + (3 * 7)` remains: `3 * 7` forms one term before addition combines it with `x`.

For `x - y - z`, left-to-right grouping gives `(x - y) - z`. Parentheses can request `x - (y - z)` instead. Similarly, `(x + 3) * 7` has multiplication at the root because the parenthesized expression forms one factor.

Follow the operand links to check each explanation against its tree.

</details>

# Practice

The [short Go compiler tutorial](/SEBook/tools/compilers-tutorial) has four exercises: recognize names, repair precedence, support parentheses, and parse assignments. Allow about 10–15 minutes; a [print view](/SEBook/tools/compilers-tutorial/print) is available.

Before leaving, distinguish three failures: an unsupported character, an operator without an operand, and an undeclared name.

<details markdown="1">
<summary>Check the phase boundaries</summary>

These require lexical analysis, syntax analysis, and semantic analysis respectively. A syntax tree establishes structure; it does not prove that names and types are valid.

</details>

These labs recognize ASCII names, decimal integers, and the displayed operators. They do not execute programs. If enumeration exceeds a resource limit, the lab reports that limit instead of claiming that a partial set contains every valid tree.
