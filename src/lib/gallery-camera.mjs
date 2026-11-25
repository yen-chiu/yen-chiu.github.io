// Shared by the static gallery and the local Studio; no browser or Node dependencies.
// Parse explicit equipment labels before exposure tokens, so lens specifications
// (e.g. 24-70mm f/2.8) never become the recorded shooting settings.
/** @param {string | undefined | null} input */
export function parseCamera(input) {
  const text = String(input ?? '').normalize('NFKC').trim()
  /** @type {Record<string, string[]>} */
  const values = {}
  /** @type {string[]} */
  const notes = []
  const order = ['相机', '镜头', '焦距', '光圈', '快门', '感光度']
  /** @param {string} key @param {string} value */
  function add(key, value) {
    if (!value) return
    const list = values[key] ??= []
    if (!list.includes(value)) list.push(value)
  }
  /** @param {string} s */
  const positive = s => Number.isFinite(Number(s)) && Number(s) > 0
  for (const part of text.split(/\s*[·|;,，；\n]\s*/).filter(Boolean)) {
    const tagged = part.match(/^(相机(?:型号)?|机身|camera(?:\s+model)?|body|镜头(?:型号)?|lens(?:\s+model)?)\s*[:=]\s*(.+)$/i)
    if (tagged) {
      add(/^(镜头|lens)/i.test(tagged[1]) ? '镜头' : '相机', tagged[2].trim())
      continue
    }
    // Unlabelled zoom-lens strings are ambiguous. Keep them intact as notes.
    if (/\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\s*mm\b/i.test(part)) {
      notes.push(part.trim())
      continue
    }
    let rest = part
    const rules = [
      {key:'焦距', re:/(?<![\w./+-])(?:焦距\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*mm(?!\w)/gi, format: /** @param {RegExpMatchArray} m */ m => positive(m[1]) ? Number(m[1])+'mm' : ''},
      {key:'光圈', re:/(?<![\w./+-])(?:光圈\s*[:=]?\s*)?f\s*\/?\s*(\d+(?:\.\d+)?)(?![\w.])/gi, format: /** @param {RegExpMatchArray} m */ m => positive(m[1]) ? 'f/'+Number(m[1]) : ''},
      {key:'快门', re:/(?<![\w./+-])(?:快门\s*[:=]?\s*)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(?:s(?:ec)?|秒)(?![\w.])/gi, format: /** @param {RegExpMatchArray} m */ m => positive(m[1]) && (!m[2] || positive(m[2])) ? Number(m[1])+(m[2]?'/'+Number(m[2]):'')+'s' : ''},
      {key:'感光度', re:/(?<![\w./+-])(?:(?:感光度\s*[:=]?\s*)?ISO\s*[:=]?\s*)(\d+)(?![\w.])/gi, format: /** @param {RegExpMatchArray} m */ m => positive(m[1]) ? 'ISO '+Number(m[1]) : ''}
    ]
    // Replace matches by spaces rather than concatenating adjacent tokens.
    for (const rule of rules) {
      rest = rest.replace(rule.re, (...args) => {
        const m = /** @type {RegExpMatchArray} */ (args.slice(0,-2))
        const value = rule.format(m)
        if (!value) return m[0]
        add(rule.key, value)
        return ' '
      })
    }
    rest = rest.trim().replace(/\s{2,}/g,' ')
    // Recognize common camera model strings without guessing arbitrary notes.
    if (/^(?:NIKON\s+)?(?:D\d{2,4}|Z\s?\d{1,2}(?:\s?(?:II|III))?)$/i.test(rest) ||
        /^(?:Canon\s+)?EOS\s+[\w -]+$/i.test(rest) ||
        /^(?:SONY\s+)?(?:ILCE-[\w-]+|A[679][\w-]*)$/i.test(rest) ||
        /^(?:FUJIFILM\s+)?(?:X-[\w-]+|GFX\s?[\w-]+)$/i.test(rest)) {
      add('相机',rest)
    } else if (rest) notes.push(rest)
  }
  // Conflicting values are not silently resolved. Display them as notes instead.
  const settings = order.flatMap(label => {
    const list = values[label] ?? []
    if (list.length === 1) return [{label,value:list[0]}]
    if (list.length > 1) notes.push(label+'（存在多个值）：'+list.join(' / '))
    return []
  })
  return {settings, notes}
}
