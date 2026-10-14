import { defineConfig } from 'vitepress'

// base 与部署地址对齐：仓库是 github.com/snowowowo/dsh-manim-card，项目页即
// https://snowowowo.github.io/dsh-manim-card/ 。换自定义域名（或改成 <user>.github.io
// 用户页）时改这一处即可——正文里的图片全是相对路径，vite 构建时自动带上 base。
const BASE = '/dsh-manim-card/'

// i18n 约定（标准源是 dsh-plugin-template）：中文是源语言，放在根目录；英文是本地化，
// 放在 en/ 下且目录结构与中文一一对应。两侧只差语言，不差内容——改了中文必须同步改英文。
export default defineConfig({
  base: BASE,
  title: 'dsh-manim-card',
  description: 'DeepSeek Harness 插件：在会话中让 AI 用 Manim 画动画——聊天流中出现可播放、可查看代码、可导出 mp4 的动画卡片；代码在浏览器内执行，基础功能离线可用。',
  // 图标放在 public/ 下。head 里的 href **不会**被自动加 base（它不走 markdown 链接改写），
  // 所以这里手动拼上——顺手把它绑到上面那个 BASE，免得两处各改一次。
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}favicon.svg` }]],
  // README.md 是给「改文档的人」看的说明（怎么装依赖、base 在哪改），不是正文——别渲染成页面。
  srcExclude: ['README.md'],
  // 每页底部显示「上次更新」：取 git 提交时间。
  lastUpdated: true,

  locales: {
    // 中文 = 源语言，页面在根目录。
    root: {
      label: '简体中文',
      lang: 'zh-CN',

      themeConfig: {
        // ⚠️ nav / sidebar 必须在 themeConfig 里。写在 defineConfig 顶层是无效的
        // ——不报错、也不出现，页面就是「既没顶部导航、又没左侧目录」（manim-live 踩过）。
        nav: [
          { text: '指南', link: '/guide/overview', activeMatch: '^/guide/' },
          { text: 'API', link: '/api/', activeMatch: '^/api/' },
        ],

        sidebar: [
          // 信息梯度：开始 = 认识插件并装好就能用；功能 = 各功能的细节；
          // 接入 = 给要在自己插件里用画布的开发者；API 参考 = 查阅；开发 = 改代码的人才需要。
          {
            text: '开始',
            items: [
              { text: '它是什么', link: '/guide/overview' },
              { text: '安装', link: '/guide/installation' },
              { text: '在聊天里用', link: '/guide/usage' },
            ],
          },
          {
            text: '功能',
            items: [
              { text: '设置面板', link: '/guide/settings' },
            ],
          },
          {
            text: '接入',
            items: [{ text: '第三方插件接入', link: '/guide/integrating' }],
          },
          {
            text: 'API 参考',
            items: [
              { text: '总览与入口', link: '/api/' },
              { text: 'manim-card 服务', link: '/api/service' },
              { text: '数据类型', link: '/api/types' },
              { text: '宿主工具', link: '/api/tool' },
            ],
          },
          // 开发调试内容单独一小节，排在最后——使用者用不到，别混进上面的使用指南。
          {
            text: '开发',
            items: [{ text: '开发与调试', link: '/dev/' }],
          },
        ],

        outline: { level: [2, 3], label: '本页目录' },
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        darkModeSwitchLabel: '外观',
        lastUpdated: { text: '上次更新' },
        docFooter: { prev: '上一页', next: '下一页' },

        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },

    // 英文 = 本地化，页面在 en/ 下，目录结构与中文一一对应。
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'dsh-manim-card',
      description: 'A DeepSeek Harness plugin: let AI draw Manim animations right in the session — playable, code-inspectable, mp4-exportable animation cards appear in the chat stream; code runs in the browser, and basic features work offline.',

      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/overview', activeMatch: '^/en/guide/' },
          { text: 'API', link: '/en/api/', activeMatch: '^/en/api/' },
        ],

        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'What It Is', link: '/en/guide/overview' },
              { text: 'Installation', link: '/en/guide/installation' },
              { text: 'Usage in Chat', link: '/en/guide/usage' },
            ],
          },
          {
            text: 'Features',
            items: [
              { text: 'Settings Panel', link: '/en/guide/settings' },
            ],
          },
          {
            text: 'Integration',
            items: [{ text: 'Third-party Plugin Integration', link: '/en/guide/integrating' }],
          },
          {
            text: 'API Reference',
            items: [
              { text: 'Overview and Entry Points', link: '/en/api/' },
              { text: 'The manim-card Service', link: '/en/api/service' },
              { text: 'Data Types', link: '/en/api/types' },
              { text: 'Host Tool', link: '/en/api/tool' },
            ],
          },
          {
            text: 'Development',
            items: [{ text: 'Development & Debugging', link: '/en/dev/' }],
          },
        ],

        outline: { level: [2, 3], label: 'On this page' },
        sidebarMenuLabel: 'Contents',
        returnToTopLabel: 'Back to top',
        darkModeSwitchLabel: 'Appearance',
        lastUpdated: { text: 'Last updated' },
        docFooter: { prev: 'Previous', next: 'Next' },
      },
    },
  },

  // socialLinks / footer 两侧共享，留在顶层 themeConfig。
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/snowowowo/dsh-manim-card' }],
    footer: {
      message: 'DeepSeek Harness 插件系列 · 运行时与渲染引擎见核心包 manim-live',
      copyright: 'Copyright © 2026 snowowowo',
    },
  },
})
