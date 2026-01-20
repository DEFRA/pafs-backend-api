export function extractDomain(input) {
  const str = String(input).trim().toLowerCase()
  const at = str.lastIndexOf('@')
  return at >= 0 ? str.slice(at + 1) : str
}

export function domainMatches(needleDomain, approvedDomain) {
  const d = needleDomain.toLowerCase()
  const a = approvedDomain.toLowerCase()

  return d === a || d.endsWith('.' + a)
}

export function isApprovedDomain(emailOrDomain, approvedDomains) {
  const domain = extractDomain(emailOrDomain)
  return approvedDomains.some((approved) => domainMatches(domain, approved))
}
