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
