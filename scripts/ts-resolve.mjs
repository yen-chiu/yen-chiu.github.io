// 测试用解析钩子：让 `node --test` 能解析源码里不带扩展名的相对导入（Astro/TS 风格）
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        const resolved = await nextResolve(candidate, context)
        if (existsSync(fileURLToPath(resolved.url))) return resolved
      } catch {
        // 试下一个候选
      }
    }
  }
  return nextResolve(specifier, context)
}
