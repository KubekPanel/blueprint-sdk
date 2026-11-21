# @kubekpanel/blueprint-sdk

TypeScript type contract for **Kubek blueprints** — declarative server-type definitions describing
how to download, install, launch, stop, detect status and query a game server.

This package is **types only**: it has no runtime code. It feeds the manifest validator, your editor's
IntelliSense and the `versions.ts` resolver you ship inside a blueprint.

```sh
npm i -D @kubekpanel/blueprint-sdk
```

```ts
import type {
  KubekBlueprintManifest,
  VersionResolver,
} from "@kubekpanel/blueprint-sdk";
```

See the [blueprint starter template](https://github.com/KubekPanel/blueprint-template)
for a complete, working example.

## Install steps (0.3.1)

- `exec`: runs a command in the server folder through `sh` / `cmd`, with `commandByPlatform` and
  `timeoutSec` (default 900). `{{JAVA_BIN}}` is available when the blueprint declares `JAVA_VERSION`.
- `steamcmd`: anonymous SteamCMD `app_update` into the server folder: `appId`, optional `beta`,
  `betaPassword`, `platform` (force another OS build) and `validate` (default true).
- `gameName`: game title, the panel groups server types with the same `game` under it.
- `DownloadSpec.vars`: extra `{{...}}` values a resolver hands to the install steps, for example the
  exact loader build it picked. They never override variables.

Query protocols the panel speaks: `minecraft-java`, `minecraft-bedrock`, `source-a2s`,
`gamedig:<id>` and `none`.

## Stop timeout (0.4.0)

- `stop.timeoutSec`: seconds the panel waits for the process to exit after the stop command or signal,
  then kills it. Defaults to the panel's `KUBEK_STOP_TIMEOUT` (60 s). Useful for servers that finish
  shutting down but keep waiting for input. Kubek 4.1.3+, older panels ignore it.

```ts
stop: { type: "command", value: "exit", timeoutSec: 10 },
```

## Docker runtime

`runtime.kind` selects how the panel launches the server: `"native"` (a host process) or `"docker"`
(a container). All docker configuration lives in the optional `dockerProfile` field.

- **docker-only** blueprint: `runtime: { kind: "docker" }` plus a `dockerProfile`.
- **dual-capable** blueprint: `runtime: { kind: "native" }` plus a `dockerProfile`. The panel chooses the
  runtime when the server is created (global `serverRuntime` setting: `auto` / `native` / `docker`) and
  freezes that choice per server. Without Docker the blueprint behaves exactly like a native one.

`dockerProfile.env` is the single place where container env vars are mapped; every value supports `{{...}}`
substitutions. Available tokens are the blueprint variables (`{{JAVA_VERSION}}`, `{{GAME_VERSION}}`, `{{XMX}}`, …)
plus the host-supplied `{{SERVER_DIR}}`, `{{HOST_UID}}`, `{{HOST_GID}}`. Defaults: `mounts` →
`{{SERVER_DIR}}:/data`, `install` → `[{ type: "dockerPull", image }]`, `stdinOpen` → `true`,
`stop` → the blueprint's `startup.stop`.

```ts
const paper: KubekBlueprintManifest = {
  // ...manifestVersion, id, variables (incl. JAVA_VERSION/GAME_VERSION/XMX), versions, install, startup...
  runtime: { kind: "native" },
  dockerProfile: {
    image: "itzg/minecraft-server:java{{JAVA_VERSION}}",
    stdinOpen: true,
    stop: { type: "signal:SIGTERM" },
    env: {
      EULA: "TRUE",
      TYPE: "PAPER",
      VERSION: "{{GAME_VERSION}}",
      MAX_MEMORY: "{{XMX}}M",
      OVERRIDE_SERVER_PROPERTIES: "false",
      PUID: "{{HOST_UID}}",
      PGID: "{{HOST_GID}}",
    },
  },
};
```
