// 用 `node --import ./scripts/ts-register.mjs --test ...` 启用 TS 风格相对导入的解析
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
