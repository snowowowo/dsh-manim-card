/**
 * Pyodide 包名的**归一化口径**（PEP 503 那一套：`[-_.]+` 折成 `-`、转小写）。
 *
 * 为什么必须有它：随包 `pyodide-lock.json` 里**包名有三种写法在混用**——
 *  - 键 `pillow` 而条目内的 `name` 字段是 `Pillow`（351 条里有 21 条这样：`jinja2`/`Jinja2`、
 *    `markupsafe`/`MarkupSafe`、`cartopy`/`Cartopy`…）；
 *  - `depends` 里两种写法都出现（`pillow` 是键的写法，`astropy_iers_data` / `ruamel.yaml`
 *    是 `name` 字段的下划线 / 点号写法）。
 *
 * 实测（374 条依赖引用）：只按**键**解析会落空 8 条，只按 `name` 字段解析会落空 11 条
 * （含 `pillow`——也就是「提前缓存 matplotlib」会漏掉它）。所以「拿哪一种当名字」都是错的，
 * 唯一站得住的做法是**归一化之后再比**：这样 374 条一条不漏。
 *
 * 还有一层：用户会按自己记得的名字打字（`Pillow` / `pillow` / `scikit_learn`），
 * 归一化让这些写法都能落到同一个包上，而不是回一句「不认识」。
 *
 * 一处定义、两端共用：Host 侧从 `core.js` 取，浏览器侧直接 import 这个文件——
 * 两边**不许各写一份**，否则「哪些包能对上」会随半边改动而漂移。
 */
export function canonicalPackageName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/gu, '-')
}
