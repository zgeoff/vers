# Rate limits

app-web's server answers a request over its rate limit with a 429 and a plain-text body before the
request reaches a route. The limiter (`apps/web/src/server/make-rate-limiter.ts`) picks one tier per
request from its path and method, counts requests per key in a fixed 60s window, and rejects the
request that takes the count past the tier's budget. A rejected request on the `rpc` tier carries a
`Retry-After` header holding the whole seconds until its window resets. The domain services hold no
limiter of their own: every client request enters through app-web, so its limiter is the one budget
a client spends.

## Tiers

| Tier      | Requests                                  | Key       | Budget per 60s |
| --------- | ----------------------------------------- | --------- | -------------- |
| `rpc`     | any method under `/api/rpc`               | session   | 60             |
| `strict`  | a mutation on an auth or account route    | client IP | 10             |
| `strong`  | a GET or HEAD on an auth or account route | client IP | 100            |
| `default` | every other request                       | client IP | 1000           |

Outside production every budget is multiplied by 10,000, since Playwright and local development
drive these routes far faster than a player ever does.

## The session key

The `rpc` key is the signed-in session id read out of the sealed session cookie, so two sessions
behind one client IP spend separate budgets, and a re-sealed cookie for the same session keeps
spending the same one. A request whose cookie is missing, forged, expired, or signed out is keyed by
client IP instead, so a client cannot mint budgets by inventing cookie values. **Why:** the game's
writer flushes about once every 10s, and a page load adds a burst of under 20 calls, so a healthy
session spends under half of its budget in any minute. A runaway client is stopped within seconds
instead of after the 1000 requests the IP-keyed `default` tier allows.

The limiter unseals the cookie with `h3` directly (`apps/web/src/server/find-session-id.ts`) rather
than through the framework's session reader. **Why:** the limiter runs in the fetch middleware chain
ahead of the TanStack Start handler, where no Start request context exists for `getSession` to read.
`h3` is the library TanStack Start seals the cookie with, and the catalog pins the same version
Start depends on, so both sides agree on the seal format. A Start upgrade that moves its `h3` pin
moves the catalog pin with it. The cookie's shape and lifetime are owned by [auth](./auth.md).

## Memory

The limiter holds one window per key in memory and sweeps the expired windows whenever a fresh
window is opened while 1000 or more are held, so the map is bounded by the keys active in the last
minute. Each app-web machine holds its own map, so a client that lands on two machines spends two
budgets.
