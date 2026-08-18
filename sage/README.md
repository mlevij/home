# Sage Grande Testbed — Network Architecture Flowchart

An interactive, clickable network-architecture diagram for the Sage Grande Testbed (SGT)
program, showing four views of how these edge-AI nodes connect to the network — a Chicago test
node, a NEON tower (CPER) deployment, a stripped-down field node, and a remote site relying on
Starlink/LoRaWAN — plus a reference OSI/TCP-IP model tab.

## Viewing it

Download `network-architecture/Networking Architecture Flowchart -
standalone.html` and open it in a browser — it's a single self-contained file, no server or
build step required.

## Structure

- `network-architecture/Networking Architecture Flowchart - standalone.html` —
  the working, deployable file. Open this to view/use the diagram.
- `network-architecture/source/Networking Architecture Flowchart.dc.html` —
  the human-readable source (original Claude Design export format), useful for understanding or
  modifying the diagram's content and logic.
- `network-architecture/README.md` — detailed spec of the diagram's design,
  interactions, and data model.
- `dev-notes.md` — running log of what's changed since the initial handoff, and why.
