# Vendored openpilot capnp schema

`log.capnp` is a minimal, hand-trimmed subset of the real
[`cereal/log.capnp`](https://github.com/commaai/openpilot/blob/master/openpilot/cereal/log.capnp)
(MIT licensed), kept wire-compatible with real rlog/qlog files:

- Every `Event` union field ordinal (`@N`) is preserved exactly, so the union
  discriminant for `modelV2`/`liveCalibration` matches the real schema
  bit-for-bit (Cap'n Proto assigns discriminant values by ordinal rank across
  *all* union members, so dropping any ordinal would shift every later one).
  Fields we don't decode are typed `Void` — the same pattern
  [opendbc's own `rlog.capnp`](https://github.com/commaai/opendbc/blob/master/opendbc/car/rlog.capnp)
  uses for its own "subset of cereal/log.capnp".
- `ModelDataV2` keeps only the fields `components/openpilotModelRenderer.ts`
  actually reads (`position`, `laneLines`, `laneLineProbs`, `roadEdges`,
  `roadEdgeStds`, `acceleration`) with their real types; everything else
  (`meta`, `leads`, `leadsV3`, `action`, `confidence`, the deprecated fields)
  is retyped to a placeholder of the same wire *kind* (`AnyPointer`/`Data` for
  pointer fields, `UInt16` for the one enum) so every real field keeps its
  exact pointer/data-section slot rank.

## Regenerating the TypeScript bindings

`../generated/log.ts` is checked into git, so this is **not** needed for
normal `npm install`/`npm run dev`/`npm run build`. Only run it after editing
`log.capnp`:

```sh
# requires the native Cap'n Proto compiler: apt install capnproto / brew install capnp
npm run schema:capnp
```

This uses [`capnp-es`](https://npmjs.com/package/capnp-es)'s `capnpc-ts`
plugin — the original `capnpc-ts` package is unmaintained and crashes on this
schema under modern TypeScript; `capnp-es` is the actively maintained fork.
