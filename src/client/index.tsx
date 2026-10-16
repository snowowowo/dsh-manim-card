// Client 入口：默认导出插件对象（产物包装由构建预设的 banner/footer 完成）。
import React, { type ReactNode } from 'react'
import { ManimSettingsPage } from './settings'
import { ManimCard } from './components/card'
import { definition, type ManimCardData } from './definition'
import { disposeManimRenderer, manimRenderer } from './renderer'
import { DICT, NS, type Translate } from './i18n'
import './styles.css'

interface HostContext {
  effect(fn: () => (() => void) | void, label?: string): void
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
    console.error('[manim-card] slot render crashed:', error)
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
    ctx.effect(() => ctx.locale.register(NS, DICT), 'manim-card: dictionaries')
    const t = ctx.locale.bind(NS)

    // 本插件**不对外提供 Cordis 服务**（2026-10-16 定）：没有下游依赖它；谁要用 Manim 能力，
    // 直接依赖核心包 `manim-live`（npm）——共享的是那个包，不是插件。
    //
    // 这一句把渲染器建起来（核心包 `manim-live` 的工厂）：**KaTeX 样式与 Pyodide 取数根**
    // 都由它按配置一并登记（见 ./renderer.ts）——设置页的运行时读数就来自这份登记，
    // 所以插件一加载就建，不必等第一张卡。卸载时连渲染器一起释放：它持有 WASM / WebGL
    // 与注入的样式，漏一次就是一次内存泄漏。
    ctx.effect(() => {
      manimRenderer()
      return () => disposeManimRenderer()
    }, 'manim-card: renderer lifecycle')

    // 设置分区：设置面板里的一个整页（本机环境 + 包缓存）。这是**真功能**（用户要用的），
    // 照常注册槽位、常显；label 用插件英文名。
    //
    // 落座点**只在这一行**，面板本体（./settings.tsx）只收一个取词函数——不接 close、
    // 不假设容器宽高、不读设置面板的 store。所以「这块面板摆在哪」是这里一行的事：
    // 想搬到别处（比如以后那个把各插件摆到一起的工作台）只改这一行，面板一行都不用动。
    // 取词命名空间沿用本插件的 NS。
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section', id: 'manim-card', order: 60, label: 'manim-card', locale: NS,
    }, (props: { t?: Translate }) => <SlotErrorBoundary><ManimSettingsPage t={props.t ?? t} /></SlotErrorBoundary>))

    // 聊天卡片：manim_render 的 tool/call 折叠成一张卡（定义见 ./definition.ts）。
    // 定义的 kind 与槽位的 key 必须一致——那是渲染器认领节点的键。
    // register 返回幂等 disposer，按注册即 effect 的约定交 ctx.effect 托管。
    ctx.effect(() => ctx.uiConversation.events.register(definition), 'manim-card: conversation definition')
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
      { name: 'conversation.chat.node', key: 'manim-card', locale: NS },
      (props: { node: { data: ManimCardData } }) =>
        <SlotErrorBoundary><ManimCard data={props.node.data} t={t} /></SlotErrorBoundary>,
    ))
  },
}