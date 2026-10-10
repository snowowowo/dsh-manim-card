// 只读代码视图：行号 + Python 高亮，高亮不可用时退化为等宽纯文本（行号照给）。
// 行号要对得上 AI 报错里的「第 N 行」——卡片上的报错就是按这个行号给的。
// 右上角一键复制：吸附在滚动容器顶部（长代码往下滚也不消失），不用打开顶部栏。
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlightPython } from '../code-highlight'
import { useCopied } from '../clipboard'
import type { Translate } from '../i18n'

export function CodeView({ code, t }: { code: string; t: Translate }) {
  // 结尾换行只是文件习惯，显示时去掉，否则会多出一个空行号。
  const trimmed = code.endsWith('\n') ? code.slice(0, -1) : code
  const lines = useMemo(() => highlightPython(trimmed), [trimmed])
  const [copied, copy] = useCopied()

  const gutter = `${Math.max(2, String(trimmed.split('\n').length).length)}ch`

  return (
    <div className="mr-codewrap">
      <div className="mr-codepane-actions">
        <button
          className="mr-iconbtn"
          type="button"
          aria-label={copied ? t('copied') : t('copy')}
          title={copied ? t('copied') : t('copy')}
          onClick={() => copy(trimmed)}
        >
          {copied ? <Check size={14} strokeWidth={1.8} /> : <Copy size={14} strokeWidth={1.6} />}
        </button>
      </div>
      <pre className="mr-codeview" style={{ '--mr-codeview-gutter': gutter } as CSSProperties} tabIndex={0}>
        <code>
          {lines === undefined
            ? trimmed.split('\n').map((text, index) => <span className="line" key={index}>{text}</span>)
            : lines.map((line, index) => (
              <span className="line" key={index}>
                {line.map((span, spanIndex) => <span key={spanIndex} style={span.style}>{span.text}</span>)}
              </span>
            ))}
        </code>
      </pre>
    </div>
  )
}
