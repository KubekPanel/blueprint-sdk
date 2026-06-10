/**
 * @kubekpanel/blueprint-sdk
 *
 * Type contract for Kubek server-type blueprints: how to download, install, launch, stop,
 * detect status and query a server type. Manifests are plain JSON; these types feed the
 * validator, IDE hints and the author versions.ts resolver. Types only, no runtime
 */

/** Host operating system, as reported by Node's `process.platform` */
export type KubekPlatform = "win32" | "linux" | "darwin";

/** blueprint.json shape */
export interface KubekBlueprintManifest {
  manifestVersion: 1;
  /** reverse-domain, unique */
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  /** game family: "minecraft" | "source" | "ark" | ... */
  game: string;
  /** path to a .png inside the package, or an emoji/text icon */
  icon?: string;
  author?: { name: string; url?: string };
  /** semver of the blueprint itself */
  version: string;
  tags?: string[];
  engines?: { kubek: string };
  /**
   * Operating systems this server type can run on. Omit to allow every platform.
   * When set, the panel only offers the blueprint on a matching host. This is a
   * coarse availability gate, distinct from docker image platforms (see dockerProfile.platforms)
   */
  platforms?: KubekPlatform[];

  runtime: BlueprintRuntime;
  /**
   * Docker launch profile. Required whenever the blueprint can run in docker, either
   * docker-only (runtime.kind === "docker") or dual-capable (runtime.kind === "native"
   * plus this profile, the panel picks the runtime at create time and freezes it per server).
   * Omit for native-only blueprints. The invariant is enforced by the manifest validator, not the type
   */
  dockerProfile?: DockerProfile;
  variables: BlueprintVariable[];
  versions: VersionSpec;
  install: InstallSpec;
  startup: StartupSpec;
  detection?: DetectionSpec;
  query: QuerySpec;
  ports: PortSpec[];
  configFiles?: ConfigFileSpec[];
  features?: BlueprintFeature[];
  signature?: { alg: "ed25519"; publicKeyId: string; value: string };
}

/** Selects how the panel launches the server. Docker config lives in dockerProfile */
export type BlueprintRuntime = { kind: "native" } | { kind: "docker" };

/** All docker-runtime config for a blueprint. Every string supports {{...}} substitutions */
export interface DockerProfile {
  /** image with substitutions, e.g. "itzg/minecraft-server:java{{JAVA_VERSION}}" */
  image: string;
  /** maps container env vars to substituted values, e.g. { TYPE: "PAPER", VERSION: "{{GAME_VERSION}}" } */
  env: Record<string, string>;
  /** keep stdin attached so the panel console can write commands (default true) */
  stdinOpen?: boolean;
  /** container user, usually unneeded since file ownership is handled via PUID/PGID */
  user?: string;
  /** bind mounts, defaults to [{ host: "{{SERVER_DIR}}", container: "/data" }] */
  mounts?: { host: string; container: string }[];
  /** docker image platforms, e.g. ["linux/amd64", "linux/arm64"] */
  platforms?: string[];
  /** how to stop the container, defaults to the blueprint's startup.stop */
  stop?: StopSpec;
  /** install steps for docker mode, defaults to [{ type: "dockerPull", image }] */
  install?: InstallStep[];
}

export interface BlueprintVariable {
  key: string;
  label?: string;
  description?: string;
  type: "string" | "number" | "boolean" | "enum" | "secret";
  default?: string | number | boolean;
  options?:
    | { from: "static"; values: (string | number)[] }
    | { from: "versions" };
  /** laravel-like rules: "required|min:512|accepted|url" */
  rules?: string;
  /** env var name (docker/process) */
  env?: string;
  /** show in the create form */
  userEditable?: boolean;
  editableAfterInstall?: boolean;
}

export type VersionSpec =
  | { kind: "none" }
  | { kind: "static"; versions: VersionEntry[] }
  | { kind: "http"; list: HttpStep; resolveDownload?: HttpStep }
  /** path to versions.ts inside the blueprint */
  | { kind: "resolver"; module: string };

export interface VersionEntry {
  id: string;
  label?: string;
  /** direct URL (for static) */
  url?: string;
  unpack?: boolean;
}

/** Declarative step of the core HTTP engine. */
export interface HttpStep {
  request: {
    /** with {{...}} substitutions */
    url: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
  /** extract from response: JSONPath ($...), "text-regex:<re>", or "header:<name>" */
  select?: string;
  /** filter expression, e.g. "!prerelease && !draft" */
  filter?: string;
  /** transform expression applied to each element */
  map?: string;
  sort?: "semver-desc" | "semver-asc" | "date-desc" | "date-asc" | "none";
  paginate?: { nextSelect: string; max?: number };
  /** chain: previous result is available as {{prev}} in the next step */
  then?: HttpStep | { url: string };
  /** make platform substitutions {{os}} {{arch}} available in url/select */
  platform?: boolean;
}

/** Contract of a blueprint-supplied resolver (versions.ts), executed in a sandbox. */
export interface VersionResolver {
  listVersions(ctx: VersionResolverContext): Promise<VersionEntry[]>;
  resolveDownload(
    version: string,
    ctx: VersionResolverContext,
  ): Promise<DownloadSpec>;
}

export interface VersionResolverContext {
  /** the only way out to the network */
  fetch(url: string, init?: RequestInit): Promise<Response>;
  variables: Record<string, string | number | boolean>;
  platform: { os: "linux" | "win32" | "darwin"; arch: "x64" | "arm64" };
}

export interface DownloadSpec {
  url: string;
  unpack?: boolean;
  filename?: string;
}

export interface InstallSpec {
  runIn?: "host" | "image" | `container:${string}`;
  steps: InstallStep[];
}

export type InstallStep =
  | { type: "download"; url: string; dest: string; unpack?: boolean }
  | { type: "writeFile"; path: string; content: string }
  | { type: "chmod"; path: string; mode: string }
  | { type: "script"; shell: "bash" | "sh"; file?: string; inline?: string }
  | { type: "dockerPull"; image: string }
  | { type: "template"; src: string; dest: string };

export interface StartupSpec {
  /** native: full command; docker: command inside the container */
  command?: string;
  /**
   * Per-OS launch command. Overrides `command`
   */
  commandByPlatform?: Partial<Record<KubekPlatform, string>>;
  workingDir?: string;
  stop: StopSpec;
}

export type StopSpec =
  /** send to stdin, e.g. "stop" */
  | { type: "command"; value: string }
  | { type: "signal:SIGINT" | "signal:SIGTERM" | "signal:SIGKILL" }
  /** when the RCON adapter lands */
  | { type: "rcon"; command: string };

export interface DetectionSpec {
  /** RegExp source strings */
  starting?: string[];
  running?: string[];
  stopping?: string[];
  crash?: string[];
}

export interface QuerySpec {
  protocol:
    | "minecraft-java"
    | "minecraft-bedrock"
    | "source-a2s"
    | `gamedig:${string}`
    | "none";
  /** default 127.0.0.1 */
  host?: string;
  port: { fromVariable: string } | { value: number };
}

export interface PortSpec {
  key: string;
  label?: string;
  default: number;
  protocol: "tcp" | "udp" | "tcp+udp";
  env?: string;
  primary?: boolean;
}

export interface ConfigFileSpec {
  path: string;
  parser: "properties" | "json" | "yaml" | "ini" | "toml" | "text";
  label?: string;
}

export type BlueprintFeature =
  | "console"
  | "backups"
  | "files"
  | "players"
  | "plugins:modrinth"
  | "mods:fabric";
