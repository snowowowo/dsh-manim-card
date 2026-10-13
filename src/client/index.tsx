// Client 入口：默认导出插件对象（产物包装由构建预设的 banner/footer 完成）。
import React, { type ReactNode } from 'react'
import { ManimPage } from './page'
import { ManimSettingsPage } from './settings'
import { ManimCard } from './components/card'
import { definition, type ManimCardData } from './definition'
import { createManimService, disposeManimRenderer } from './service'
import { DICT, NS, type Translate } from './i18n'
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
    console.error('[manim-live] slot render crashed:', error)
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
    ctx.effect(() => ctx.locale.register(NS, DICT), 'manim-live: dictionaries')
    const t = ctx.locale.bind(NS)

    // 对外服务：给别的插件（将来的黑板）「运行时 + 一块画布」——插件间禁止 import，只此一条路。
    // 不含卡片 UI / Host 工具 / 分步播放：那些是本插件的入口或调用方自己的事（顶层设计 §5、§6）。
    //
    // 服务名是 `manim-live` 而不是裸 `manim`：服务名是**跨插件共享的命名空间**，取泛词等于把
    // `manim` 这个词占住，后来者（别的插件要暴露 manim 相关能力）只能绕开或撞名。与入口 id、
    // 路由前缀、技能名、槽位 id 同一套。**改名代价**：消费方 `ctx.get('manim-live')` 要跟着改。
    //
    // 这一句同时把渲染器建起来（核心包 `manim-live` 的工厂）：**KaTeX 样式与 Pyodide 取数根**
    // 都由它按配置一并登记（见 ./service.ts），所以这里不再单独挂那份 `<link>` ——
    // 以前那一段是「插件自己拼地址、自己注入」，现在地址仍是插件的（src/routes.js），
    // 只是把「怎么用」交给了核心包。
    // 卸载时连渲染器一起释放：它持有 WASM / WebGL 与注入的样式，漏一次就是一次内存泄漏
    //（顶层设计 §5 的「销毁契约」）。
    ctx.effect(() => {
      const release = ctx.provide('manim-live', createManimService())
      return () => {
        release()
        disposeManimRenderer()
      }
    }, 'manim-live: provide service')

    // 调试面板：实验场（内置样例集 + 自定义代码的功能验收台）不占自己的导航，以 devpanel
    // 服务交给开发台（dsh-devbench）聚合；开发台缺席时无人读它，零可见（真功能页才注册槽位）。
    // label 一律插件自己的英文名（入口短名），不自起中文名。
    ctx.effect(() => ctx.provide('devpanel.manim-live', {
      label: 'manim-live',
      component: () => <SlotErrorBoundary><ManimPage t={t} /></SlotErrorBoundary>,
    }), 'manim-live: devpanel')

    // 设置分区：设置面板里的一个整页（本机环境 + 包缓存）。这是**真功能**（用户要用的），
    // 照常注册槽位、常显；label 用插件英文名。
    //
    // 落座点**只在这一行**，面板本体（./settings.tsx）只收一个取词函数——不接 close、
    // 不假设容器宽高、不读设置面板的 store。所以「这块面板摆在哪」是这里一行的事：
    // 想搬到别处（比如以后那个把各插件摆到一起的工作台）只改这一行，面板一行都不用动。
    // 取词命名空间沿用本插件的 NS。
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section', id: 'manim-live', order: 60, label: 'manim-live', locale: NS,
    }, (props: { t?: Translate }) => <SlotErrorBoundary><ManimSettingsPage t={props.t ?? t} /></SlotErrorBoundary>))

    // 聊天卡片：manim_render 的 tool/call 折叠成一张卡（定义见 ./definition.ts）。
    // 定义的 kind 与槽位的 key 必须一致——那是渲染器认领节点的键。
    // register 返回幂等 disposer，按注册即 effect 的约定交 ctx.effect 托管。
    ctx.effect(() => ctx.uiConversation.events.register(definition), 'manim-live: conversation definition')
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
      { name: 'conversation.chat.node', key: 'manim-render', locale: NS },
      (props: { node: { data: ManimCardData } }) =>
        <SlotErrorBoundary><ManimCard data={props.node.data} t={t} /></SlotErrorBoundary>,
    ))
  },
}