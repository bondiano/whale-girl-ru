import { compareVersions } from './semver.js'

export interface Repository { owner: string; repo: string }
export type InstallSource =
  | { kind: 'git'; owner: string; repo: string; ref?: string }
  | { kind: 'registry'; name: string; version?: string }
  | { kind: 'local'; path: string }
export interface LockIdentity { sha?: string; version?: string }
export interface UpdateTarget extends LockIdentity { ref?: string; repo?: Repository }
export type UpdateState = 'update-available' | 'up-to-date' | 'unknown'
export type ApplicationState = 'installed' | 'restart-required' | 'overridden' | 'failed'
export interface UpdateComparison {
  kind: 'git' | 'registry' | 'local'
  currentSha?: string
  latestSha?: string
  currentVersion?: string
  latestVersion?: string
}


// Pure update-source and identity helpers, without host or network dependencies.
// parseInstallSource normalizes the profile's recorded pnpm source into Git, registry, or local install metadata; unknown forms return undefined.
// Source syntax comes from @deepseek-ai/dsh-plugin-manager listBundles().source; registry ranges/tags follow the package name.
// readLockIdentity extracts a Git sha or registry version from the profile pnpm-lock.yaml.
// Git package.json versions do not identify commits, so the lockfile is authoritative for the commit.
// semver.ts owns version comparison; decideUpdate returns update-available, up-to-date, or unknown.
// resolveGitHead interprets HEAD and packed-refs for local checkout identity.
// updateSpecs produces the ordered installation specs. Tests: tests/update.test.mjs.

/** Parse a GitHub repository into { owner, repo }; other hosts or invalid shapes return undefined. This parses the install spec, not a manifest-repository fallback. */
export function parseRepository(url: unknown): Repository | undefined {
  if (typeof url !== 'string') return undefined
  const text = url.trim().replace(/^git\+/, '').replace(/\.git$/, '')
  const ssh = /^git@github\.com:([^/]+)\/(.+)$/u.exec(text)
  if (ssh !== null) return { owner: ssh[1]!, repo: ssh[2]! }
  const http = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)$/u.exec(text)
  if (http !== null) return { owner: http[1]!, repo: http[2]! }
  return undefined
}

/** Remove a possible .git suffix from a repository component. */
function cleanRepo(repo: string) {
  return repo.replace(/\.git$/u, '')
}

/** Normalize a pnpm install spec; unknown forms return undefined. */
export function parseInstallSource(spec: unknown): InstallSource | undefined {
  if (typeof spec !== 'string') return undefined
  const text = spec.trim()
  if (text === '') return undefined
  // Local absolute/relative/file:/link: paths have no profile-recorded upstream to query.
  if (text.startsWith('/') || text.startsWith('./') || text.startsWith('../') || text.startsWith('file:') || text.startsWith('link:')) {
    return { kind: 'local', path: text.replace(/^(?:file|link):/u, '') }
  }
  // GitHub shorthand: github:owner/repo[#ref] or bare owner/repo[#ref].
  const shorthand = /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:#([^\s#]+))?$/u.exec(text)
  if (shorthand !== null && !text.includes('://')) {
    return { kind: 'git', owner: shorthand[1]!, repo: cleanRepo(shorthand[2]!), ...(shorthand[3] === undefined ? {} : { ref: shorthand[3] }) }
  }
  // git+https://… / https://github.com/… / git@github.com:…
  if (/^(?:git\+|git:|git@|https?:\/\/)/u.test(text)) {
    const ref = text.includes('#') ? text.slice(text.indexOf('#') + 1) : undefined
    const bare = text.includes('#') ? text.slice(0, text.indexOf('#')) : text
    const repo = parseRepository(bare)
    if (repo === undefined) return undefined
    return { kind: 'git', owner: repo.owner, repo: repo.repo, ...(ref === undefined || ref === '' ? {} : { ref }) }
  }
  // Registry specs are @scope/name@range or name@range, with one version separator.
  const at = text.startsWith('@') ? text.indexOf('@', 1) : text.indexOf('@')
  const registry: Extract<InstallSource, { kind: 'registry' }> = at > 0
    ? { kind: 'registry', name: text.slice(0, at), ...(text.slice(at + 1) === '' ? {} : { version: text.slice(at + 1) }) }
    : { kind: 'registry', name: text }
  // Package names may have one optional scope; ranges cannot contain colon or slash. Reject other-host forms such as gitlab:owner/repo and name@github:owner/repo rather than querying npm with an invalid name.
  const named = /^(?:@[^/@:\s]+\/)?[^/@:\s]+$/u.test(registry.name)
  const ranged = registry.version === undefined || !/[:/]/u.test(registry.version)
  return named && ranged ? registry : undefined
}

/**
 * Read the package identity from the profile pnpm lockfile.
 * Git lock keys use <name>@https://.../tar.gz/<sha>, <name>@git+...#<sha>, or <name>@github:owner/repo#<sha>.
 * A <name>@<version> key identifies a registry version.
 */
export function readLockIdentity(lockText: unknown, packageName: string): LockIdentity {
  const line = lockKeyLine(lockText, packageName)
  if (line === undefined) return {}
  const sha = /tar\.gz\/([0-9a-f]{7,40})/u.exec(line)?.[1]
    ?? /#([0-9a-f]{7,40})(?=[:\s(]|$)/u.exec(line)?.[1]
    ?? /([0-9a-f]{40})(?=[:\s(]|$)/u.exec(line)?.[1]
  const version = /@(\d[^:\s(']*)/u.exec(line)?.[1]
  return {
    ...(sha === undefined ? {} : { sha }),
    ...(version === undefined ? {} : { version }),
  }
}

/** Find the package's own indented YAML lock key; scoped package names may be quoted. */
function lockKeyLine(lockText: unknown, packageName: string) {
  if (typeof lockText !== 'string' || packageName === '') return undefined
  const quoted = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = new RegExp(`^\\s{2,}'?${quoted}@\\S*`, 'mu').exec(lockText)
  return match === null ? undefined : match[0]
}

/** Show the first seven commit characters, preserving shorter values. */
export function shortSha(sha: unknown) {
  return typeof sha === 'string' ? sha.slice(0, 7) : ''
}

/** Return the three-state update comparison: update-available, up-to-date, or unknown. */
export function decideUpdate(input: UpdateComparison): UpdateState {
  // Local checkouts must be compared with Git semantics by the caller; a direct local comparison remains unknown.
  if (input.kind === 'local') return 'unknown'
  if (input.kind === 'git') {
    const { currentSha, latestSha } = input
    if (typeof currentSha !== 'string' || typeof latestSha !== 'string') return 'unknown'
    if (currentSha === '' || latestSha === '') return 'unknown'
    return currentSha.startsWith(latestSha) || latestSha.startsWith(currentSha) ? 'up-to-date' : 'update-available'
  }
  const comparison = compareVersions(input.latestVersion, input.currentVersion)
  if (comparison === undefined) {
    if (input.latestVersion === undefined || input.currentVersion === undefined) return 'unknown'
    return input.latestVersion === input.currentVersion ? 'up-to-date' : 'update-available'
  }
  return comparison > 0 ? 'update-available' : 'up-to-date'
}

/**
 * Map host ChangeResult.application to the UI state.
 * Only applied and restart-required count as installed; overridden has its own state.
 * Failed, cancelled, unknown, or absent results remain failed rather than reporting unproven success.
 */
export function applicationState(application: unknown): ApplicationState {
  switch (application) {
    case 'applied': return 'installed'
    case 'restart-required': return 'restart-required'
    case 'overridden': return 'overridden'
    default: return 'failed'
  }
}

/**
 * Build the ordered installation specs for an update.
 * The host detects the updated package from dependency-string changes, so reinstalling the identical spec is ambiguous-install.
 * For moving Git branches/tags/default branches, install the exact checked commit and then restore the tracked spec; already-pinned commits need one install.
 * Registry updates install the checked version, which pnpm normally stores as a moving caret range.
 * Local installs switch from their local link to target.repo and target.ref, tracking that repository branch.
 * Return undefined for unrecognized sources or unusable targets.
 */
export function updateSpecs(parsed: InstallSource | null | undefined, target: UpdateTarget | null): { specs: string[] } | undefined {
  if (parsed === undefined || parsed === null || target === null || typeof target !== 'object') return undefined
  if (parsed.kind === 'git') {
    if (typeof target.sha !== 'string' || target.sha === '') return undefined
    const pinned = `github:${parsed.owner}/${parsed.repo}#${target.sha}`
    const moving = parsed.ref === undefined || !/^[0-9a-f]{7,40}$/u.test(parsed.ref)
    return { specs: moving ? [pinned, `github:${parsed.owner}/${parsed.repo}${parsed.ref === undefined ? '' : `#${parsed.ref}`}`] : [pinned] }
  }
  if (parsed.kind === 'registry') {
    if (typeof target.version !== 'string' || target.version === '') return undefined
    return { specs: [`${parsed.name}@${target.version}`] }
  }
  if (parsed.kind === 'local') {
    const repo = target.repo
    if (repo === undefined || repo === null || typeof repo.owner !== 'string' || typeof repo.repo !== 'string') return undefined
    const ref = typeof target.ref === 'string' && target.ref !== '' ? target.ref : undefined
    if (ref === undefined) return undefined
    return { specs: [`github:${repo.owner}/${repo.repo}#${ref}`] }
  }
  return undefined
}

/** Resolve a commit from HEAD and packed-refs. Detached HEAD is direct; symbolic refs are searched in packed-refs, while the caller reads loose refs. */
export function resolveGitHead(head: unknown, packedRefs = '') {
  const text = typeof head === 'string' ? head.trim() : ''
  if (/^[0-9a-f]{40}$/u.test(text)) return text
  const symbolic = /^ref:\s*(\S+)$/u.exec(text)
  if (symbolic === null || typeof packedRefs !== 'string') return undefined
  for (const line of packedRefs.split('\n')) {
    const entry = /^([0-9a-f]{40})\s+(\S+)$/u.exec(line.trim())
    if (entry !== null && entry[2] === symbolic[1]) return entry[1]
  }
  return undefined
}
