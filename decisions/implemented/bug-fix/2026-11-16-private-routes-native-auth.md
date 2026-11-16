# Decision: admit LAN plugin requests through native DSH authentication

Status: implemented

## Problem

Raw plugin HTTP routes bypass the host's core API admission. A LAN listener can expose configuration and mutation routes without a browser session; loopback Host checks alone do not authenticate a caller.

## Decision

Whale Girl registers private routes through its packaged `lib/web-route-auth.mjs` facade. For managed LAN mode, native remote authorities, or a non-loopback listener, each request must pass `connection.requestRejection` before its handler runs. Missing admission fails closed with 503. Only after admission are Host and Origin adapted for existing loopback guards. The original request headers remain unchanged.

Private-only desktop transports retain their existing behavior. The facade does not modify the host server or core API routes.

## Alternatives considered

Accepting a LAN Host in each guard does not authenticate callers. Replacing every route guard duplicates the native authority and browser authentication contract.

## Consequences

The package includes the admission helper inside its own `lib/` directory, so standalone installation has no sibling-package dependency. LAN verification must check both unauthenticated rejection and authenticated success after restarting the web host. The helper tests cover forged loopback Host, Origin rejection, unavailable admission, stream forwarding, and private desktop behavior.

## 取代检查

无重叠：existing decisions cover plugin state, desktop transport, and host version alignment; none defines native admission for the workstation LAN listener.
