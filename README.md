### my-telegram-group-bot
一时兴起在 Cloudflare Worker 上试试水的独裁 bot


### 部署在 Cloudflare Worker 上

需要填写一下环境信息

- `ENV_BOT_TOKEN`: 你的 Bot token
- `ENV_BOT_SECRET`: 你的 Bot 密钥，随便生成个
- `KV_SETTINGS`: KV 绑定

请在 KV 中提前编辑好以下变量
`disable_join_check`:`false`

丢 Worker 里即可

> 一个晚上弄的，尝尝鲜，轻喷 😢
