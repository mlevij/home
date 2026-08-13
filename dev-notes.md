# Dev Notes — Interactive Network Architecture Flowchart

Living context notes for this project, so future Claude Code sessions (or Hermes, if this
ever gets bridged over there) don't have to re-derive what's already been figured out.
Companion to `design_handoff_network_architecture/README.md` (the original Claude Design
handoff spec) — that file describes what the artifact *is*; this one tracks what's actually
happened to it since.

## Project context
- Interactive, clickable network-architecture diagram for the Sage Grande Testbed (SGT),
  showing the deployment progression: Stage 1 (Chicago test node, today) → Stage 2 (NEON
  Tower/CPER site, near-term) → Stage 3 (stripped-down future field node), plus an OSI/TCP-IP
  reference tab.
- Working file: `design_handoff_network_architecture/Networking Architecture Flowchart -
  standalone.html` — self-contained, no server dependency, deployable as-is.
- Goal (per user, 2026-07-30): eventually move this into a private git repo.

## Session log — 2026-07-30

### Bug: diagram box labels not rendering (found and fixed)
Root cause: the Claude Design export's `x-dc` templating runtime wraps every `{{ }}` dynamic
interpolation in a plain HTML `<span class="sc-interp">` element (created generically, not
namespace-aware). Browsers only paint HTML content nested inside SVG when it's wrapped in a
`<foreignObject>` — a bare HTML `<span>` dropped directly into an SVG `<text>` is valid DOM
but never gets painted. Confirmed via live DOM inspection: the "+" drilldown badge (static
text, not a `{{ }}` binding) rendered fine, while every dynamic text binding (node
kicker/label/expansion captions, edge labels, drilldown-modal labels) was present in the DOM
with the correct text content but completely invisible.

**Fix applied**: replaced the three affected `<text>` blocks — the main node label triplet,
the drilldown modal's label pair, and the edge label — with `<foreignObject><div>...</div>
</foreignObject>`, since `<foreignObject>` is the actual SVG-spec mechanism for embedding
HTML content. Verified working by the user after a hard refresh.

**Note for next time this file is touched**: if more text gets added to the SVG canvas later
(new labels, new captions, anything from a `{{ }}` binding), don't write it as a bare
`<text>{{ }}</text>` — it will render invisibly again for the exact same reason. Use the same
`<foreignObject><div>` pattern instead. The one static (non-interpolated) `<text>` element
left in the file — the drill-badge "+" — is fine as-is and doesn't need this treatment.

### Investigated, turned out NOT to be a bug: apparent text corruption
Initially flagged `â€"`-style mojibake in some description text as real file corruption.
Turned out to be a false alarm caused by how the Bash/grep tool displayed UTF-8 bytes in the
terminal — not an actual problem in the file. Verified via raw byte inspection: em-dashes are
correctly UTF-8 encoded (`E2 80 94`) throughout. Nothing was actually broken; no fix needed.

### Stage 2 data-flow question — NEON Tower edge
Currently, selecting "NEON Environmental Sensors" only animates simulated traffic to "SGT
Node (Thor-Blade)" — the one edge marked `dataflow:true`. The `neonSensors↔neonTower` and
`neonTower↔thorTower` edges are both just dashed "co-located" relationships (no animated
data flow).

Clarified with the user: NEON's sensors report both to the SGT/Thor-Blade node AND NEON's own
internal network. "Host-Provided Sensors" (`hostSensors`) is a real, distinct node — not
redundant with the NEON sensors — most likely representing CPER's host-site (USDA-ARS)
instrumentation, separate from NEON's own DP1 sensor suite, even though both sit at the same
physical site.

**Proposed fix, pending confirmation as of this note**: turn `neonSensors → neonTower` into a
real dataflow edge (solid line, arrowhead, animated, labeled something like "NEON science
network") representing that internal-telemetry path. Leave `neonTower → thorTower` as the
dashed co-located line (no described data relationship between the tower structure itself and
the SGT node — the SGT node's data comes directly from the sensors/host sensors, not the
tower). Leave `hostSensors → thorTower` untouched.

## Planned (NOT STARTED): a future "physical/operational" layer
User wants to eventually add another layer/view to this diagram documenting the actual
hands-on operational reality behind each node — not just the conceptual network architecture
already shown, but:
- The actual commands used to connect to each node (SSH, tmux session management/attach
  conventions, venv activation, `hermes` launch, etc.) — the same workflow already logged in
  the Sage workshop's own dev notes (`Sage/dev-notes/*.md`) for H037/Hermes work.
- What each diagram node actually maps to physically/technically — real hardware (physical
  machines, switches, routers) vs. software layers (venvs, Hermes itself) vs. conceptual/
  network entities that don't correspond to a single physical thing.

This would connect the abstract architecture diagram to the concrete hands-on Sage Grande
workshop work already documented elsewhere, rather than duplicating it.

**Explicitly deferred** — flagged by the user on 2026-07-30 due to possible session/usage
constraints. This section is a placeholder plan only; nothing below has been started.

### Rough plan for whenever this gets picked up
1. Decide how this layer is best represented in the existing UI: a new 5th tab/stage in the
   segmented control, an expansion of the existing per-node sidebar detail panel (e.g. an
   "Operations" section alongside the existing title/description/specs), or a separate
   companion document entirely — each has different implications for how much new template
   structure needs to go through the `x-dc` runtime (see the labels bug above — hand-editing
   this compiled output is workable but fragile; regenerating through Claude Design again
   might be safer for a structural addition this size).
2. Inventory the real commands/access patterns to document per node — pull directly from the
   existing Sage session notes (SSH command patterns, tmux session naming/attach conventions,
   venv activate steps, `hermes` launch, `pluginctl` usage) rather than re-deriving from
   scratch.
3. Map each diagram node to its physical/technical reality — e.g. which nodes are actual Sage
   Thor-Blade hardware (Chicago test node, the eventual CPER node) vs. conceptual/network
   entities (Internet, Sage Cloud/Beehive) vs. NEON-owned infrastructure not directly
   SSH-accessible (NEON Tower, NEON Environmental Sensors) vs. software layers (venv, Hermes)
   that sit on top of a physical node rather than being a separate node in their own right.
4. Given the proprietary compiled `x-dc` template runtime can't easily be hand-extended
   without risking the same class of rendering surprise as today's label bug, decide upfront
   whether new content for this layer should go back through Claude Design rather than being
   hand-edited into the compiled HTML directly.

## Session log — 2026-08-04

### LoRaWAN layer — raised, not yet added (blocked on topology confirmation)
User was testing SSH access on W021 (a retired Thor-Blade node physically at CSU, used as a
local practice/deployment-test rig — still fully live: k3s, containerd, influxd, and an active
`top_camera` plugin all running despite being "retired") ahead of a real field deployment in a
few weeks. Found real LoRaWAN-adjacent hardware/software on it:
- An unidentified FT232 USB-serial device (`/dev/ttyUSB0`) — a plausible LoRaWAN concentrator
  interface, never conclusively identified (same unidentified FT232 was also seen on H02E
  during the July workshop and guessed-but-unconfirmed as GPS there — a separate U-Blox AG USB
  device is the more likely GPS candidate on W021).
- A `chirpstack_ip` helper command on the node, returning a k3s-internal ClusterIP
  (`10.43.161.62`, in k3s's default `10.43.0.0/16` service range) — confirms **ChirpStack**
  (open-source LoRaWAN Network Server) is running locally under k3s on this node, with its web
  dashboard on port 8080. Reached it from a laptop via SSH local port-forward:
  `ssh mlevij@waggle-dev-node-W021 -L 8080:10.43.161.62:8080`, then browsing to
  `localhost:8080` — tunnel confirmed working, UI login not yet completed as of this note.

**Prompted the idea of adding a LoRaWAN layer/nodes to this diagram** — nothing built yet.
Raised an open real-world topology question first: user described the CPER field site's ARS
bunkhouse as having "Starlink tied to a LoRaWAN which connects the current node at CPER to the
internet" (CPER node's own VSN not recalled), but also separately knows the Thor-Blade there
has conventional LAN/WAN cables into a switch inside the hut — an apparent contradiction the
user wants to clarify with a colleague before committing anything to the diagram.

**Hypothesis offered (unconfirmed)**, based on the W021 pattern above: LoRaWAN gateway
hardware + ChirpStack may live *on* each node to pull in remote field-sensor data over RF
(sensors → node), a separate concern from the node's own LAN/WAN internet uplink — rather than
LoRaWAN being the node's path *to* the internet. Needs confirmation against the actual CPER
bunkhouse wiring before treating as fact.

**Next steps once clarified**:
- Get the real hop order confirmed (does LoRaWAN sit upstream of the node's internet access,
  downstream feeding sensor data into it, or both in different roles) and the CPER node's VSN.
- Decide where LoRaWAN nodes/edges go in the diagram (Stage 2 CPER-specific vs. Stage 3
  generic future-field-node vs. both) and whether to model it generically or reflect the real
  W021/ChirpStack specifics found today.
- Still-open editing-approach question from the original plan above (hand-edit standalone HTML
  vs. regenerate via Claude Design) applies here too — not yet decided.

### Update, same session: topology clarified, Stage 4 built

User corrected the ARS/CPER framing above: **CPER's own Thor-Blade already has its own internet
connection** (Stage 2 is correct as-is, no change needed there). The Starlink/LoRaWAN pattern
described is a *different* site type — e.g. an ARS field station with no pre-existing network at
all, where Starlink provides the outbound WAN path and LoRaWAN is a separate, local, inbound path
bringing in a physically separate instrument node's data (not a serial LoRaWAN→Starlink chain,
which would be an unusual use of LoRaWAN's very low bandwidth anyway).

User chose to represent this as a **new 5th tab** ("Stage 4 · Remote Site") rather than folding
it into Stage 3, so Stage 3's existing generic future-field-node concept stays untouched.

**Built and shipped** (both `source/Networking Architecture Flowchart.dc.html` and the compiled
`Networking Architecture Flowchart - standalone.html` were updated in sync):
- New `STAGE_META` entry (`stage4`) inserted before the `osi` tab.
- New `STAGE_DATA.stage4`: 6 nodes (Remote Field Site, Remote Instrument Node [LoRaWAN End
  Device], Edge Node [Bunkhouse] hosting the LoRaWAN gateway + ChirpStack locally, Starlink
  Terminal, Internet, Sage Cloud) and 5 edges. Key modeling choice: LoRaWAN feeds *into* the edge
  node (dashed, dataflow, labeled "LoRaWAN (RF)") as a separate path from the node's own WAN
  chain (edge node → Starlink → internet → Sage Cloud) — no shared edge between the two, per the
  corrected topology above.
- New `GLOSSARY` entry for LoRaWAN (so it surfaces in the node's sidebar "Terms" section and the
  glossary modal), explicitly noting it's for local instrument data, not internet backhaul.
- No new node **group** was needed — the LoRaWAN instrument node reuses the existing `sensors`
  group, Starlink reuses `wan`.

**Editing approach resolved in practice**: turned out the compiled `standalone.html` isn't
directly hand-editable HTML — it's a custom bundler format (`<script type="__bundler/manifest">`
holds a gzip+base64 **runtime** blob, generated from `dc-runtime` and explicitly marked "do not
edit"; `<script type="__bundler/template">` holds the actual page content as a **JSON-string-
encoded blob**, functionally identical to the `source/*.dc.html` file modulo a mechanical
camelCase-attribute rewrite in the markup only, e.g. `onClick` → `sc-camel-on-click`). Since this
addition was pure data (new stage entries in the existing `STAGE_META`/`STAGE_DATA`/`GLOSSARY`
arrays, no new markup), no markup rewriting was needed — edited `decoded_template.html` (a
throwaway local decode of the template blob, since deleted) matched `source/*.dc.html`'s JS
section byte-for-byte, so the same edit was applied to both, then re-encoded (`json.dumps` +
global `/`→`/`, matching the original's own escaping convention) back into the compiled
file's single template line. **For any future edit that needs new markup** (not just new data),
expect to redo this same decode → edit → re-encode round trip, or go back through Claude Design —
don't try to hand-edit the visible standalone.html text directly, since the real content isn't
readable there without decoding it first.

**First attempt actually broke the page — found and fixed.** The Chrome extension wasn't
connected this session, so the first pass was only checked structurally (JSON parses,
surrounding tags intact) and shipped without a real browser load. User opened it manually and hit
a near-blank page (just the bundler's built-in "unpacking" placeholder — a triangle-with-three-
circles SVG — plus Chrome's translate prompt oddly offering Afrikaans, a tell that almost no real
text was on the page). The page's own built-in error banner (bottom-right, easy to miss — not
bottom-left as initially guessed) read: `Error unpacking: Unterminated string in JSON at position
186 (line 2 column 186)`.

**Root cause**: the re-encoding script was supposed to escape every literal `/` in the JSON-
encoded template string as the 6-character sequence backslash-u-0-0-2-F — mirroring the original
bundler's own convention — but a
bash/Python quoting mistake (nested backslash escaping across a `py -c "..."` call) silently
turned this into a no-op. The raw JSON itself was still perfectly valid (confirmed via
`json.loads` both before and after — this is why the earlier structural check passed), but the
un-escaped template content contains its own nested `<script src="...">​</script>` tag near the
very top (from the template's own `<head>`). Browsers tokenize `<script>` content as raw text and
end the element at the **first literal `</script>` substring**, regardless of JS/JSON semantics —
so the real `<script type="__bundler/template">` block was being truncated right after that early
nested tag, well before the rest of the page's JSON ever got there. Whatever the runtime's
`JSON.parse` received was just that early truncated fragment, hence "unterminated string in JSON."

**Lesson for next time**: verifying `json.loads()` succeeds on the re-encoded blob is necessary
but **not sufficient** — must also confirm no raw `</script>` (or other unescaped `/` inside a
closing tag) survived the escaping step, since that's an HTML-parser-level failure, not a JSON-
level one. A quick post-encode check worth keeping: `assert '</script>' not in encoded_string`.

**Fixed**: rewrote the encoding step as a standalone `.py` script file (avoiding the bash/Python
nested-quoting trap that caused the silent no-op) and re-ran it against the same file — 157
forward slashes now properly escaped (backslash-u-0-0-2-F each), zero raw `</script>` left in the
blob. User
confirmed the page loads correctly after a hard refresh. Stage 4 is now genuinely verified
working, not just structurally plausible.

### Follow-up, same session: framing + "networking for dummies" content pass

User feedback after inspecting the live page:
- Fonts/boxes are small by design (zoomable canvas) — no change needed, just hadn't remembered
  the zoom feature existed.
- The per-stage temporal framing ("Today —", "Near-term —", "Future —") reads like a committed
  roadmap rather than four different lenses on the same project. Dropped the temporal language
  from all four subtitles, and (per user's explicit choice) dropped the "Stage N ·" prefix from
  the tab labels entirely — tabs now just read "Chicago", "NEON Tower", "Field Node", "Remote
  Site", "OSI / TCP-IP".
- The pan/zoom/interaction hint ("Scroll to zoom · drag background to pan...") moved from
  bottom-left of the canvas to directly under the stage subtitle at the top — no longer easy to
  miss.
- Clicking a topology node or an OSI/TCP-IP layer only ever showed a plain glossary-style
  definition. User asked for (a) a real-world example under every term, framed in Sage's own
  context where sensible, in **both** the topology node Terms panel and the OSI/TCP-IP tab (not
  OSI/TCP-IP only — explicitly chose the broader option), and (b) a real-life example under each
  OSI/TCP-IP **layer's own** description too (e.g. clicking "Application" should say what an
  application actually is, not just list HTTP/DNS/SMTP).
- User also flagged, while clicking around: didn't remember what "subnet" meant, despite it
  appearing in a node's spec line — explicit signal to treat this whole thing as "networking for
  dummies" rather than assuming prior networking literacy.

**Built**, applied identically to both `source/*.dc.html` and the compiled `standalone.html`:
- `GLOSSARY` grew from 30 to 43 entries — every existing entry gained an `example` field, and
  added net-new beginner terms that were being used in the diagram's own text but never defined:
  Subnet, Firewall, Bastion, ISP, LEO, RF, Ethernet, PPP, JPEG, ASCII, Wi-Fi, Cellular.
- All 7 `OSI_LAYERS` and 4 `TCP_LAYERS` entries gained an `example` field (a real-world/Sage-
  grounded illustration of the layer itself, not just its protocols).
- `renderVals()`'s `isOsi` branch now sets `terms:` (via the same `Component.findAcronyms` helper
  already used for topology nodes) and appends `'Example: ' + o.example` to `specs` — previously
  this branch set neither, so OSI/TCP-IP selections never showed a Terms section at all.
- Topology-node term scanning widened from `[n.label, n.kicker].concat(n.specs)` to also include
  `n.desc` — jargon that only appeared in a node's description (e.g. "bastion" in the Chicago
  node's own desc) is now eligible to surface as a defined term, not just spec-line jargon.
- Sidebar Terms block and the full Glossary modal both gained an "Example: ..." line under each
  term's definition (new markup, not just data — see below).

**Process note for future edits**: this round needed real markup changes (not just new data), so
the earlier "just add data, no markup risk" shortcut didn't apply. Went through the full
decode → edit → re-encode round trip again: extracted the *live* (already-fixed) compiled
template fresh via `json.loads`, applied the identical set of edits to both it and
`source/*.dc.html`, verified bracket balance matched between the two before re-encoding, and this
time added explicit guardrails to the encode script itself — `assert '</script>' not in
encoded_fixed` and `assert json.loads(encoded_fixed) == original_text` — so the exact class of
bug from the first Stage 4 attempt can't silently ship again. Also hit the *same* bash/`py -c`
nested-quoting trap a second time when re-running the escape-replacement inline; fixed the same
way, by writing the encode step to a standalone `.py` script file instead of an inline command.
**Lesson reinforced**: never run this project's encode/replace step as an inline `py -c "..."`
through Bash — always a script file. Verified all four checks (stage4 present, Subnet/Bastion
terms present, moved hint present, `gi.example` present in the compiled output) before reporting
done.

**Not yet independently re-verified in a live browser this round either** (Chrome extension still
not connected) — checked structurally only. User is currently inspecting live; ask them to
hard-refresh and confirm before treating this pass as done, same caveat as last time.

**Also raised, explicitly deferred to right after this pass**: user thinks there may be a
separate physical gateway/router between the internet and the Chicago Thor-Blade — distinct from
the Thor-Blade's own *internal* "Integrated Router" already shown in its drilldown. Not yet
investigated or resolved.

### Follow-up, same session: SSH bastion node, rename, Client-pill question

**Sage SSH Gateway (Bastion) added to Stage 1.** User connected to W021 earlier this session and
noticed two separate SSH passphrase prompts, and wondered whether there's a physical
network gateway/router between the internet and the Chicago Thor-Blade that the diagram was
missing. Resolved from the W021 login transcript already in this session: the two prompts are
explained by the bastion-host pattern (`~/.ssh/config`'s jump-host block, `beekeeper.sagecontinuum.org` —
the login banner literally says "Welcome to our node SSH gateway"). This is a real separate
machine, but it's an SSH/application-layer jump host, not necessarily proof of a distinct
physical network router — those are different questions. Added the SSH gateway as its own node
since Stage 1 previously skipped straight from Internet to the Thor-Blade, glossing over a real
hop: `Your Workstation → Internet → Sage SSH Gateway (Bastion) → Thor-Blade`. Also corrected
`csuWorkstation`'s own description, which previously said "no VPN or bastion in this setup" —
no longer accurate now that the bastion is shown explicitly.

**Whether a separate physical router also exists**: user is not pursuing this now — plans to ask
Sage directly and have other networking-savvy friends review the diagram generally. Left
unresolved, not blocking.

**"Bunkhouse" → "Field House"**: user didn't like the ARS-bunkhouse-specific term on the Stage 4
edge node label (too specific to one physical site) — renamed to the generic "Edge Node (Field
House)" in both files.

**"Client" pill empty on Remote Site, explained not fixed**: user noticed toggling only the
"Client" layer pill on Stage 4 (top of the sidebar) shows nothing, and asked whether the edge
node should count as "Client." Checked: `client` group only ever has one node in this whole
diagram — Stage 1's "Your Workstation (CSU)" — Stage 2 and Stage 3 are *also* already empty for
`client`, so this isn't a new Stage-4-specific bug. In this diagram's vocabulary "Client"
specifically means the human's own workstation reaching in via SSH, not the deployed edge/compute
node itself (which is correctly tagged `compute`). Explained to user, offered to grey out/hide
empty layer pills per-stage as a UX polish if wanted — not done, no decision yet.

Both `source/*.dc.html` and the compiled `standalone.html` updated identically and re-verified
(bracket balance matched between the two, `assert '</script>' not in encoded` and round-trip
`json.loads` checks both passed before writing). Not yet re-confirmed live in a browser — same
standing caveat as the last two rounds.

## Session log — 2026-08-13

### Stage 2 LoRaWAN gateway added — CPER topology confirmed via install photo

Follow-up to the 2026-08-04 "topology clarified, Stage 4 built" entry above, which left CPER's
own LoRaWAN setup unaddressed (Stage 4 was explicitly scoped to a *different* site archetype —
a true remote site with no pre-existing network at all). Separately, while comparing this
diagram against a real physical wiring schematic (`Simplified Network Connection Schematic
20250922.pptx`/`.png`, showing a Tower + Instrument Hut with a PoE injector, switch network,
security camera, and LoRaWAN IoT Gateway all wired via PoE/VLAN), and a hardware procurement
list (dedicated floor-mount hardware for a "LoRaWAN Gateway," separate from the camera and from
the PoE injector's own weatherproof outdoor housing), the user confirmed — first via
`Sage Grande Deployments.txt` (PUUM described as "CPER mirror essentially," LoRaWAN "coming
down to the middle of the tower/network switch"), then definitively via an actual install photo
— that CPER does have a LoRaWAN gateway, tower-mounted and PoE/Ethernet-attached, not something
they'd been involved in planning personally ("this is what happens when i dont do installs").

**Confirmed topology**: the LoRaWAN gateway is a physically separate device mounted on the NEON
tower itself, PoE-powered off the tower's own switch — not hosted locally on the Thor-Blade the
way Stage 4's `edgeNodeRemote` node models it (USB-attached concentrator + local ChirpStack, per
the W021 empirical finding). It's for current/future low-power sensor telemetry only — explicitly
not for internet backhaul, and not for node-to-node communication (LoRaWAN is a star topology by
design: every end device reports up to the gateway only, nothing talks peer-to-peer).

**Built**, applied identically to both `source/*.dc.html` and the compiled `standalone.html`:
- New `stage2` node `loraGatewayCper` ("LoRaWAN Gateway", group `site`, positioned near
  `neonTower`) with a description covering the mount, PoE power, and the two explicit "not for"
  clarifications above.
- Two new `stage2` edges: `neonTower → loraGatewayCper` (dashed, "mounted on tower" — same
  co-located convention as the existing tower/sensor/node edges) and
  `loraGatewayCper → thorTower` (dashed, dataflow, "LoRaWAN sensor data").
- New `PoE` glossary entry (Power over Ethernet) — didn't exist yet despite being implied by the
  Thor-Blade spec doc's "LAN subnet ... for optional PoE-connected sensors" line found back on
  2026-08-04.
- **Fixed a glossary entry that would otherwise have gone stale**: the existing `CPER` glossary
  example previously said CPER "doesn't need a Starlink/LoRaWAN setup the way the Remote Site
  view does" — true for the Starlink/WAN part, but now wrong on LoRaWAN specifically now that
  Stage 2 has its own gateway. Reworded to distinguish CPER's *local-telemetry-only* LoRaWAN use
  from Stage 4's Starlink-style *WAN workaround* use, rather than implying CPER has no LoRaWAN at
  all.

**Process note — a new failure mode in the decode/edit/re-encode round trip**: the compiled
template's underlying JS source represents apostrophes and em-dashes as literal 6-character
`’`/`—` escape-sequence *text*, not the actual Unicode glyph — confirmed by direct
`repr()` inspection after a first edit attempt raised `count == 0` for a search string built by
hand-typing real Unicode characters into a Python script. Rather than hand-converting every
apostrophe/dash (error-prone), the working script extracts the exact old/new text spans directly
from the two files via anchor-string slicing (`str.index`/`str.count`-based, e.g. from
`"{id:'hostSensors',"` up to `"\n    stage3: {"`) instead of retyping any Unicode-sensitive text
at all — sidesteps the encoding-convention question entirely by never manually reproducing text
that has to match byte-for-byte. **Lesson for next time**: never hand-type old/new strings for
this file's edit script when the same text already exists verbatim in either file — extract it
by anchor instead.

All standing guardrails re-verified (bracket balance matches within each file, `json.loads`
round-trip, no raw `</script>` survived escaping, new content confirmed present via a fresh
independent re-read after writing). **Not yet confirmed live in a browser** — Chrome extension
still not connected this session, same standing caveat as every round in this file so far.

### Same session, continued: security camera added (NEON Tower), LoRaWAN pulled out on Remote Site too

User's stated principle: "if a site has a lorawan, a phenocam and/or other instruments, we
should have those showing with their connections" — instrumentation should be its own visible
node with real edges, not folded into a compute node's description text. Applied to both stages
that had this problem.

**NEON Tower (`stage2`)**: added `cameraCper` (Security Camera, group `sensors`, tower-mounted,
PoE-powered) — confirmed via the same physical schematic and hardware procurement list that
confirmed the LoRaWAN gateway. Two new edges: `neonTower → cameraCper` (dashed, "mounted on
tower") and `cameraCper → thorTower` (dashed, dataflow, "via site network" — same pattern as
`hostSensors`'s edge, since it reaches the node the same way).

**Remote Site (`stage4`)**: pulled the LoRaWAN gateway out of `edgeNodeRemote`'s description
into its own node, `loraGatewayRemote` (LoRaWAN Gateway, group `site`, kicker "On-Node
Hardware") — distinct from CPER's `loraGatewayCper` in one real way: this one is modeled as
USB-attached directly to the edge node itself (per the W021 empirical finding: an unidentified
FT232 USB-serial device + locally-running ChirpStack), not mounted as separate site
infrastructure the way CPER's tower-mounted gateway is. `edgeNodeRemote`'s own desc/specs
reworded to say it *runs ChirpStack* rather than *hosts the gateway*, now that the gateway
hardware is its own node. Edges: `edgeNodeRemote → loraGatewayRemote` (dashed, "USB-attached")
and `loraInstruments → loraGatewayRemote` (dashed, dataflow, "LoRaWAN (RF)") — replacing the old
direct `loraInstruments → edgeNodeRemote` edge.

**Also fixed while in there**: `remoteSite`'s desc/specs still said "unlike CPER (Stage 2)" in
two places — stale now that the diagram's own tabs dropped "Stage N" labeling back on
2026-08-04 (user asked to stop using "Stage N" in conversation too, going forward — refer to
tabs by their actual names: Chicago, NEON Tower, Field Node, Remote Site, OSI/TCP-IP).

**Process note — the Unicode-escaping convention is not uniform across the file.** Assumed after
the last round that *all* apostrophes/dashes in the compiled template's decoded JS are literal
`’`/`—` escape-text. Wrong — some regions (e.g. the `stage4` block, untouched since its
original 2026-08-04 build) use the actual Unicode glyph directly, while others (e.g. content
added in the previous LoRaWAN-gateway round) use literal escape text. A hand-typed edit against
`stage4` using literal `’` text failed to match for exactly this reason. **Confirmed via
direct `Read` tool calls on specific lines** (not through Bash/print pipes — a `python -c` call
piped through Bash and a background-task output file produced a mangled `�` character for a
real em-dash that the direct `Read` tool rendered correctly moments earlier; same false-alarm
class as the 2026-07-30 mojibake investigation above, not real file corruption). **Practical
approach that worked**: don't assume a convention at all — check each specific location directly
via `Read` before constructing a match, and prefer whole-block anchor-slice replacement (start
anchor to a stable end anchor, e.g. `"{id:'neonTower',"` through `"\n    stage3: {"`) over
incremental hand-typed edits wherever the block is being substantially rewritten anyway.

Same guardrails re-verified (brace/bracket balance in both files, `json.loads` round-trip, no
raw `</script>`, new content confirmed present post-write). Not yet confirmed live in a browser.

### Same session, continued: repo merged into mlevij/home, kicker simplified

**This repo is now also mirrored into `mlevij/home` at `sage/`**, via `git subtree` (history
preserved, same pattern as the earlier `findings-template` → `analysis/moffat/` merge in that
repo). Live at `mlevij.com/sage/` as well as this repo's own GitHub Pages URL. Going forward,
changes made here should be pushed to this repo first, then pulled into `mlevij/home` via
`git subtree pull --prefix=sage <this-repo-url> main` — do not edit the `sage/` copy inside
`mlevij/home` directly, or the two will drift. Whether this standalone repo eventually gets
archived/made private once `mlevij/home` is the primary home (matching what was just done to
`findings-template`, which had the same orphaned-duplicate problem after its own migration) is
not yet decided — don't assume either way without checking.

**Kicker simplified**: `loraInstruments`'s kicker changed from "LoRaWAN End Device" to "Field
Sensor" — user feedback that the jargon-y kicker didn't say what the thing actually *is* (a
sensor) even though the diagram is meant to be readable without prior networking literacy. The
technical detail (LoRaWAN link) stays in `specs`, just not in the first thing a reader sees.

### Noted for later, NOT started: Wild Sage Node (outdoor Thor) test rigs

Info from Sage's team, relayed 2026-08-13 — **explicitly deferred, not this session**:
Sage is standing up three outdoor test enclosures for the Thor node (the "Wild Sage Node") at
ANL, essentially the same Sage Blade hardware in a weatherproofed outdoor box:

- **"BigBoy"** — 20x16x12in, oversized enclosure with an air-to-air heat exchanger (methanol
  heat pipe, 44W/C cooling capacity, likely overkill by design — "start big and scale down").
  External + internal T/RH sensors, 24V power for the HX. Already at ANL, Sage engineers
  configuring control-software plugins to cycle the cooler on/off.
- **"Slim"** — 20x16x8in, smaller HX (22W/C, 2in thinner), saves 6in of depth vs. BigBoy. Being
  ordered, targeting assembly by Aug 26 — testing in hot weather to see if half the cooling
  capacity is still enough.
- **"Zephyr"** — vented enclosure (Altelix, an enclosure vendor) using a telecom-style
  hydrostat-controlled heating plate instead of an HX — keeps internals 5-10C above dew point
  rather than actively cooling. Cheaper, but only suited to clean-air sites (not high-corrosion
  environments like volcanic sites, where the stainless-steel HX route is the safer bet).
  Configuration not yet back from Altelix as of this note.

All three report T/RH (external and internal) and cooling-system-active status as sensor data.
Sage's own team is setting up a separate repo with full documentation for the test parts.

**Why this matters for the diagram**: none of the existing four tabs (Chicago, NEON Tower,
Field Node, Remote Site) represent an *outdoor-enclosure* Thor deployment — Field Node
("Stripped-Down Edge Node") is a reduced-compute variant, not an outdoor-hardening variant, so
this may need to be its own tab/view eventually rather than folded into an existing one. Not
enough is settled yet (enclosure choice undecided among the three, no repo link yet, no VSN) to
model anything concretely — revisit once Sage's own test-parts repo exists and/or one
configuration is chosen as the production standard.

### Noted: CPER Sage node connectivity issue — NEON network engineer actively investigating

NEON's assigned network engineer is actively troubleshooting the known CPER Sage node
connectivity issue (unresolved as of the 2026-07-28 workshop notes). Router-level diagnostics
(ARP table on the node's VLAN) showed the node's address(es) unresolved — the router sent ARP
requests and got no reply, while the router's own interface on that VLAN resolved normally. That
pattern points toward a link-layer/power/config problem on the node's own side (not connected,
not powered, or misconfigured) rather than a routing or firewall issue on the network side. Still
open — revisit once there's more to report. (Specific IPs/hostnames/names intentionally omitted
here — this is a general-context note only.)

### Same session, continued: full tab rebuild — Chicago removed, Field Node and Wild Sage Node

This was the biggest content rework this diagram has had, driven by a genuine "wires crossed"
realization: when Remote Site was originally built (2026-08-04), the user was actually picturing
the Wild Sage Node / Waggle-fleet concept, not the Starlink+LoRaWAN-no-network scenario that got
built under that name. Untangling this took several rounds of real data-gathering from Sage's
own node portal before any file got touched — worth reading in full if this needs revisiting,
since a lot of intermediate hypotheses turned out wrong (e.g. "WSN uses Thor-class compute like
the tower" — false, confirmed WSN nodes run **Jetson Xavier NX**, not Thor; Sage's team's
outdoor-Thor test rigs are the *next-generation* WSN, not what's currently deployed).

**What actually settled it**: the user pulled real attached-hardware listings from Sage's portal
for multiple nodes (LHIA/H0??, W070, NU/W099, VLPK/W095, AMK/W06C — general WSN fleet examples —
plus CPER1/H019 = confirmed CPER-ARS, UIC, and LCUF — actual SGT-program nodes). Cross-comparing
these gave a real, evidence-based baseline instead of another guess.

**Chicago tab removed entirely** — it was only ever the user's own scratch reference for
figuring out how to reach the practice/workshop nodes, not a real deployment archetype. Default
tab changed from `stage1` (deleted) to `stage2` (NEON Tower).

**Field Node rebuilt to represent CPER-ARS** — a real, distinct SGT installation at CPER,
separate from the NEON tower on the same property (confirmed: `H019` = CPER-ARS in Sage's
portal). Old content ("Stripped-Down Edge Node," generic reduced compute + normal WAN/LAN) was
simply wrong for this site — replaced with what's actually confirmed: **AGX Thor** compute
(same Thor family as the NEON tower, per the portal's `agx-thor` listing), a LoRaWAN Gateway
attached to the node, and **Starlink** for WAN (per the user directly, even though the portal
currently only shows the LoRaWAN gateway installed — this models the target architecture, not
just today's partial rollout, per explicit instruction: "build the network architecture around
the highest possibility"). This is essentially the old Remote Site content, correctly
re-attributed to where it actually belongs.

**Remote Site renamed Wild Sage Node, rebuilt from real portal data.** Confirmed baseline
(present across nearly every WSN example checked, several listed at 90/90-ish nodes fleet-wide
in Sage's own hardware catalog): two cameras (Hanwha bottom XNV-8081Z + top XNF-8010RV), rain
gauge (Hydreon RG-15), microphone (ETS ML1-WS IP54), GPS (Geekstory VK-162), BME280 + BME680
(temp/pressure/humidity/gas), all housed in a Stevenson Shield, on **Jetson Xavier NX + Raspberry
Pi 4B** compute. Modeled as a `Sensor Suite` node (consolidated rather than one node per sensor,
to keep the canvas readable) feeding the compute node.

Confirmed as genuinely **site-specific, not universal** (present on some real examples, absent
on others — kept as a separate, clearly-optional node rather than folded into the baseline):
LoRaWAN Gateway + Antenna (~18/90 nodes fleet-wide, always paired with its own dedicated third
compute unit for LoRaWAN duties specifically). Left out of this pass as *not yet confirmed
universal enough to model*: extra cameras (Mobotix M16, Hanwha PTZ), Vaisala WXT weather
transmitter, and the AQT530-vs-ES-642 particulate sensor choice — these clearly exist on richer
nodes but aren't part of the confirmed baseline the way the core sensor set is.

**WAN modeled as a single "Cellular or Starlink" node**, not picked one way — per the user,
neither option is confirmed as the default (asked Sage's own team, got "not sure" back), and
edge cases (no cell signal) plausibly need Starlink even where cellular is typical. Kept
deliberately generic rather than guessing.

**`WAGGLE_DRILL` repurposed** (title, desc, and internal node/edge structure) to reflect the
real Xavier NX + Raspberry Pi architecture instead of a vague "reduced compute module" — now
titled "Wild Sage Node — Internal." Field Node's compute node points at the existing
`THOR_BLADE_DRILL` instead, since AGX Thor is the same platform family as the tower's Thor-Blade.

**Eight `GLOSSARY` examples fixed** that referenced either the removed Chicago tab (SGT, PDU,
SSH, VPN entries) or the old Remote Site framing (CPER, ISP, RF, LoRaWAN entries) — all reworded
to reference real, still-current content (NEON tower, CPER-ARS, Wild Sage Node) instead of
dangling references to removed/renamed things.

**One real open thread, not modeled**: whether "urban" WSN deployments (e.g. wired into a
city's own network) differ from rural ones beyond just the WAN choice — raised by the user,
not yet resolved on their end either ("again, i dont know"). UIC's node (sap flow meter, gas
flux analyzer, generic SDI-12 loggers) looks like a genuinely different ecological-research
instrument mix, not a WSN variant at all — worth clarifying whether it's in scope for this
diagram before assuming it fits anywhere.

Same guardrails re-verified as every prior round (brace/bracket balance in both files matches,
`json.loads` round-trip, no raw `</script>`, all new content confirmed present and all removed
content confirmed absent via independent post-write re-read). Committed and pushed (both this
repo and the `mlevij/home` `sage/` mirror) after user review — but see the follow-up bug below,
found immediately after shipping.

### Same-day bug: OSI/TCP-IP tab broke after stage1 removal — found and fixed

User reported the OSI/TCP-IP tab wasn't displaying right after the rebuild above shipped, with
console error `Cannot read properties of undefined (reading 'nodes')`.

**Root cause**: `renderVals()` computes `const stageData = Component.STAGE_DATA[stage] ||
Component.STAGE_DATA.stage1;` — a fallback for the OSI tab specifically, since OSI has no
`STAGE_DATA` entry of its own (it uses the separate `isOsi` flag and `OSI_LAYERS`/`TCP_LAYERS`
data instead). The very next line unconditionally does `stageData.nodes`, even when rendering
OSI. This relied on `stage1` existing purely as a harmless non-null fallback object — deleting
`stage1` in the tab-removal pass above turned that fallback into `undefined`, and `.nodes` on
`undefined` threw. **Fixed**: fallback now points at `Component.STAGE_DATA.stage2` (the new
first/default tab) instead of the deleted `stage1`.

**Second, related bug found in the same sweep** (cosmetic, not yet reported by the user but
would have been visibly wrong): the tab-bar styling logic skips the left-border divider only for
`s.key !== 'stage1'`, so with `stage1` gone every remaining tab — including the new first tab,
NEON Tower — would incorrectly render a divider before it. Fixed the same way, checking against
`'stage2'` instead.

**Lesson**: when removing a `STAGE_DATA`/`STAGE_META` key, grep the whole file for that literal
key string afterward, not just the obvious node/edge definitions — this diagram has at least two
places where a stage key is referenced as an implicit fallback/special-case rather than through
`STAGE_META`/`STAGE_DATA` iteration, and neither was in the block that got directly rewritten.
Confirmed via `grep -i stage1` across the whole file that these were the only two remaining
references before treating this as closed.

Same guardrails re-verified (brace/bracket balance, `json.loads` round-trip, no raw `</script>`,
new fallback values confirmed present and old ones confirmed absent post-write).

### Same day: real names sanitized, glossary deepened past "networking for dummies"

**Real names removed.** `David Clark` and `Pete Beckman` had been used by name in earlier
entries in this file — fine for an internal engineering thread, but this repo (and its
`mlevij/home` mirror) are both public, so both got replaced with role descriptions ("NEON's
assigned network engineer," "Sage's team") throughout this file. Nothing in the diagram content
itself ever had real names — this was a dev-notes-only fix.

**Scope deliberately expanded past the original "networking for dummies" framing** — user wants
to move from "explain this to someone new" toward genuine troubleshooting proficiency, but
explicitly *not* via a step-by-step checklist. The framing given: like learning soil horizons —
understand the mechanism well enough to recognize what you're looking at, not follow a script.
So all additions use the diagram's existing term-plus-real-example format, not a new
procedural/checklist section.

**Ten new glossary terms added**: NAT, Default Gateway, Routing Table (routing fundamentals,
inserted near Subnet), Bandwidth, Latency, QoS (inserted near LEO/Starlink), Certificate
(inserted right after TLS — trust, not just encryption), and three diagnostic tools — Ping,
Traceroute, DNS Lookup (inserted near ICMP, where `ping` was already mentioned in passing).

**Three existing entries enriched** with a diagnostic-recognition angle folded into their
existing example (not a separate checklist item): ARP now also covers what an "incomplete" ARP
table entry actually indicates; PoE now notes what a power (vs. network) failure looks like;
DHCP now notes the symptom of a device that never gets a usable address. Two OSI layer examples
(Network, Data Link) similarly extended with "what a problem at this specific layer looks like,"
so the existing OSI/TCP-IP tab does double duty as the "how do you reason about where to look"
content, rather than adding a redundant flowchart next to it.

**All examples kept generic/hypothetical per explicit instruction** — no real names, no real
IPs/hostnames, phrased as "a device that..." rather than referencing any specific incident
(including the real ARP-troubleshooting thread earlier in this file, which is exactly what
prompted this rule — that stays as an internal dev-note, not something reflected in the
public-facing diagram content).

Same guardrails re-verified as every round (brace/bracket balance, `json.loads` round-trip, no
raw `</script>`, all ten new terms and both enriched OSI examples confirmed present post-write,
zero remaining name references confirmed via direct search). Pushed directly per explicit
instruction — no separate review-before-shipping step this round.
