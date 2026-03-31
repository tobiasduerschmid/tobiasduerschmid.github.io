---
title: "Regular Expressions (RegEx): Reference Guide"
layout: sebook
---

> **New to RegEx? Start here:** The [RegEx Tutorial: Basics](/SEBook/tools/regex-tutorial.html) teaches you Regular Expressions step by step with hands-on exercises and real-time feedback. Then continue with the [Advanced Tutorial](/SEBook/tools/regex-tutorial-advanced.html) for greedy/lazy matching, groups, lookaheads, and integration challenges. Come back to this page as a reference.

This page is a **reference guide** for Regular Expression syntax, engine mechanics, and worked examples. It is designed to be consulted alongside or after the interactive tutorial — not as a replacement for hands-on practice.

# Overview

## The Core Purpose of RegEx

At its heart, RegEx solves three primary problems in software engineering:
1. **Validation**: Ensuring user input matches a required format (e.g., verifying an email address or checking if a password meets complexity rules).
2. **Searching & Parsing**: Finding specific substrings within a massive text document or extracting required data (e.g., scraping phone numbers from a website).
3. **Substitution**: Performing advanced search-and-replace operations (e.g., reformatting dates from `YYYY-MM-DD` to `MM/DD/YYYY`).


## The Conceptual Power of Pattern Matching: What RegEx Actually Does

Before we dive into the specific symbols and syntax, we need to understand the fundamental shift in thinking required to use Regular Expressions. 

When we normally search through text (like using `Ctrl + F` or `Cmd + F` in a word processor), we perform a **Literal Search**. If you search for the word `cat`, the computer looks for the exact character `c`, followed immediately by `a`, and then `t`. 

However, real-world data is rarely that predictable. Regular Expressions allow you to perform a **Structural Search**. Instead of telling the computer exactly *what* characters to look for, you describe the *shape, rules, and constraints* of the text you want to find. 

Let's look at one simple and two complex examples to illustrate this conceptual leap.

### The Simple Example: The "Cat" Problem
Imagine you are proofreading a document and want to find every instance of the animal "cat." 

If you do a literal search for `cat`, your text editor will highlight the "cat" in "The **cat** is sleeping," but it will also highlight the "cat" in "**cat**alog", "edu**cat**ion", and "s**cat**ter". Furthermore, a literal search for `cat` will completely miss the plural "cats" or the capitalized "Cat".

Conceptually, a Regular Expression allows you to tell the computer: 
> *"Find the letters C-A-T (ignoring uppercase or lowercase), but only if they form their own distinct word, and optionally allow an 's' at the very end."* By defining the *rules* of the word rather than just the literal letters, RegEx eliminates the false positives ("catalog") and captures the edge cases ("Cats").

### Complex Example 1: The Phone Number Problem
Suppose you are given a massive spreadsheet of user data and need to extract everyone's phone number to move into a new database. The problem? The users typed their phone numbers however they wanted. You have:
* `123-456-7890`
* `(123) 456-7890`
* `123.456.7890`
* `1234567890`

A literal search is useless here. You cannot `Ctrl + F` for a phone number if you don't already know what the phone number is! 

With RegEx, you don't search for the numbers themselves. Instead, you describe the **concept** of a North American phone number to the engine:
> *"Find a sequence of exactly 3 digits (which might optionally be wrapped in parentheses). This might be followed by a space, a dash, or a dot, but it might not. Then find exactly 3 more digits, followed by another optional space, dash, or dot. Finally, find exactly 4 digits."*

With one single Regular Expression, the engine will scan millions of lines of text and perfectly extract every phone number, regardless of how the user formatted it, while ignoring random strings of numbers like zip codes or serial numbers.

### Complex Example 2: The Server Log Problem
Imagine you are a backend engineer, and your company's website just crashed. You are staring at a server log file containing 500,000 lines of system events, timestamps, IP addresses, and status codes. You need to find out which specific IP addresses triggered a "Critical Timeout" error in the last hour.

The data looks like this:
`[2023-10-25 14:32:01] INFO - IP: 192.168.1.5 - Status: OK`
`[2023-10-25 14:32:05] ERROR - IP: 10.0.4.19 - Status: Critical Timeout`

You can't just search for "Critical Timeout" because that won't extract the IP address for you. You can't search for the IP address because you don't know who caused the error.

Conceptually, RegEx allows you to create a highly specific, multi-part extraction rule:
> *"Scan the document. First, find a timestamp that falls between 14:00:00 and 14:59:59. If you find that, keep looking on the same line. If you see the word 'ERROR', keep going. Find the letters 'IP: ', and then permanently **capture and save** the mathematical pattern of an IP address (up to three digits, a dot, up to three digits, etc.). Finally, ensure the line ends with the exact phrase 'Critical Timeout'. If all these conditions are met, hand me back the saved IP address."*

This is the true power of Regular Expressions. It transforms text searching from a rigid, literal matching game into a highly programmable, logic-driven data extraction pipeline.

## The Anatomy of a Regular Expression

A regular expression is composed of two types of characters:
* **Literal Characters**: Characters that match themselves exactly (e.g., the letter `a` matches the letter "a").
* **Metacharacters**: Special characters that have a unique meaning in the pattern engine (e.g., `*`, `+`, `^`, `$`).

Let's explore the most essential metacharacters and constructs.

### Anchors: Controlling Position
Anchors do not match any actual characters; instead, they constrain a match based on its position in the string.

* `^` (Caret): Asserts the **start** of a string. `^Hello` matches "Hello world" but not "Say Hello".
* `$` (Dollar Sign): Asserts the **end** of a string. `end$` matches "The end" but not "endless".

> **Practice this:** [Anchors exercises in the Interactive Tutorial](/SEBook/tools/regex-tutorial.html#anchors)

### Character Classes: Matching Sets of Characters
Character classes (or sets) allow you to match any single character from a specified group.

* `[abc]`: Matches either "a", "b", or "c".
* `[a-z]`: Matches any lowercase letter.
* `[A-Za-z0-9]`: Matches any alphanumeric character.
* `[^0-9]`: The caret inside the brackets means **negation**. This matches any character that is *not* a digit.

> **Practice this:** [Character Classes exercises in the Interactive Tutorial](/SEBook/tools/regex-tutorial.html#character-classes)

### Metacharacters
Because certain character sets are used so frequently, RegEx provides handy meta characters:
* `\d`: Matches any digit (equivalent to `[0-9]`).
* `\w`: Matches any "word" character (alphanumeric plus underscore: `[a-zA-Z0-9_]`).
* `\s`: Matches any whitespace character (spaces, tabs, line breaks).
* `.` (Dot): The wildcard. Matches *any* single character except a newline. (To match a literal dot, you must escape it with a backslash: `\.`).

> **Practice this:** [Meta Characters exercises in the Interactive Tutorial](/SEBook/tools/regex-tutorial.html#meta-characters)

### Quantifiers: Controlling Repetition
Quantifiers tell the RegEx engine how many times the preceding element is allowed to repeat.

* `*` (Asterisk): Matches **0 or more** times. (`a*` matches "", "a", "aa", "aaa")
* `+` (Plus): Matches **1 or more** times. (`a+` matches "a", "aa", but not "")
* `?` (Question Mark): Matches **0 or 1** time (makes the preceding element optional).
* `{n}`: Matches exactly *n* times.
* `{n,m}`: Matches between *n* and *m* times.

> **Practice this:** [Quantifiers exercises in the Interactive Tutorial](/SEBook/tools/regex-tutorial.html#quantifiers)

## Real-World Examples

Let's look at how we can combine these rules to solve practical problems.

### Example A: Password Validation
Suppose we need to validate a password that must be at least 8 characters long and contain only letters and digits.

**The Pattern:** `^[a-zA-Z0-9]{8,}$`

**Breakdown:**
* `^` : Start of the string.
* `[a-zA-Z0-9]` : Allowed characters (any letter or number).
* `{8,}` : The previous character class must appear 8 or more times.
* `$` : End of the string. (This ensures no special characters sneak in at the end).

### Example B: Email Validation
Validating an email address perfectly according to the RFC standard is notoriously difficult, but a highly effective, standard RegEx looks like this:

**The Pattern:** `^[a-zA-Z0-9.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`

**Breakdown:**
1. `^[a-zA-Z0-9.-]+` : Starts with one or more alphanumeric characters, dots, or dashes (the username).
2. `@` : A literal "@" symbol.
3. `[a-zA-Z0-9.-]+` : The domain name (e.g., "ucla" or "google").
4. `\.` : A literal dot (escaped).
5. `[a-zA-Z]{2,}$` : The top-level domain (e.g., "edu" or "com"), consisting of 2 or more letters, extending to the end of the string.


## Grouping and Capturing

Often, you don't just want to know *if* a string matched; you want to extract specific parts of the string. This is done using **Groups**, denoted by parentheses `()`.

### Standard Capture Groups
If you want to extract the domain from an email, you can wrap that section in parentheses:
`^.+@(.+\.[a-zA-Z]{2,})$`
The engine will save whatever matched inside the `()` into a numbered variable that you can access in your programming language.

### Named Capture Groups
When dealing with complex patterns, remembering group numbers gets confusing. Modern RegEx engines (like Python's) support **Named Capture Groups** using the syntax `(?P<name>pattern)`.

**Example: Parsing HTML Hex Colors**
Imagine you want to extract the Red, Green, and Blue values from a hex color string like `#FF00A1`:

**The Pattern:** `#(?P<R>[0-9a-fA-F]{2})(?P<G>[0-9a-fA-F]{2})(?P<B>[0-9a-fA-F]{2})`

Here, we define three named groups (R, G, and B). When this runs against `#FF00A1`, our code can cleanly extract:
* Group "R": `FF`
* Group "G": `00`
* Group "B": `A1`

## Seeing it in Action: Step-by-Step Worked Examples

Let's put the theory of pattern pointers, bumping along, and backtracking into practice. Here is exactly how the RegEx engine steps through the three conceptual examples we discussed earlier.

### Worked Example 1: The "Cat" Problem
**The Goal:** Find the distinct word "cat" or "cats" (case-insensitive), ignoring words where "cat" is just a substring.
**The Regex:** `\b[Cc][Aa][Tt][Ss]?\b`
*(Note: `\b` is a "word boundary" anchor. It matches the invisible position between a word character and a non-word character, like a space or punctuation).*

**The Input String:** `"cats catalog cat"`

**Step-by-Step Execution:**
1. **Index 0 (`c` in "cats"):**
   * The pattern pointer starts at `\b`. Since `c` is the start of a word (a transition from the start of the string to a word character), the `\b` assertion passes (zero characters consumed).
   * `[Cc]` matches `c`. 
   * `[Aa]` matches `a`. 
   * `[Tt]` matches `t`.
   * `[Ss]?` looks for an optional 's'. It finds `s` and matches it.
   * `\b` checks for a word boundary at the current position (between 's' and the space). Because 's' is a word character and the following space is a non-word character, the boundary assertion passes. Match successful!
   * **Match 1 Saved:** `"cats"`
2. **Resuming at Index 4 (the space):**
   * The engine resumes exactly where it left off to look for more matches.
   * `\b` matches the boundary. `[Cc]` fails against the space. The engine bumps along.
3. **Index 5 (`c` in "catalog"):**
   * `\b` matches. `[Cc]` matches `c`. `[Aa]` matches `a`. `[Tt]` matches `t`.
   * The string pointer is now positioned between the `t` and the `a` in "catalog".
   * The pattern asks for `[Ss]?`. Is 'a' an 's'? No. Since the 's' is optional (`?`), the engine says "That's fine, I matched it 0 times," and moves to the next pattern token.
   * The pattern asks for `\b` (a word boundary). The string pointer is currently between `t` (a word character) and `a` (another word character). Because there is no transition to a non-word character, the boundary assertion fails.
   * **Match Fails!** The engine drops everything, resets the pattern, and bumps along to the next letter.
4. **Index 13 (`c` in "cat"):**
   * The engine bumps along through "atalog " until it hits the final word.
   * `\b` matches. `[Cc]` matches `c`. `[Aa]` matches `a`. `[Tt]` matches `t`.
   * `[Ss]?` looks for an 's'. The string is at the end. It matches 0 times.
   * `\b` looks for a boundary. The end of the string counts as a boundary. Match successful!
   * **Match 2 Saved:** `"cat"`

### Worked Example 2: The Phone Number Problem
**The Goal:** Extract a uniquely formatted phone number from a string.
**The Regex:** `\(?\d{3}\)?[- .]?\d{3}[- .]?\d{4}`

**The Input String:** `"Call (123) 456-7890 now"`

**Step-by-Step Execution:**
1. The engine starts at `C`. `\(` (an optional literal opening parenthesis) is not `C`, so it skips it. Next token `\d{3}` fails because `C` is not a digit. Bump along.
2. It bumps along through "Call " until it reaches index 5: `(`.
3. **Index 5 (`(`):**
   * `\(`? matches the `(`. (Consumed).
   * `\d{3}` matches `123`. (Consumed).
   * `\)?` matches the `)`. (Consumed).
   * `[- .]?` looks for an optional space, dash, or dot. It finds the space after the parenthesis and matches it. (Consumed).
   * `\d{3}` matches `456`. (Consumed).
   * `[- .]?` finds the `-` and matches it. (Consumed).
   * `\d{4}` matches `7890`. (Consumed).
4. The pattern is fully satisfied. 
   * **Match Saved:** `"(123) 456-7890"`


### Worked Example 3: The Server Log (with Backtracking)
**The Goal:** Extract the IP address from a specific error line.
**The Regex:** `^.*ERROR.*IP: (?P<IP>\d{1,3}(?:\.\d{1,3}){3}).*Critical Timeout$`
*(Note: We use `.*` to skip over irrelevant parts of the log).*

**The Input String:** `[14:32:05] ERROR - IP: 10.0.4.19 - Status: Critical Timeout`

**Step-by-Step Execution:**
1. **Start of String:** `^` asserts we are at the beginning.
2. **The `.*`:** The pattern token `.*` tells the engine to match *everything*. The engine consumes the **entire string** all the way to the end: `[14:32:05] ERROR - IP: 10.0.4.19 - Status: Critical Timeout`.
3. **Hitting a Wall:** The next pattern token is the literal word `ERROR`. But the string pointer is at the absolute end of the line. The match fails.
4. **Backtracking:** The engine steps the string pointer backward one character at a time. It gives back `t`, then `u`, then `o`... all the way back until it gives back the space right before the word `ERROR`.
5. **Moving Forward:** Now that the `.*` has settled for matching `[14:32:05] `, the engine moves to the next token. 
   * `ERROR` matches `ERROR`.
   * The next `.*` consumes the rest of the string again.
   * It has to backtrack again until it finds `IP: `.
6. **The Capture Group:** The engine enters the named capture group `(?P<IP>...)`.
   * `\d{1,3}` matches `10`.
   * `(?:\.\d{1,3}){3}` matches `.0`, then matches `.4`, then matches `.19`.
   * The engine saves the string `"10.0.4.19"` into a variable named "IP".
7. **The Final Stretch:** The final `.*` consumes the rest of the string again, backtracking until it can match the literal phrase `Critical Timeout`.
   * `$` asserts the end of the string.
   * **Match Saved!** The group "IP" successfully holds `"10.0.4.19"`.


# Advanced

## Advanced Pattern Control: Greediness vs. Laziness

Once you understand the basics of matching characters and using quantifiers, you will inevitably run into scenarios where your regular expression matches too much text. To solve this problem, we use Lazy Quantifiers.

By default, regular expression quantifiers (`*`, `+`, `{n,m}`) are **greedy**. This means they will consume as many characters as mathematically possible while still allowing the overall pattern to match.


**The Greedy Problem:**
Imagine you are trying to extract the text from inside an HTML tag: `<div>Hello World</div>`.
You might write the pattern: `<.*>`

Because `.*` is greedy, the engine sees the first `<` and then the `.*` swallows the entire rest of the string. It then backtracks just enough to find the final `>` at the very end of the string. 
Instead of matching just `<div>`, your greedy regex matched the entire string: `<div>Hello World</div>`.

**The Lazy Solution (Non-Greedy):**
To make a quantifier **lazy** (meaning it will match as few characters as possible), you simply append a question mark `?` immediately after the quantifier.

* `*?` : Matches 0 or more times, but as few times as possible.
* `+?` : Matches 1 or more times, but as few times as possible.

If we change our pattern to `<div>(.*?)</div>`, the engine matches the tags and **captures** only the text inside. 
Running this against `<div>Hello World</div>` will successfully yield a match where the first capture group is exactly "Hello World".

## Advanced Pattern Control: Lookarounds

Sometimes you need to assert that a specific pattern exists (or doesn't exist) immediately before or after your current position, but you don't want to include those characters in your final match result. To solve this problem, we use Lookarounds.

Lookarounds are "zero-width assertions." Like anchors (`^` and `$`), they check a condition at a specific position, but they do not "consume" any characters. The engine's pointer stays exactly where it is.

### Positive and Negative Lookaheads
Lookaheads look forward in the string from the current position.
* **Positive Lookahead `(?=...)`**: Asserts that what immediately follows matches the pattern.
* **Negative Lookahead `(?!...)`**: Asserts that what immediately follows does *not* match the pattern.

**Example: The Password Condition**
Lookaheads are the secret to writing complex password validators. Suppose a password must contain at least one number. You can use a positive lookahead at the very start of the string:
`^(?=.*\d)[A-Za-z\d]{8,}$`

* `^` asserts the position at the beginning of the string.
* `(?=.*\d)` looks ahead through the string from the current position. If it finds a digit, the condition passes. **Crucially, because lookaheads are zero-width, they do not consume characters. After the check passes, the engine's string pointer resets back to the exact position where the lookahead started** (which, in this specific case, is still the beginning of the string).
* `[A-Za-z\d]{8,}$` then evaluates the string normally from that starting position to ensure it consists of 8+ valid characters.

### Positive and Negative Lookbehinds
Lookbehinds look backward in the string from the current position.
* **Positive Lookbehind `(?<=...)`**: Asserts that what immediately precedes matches the pattern.
* **Negative Lookbehind `(?<!...)`**: Asserts that what immediately precedes does *not* match the pattern.

**Example: Extracting Prices**
Suppose you have the text: `I paid $100 for the shoes and €80 for the jacket.`
You want to extract the number `100`, but *only* if it is a price in dollars (preceded by a `$`). 

If you use `\$\d+`, your match will be `$100`. But you only want the number itself!
By using a positive lookbehind, you can check for the dollar sign without consuming it:
`(?<=\$)\d+`

* The engine reaches a position in the string.
* It peeks backward to see if there is a `$`.
* If true, it then attempts to match the `\d+` portion. The match is exactly `100`. 

By mastering lazy quantifiers and lookarounds, you transition from simply searching for text to writing highly precise, surgical data-extraction algorithms!

## How the RegEx Engine Finds All Matches: Under the Hood

To truly master Regular Expressions, it helps to understand exactly what the computer is doing behind the scenes. When you run a regex against a string, you are handing your pattern over to a **RegEx Engine**—a specialized piece of software (typically built using a theoretical concept called a Finite State Machine) that parses your text.

Here is the step-by-step breakdown of how the engine evaluates an input string to find every possible match.

### The Two "Pointers"
Imagine the engine has two pointers (or fingers) tracing the text:
* **The Pattern Pointer:** Points to the current character/token in your RegEx pattern.
* **The String Pointer:** Points to the current character in your input text.

The engine always starts with both pointers at the very beginning (index 0) of their respective strings. It processes the text strictly from **left to right**.

### Attempting a Match and "Consuming" Characters
The engine looks at the first token in your pattern and checks if it matches the character at the string pointer. 
* If it **matches**, the engine *consumes* that character. Both pointers move one step to the right. 
* If a quantifier like `+` or `*` is used, the engine will act **greedily** by default. It will consume as many matching characters as possible before moving to the next token in the pattern.

### Hitting a Wall: Backtracking
What happens if the engine makes a choice (like matching a greedy `.*`), moves forward, and suddenly realizes the rest of the pattern doesn't match? It doesn't just give up.

Instead, the engine performs **Backtracking**. It remembers previous decision points—places where it could have made a different choice (like matching one fewer character). It physically moves the string pointer *backwards* step-by-step, trying alternative paths until it either finds a successful match for the entire pattern or exhausts all possibilities.



### The "Bump-Along" (Failing and Retrying)
If the engine exhausts all possibilities at the current starting position and completely fails to find a match, it performs a "bump-along." 

It resets the pattern pointer to the beginning of your RegEx, advances the string pointer *one character forward* from where the last attempt began, and starts the entire process over again. It will continue this process, checking every single starting index of the string, until it finds a match or reaches the end of the text.

### Finding *All* Matches (Global Search)
Usually, a RegEx engine stops the moment it finds the *first* valid match. However, if you instruct the engine to find *all* matches (usually done by appending a global modifier, like `/g` in JavaScript or using `re.findall()` in Python), the engine performs a specific sequence:

1. It finds the first successful match.
2. It saves that match to return to you.
3. It **resumes the search starting at the exact character index where the previous match ended**.
4. It repeats the evaluate-bump-match cycle until the string pointer reaches the absolute end of the input string.

**An Example in Action:**
Let's say you are searching for the pattern `cat` in the string `"The cat and the catalog"`.
1. The engine starts at `T`. `T` is not `c`. It bumps along.
2. It eventually bumps along to the `c` in `"cat"`. `c` matches `c`, `a` matches `a`, `t` matches `t`. **Match #1 found!**
3. The engine saves `"cat"` and moves its string pointer to the space immediately following it.
4. It continues bumping along until it hits the `c` in `"catalog"`. 
5. It matches `c`, `a`, and `t`. **Match #2 found!**
6. It resumes at the `a` in `"catalog"`, bumps along to the end of the string, finds nothing else, and completes the search. 

By mechanically stepping forward, backtracking when stuck, and resuming immediately after success, the engine guarantees no potential match is left behind!

## Limitations of RegEx: The HTML Problem

As powerful as RegEx is, it has mathematical limitations. Under the hood, standard regular expressions are powered by **Finite Automata** (state machines). 



Because Finite Automata have no "memory" to keep track of deeply nested structures, **you cannot write a general regular expression to perfectly parse HTML or XML**. 

HTML allows for infinitely nested tags (e.g., `<div><div><span></span></div></div>`). A regular expression cannot inherently count opening and closing brackets to ensure they are perfectly balanced. Attempting to use RegEx to parse raw HTML often results in brittle code full of false positives and false negatives. For tree-like structures, you should always use a dedicated parser (like BeautifulSoup in Python or the DOM parser in JavaScript) instead of RegEx.

## Conclusion

Regular Expressions might look intimidating, but they are incredibly logical once you break them down into their component parts. By mastering anchors, character classes, quantifiers, and groups, you can drastically reduce the amount of code you write for data validation and text manipulation. Start small, practice in online tools like Regex101, and slowly incorporate them into your daily software development workflow!

# Quiz

{% include flashcards.html id="regex_basics" %}

{% include flashcards.html id="regex_examples" %}

{% include quiz.html id="regex" %}