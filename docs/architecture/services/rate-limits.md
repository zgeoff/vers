# Rate limits

The web app's server answers a request over its rate limit with a 429 and a plain-text body before
any handler runs, static assets and the analytics proxy included. The limiter picks one tier per
request from its path and method, counts requests per key in a fixed window, and rejects the request
that takes the count past the tier's budget. Every rejected request carries a `Retry-After` header
naming the seconds left in its window. The domain services hold no limiter of their own: every
client request enters through the web app, so its limiter is the one budget a client spends. One
multiple scales every tier's budget, and it is 1 in production; outside production it is large,
because the e2e suite and local development drive these routes faster than a player does.

The limiter holds one window per key in memory and sweeps expired windows when it opens a fresh one
past a sweep threshold, so the map holds no more than that threshold plus the keys active in the
current window. Each web app machine holds its own map, so a client that lands on two machines
spends two budgets.

## Tiers

| Tier      | Requests                                  | Key                        |
| --------- | ----------------------------------------- | -------------------------- |
| `rpc`     | any method under the RPC proxy            | session id, else client IP |
| `strict`  | a mutation on an auth or account route    | client IP                  |
| `strong`  | a GET or HEAD on an auth or account route | client IP                  |
| `default` | every other request                       | client IP                  |

## The session key

The `rpc` key is the signed-in session id read out of the sealed session cookie, so two sessions
behind one client IP spend separate budgets, and a re-sealed cookie for the same session keeps
spending the same one. A request whose cookie is missing, forged, expired, or signed out is keyed by
client IP on the same tier, so a client cannot mint budgets by inventing cookie values.

**Why:** the session key stops one player's sessions from sharing a budget with every other player
behind the same address, and the checkpoint writer
([game simulation](../game/game-simulation.md#checkpoint-streams)) spends a steady, small share of
it.

The limiter unseals the cookie itself with the library the framework seals it with (`h3`), pinned to
the same version. It runs in the fetch middleware chain ahead of the framework handler, where no
framework request context exists. The cookie's shape and lifetime are owned by [auth](./auth.md).
