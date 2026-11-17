export function graphLabel(label: string, kind: string, mobile: boolean, focused = false): string {
 if (!mobile || focused) return label
 if (kind !== 'blog' && kind !== 'docs') return ''
 const letters=Array.from(label)
 return letters.length>12 ? letters.slice(0,12).join('')+'…' : label
}
