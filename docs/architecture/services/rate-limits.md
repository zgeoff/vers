# Rate limits

The web app's server answers a request over its rate limit with a 429 and a plain-text body before
the request reaches a route. The limiter picks one tier per request from its path and method, counts
requests per key in a fixed window, and rejects the request that takes the count past the tier's
budget. A rejected request on the `rpc` tier carries a `Retry-After` header. The domain services
hold no limiter of their own: every client request enters through the web app, so its limiter is the
one budget a client spends. Outside production every budget is multiplied up, because the e2e suite
and local development drive these routes far faster than a player does.

## Tiers

| Tier      | Requests                                  | Key       |
| --------- | ----------------------------------------- | --------- |
| `rpc`     | any method under the RPC proxy            | session   |
| `strict`  | a mutation on an auth or account route    | client IP |
| `strong`  | a GET or HEAD on an auth or account route | client IP |
| `default` | every other request                       | client IP |

## The session key

The `rpc` key is the signed-in session id read out of the sealed session cookie, so two sessions
behind one client IP spend separate budgets, and a re-sealed cookie for the same session keeps
spending the same one. A request whose cookie is missing, forged, expired, or signed out is keyed by
client IP instead, so a client cannot mint budgets by inventing cookie values. **Why:** a healthy
session's writer flushes and page-load bursts spend well under the budget in any window, so a
runaway client is stopped within seconds instead of after the far larger IP-keyed budget.

The limiter unseals the cookie with the library the framework seals it with, pinned to the same
version, because it runs in the fetch middleware chain ahead of the framework handler, where no
framework request context exists. The cookie's shape and lifetime are owned by [auth](./auth.md).

## Memory

The limiter holds one window per key in memory and sweeps expired windows once enough are held, so
the map is bounded by the keys active in the last window. Each web app machine holds its own map, so
a client that lands on two machines spends two budgets.
