// Pure, dependency-free version comparison for this plugin: numeric components and prerelease identifiers. Tests: tests/semver.test.mjs.

/** Compare version-shaped strings; return undefined if either shape is invalid. */
export function compareVersions(a: unknown, b: unknown) {
  const parse = (value: unknown) => {
    if (typeof value !== 'string') return undefined
    const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value.trim())
    if (match === null) return undefined
    return { numbers: match[1]!.split('.').map(Number), pre: match[2] === undefined ? undefined : match[2].split('.') }
  }
  const left = parse(a)
  const right = parse(b)
  if (left === undefined || right === undefined) return undefined
  const length = Math.max(left.numbers.length, right.numbers.length)
  for (let index = 0; index < length; index += 1) {
    const one = left.numbers[index] ?? 0
    const other = right.numbers[index] ?? 0
    if (one !== other) return one < other ? -1 : 1
  }
  // A prerelease sorts below the release with the same version, such as 10.0.0-rc.1 < 10.0.0.
  if (left.pre === undefined && right.pre === undefined) return 0
  if (left.pre === undefined) return 1
  if (right.pre === undefined) return -1
  const preLength = Math.max(left.pre.length, right.pre.length)
  for (let index = 0; index < preLength; index += 1) {
    const one = left.pre[index]
    const other = right.pre[index]
    if (one === undefined) return -1
    if (other === undefined) return 1
    if (one === other) continue
    const oneNumber = /^\d+$/u.test(one)
    const otherNumber = /^\d+$/u.test(other)
    if (oneNumber && otherNumber) return Number(one) < Number(other) ? -1 : 1
    if (oneNumber) return -1
    if (otherNumber) return 1
    return one < other ? -1 : 1
  }
  return 0
}

