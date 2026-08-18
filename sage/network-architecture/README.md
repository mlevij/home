# Handoff: Sage Grande Testbed — Interactive Network Architecture Flowchart

## Overview
An interactive, clickable network-architecture diagram built for the Sage Grande Testbed (SGT) program (CSU Soil & Crop Science / Agricultural Experiment Station, partnered with Sage and NEON/Battelle). It shows the progression of the deployment across three stages — a Chicago-based Thor-Blade test node (today), a Thor-Blade node mounted at a NEON tower/CPER site (near-term), and a stripped-down field edge node with sensors/camera/mic (future) — plus a reference OSI/TCP-IP model tab and an acronym glossary.

## About the Design Files
The file in this bundle (`Networking Architecture Flowchart - standalone.html`) is a **fully self-contained, working HTML page** — not just a static mock. It has no server dependency and can be dropped directly into a static site or GitHub Pages as-is. The `source/` folder holds the original design-tool source (`.dc.html`) for reference only — it depends on a proprietary runtime and **will not run outside this design tool**; use the standalone file for actual deployment, and use the source only to understand structure/content when reimplementing in your own stack (e.g. as a React/Vue component, or hand-written JS) if you want it to match your site's build system instead of being a dropped-in static file.

## Fidelity
**High-fidelity.** This is a finished, working prototype with final colors, typography, copy, and interactions — not a wireframe. It can be shipped as-is or reimplemented faithfully.

## Screens / Views
Single page, four tab-switchable views (segmented control, top-left of header):

1. **Stage 1 · Chicago** — Client workstation → Internet (dashed line, "SSH / RDP" label) → Thor-Blade Test Node (Chicago). Clicking the Thor-Blade node's "+" badge opens an internal-diagram dialog (Compute Module, Integrated Router, WAN Port, LAN Port, Network-Controlled PDU).
2. **Stage 2 · NEON Tower** — NEON Tower (CPER site) co-located with NEON's own sensors and the SGT/Thor-Blade node; the tower's sensors feed data into the node ("sensor data" label, arrowhead pointing into the node); host-provided site-network sensors also feed in; node → Internet ("WAN uplink") → Sage Cloud (Beehive, hosted at Northwestern University).
3. **Stage 3 · Field Node** — Environmental sensors, camera(s), and microphone (LAN-connected) feed a stripped-down edge node, which uplinks to Sage Cloud the same way.
4. **OSI / TCP-IP** — Two columns: the 7-layer OSI model and the 4-layer TCP/IP model, sized so grouped OSI layers visually align with their TCP/IP counterpart (flex-grow proportional to layer count). Each box shows its title, protocols, and a one-line definition inline; clicking cross-highlights the corresponding layer(s) in the other column.

### Layout
- Header bar: 56px tall, dark surface (`#1c1e2b`), bottom border `1px solid rgba(233,233,237,0.16)`. Contains: title, 4-way segmented tab control, (topology views only) "Simulate traffic" + "Reset view" buttons, and a "Glossary" button (always visible).
- Body: flex row — canvas area (flex:1) + a fixed 340px right sidebar (`#1c1e2b`, left border same divider color, scrollable, 20px padding).
- Canvas (topology views): full-bleed SVG, `viewBox="0 0 1600 880"`, pannable (drag empty background) and zoomable (scroll wheel, 0.5×–2.2× via a `<g transform>` wrapper), with a bottom-left hint caption and top-left stage subtitle.
- Canvas (OSI/TCP-IP view): plain HTML flex layout, two columns, 40px padding, 56px gap.
- Sidebar: layer-toggle pills (topology only) at top, then a detail panel that populates on node/layer click (tag chip, title, description paragraph, spec rows, a "Terms" glossary block for acronyms relevant to the selection, and — for drillable nodes — a "View internal diagram" button).
- Two modal dialogs (both `position:fixed; inset:0`, dark scrim `rgba(22,24,38,0.6)`): the internal-diagram drilldown, and the full Glossary list.

### Components
- **Diagram node** (SVG group): rounded rect (`rx:8`, fill `#232532`, 1px border `rgba(233,233,237,0.24)`, 2.5px accent border `#9184d9` when selected), uppercase 9px accent-colored kicker label, 11.5px medium-weight title, 8px muted acronym-expansion caption (e.g. "WAN" → "Wide Area Network") when applicable. A small circular "+" badge (accent-bordered, dark fill) top-right on nodes with a drilldown.
- **Edge**: SVG path, 1.4px default / 2.5px when connected to the selected node, `rgba(233,233,237,0.3)` default / accent `#9184d9` when highlighted, dashed (`7 6`) for non-data-flow/co-location edges, with an arrowhead marker (`<marker id="arrowhead">`) on real data-flow edges only. An inline pill label (dark rounded rect + 9.5px text) sits at the midpoint of labeled edges.
- **Packet animation**: a 4.5px accent-colored circle animated along an edge's path via SVG `<animateMotion repeatCount="indefinite">`, shown only on data-flow edges when "Simulate traffic" is toggled on (and, if a node is selected, only on edges connected to it).
- **Layer pill** (sidebar): pill-shaped toggle, accent border/text/tint when active, muted/transparent when off.
- **OSI/TCP-IP box**: rounded rect div, 1.5px border (accent when selected, dimmer accent when cross-highlighted from the other column, else divider gray), background tint to match.

## Color & Type (design system: "Nocturne")
This inherits Colorado State's bound Nocturne dark design system. Token values (hard-coded as literals per this tool's inline-style convention — see Design Tokens below) — reference `styles.css`/`readme.md` from the Nocturne design-system bundle if you have it, or treat the hex values below as the source of truth.

## Interactions & Behavior
- **Tab switching**: click a segmented-control tab → swaps the whole dataset/view; resets selection and any open drilldown.
- **Node/layer click**: toggles selection (click again to deselect). Selecting a topology node dims (opacity 0.28) all non-connected nodes/edges and highlights connected edges/nodes in accent color. Selecting an OSI or TCP/IP layer cross-highlights its counterpart(s) in the other column.
- **Layer-group pills**: toggle visibility of a whole category of nodes (and any edge whose endpoints are both hidden is hidden too). Independent per stage.
- **"+" drilldown badge**: opens a modal with a small internal sub-diagram (own SVG viewBox, its own nodes/edges, no pan/zoom) plus a short description. Click the backdrop or "Close" to dismiss.
- **Simulate traffic** button: toggles animated packets along all currently-visible data-flow edges (or just the selected node's edges, if one is selected).
- **Pan**: mousedown+drag on empty canvas background; **zoom**: mouse wheel, clamped 0.5×–2.2×.
- **Reset view**: clears pan/zoom, selection, drilldown, and re-enables all layer pills.
- **Glossary button**: opens a scrollable modal listing every acronym used anywhere in the diagram with its full definition.
- No loading or error states — everything is static, client-side data.

## State Management
- `stage`: `'stage1' | 'stage2' | 'stage3' | 'osi'`
- `selectedId` / `selectedSource` (`'topology' | 'osi'`): current node/layer selection
- `groups`: `{ client, wan, compute, site, sensors, cloud }` booleans — layer visibility
- `simulate`: boolean — packet animation on/off
- `drill`: `null | 'thorBlade' | 'waggle'` — which internal-diagram dialog is open
- `showGlossary`: boolean
- `tx, ty, scale`: pan/zoom transform for the topology canvas

All diagram content (nodes, edges, OSI/TCP-IP layers, drilldown sub-diagrams, glossary) is static data baked into the page — no external data fetching.

## Design Tokens
- Background: `#161826` · Surface: `#232532` · Text: `#e9e9ed`
- Accent (single accent, mono scheme): `#9184d9`; light tint `#f5f4ff`; dark tints `#423a6a` / `#423e5d` for tag chips
- Divider: `rgba(233,233,237,0.16)` (borders), `rgba(233,233,237,0.1)`–`0.3` (rules/muted lines)
- Font: Inter (400/500 weight), system-ui/sans-serif fallback
- Radius: 8px (boxes/buttons), 14px (dialogs), 999px (pills)
- Header height: 56px · Sidebar width: 340px

## Assets
No image/icon assets — all visuals are inline SVG shapes (rects, circles, lines, a path-based arrowhead marker) and system text.

## Files
- `Networking Architecture Flowchart - standalone.html` — the working, self-contained page. Deploy this as-is.
- `source/Networking Architecture Flowchart.dc.html` — original design-tool source, for reference/reimplementation only (will not run standalone).
