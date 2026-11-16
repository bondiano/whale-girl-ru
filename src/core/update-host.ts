/**
 * Host-side update orchestration: read the profile's source/lockfile, check upstream, and use its package manager to install.
 * Injected manager, network, manifest, and profile-directory boundaries support temporary-directory and mock tests;
 * index.ts only connects Cordis services and HTTP routes.
 * Current identity is a Git commit or registry version. Prefer host BundleInfo.version, then lockfile and package-manifest versions.
 * Git package.json versions do not identify commits; the lockfile does.
 * Upstream means the tracked source's latest commit/version; local-path installs follow the manifest repository's default branch.
 * host-outdated applies only to a known bundle lacking source and the modern official/availability fields.
 * Modern bundles without source are no-source, including built-in installs or unreadable manifests.
 * Do not infer host age from version: older hosts also populated it.
 * See 2026-10-16-host-outdated-shape-probe for the observed host-shape boundary.
 */
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  applicationState,
  decideUpdate,
  parseInstallSource,
  readLockIdentity,
  resolveGitHead,
  shortSha,
  updateSpecs,
} from './update.js'

import type { InstallSource, Repository, UpdateState, UpdateTarget } from './update.js'

interface HostBundle { name?: unknown; source?: unknown; version?: unknown; official?: unknown; availability?: unknown; enabled?: unknown }
interface HostInstallResult { application?: unknown; error?: { code?: unknown; diagnostic?: unknown }; version?: string }
export interface UpdateManager {
  listBundles?: () => Promise<unknown> | unknown
  installBundle?: (spec: string, options: { enabled: boolean; requestId: string }) => Promise<HostInstallResult>
}
export interface UpdateHostDependencies {
  self: { name: string; version?: string; repository?: Repository }
  profileDir?: string
  managerOf: () => UpdateManager | undefined
  fetchJson: (url: string, accept: string) => Promise<unknown>
}
interface CurrentIdentity { version?: string; source?: string; commit?: string }
interface Upstream { latest: UpdateTarget & { commit?: string }; state: UpdateState }
export interface UpdateStatus {
  current: CurrentIdentity
  latest?: Upstream['latest']
  state: UpdateState
  canUpdate: boolean
  reason?: string
  detail?: string
}
export interface UpdateOutcome {
  state: string
  errorCode?: string
  errorDetail?: string
  application?: string
  spec?: string
  version?: string
  commit?: string
  pinnedSpec?: string
  current?: CurrentIdentity
}

/** Update-check network timeout in milliseconds; checks run on card mount or explicit user action. */
export const UPDATE_TIMEOUT_MS = 10000

/**
 * Read the current commit from <dir>/.git, returning undefined when unavailable.
 * .git may be a directory or a gitdir pointer file for worktrees/submodules.
 * Worktree branch refs may live in the commondir, so inspect both loose refs and packed-refs.
 */
export function readGitHead(dir: string, io = { readFileSync, statSync, join, resolve }) {
  try {
    let gitDir = io.join(dir, '.git')
    if (io.statSync(gitDir).isFile()) {
      const pointer = io.readFileSync(gitDir, 'utf8').trim().replace(/^gitdir:\s*/u, '')
      gitDir = io.resolve(dir, pointer)
    }
    const commonDir = (() => {
      try {
        const pointer = io.readFileSync(io.join(gitDir, 'commondir'), 'utf8').trim()
        return pointer === '' ? gitDir : io.resolve(gitDir, pointer)
      } catch {
        return gitDir
      }
    })()
    const head = io.readFileSync(io.join(gitDir, 'HEAD'), 'utf8')
    const symbolic = /^ref:\s*(\S+)$/u.exec(head.trim())
    if (symbolic !== null) {
      for (const base of commonDir === gitDir ? [gitDir] : [gitDir, commonDir]) {
        try {
          return io.readFileSync(io.join(base, symbolic[1]!), 'utf8').trim()
        } catch {
          // The loose ref may live elsewhere; continue with packed-refs.
        }
      }
    }
    const packed = [gitDir, commonDir]
      .map((base) => {
        try {
          return io.readFileSync(io.join(base, 'packed-refs'), 'utf8')
        } catch {
          return ''
        }
      })
      .join('\n')
    return resolveGitHead(head, packed)
  } catch {
    return undefined
  }
}

/** Create the update host with injected package-manager, network, manifest, and profile-directory dependencies. */
export function createUpdateHost({ self, profileDir, managerOf, fetchJson }: UpdateHostDependencies) {
  /** Read the profile lockfile, or return an empty string so callers report an unknown identity. */
  function readLockText() {
    if (profileDir === undefined) return ''
    try {
      return readFileSync(join(profileDir, 'pnpm-lock.yaml'), 'utf8')
    } catch {
      return ''
    }
  }

  /** Whether the host exposes installation support, controlling the availability of update actions. */
  function canInstall() {
    const manager = managerOf()
    return manager !== undefined && typeof manager.installBundle === 'function'
  }

  /** Read the host package manager's current bundle record each time; the plugin may load before that service. */
  async function selfBundle(): Promise<HostBundle | undefined> {
    const manager = managerOf()
    if (manager === undefined || typeof manager.listBundles !== 'function') return undefined
    try {
      const bundles = await manager.listBundles()
      if (!Array.isArray(bundles)) return undefined
      return bundles.find((bundle: unknown): bundle is HostBundle => bundle !== null && typeof bundle === 'object' && 'name' in bundle && bundle.name === self.name)
    } catch {
      return undefined
    }
  }

  /**
   * Check Git upstream through commits/<ref>, using HEAD for the repository default branch.
   * Do not use the commits list endpoint: its array has no top-level sha and would leave unpinned installs unknown.
   */
  async function gitUpstream(parsed: Extract<InstallSource, { kind: 'git' }>, currentSha: string | undefined): Promise<Upstream> {
    const suffix = `/${encodeURIComponent(parsed.ref ?? 'HEAD')}`
    const payload = await fetchJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits${suffix}`, 'application/vnd.github+json') as { sha?: unknown } | null
    const sha = typeof payload?.sha === 'string' ? payload.sha : undefined
    return {
      latest: sha === undefined ? {} : { sha, commit: shortSha(sha) },
      state: decideUpdate({ kind: 'git', currentSha, latestSha: sha }),
    }
  }

  /** Registry upstream comes from dist-tags.latest. */
  async function registryUpstream(parsed: Extract<InstallSource, { kind: 'registry' }>, currentVersion: string | undefined): Promise<Upstream> {
    const payload = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(parsed.name).replaceAll('%40', '@')}`, 'application/json') as { 'dist-tags'?: { latest?: unknown } } | null
    const version = payload?.['dist-tags']?.latest as string | undefined
    return { latest: { version }, state: decideUpdate({ kind: 'registry', currentVersion, latestVersion: version }) }
  }

  /**
   * Local installs follow the manifest repository's actual default branch, commonly main.
   * Return undefined if the repository or branch cannot be established; guessing could switch the tracked source.
   */
  async function localUpstream(localSha: string): Promise<Upstream | undefined> {
    const repo = self.repository
    if (repo === undefined) return undefined
    const info = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, 'application/vnd.github+json') as { default_branch?: unknown } | null
    const ref = typeof info?.default_branch === 'string' && info.default_branch !== '' ? info.default_branch : undefined
    if (ref === undefined) return undefined
    const payload = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${encodeURIComponent(ref)}`, 'application/vnd.github+json') as { sha?: unknown } | null
    const sha = typeof payload?.sha === 'string' ? payload.sha : undefined
    return {
      latest: { ...(sha === undefined ? {} : { sha, commit: shortSha(sha) }), ref, repo },
      state: decideUpdate({ kind: 'git', currentSha: localSha, latestSha: sha }),
    }
  }

  /**
   * Read current and upstream identities on card mount or explicit update checks.
   * The client consumes current.{version,commit,source}, latest.{version,commit,ref}, state, canUpdate, reason, and detail.
   */
  async function status(): Promise<UpdateStatus> {
    const bundle = await selfBundle()
    // Only the profile-recorded spec determines the update target. Manifest repository metadata must not replace a tracked branch/tag or convert a built-in bundle into a profile dependency.
    const source = typeof bundle?.source === 'string' && bundle.source !== '' ? bundle.source : undefined
    // Prefer host BundleInfo.version over lockfile or self-manifest versions. Git commit identity still comes from the lockfile, because package versions do not identify commits.
    const bundleVersion = typeof bundle?.version === 'string' && bundle.version !== '' ? bundle.version : undefined
    // Host-age detection uses official/availability fields introduced with 0.2.1-alpha.2; version is insufficient because older hosts already populated it.
    const modernBundle = typeof bundle?.official === 'boolean' || typeof bundle?.availability === 'string'
    const installable = canInstall()
    const identity = readLockIdentity(readLockText(), self.name)
    const current = {
      version: bundleVersion ?? identity.version ?? self.version,
      ...(source === undefined ? {} : { source }),
      ...(identity.sha === undefined ? {} : { commit: shortSha(identity.sha) }),
    }
    const unsupported = (reason: string): UpdateStatus => ({ current, latest: undefined, state: 'unknown', canUpdate: false, reason })
    const settle = (upstream: Upstream, currentOverride?: CurrentIdentity): UpdateStatus => ({
      current: currentOverride ?? current,
      latest: upstream.latest,
      state: upstream.state,
      canUpdate: installable && upstream.state === 'update-available',
    })

    const parsed = parseInstallSource(source)
    if (parsed === undefined) {
      // Known bundles with neither source nor modern fields are host-outdated; modern bundles without a tracked source, or unrecognized recorded specs, are no-source.
      return source === undefined && !modernBundle && installable && bundle !== undefined
        ? unsupported('host-outdated')
        : unsupported('no-source')
    }
    try {
      if (parsed.kind === 'local') {
        const localSha = readGitHead(parsed.path)
        if (localSha === undefined) return unsupported('local-source')
        const upstream = await localUpstream(localSha)
        if (upstream === undefined) return unsupported('local-source')
        return settle(upstream, { ...current, commit: shortSha(localSha) })
      }
      const upstream = parsed.kind === 'git' ? await gitUpstream(parsed, identity.sha) : await registryUpstream(parsed, current.version)
      return settle(upstream)
    } catch (error) {
      // Upstream 403/429 rate limits are distinct from unavailable source metadata and need their own diagnostic.
      const code = error !== null && typeof error === 'object' && 'status' in error ? error.status : undefined
      const limited = code === 403 || code === 429
      return { ...unsupported(limited ? 'rate-limited' : 'check-failed'), detail: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Delegate installation to the host package manager.
   * Reinstalling an unchanged profile spec is ambiguous-install because the host identifies updates from dependency-string changes.
   * First install the checked exact commit/version, then restore the moving branch/tag/default-branch spec so future updates remain trackable.
   * The client consumes state, errorCode, errorDetail, commit, and pinnedSpec; application/spec/version remain diagnostic metadata.
   */
  async function apply(): Promise<UpdateOutcome> {
    const manager = managerOf()
    if (manager === undefined || typeof manager.installBundle !== 'function') return { state: 'unsupported' }
    const checked = await status()
    if (checked.state !== 'update-available' || checked.latest === undefined) {
      // An inconclusive upstream check is check-failed, rather than a misleading installation failure.
      return checked.state === 'unknown'
        ? { state: 'check-failed', ...(checked.reason === undefined ? {} : { errorCode: checked.reason }) }
        : { state: checked.state, current: checked.current }
    }
    const parsed = parseInstallSource(checked.current.source)
    // Local installs use the manifest repository default branch; all other installs follow their profile-recorded spec.
    const target = parsed !== undefined && parsed.kind === 'local' ? { ...checked.latest, repo: self.repository } : checked.latest
    const plan = updateSpecs(parsed, target)
    // Defensive guard: an update-available result must contain an installable identity.
    if (plan === undefined) return { state: 'failed', errorCode: 'unsupported-source' }
    const requestId = `${self.name}-update-${Date.now().toString(36)}`

    /** Install one spec and report the host application result faithfully. */
    const latest = checked.latest
    const runInstall = async (spec: string, step: number): Promise<UpdateOutcome> => {
      const bundle = await selfBundle()
      // Without a known enabled state, do not install: omitting enabled would turn a disabled pet on by host default.
      if (bundle === undefined || typeof bundle.enabled !== 'boolean') {
        return { state: 'failed', errorCode: 'unknown-enabled-state' }
      }
      const result = await manager.installBundle!(spec, { enabled: bundle.enabled, requestId: `${requestId}-${String(step)}` })
      const application = typeof result?.application === 'string' ? result.application : undefined
      const failure = result?.error
      return {
        state: applicationState(application),
        ...(application === undefined ? {} : { application }),
        ...(typeof failure?.code === 'string' ? { errorCode: failure.code } : {}),
        ...(typeof failure?.diagnostic === 'string' ? { errorDetail: failure.diagnostic } : {}),
        spec,
        version: result?.version ?? latest.version,
        ...(latest.commit === undefined ? {} : { commit: latest.commit }),
      }
    }

    let done: UpdateOutcome | undefined
    for (const [index, spec] of plan.specs.entries()) {
      let outcome: UpdateOutcome
      try {
        outcome = await runInstall(spec, index + 1)
      } catch (error) {
        // A thrown host error after the first install leaves the profile pinned, just like a failed result; report tracking-not-restored and the pinned spec.
        outcome = { state: 'failed', errorDetail: error instanceof Error ? error.message : String(error) }
      }
      if (outcome.state === 'failed') {
        if (index === 0) return outcome
        // If restoring the moving spec fails, the profile remains pinned to the first spec. Preserve the host error code in diagnostics and expose that pinned state.
        const hostCode = outcome.errorCode
        return {
          ...outcome,
          errorCode: 'tracking-not-restored',
          ...(hostCode === undefined ? {} : { errorDetail: [hostCode, outcome.errorDetail].filter((part) => typeof part === 'string' && part !== '').join(' · ') }),
          pinnedSpec: plan.specs[0],
        }
      }
      done = outcome
    }
    return done ?? { state: 'failed', errorCode: 'unsupported-source' }
  }

  return { status, apply }
}
