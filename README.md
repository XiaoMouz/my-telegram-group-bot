### my-telegram-group-bot
一时兴起在 Cloudflare Worker 上试试水的独裁 bot


### 部署在 Cloudflare Worker 上

需要填写一下环境信息

- `ENV_BOT_TOKEN`: 你的 Bot token
- `ENV_BOT_SECRET`: 你的 Bot 密钥，随便生成个
- `KV_SETTINGS`: KV 绑定

请在 KV 中提前编辑好以下变量
- `disable_join_check`:`false`
- `block_stickers`: 空
- `block_username_keywords`: 空
- `admin_ids`: `[用户id,用户id]` (int)
- `operator_ids`: `[用户id,用户id]` (int)
admin_ids 和 operator_ids 是管理员和操作员 id，一般填自己id即可

然后丢 Worker 里即可

> 一个晚上弄的，尝尝鲜，轻喷 😢
