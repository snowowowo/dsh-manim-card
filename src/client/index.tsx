// Client 入口：默认导出插件对象（产物包装由构建预设的 banner/footer 完成）。
import React, { type ReactNode } from 'react'
import { ManimPage } from './page'
import { ManimCard } from './components/card'
import { definition, type ManimCardData } from './definition'
import { NavIcon } from './navicon'
import { createManimService } from './service'
import { DICT, NS } from './i18n'
import './styles.css'

interface HostContext {
  effect(fn: () => (() => void) | void, label?: string): void
  provide(name: string, value: unknown): () => void
  locale: { register(ns: string, dict: unknown): void; bind(ns: string): (key: string) => string }
  uiConversation: { events: { register(definition: unknown): () => void } }
  slots: {
    inject(name: string, register: () => void): void
    register(options: Record<string, unknown>, component: unknown): void
  }
}

/** 槽位渲染崩溃时原地显示 + 打 Console，禁止静默消失。 */
class SlotErrorBoundary extends React.Component {
  declare props: { children?: ReactNode }
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[manim-renderer] slot render crashed:', error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 13, padding: '8px 16px' }}>
          {`渲染出错：${this.state.error.message}`}
        </div>
      )
    }
    return this.props.children
  }
}

export default {
  inject: ['slots', 'locale', 'uiConversation'],
  apply(ctx: HostContext) {
    ctx.effect(() => ctx.locale.register(NS, DICT), 'manim-renderer: dictionaries')
    const t = ctx.locale.bind(NS)

    // 对外服务：给别的插件（将来的黑板）「运行时 + 一块画布」——插件间禁止 import，只此一条路。
    // 不含卡片 UI / Host 工具 / 分步播放：那些是本插件的入口或调用方自己的事（顶层设计 §5、§6）。
    ctx.effect(() => ctx.provide('manim', createManimService()), 'manim-renderer: provide service')

    // KaTeX 样式：MathTex 渲染成 KaTeX HTML，字体由 Host 路由提供（见 src/host/index.js）。
    // effect 托管，卸载即移除。
    ctx.effect(() => {
      const katexCss = document.createElement('link')
      katexCss.rel = 'stylesheet'
      katexCss.href = '/dsh-plugins/manim-renderer/katex/katex.min.css'
      document.head.append(katexCss)
      return () => katexCss.remove()
    }, 'manim-renderer: katex stylesheet')

    // 左侧导航项（图标 + 名称）
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist', id: 'manim-renderer', order: 2000, label: () => t('nav'),
    }, (props: { size: number; active: boolean }) =>
      <SlotErrorBoundary><NavIcon {...props} /></SlotErrorBoundary>))

    // 整页内容
    ctx.slots.inject('main', () => ctx.slots.register(
      { name: 'main', key: 'manim-renderer' },
      () => <SlotErrorBoundary><ManimPage t={t} /></SlotErrorBoundary>,
    ))

    // 聊天卡片：manim_render 的 tool/call 折叠成一张卡（定义见 ./definition.ts）。
    // 定义的 kind 与槽位的 key 必须一致——那是渲染器认领节点的键。
    // register 返回幂等 disposer，按注册即 effect 的约定交 ctx.effect 托管。
    ctx.effect(() => ctx.uiConversation.events.register(definition), 'manim-renderer: conversation definition')
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
      { name: 'conversation.chat.node', key: 'manim-render', locale: NS },
      (props: { node: { data: ManimCardData } }) =>
        <SlotErrorBoundary><ManimCard data={props.node.data} t={t} /></SlotErrorBoundary>,
    ))
  },
}