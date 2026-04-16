---
title: Networking
layout: sebook
---

This is a **reference page** for networking concepts that are essential for building web applications. It covers network architectures, the TCP/IP protocol stack, HTTP, and the key trade-offs you need to understand when designing networked systems.

> **How to use this page:** Keep it open as a reference while working on your projects. The concepts here underpin everything you build with Node.js and React — every time your browser talks to a server, it relies on these protocols.

# Network Architectures

When designing a networked application, the first decision is *how* your devices will communicate. There are two fundamental models, plus a practical combination of both.

## Client-Server Architecture

The **client-server** model is the most common architecture for web-based systems. It defines two distinct roles:

| Role | Responsibility |
|------|---------------|
| **Client** | Initiates requests; consumes resources (e.g., your web browser) |
| **Server** | Listens for requests; provides resources (e.g., your Node.js backend) |

Key characteristics:
* **Multiple clients** can connect to the same server simultaneously
* Connections are always **initiated by the client**, never the server
* It is a **centralized architecture** — all communication flows through the server

When you build a web app, you are building both sides: a *server* (Node.js/Express) that provides data and a *client* (React) that runs in the user's browser.

## Peer-to-Peer (P2P) Architecture

In a **peer-to-peer** architecture, there is no dedicated server. Every node in the network is both a supplier and a consumer of resources.

Key characteristics:
* **Decentralized** — no single point of control
* Peers are **equally privileged** participants
* Each peer is both a **supplier and consumer** of resources

P2P is rare in pure form. **BitTorrent** is a well-known example: when you download a file via BitTorrent, your client receives chunks directly from other peers who already have parts of the file — no central file server is involved.

## Hybrid Architectures

In practice, most systems that need P2P benefits use a **hybrid** approach: some communication goes through a central server, while some happens directly between peers.

**Example — Apple FaceTime:** For 1-on-1 calls, FaceTime attempts a direct peer-to-peer connection between devices for the lowest possible latency. If that fails (e.g., due to NAT or firewall restrictions), it routes communication through Apple's relay servers. For **Group FaceTime** calls, all participants connect to Apple's servers, since each device sending a separate video stream to every other participant would overwhelm its upload bandwidth.

### Comparing Architectures

| | Client-Server | Peer-to-Peer | Hybrid |
|---|---|---|---|
| **Structure** | Centralized | Decentralized | Mixed |
| **Single point of failure** | Yes (the server) | No | Partial |
| **Scalability** | Add more servers | Scales with peers | Flexible |
| **Use case** | Web apps, APIs, databases | File sharing, distributed backup | Video calls, gaming |

## Throughput and Latency

Two critical **quality attributes** for any networked system:

**Throughput** measures the *volume* of work processed per unit of time.
*Example: "The API server handles 500 requests per second during peak load."*

**Latency** (response time) measures how long a *single* request takes to receive a reply.
*Example: "Each database query returns results in 40ms."*

These are related but **not the same**:
* **Duplicating servers** increases throughput (more requests handled in parallel) without necessarily reducing latency.
* **Implementing caching** reduces latency (individual requests are faster) and may also increase throughput.

# The TCP/IP Protocol Stack

The internet uses a **layered architecture** called the TCP/IP stack. Each layer solves a specific problem and relies only on the layer directly below it. This design provides **reusability** (lower layers can be shared) and **flexibility** (you can swap one layer's implementation without affecting the others).

## The Four Layers

| Layer | Responsibility | Example Protocols |
|-------|---------------|-------------------|
| **Application Layer** | Provides an interface for applications to access network services | HTTP, HTTPS, SSH, DNS, FTP, POP/SMTP, TLS/SSL |
| **Transport Layer** | Provides end-to-end communication between applications on different hosts | TCP, UDP |
| **Internet Layer** | Enables communication between networks through addressing and routing | IPv4, IPv6 |
| **Link Layer** | Handles the physical transmission of data over local network hardware | Ethernet, Wi-Fi, MAC |

## Encapsulation (Package Wrapping)

Higher-layer protocols use the protocols directly below them to send messages. Each layer **wraps** the higher-layer message as its payload and adds its own header — like sealing a letter inside successively larger envelopes, each addressed for a different step of the journey:

```
┌──────────────┬───────────┬────────────┬─────────────┬─────────┐
│  Ethernet    │    IP     │    TCP     │    HTTP     │ Payload │
│  Header      │  Header   │   Header   │   Header    │ (data)  │
└──────────────┴───────────┴────────────┴─────────────┴─────────┘
← Link Layer → ← Internet → ← Transport → ← Application →
```

Each message consists of a **header** (meta information like destination, origin, content type, checksums) and a **payload** (the actual content of the message).

## IP Addresses

Every device on the internet needs a unique address. **IP addresses** solve this by having two parts: a **network** portion (like a city) and a **host** portion (like a street address).

* **IPv4** addresses range from `0.0.0.0` to `255.255.255.255`
* `127.0.0.1` is **localhost** — it always refers to *your own machine*
* **IPv6** was created because the world ran out of IPv4 addresses

## Ports

A single device can run many networked applications simultaneously. **Ports** identify which application on a host should receive a given message.

* Port numbers range from 0 to 65535
* Well-known ports: **80** (HTTP), **443** (HTTPS), **22** (SSH)
* When developing locally, you often use ports like **3000** or **5000**

# Transport Layer Protocols: TCP vs. UDP

The transport layer offers two protocols with fundamentally different trade-offs. Choosing between them is one of the most important networking decisions you will make.

## UDP (User Datagram Protocol)

UDP simply "throws" messages at the receiver without establishing a connection first.

* **Fast** and **lightweight** — no connection setup overhead
* **Connectionless** — just sends the data
* **Does not guarantee** delivery, order, or error checking
* If a message is lost, it is simply gone

**UDP is ideal when speed matters more than reliability:** DNS name resolution (a fast, independent lookup where a retry is cheap), live GPS position broadcasts in navigation apps, and real-time game state updates (player positions and bullet trajectories in FPS games).

## TCP (Transmission Control Protocol)

TCP is more complex but provides **reliable**, ordered delivery. It uses a three-way handshake to establish a connection:

**Connection Setup (3-Way Handshake):**

| Step | Sender | Message | Meaning |
|------|--------|---------|---------|
| 1 | Client → Server | **SYN** | "I want to connect" |
| 2 | Server → Client | **SYN-ACK** | "OK, I'm ready" |
| 3 | Client → Server | **ACK** | "Great, let's go" |

**Data Transfer:** Messages are sent in order, each with a **checksum** for error detection. The receiver sends an **ACK** for each message. If the sender doesn't receive an ACK within a **timeout**, it retransmits the message.

**Connection Teardown:**

| Step | Sender | Message | Meaning |
|------|--------|---------|---------|
| 1 | Sender → Receiver | **FIN** | "I'm done sending" |
| 2 | Receiver → Sender | **FIN-ACK** | "OK, I'm done too" |
| 3 | Sender → Receiver | **ACK** | "Goodbye" |

**The cost of reliability:** For N data messages, TCP sends at least **6 + 2N** total messages (3 handshake + N data + N ACKs + 3 teardown). UDP would send just N.

## TCP vs. UDP — Trade-Offs at a Glance

| | TCP | UDP |
|---|---|---|
| **Message order** | Preserved | Any order |
| **Error detection** | Included (checksums) | Not included |
| **Lost messages** | Retransmitted | Lost forever |
| **Speed** | Slower (overhead) | Fast (no overhead) |

## When to Use Each

| Protocol | Best For | Examples |
|----------|----------|----------|
| **TCP** | Data that must arrive completely and in order | SSH sessions, pushing code to a Git repository, online banking, web browsing |
| **UDP** | Real-time data where speed beats reliability | DNS queries, live GPS updates, video streaming, multiplayer game state |

**Competitive online games** (e.g., CS2, Valorant) use a hybrid: **UDP** for high-frequency movement and bullet trajectory updates (often 64–128 snapshots per second), since a missed snapshot is harmless — the next one arrives milliseconds later. **TCP** handles match-making, round results, inventory changes, and in-game purchases, where a lost or reordered message would corrupt game state. UDP snapshots include **absolute positions** of all objects, so a single dropped packet never causes lasting inconsistency.

# HTTP (Hypertext Transfer Protocol)

**HTTP** is the foundation of data communication on the World Wide Web. It is an **application-layer** protocol that runs on top of TCP.

## Key Property: Stateless

HTTP is a **stateless** protocol — each request is independent, and the server does not remember anything about previous requests from the same client. Every request must contain all the information the server needs to respond.

## HTTP Verbs (Methods)

| Verb | Purpose | Response Contains |
|------|---------|-------------------|
| **GET** | Retrieve a resource (web page, data, image, file) | The resource content + status code |
| **POST** | Send data to create or update a resource (form submission, file upload) | Status code |
| **PUT** | Update an existing resource on the server | Status code |
| **DELETE** | Delete a resource on the server | Status code |
| **HEAD** | Retrieve only headers of a resource, not the body | Headers + status code |

## URLs (Uniform Resource Locators)

A URL is the web address of a resource:

```
{protocol}://{domain}(:{port})(/{resource})

http://localhost:5000/courses/cs101
https://myapp.com/about.html
```

| Component | Example | Required? |
|-----------|---------|-----------|
| Protocol | `http://`, `https://` | Yes |
| Domain | `localhost`, `myapp.com` | Yes |
| Port | `:5000`, `:3000` | No (defaults: 80 for HTTP, 443 for HTTPS) |
| Resource path | `/courses/cs101`, `/about.html` | No (defaults to `/`) |

## HTTP Status Codes

Every HTTP response includes a **status code** that tells the client what happened:

| Category | Meaning | Common Codes |
|----------|---------|-------------|
| **2xx** | Success | `200 OK` — request succeeded; `201 Created` — new resource created |
| **4xx** | Client error | `400 Bad Request` — malformed syntax; `401 Unauthorized`; `403 Forbidden`; `404 Not Found` — resource doesn't exist |
| **5xx** | Server error | `500 Internal Server Error` — generic server failure; `502 Bad Gateway`; `503 Service Unavailable` |

**Rule of thumb:** 2xx = you did it right, 4xx = *you* messed up, 5xx = the *server* messed up.

## HTTP Headers

Each HTTP message includes **headers** with metadata about the request or response. A critical header:

**Content-Type** — tells the receiver what kind of data is in the body:

| Content-Type | Used For |
|-------------|----------|
| `text/html; charset=utf-8` | HTML web pages |
| `text/plain` | Plain text |
| `application/json` | JSON data (the standard for API communication) |

## HTTPS (HTTP Secure)

HTTPS uses **SSL/TLS** encryption to secure communication. It is essential whenever **sensitive data** is transferred (passwords, personal information, private messages) and has become the **default for all public web pages**, even for non-sensitive content.

# Building a Server with Node.js

Node.js ships with a built-in `http` module that lets you create an HTTP server from scratch:

```javascript
const http = require('http');
const PORT = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World!\n');
});

server.listen(PORT, 'localhost', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
```

For real applications, the **Express** framework provides much cleaner routing:

```javascript
const express = require('express');
const app = express();
const port = 5000;

// GET /courses/:courseId — route parameter
app.get('/courses/:courseId', (req, res) => {
  res.send(`GET request for course ${req.params.courseId}`);
});

// POST /enrollments — create a new enrollment
app.post('/enrollments', (req, res) => {
  res.send('POST request to enroll in a course');
});

// Catch-all 404 handler — must be last
app.all('*', (req, res) => {
  res.status(404).send('404 - Page not found');
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
```

For a hands-on walkthrough, work through the [Node.js Essentials Tutorial](/SEBook/tools/nodejs-tutorial).

# Test Your Knowledge

{% include flashcards.html id="networking_concepts" %}

{% include quiz.html id="networking" %}

{% include quiz.html id="networking_decisions" %}
