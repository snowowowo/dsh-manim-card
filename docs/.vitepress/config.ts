import { defineConfig } from 'vitepress'

// base 与部署地址对齐：仓库是 github.com/snowowowo/dsh-manim-live，项目页即
// https://snowowowo.github.io/dsh-manim-live/ 。换自定义域名（或改成 <user>.github.io
// 用户页）时改这一处即可——正文里的图片全是相对路径，vite 构建时自动带上 base。
const BASE = '/dsh-manim-live/'

export default defineConfig({
  base: BASE,
  lang: 'zh-CN',
  title: 'dsh-manim-live',
  description: '在 DeepSeek Harness 的聊天里直接渲染 Manim 动画——AI 写 Python，当场出画面，还能导出 mp4。',
  // 图标放在 public/ 下。head 里的 href **不会**被自动加 base（它不走 markdown 链接改写），
  // 所以这里手动拼上——顺手把它绑到上面那个 BASE，免得两处各改一次。
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}favicon.svg` }]],
  // README.md 是给「改文档的人」看的说明（怎么装依赖、base 在哪改），不是正文——别渲染成页面。
  srcExclude: ['README.md'],
  // 每页底部显示「上次更新」：取 git 提交时间。
  lastUpdated: true,

  // 版式：左侧 = 整站目录（下面那段 sidebar，全站一套），右侧 = 当前页的章节大纲。
  // 后者由 outline 控制，默认就有；这里收窄到 h2/h3，免得长文右栏被 h4 灌满。
  themeConfig: {
    // ⚠️ nav / sidebar 必须在 themeConfig 里。写在 defineConfig 顶层是无效的
    // ——不报错、也不出现，页面就是「既没顶部导航、又没左侧目录」（manim-live 踩过）。
    nav: [
      { text: '指南', link: '/guide/installation', activeMatch: '^/guide/' },
    ],

    sidebar: [
      {
        text: '指南',
        items: [
          { text: '安装', link: '/guide/installation' },
          { text: '在聊天里用', link: '/guide/usage' },
          { text: '实验场', link: '/guide/lab' },
          { text: '设置面板', link: '/guide/settings' },
          { text: '第三方插件接入', link: '/guide/integrating' },
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

    socialLinks: [{ icon: 'github', link: 'https://github.com/snowowowo/dsh-manim-live' }],
    footer: {
      message: 'DeepSeek Harness 插件系列 · 运行时与渲染引擎见核心包 manim-live',
      copyright: 'Copyright © 2026 snowowowo',
    },
  },
})
