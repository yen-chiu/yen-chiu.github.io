export function sitePath(path: string, base = import.meta.env?.BASE_URL ?? '/') {
 if (/^(?:[a-z]+:|\/\/|#)/i.test(path)) return path
 const prefix = base.replace(/\/$/, '')
 const value = '/' + path.replace(/^\/+/, '')
 return prefix && (value === prefix || value.startsWith(prefix + '/')) ? value : prefix + value
}
