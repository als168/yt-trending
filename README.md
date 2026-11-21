# YouTube 每日热门 (yt-trending)

一个零依赖的 Node.js 小应用,展示 YouTube 各地区每日热门视频
(mostPopular),支持切换地区和按分类筛选。

## 功能

- 地区切换:新加坡(默认)、美国、日本、台湾、韩国、英国
- 分类筛选:全部、音乐、游戏、娱乐、新闻与政治、体育、科技、喜剧、电影与动画、人物与博客
- 视频卡片:缩略图、标题(点开跳转 YouTube)、频道名、播放量、点赞数、评论数、发布日期
- 显示"更新于"时间和刷新按钮
- 服务端内存缓存 30 分钟,同一地区+分类 30 分钟内只调一次 API

## 环境变量

| 变量 | 说明 |
| ---- | ---- |
| `YT_API_KEY` | 必填,YouTube Data API v3 的 API key |
| `PORT` | 可选,默认 3000 |

免费额度:YouTube Data API v3 默认每天 1 万单位;
`videos.list` 查热门榜一次只花 1 单位,加上 30 分钟缓存,完全够用。
额度用完不会扣钱,只会报错;申请提额才需要绑卡。

获取 key(免费,不用绑卡):
1. 打开 console.cloud.google.com,新建一个项目
2. API 和服务 → 库 → 搜 `YouTube Data API v3` → 启用
3. API 和服务 → 凭据 → 创建凭据 → API 密钥
4. 建议给 key 加 API 限制,只允许 YouTube Data API v3

## 本地运行

```bash
export YT_API_KEY=你的key
npm start
# 打开 http://localhost:3000
```

不设 key 也能启动,页面会提示未配置 key,接口返回 `missing_key` 错误。

## Hostless 部署

1. 把这份代码推到一个 GitHub 仓库
2. 在 Hostless 控制台新建 App,选该仓库,部署方式用默认的 Node 启动(`npm start`)
3. 在 App 的环境变量里设置 `YT_API_KEY`(不要把 key 写进代码或仓库)
4. 内部端口用 Hostless 分配的 `PORT` 环境变量,应用会自己读

注意:
- 应用运行时不写任何文件(Hostless 运行环境的文件系统是只读的),
  缓存只放在内存里,重启后重新拉取。
- 不要把 `YT_API_KEY` 提交进仓库。
