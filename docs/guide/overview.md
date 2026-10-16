# 它是什么

dsh-manim-card 给 DeepSeek Harness 加一张动画卡片：AI 在会话里写标准 Manim（Python）代码，聊天流中当场出现可播放、可查看代码的卡片。代码在浏览器内执行，本机不需要安装 Python。

| 落点 | 内容 |
| --- | --- |
| 聊天流 | 动画卡片：手动播放、查看代码 |
| 工具 | `manim_card`：AI 提交一段 Manim Python，返回前先跑一遍预检 |
| 设置 | 「Manim卡片」一节：浏览器运行时状态与本机库清单 |

渲染引擎与 Python 运行时由核心包 [manim-live](https://snowowowo.github.io/manim-live/) 提供，随本插件一起装好，不需要另外配置。
