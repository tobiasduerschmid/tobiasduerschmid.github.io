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

> **Analogy:** Think of a highway between two cities. **Latency** is the speed limit — it determines how fast a single truck makes the journey. **Throughput** is the number of lanes — adding lanes lets you move more total cargo per hour, but it doesn't make any individual truck arrive faster. Scaling horizontally (more servers) adds lanes; optimizing code or adding caches raises the speed limit.

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

Every device on the internet needs a unique address. **IP addresses** solve this by having two parts: a **network** portion (like a city) and a **host** portion (like a street address within that city). Routers use the network portion to forward packets toward the right destination network; once there, the host portion identifies the specific device.

* **IPv4** addresses are 32-bit numbers written as four decimal octets: `0.0.0.0` to `255.255.255.255` (about 4 billion possible addresses)
* **IPv6** was created because the world ran out of IPv4 addresses — it uses 128-bit addresses, providing vastly more unique values

### Localhost and the Loopback Interface

`127.0.0.1` (or its alias `localhost`) is a special address called the **loopback address**. Unlike a normal IP address that routes packets out through your network hardware, loopback traffic never leaves your machine — the operating system short-circuits it internally.

This is why it is indispensable for local development:

* When you run `node server.js`, your server listens on `localhost:3000` (or whichever port you choose)
* Your browser — also running on the same machine — sends an HTTP request to `localhost:3000`
* The OS intercepts the request before it ever touches Wi-Fi or Ethernet and routes it directly to your server process
* No internet connection is required; the traffic is entirely internal to your computer

> **Practical consequence:** A server listening on `localhost` is *only* reachable from the same machine. If a classmate tries to connect to your laptop's `localhost:3000` from their machine, it will fail — `localhost` on their machine refers to *their* machine, not yours.

### Public vs. Private IP Addresses

Not all IP addresses are reachable from the internet:

| Range | Type | Example |
|-------|------|---------|
| `127.0.0.0/8` | Loopback (your own machine) | `127.0.0.1` |
| `192.168.x.x`, `10.x.x.x`, `172.16–31.x.x` | Private (local network only) | `192.168.1.42` |
| Everything else | Public (internet-reachable) | `142.250.80.46` |

Your laptop typically has a private IP address assigned by your router (e.g. `192.168.1.42`). Your router holds the single public IP address that the internet sees. When you deploy a server to the cloud, it gets a public IP — that is what makes it reachable by anyone.

## Ports

An IP address identifies a *machine*, but a single machine can run many networked applications simultaneously (a web server, a database, an SSH daemon…). **Ports** identify which *application* on that machine should receive a given message.

The combination of an IP address and a port — written `IP:port` — is called a **socket address** and uniquely identifies a communication endpoint:

```
192.168.1.42:3000   →  your Node.js server
192.168.1.42:5432   →  your PostgreSQL database
```

* Port numbers range from **0 to 65535**
* **Well-known ports** (0–1023) are reserved for standard services: **80** (HTTP), **443** (HTTPS), **22** (SSH), **5432** (PostgreSQL)
* **Ephemeral ports** (typically 49152–65535) are assigned automatically by the OS for the *client* side of a connection — you never type these in, but every outgoing TCP connection uses one
* When developing locally, you pick an unprivileged port like **3000** or **5000** to avoid needing administrator privileges (ports below 1024 require root/admin on most systems)

## DNS (Domain Name System)

Humans use names like `github.com`; computers use IP addresses like `140.82.121.4`. **DNS** is the distributed directory that translates one into the other — effectively the phone book of the internet.

When you type `github.com` into your browser:

1. Your OS checks its local DNS cache — if it recently resolved this name, it reuses the answer
2. If not cached, it sends a **DNS query** (over UDP, port 53) to a DNS resolver — typically provided by your ISP or configured manually (e.g. Google's `8.8.8.8`)
3. The resolver works through a hierarchy of DNS servers to find the authoritative answer
4. Your OS receives the IP address, caches it for a configurable time (the **TTL**), and the browser proceeds with the HTTP request

This is why DNS uses UDP: each lookup is a single independent question-and-answer pair. If the response is lost, the client simply retries — no persistent connection is needed.

# Transport Layer Protocols: TCP vs. UDP

The transport layer offers two protocols with fundamentally different trade-offs. Choosing between them is one of the most important networking decisions you will make.

## UDP (User Datagram Protocol)

UDP simply "throws" messages at the receiver without establishing a connection first.

* **Fast** and **lightweight** — no connection setup overhead
* **Connectionless** — just sends the data
* **Does not guarantee** delivery or order
* Includes a **checksum** for error detection (mandatory in IPv6), but does not recover from errors — corrupted packets are silently discarded
* If a message is lost, it is simply gone

**UDP is ideal when speed matters more than reliability:** DNS name resolution (a fast, independent lookup where a retry is cheap — though DNS falls back to TCP when a response is too large for a single UDP packet), live GPS position broadcasts in navigation apps, and real-time game state updates (player positions and bullet trajectories in FPS games).

```uml-sequence
@startuml
participant sender: Sender
participant receiver: Receiver

sender ->> receiver: Datagram [1]
sender ->> receiver: Datagram [2]
note right of receiver: checksum failed — discard silently
sender ->> receiver: Datagram [3]
sender ->> receiver: Datagram [4]
note right of receiver: packet lost — never arrives
sender ->> receiver: Datagram [5]
note over sender: sender never knows about\nthe lost or corrupted packets
@enduml
```

## TCP (Transmission Control Protocol)

TCP is more complex but provides **reliable**, ordered delivery. It uses a three-way handshake to establish a connection:

**Connection Setup (3-Way Handshake):**

```uml-sequence
@startuml
participant client: Client
participant server: Server

client ->> server: SYN
server ->> client: SYN-ACK
client ->> server: ACK
note over client, server: Connection established
@enduml
```

**Data Transfer:** Messages are sent in order, each with a **checksum** for error detection (like UDP, but TCP goes further). The receiver sends **ACKs** to confirm receipt. If the sender doesn't receive an ACK within a **timeout**, it retransmits the message — this error *recovery* is what distinguishes TCP from UDP.

```uml-sequence
@startuml
participant client: Client
participant server: Server

client ->> server: Data [seq=1]
server ->> client: ACK [seq=1]
client ->> server: Data [seq=2]
note right of server: packet lost — no ACK sent
note over client: timeout — retransmit
client ->> server: Data [seq=2]
server ->> client: ACK [seq=2]
@enduml
```

**Connection Teardown:**

```uml-sequence
@startuml
participant client: Client
participant server: Server

client ->> server: FIN
server ->> client: ACK
server ->> client: FIN
client ->> server: ACK
note over client, server: Connection closed
@enduml
```

**The cost of reliability:** For N data messages, TCP sends significantly more total messages than UDP — the handshake, ACKs, and teardown all add overhead. UDP would send just N messages.

## TCP vs. UDP — Trade-Offs at a Glance

| | TCP | UDP |
|---|---|---|
| **Message order** | Preserved | Any order |
| **Error detection** | Included (checksums) | Included (checksums), but no error *recovery* |
| **Lost messages** | Retransmitted | Lost forever |
| **Speed** | Slower (overhead) | Fast (no overhead) |

## When to Use Each

| Protocol | Best For | Examples |
|----------|----------|----------|
| **TCP** | Data that must arrive completely and in order | SSH sessions, pushing code to a Git repository, online banking, web browsing |
| **UDP** | Real-time data where speed beats reliability | DNS queries (primarily), live GPS updates, real-time video calls, multiplayer game state |

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
