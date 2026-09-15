# Game glossary

The terms the game architecture docs share. Each term has one owner, the doc that states its rules.

| Term                | Meaning                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| activity            | One attempt at one piece of content, recorded as a single append-only checkpoint stream and verified as a unit.                                                                           |
| activity start      | An activity's first record — the node, seed, and stamps — synthesized locally by the client and verified by the server on ingest.                                                         |
| activity type       | What the avatar does in an activity; supplies the `ActivityExecutor` that advances its simulation.                                                                                        |
| appended anchor     | The position a new activity begins at, marking how far the player claims to have played.                                                                                                  |
| appended head       | `appended_head`: how far the client has written the stream.                                                                                                                               |
| avatar key          | The per-avatar key rolled content derives under; the server holds it under trade custody, and the self-found design holds it on the device.                                               |
| best-of-N selection | The value a scanner extracts by simulating many futures and playing only the best; the quantity these rules price.                                                                        |
| build snapshot      | The avatar's equipment, passives, and level pinned as a simulation input; the client predicts it, the server re-derives and verifies it.                                                  |
| cell coordinate     | The address of one hex cell, and a node's stable id.                                                                                                                                      |
| chain row           | The `activity_chains` row holding one chain's genesis seed, its two anchors, and its replay priority.                                                                                     |
| chain scope         | The stable place an avatar leaves and returns to; a world-map encounter's scope is its map node.                                                                                          |
| chainIndex          | A checkpoint's absolute position along the whole chain, counted from genesis and never reset by a new activity; reward coordinates key on it.                                             |
| checkpoint          | One recorded simulation step: a row keyed `(activity_id, version)` that links the previous checkpoint's hash.                                                                             |
| chunk coordinate    | The address of one square of hex cells, and the unit the generator works in.                                                                                                              |
| cleared frontier    | The set of nodes whose first clear has verified; the boundary replay's reachability check reads.                                                                                          |
| content plane       | Everything that also needs the scope secret: a node's sealed reward and encounter pool. Server-only.                                                                                      |
| continuation        | An activity that resumes a chain scope from a prior attempt's appended position, in the same chain.                                                                                       |
| encounter           | The fight an activity runs at its node; completing it clears the node.                                                                                                                    |
| entropy source      | A source of random outcomes (the seed chain, an avatar key, sealed salt) whose security properties decide whether its rewards may be tradeable.                                           |
| fast-forward        | Reconstruct a gap by deterministically re-simulating the elapsed time from the last known position.                                                                                       |
| first clear         | The one-time grant recorded when a node's clear verifies; it opens the node's neighbours.                                                                                                 |
| forward-exited      | Said of an activity that left active play with honest progress behind it: a terminal checkpoint, a player stop, or an offline cap.                                                        |
| genesis seed        | The seed a chain starts from, which the server mints the first time it reveals the node.                                                                                                  |
| geometry plane      | Everything derived from `userSeed` and a coordinate: positions, edges, difficulty, biome. Public and client-computable.                                                                   |
| head row            | An activity's single row carrying its two cursors, last checkpoint hash, writer session, and status.                                                                                      |
| keyed PRF           | A pseudorandom function `f(key, coordinate)` whose revealed outputs carry no predictive power over unrevealed coordinates.                                                                |
| look-ahead          | Simulating a reachable future offline to inspect its outcome before committing to play it.                                                                                                |
| node                | A place on the avatar's map, and the target one activity is an attempt at.                                                                                                                |
| offline budget      | The per-avatar simulated-time meter, refilled at wall-clock rate and debited per accepted batch.                                                                                          |
| position            | One point on the chain: a seed and a `chainIndex`.                                                                                                                                        |
| predecessor         | The avatar's immediately-prior activity across every chain, stamped by the device at start; the verifier waits for it before adjudicating.                                                |
| provenance          | An outcome's recorded security property (its entropy unpredictable at commit and tied to the minter) which decides tradeability; stamped from server records and the `entropySource` tag. |
| reveal              | The region a player has earned sight of: a union of hex discs over the avatar's verified first-clear nodes and the origin, derived and never stored.                                      |
| reward coordinate   | `(avatarID, scopeType, scopeID, chainIndex, ordinal)`, the deterministic position a rolled reward commits at.                                                                             |
| reward tail         | The rare, large upper end of a reward distribution; where best-of-N selection extracts its value, so tail-bearing entropy stays sealed.                                                   |
| rolled reward       | A reward whose value lives in its roll, committed at a coordinate and revealed later under a key; an item drop is the concrete case.                                                      |
| scope secret        | The per-avatar secret the server holds and never ships; without it `userSeed` derives no content.                                                                                         |
| sealed descriptor   | The keyed digest a node's contents derive from, uncorrelated with anything on the geometry plane.                                                                                         |
| sealed salt         | Server-held entropy for a tail-bearing roll, drawn online and committed before the player commits; the [crafting entropy note](../../game-design/crafting-entropy.md) owns it.            |
| seed chain          | One forward sequence of positions per avatar per chain scope; each activity draws positions from it and never draws one twice.                                                            |
| segment             | The run of checkpoints the verifier adjudicates as one piece; each segment settles what it proved.                                                                                        |
| selection           | The set a player may travel to: the origin, cleared nodes, and every node an edge joins to a cleared node.                                                                                |
| settle              | The server's verified application of an activity's rewards; the moment provisional becomes real.                                                                                          |
| sim snapshot        | The engine's serializable projection from `getSnapshot()`, which viewer tabs render.                                                                                                      |
| sim version         | The engine build's version stamp (`simVersion`); pins which code replays a segment.                                                                                                       |
| verified anchor     | The position the server has proved, marking what it may pay for and where a rejection rewinds to.                                                                                         |
| verified head       | `verified_head`: how far the verifier has replayed and trusted the stream.                                                                                                                |
| verifier            | The server process that replays a submitted stream to decide whether to trust it.                                                                                                         |
| world-map encounter | The activity type where an avatar fights through a map node's enemies, arranged in waves.                                                                                                 |
| writer worker       | The one worker per browser profile that runs the simulation and appends its checkpoints.                                                                                                  |
| `userSeed`          | The avatar's own seed. Not a secret, shipped to the client, and an input to both planes.                                                                                                  |
