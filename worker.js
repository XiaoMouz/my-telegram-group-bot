/**
 * https://github.com/cvzi/telegram-bot-cloudflare
 */

// @ts-ignore
const TOKEN = ENV_BOT_TOKEN; // Get it from @BotFather https://core.telegram.org/bots#6-botfather
const WEBHOOK = "/endpoint";
// @ts-ignore
const SECRET = ENV_BOT_SECRET; // A-Z, a-z, 0-9, _ and -

let blockStickers = ["spottedhyenaNL", "FriendlyHyena"];
let blockUsernameKeywords = [
  "免费vpn",
  "免费 vpn",
  "免费v2ray",
  "免费ssr",
  "免费ss",
  "免费梯子",
];

/**
 * Wait for requests to the worker
 */
addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event));
  } else if (url.pathname === "/registerWebhook") {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET));
  } else if (url.pathname === "/unRegisterWebhook") {
    event.respondWith(unRegisterWebhook(event));
  } else {
    event.respondWith(new Response("No handler for this request"));
  }
});

/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook(event) {
  // Check secret
  if (event.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== SECRET) {
    return new Response("Unauthorized", { status: 403 });
  }

  // Read request body synchronously
  const update = await event.request.json();
  // Deal with response asynchronously
  event.waitUntil(onUpdate(update));

  return new Response("Ok");
}

/**
 * Handle incoming Update
 * supports messages and callback queries (inline button presses)
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate(update) {
  console.log(update);
  if ("message" in update) {
    await onMessage(update.message);
  }
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
// @ts-ignore
async function registerWebhook(event, requestUrl, suffix, secret) {
  // https://core.telegram.org/bots/api#setwebhook
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
  const r = await (
    await fetch(apiUrl("setWebhook", { url: webhookUrl, secret_token: secret }))
  ).json();
  return new Response("ok" in r && r.ok ? "Ok" : JSON.stringify(r, null, 2));
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook(event) {
  // if event param have bot secret, remove it
  if (event.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== SECRET) {
    return new Response("Unauthorized", { status: 403 });
  }
  const r = await (await fetch(apiUrl("setWebhook", { url: "" }))).json();
  return new Response("ok" in r && r.ok ? "Ok" : JSON.stringify(r, null, 2));
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl(methodName, params = null) {
  let query = "";
  if (params) {
    query = "?" + new URLSearchParams(params).toString();
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`;
}

async function kvReader(key) {
  // @ts-ignore
  const value = await KV_SETTINGS.get(key);
  try {
    console.log("KV Reader(json):", value);
    return JSON.parse(value);
  } catch (e) {
    console.log("KV Reader(fail):", value);
    return value;
  }
}
async function kvWriter(key, value) {
  try {
    console.log("KV Writer(json):", value);
    // @ts-ignore
    await KV_SETTINGS.put(key, JSON.stringify(value));
  } catch (e) {
    console.log("KV Writer(fail):", value);
    // @ts-ignore
    await KV_SETTINGS.put(key, value);
    console.error();
  }
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText(chatId, text) {
  return (
    await fetch(
      apiUrl("sendMessage", {
        chat_id: chatId,
        text,
      })
    )
  ).json();
}

/**
 * Send text message formatted with MarkdownV2-style
 * Keep in mind that any markdown characters _*[]()~`>#+-=|{}.! that
 * are not part of your formatting must be escaped. Incorrectly escaped
 * messages will not be sent. See escapeMarkdown()
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendMarkdownV2Text(chatId, text) {
  console.log("Markdown content:" + text);
  return (
    await fetch(
      apiUrl("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
      })
    )
  ).json();
}

/**
 * Escape string for use in MarkdownV2-style text
 * if `except` is provided, it should be a string of characters to not escape
 * https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdown(str, except = "") {
  const all = "_*[]()~`>#+-=|{}.!\\"
    .split("")
    .filter((c) => !except.includes(c));
  const regExSpecial = "^$*+?.()|{}[]\\";
  const regEx = new RegExp(
    "[" +
      all.map((c) => (regExSpecial.includes(c) ? "\\" + c : c)).join("") +
      "]",
    "gim"
  );
  return str.replace(regEx, "\\$&");
}

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage(message) {
  //message is private
  if (
    message.chat.type === "private" &&
    (message.text.startsWith("/start") || message.text.startsWith("/help"))
  ) {
    return sayHello(message.chat.id);
  }

  // if message sticker is block stickers, delete it
  if (message.sticker !== undefined) {
    const kvBlockStickers = await kvReader("block_stickers");
    // if kvBlockStickers is empty or null or undefined, set it to blockStickers
    if (
      kvBlockStickers === null ||
      kvBlockStickers === undefined ||
      kvBlockStickers === ""
    ) {
      kvWriter("block_stickers", blockStickers);
    } else {
      blockStickers = kvBlockStickers;
    }
    if (blockStickers.includes(message.sticker.set_name)) {
      console.log(
        "Detected sticker from blocked set:",
        message.sticker.set_name
      );
      return bannedStickerDelete(message);
    }
  }
  // if message is new member, check it

  // @ts-ignore
  if (message.new_chat_member !== undefined) {
    let disable_join_check = await kvReader("disable_join_check");
    if (disable_join_check === "false") {
      return newMemberCheck(message);
    }
  }
  // if message start with '/' and @ with "@xmz_gpm_bot" go to on command
  if (message.text.startsWith("/") && message.text.includes("@xmz_gpm_bot")) {
    return onCommand(message);
  }

  // if message is from bot owner and someone left the chat, delete it
  if (
    message.from.id === 7127605463 &&
    message.left_chat_participant !== undefined
  ) {
    return deleteMessage(message.chat.id, message.message_id);
  }
}

/**
 * Handle incoming Command
 *
 **/
async function onCommand(message) {
  // get Command
  const command = message.text.split("@")[0];
  // get chat id
  const chatId = message.chat.id;

  if (command === "/disable_newmember_check") {
    try {
      // @ts-ignore
      await KV_SETTINGS.put("disable_join_check", "true");
      // @ts-ignore
      const value = await KV_SETTINGS.get("disable_join_check");
      if (value === null) {
        console.error("Failed to disable new member check");
      }
      console.log(value);
    } catch (e) {
      console.error(e);
    }
    return sendPlainText(chatId, "已关闭新成员检查");
  }
  if (command === "/enable_newmember_check") {
    try {
      // @ts-ignore
      await KV_SETTINGS.put("disable_join_check", "false");
      // @ts-ignore
      const value = await KV_SETTINGS.get("disable_join_check");
      if (value === null) {
        console.error("Failed to disable new member check");
      }
      console.log(value);
    } catch (e) {
      console.error(e);
    }
    return sendPlainText(chatId, "已开启新成员检查");
  }
  if (command === "/block_stickers") {
    // get block stickers
    const kvBlockStickers = await kvReader("block_stickers");
    // markdown
    let text = "当前被屏蔽的贴纸集合:\n";
    for (let i = 0; i < kvBlockStickers.length; i++) {
      text += `- [${kvBlockStickers[i]}](https://t.me/addstickers/${kvBlockStickers[i]})\n`;
    }
    return sendMarkdownV2Text(chatId, escapeMarkdown(text, "[]()"));
  }
  if (command === "/block_username_keywords") {
    // get block username keywords
    const kvBlockUsernameKeywords = await kvReader("block_username_keywords");
    // markdown
    let text = "当前被屏蔽的用户名关键字:\n";
    for (let i = 0; i < kvBlockUsernameKeywords.length; i++) {
      text += `- ${kvBlockUsernameKeywords[i]}\n`;
    }
    return sendMarkdownV2Text(chatId, escapeMarkdown(text, "[]()"));
  }
  if (command === "/operators") {
    // get operator ids
    const operatorIds = await kvReader("operator_ids");
    // markdown
    let text = "当前管理员:\n";
    for (let i = 0; i < operatorIds.length; i++) {
      text += `- [${operatorIds[i]}](tg://user?id=${operatorIds[i]})\n`;
    }
    return sendMarkdownV2Text(chatId, escapeMarkdown(text, "[]()"));
  }
  const operatorIds = await kvReader("operator_ids");
  const adminIds = await kvReader("admin_ids");

  if (adminIds.includes(message.from.id)) {
    return onManagerCommand(message, adminIds);
  } else {
    if (operatorIds.includes(message.from.id)) {
      return onManagerCommand(message, adminIds);
    } else {
      return sendPlainText(chatId, "你没有权限");
    }
  }
}

async function onManagerCommand(message, adminIds = []) {
  // get Command
  const command = message.text.split("@")[0];
  // get chat id
  const chatId = message.chat.id;
  if (command === "/add_block_sticker") {
    // get block stickers
    let kvBlockStickers = await kvReader("block_stickers");
    let sticker = "";
    // add sticker
    if (message.reply_to_message.sticker === undefined) {
      if (message.text.split(" ")[1] === "") {
        return sendPlainText(chatId, "请输入贴纸集合名称，或回复贴纸");
      }
      sticker = message.text.split(" ")[1];
    } else {
      sticker = message.reply_to_message.sticker.set_name;
    }
    kvBlockStickers.push(sticker);
    kvWriter("block_stickers", kvBlockStickers);
    return sendMarkdownV2Text(
      chatId,
      escapeMarkdown(
        "已添加贴纸集合至黑名单: " +
          `[${sticker}](https://t.me/addstickers/${sticker})\n`,
        "[]()"
      )
    );
  }
  if (command === "/remove_block_sticker") {
    // get block stickers
    let kvBlockStickers = await kvReader("block_stickers");
    let sticker = "";
    // find sticker in reply
    if (message.reply_to_message.sticker === undefined) {
      if (message.text.split(" ")[1] === "") {
        return sendPlainText(chatId, "请输入贴纸集合名称，或回复贴纸");
      }
      sticker = message.text.split(" ")[1];
    } else {
      sticker = message.reply_to_message.sticker.set_name;
    }
    const index = kvBlockStickers.indexOf(sticker);
    if (index > -1) {
      kvBlockStickers.splice(index, 1);
    }
    kvWriter("block_stickers", kvBlockStickers);
    return sendMarkdownV2Text(
      chatId,
      escapeMarkdown(
        "已将贴纸移出黑名单: " +
          `[${sticker}](https://t.me/addstickers/${sticker})`,
        "[]()"
      )
    );
  }
  if (command === "/add_username_block_keyword") {
    // get block username keywords
    const kvBlockUsernameKeywords = await kvReader("block_username_keywords");
    // add username keyword
    const usernameKeyword = message.text.split(" ")[1];
    kvBlockUsernameKeywords.push(usernameKeyword);
    kvWriter("block_username_keywords", kvBlockUsernameKeywords);
    return sendPlainText(
      chatId,
      "已添加用户名关键字至黑名单: " + usernameKeyword
    );
  }
  if (command === "/remove_username_block_keyword") {
    // get block username keywords
    let kvBlockUsernameKeywords = await kvReader("block_username_keywords");
    // add username keyword
    const usernameKeyword = message.text.split(" ")[1];
    const index = kvBlockUsernameKeywords.indexOf(usernameKeyword);
    if (index > -1) {
      kvBlockUsernameKeywords.splice(index, 1);
    }
    kvWriter("block_username_keywords", kvBlockUsernameKeywords);
    return sendPlainText(
      chatId,
      "已将用户名关键字移出黑名单: " + usernameKeyword
    );
  } else {
    if (adminIds.includes(message.from.id)) {
      return onAdminCommand(message);
    }
  }
}

async function onAdminCommand(message) {
  // get Command
  const command = message.text.split("@")[0];
  // get chat id
  const chatId = message.chat.id;
  if (command === "/add_operator") {
    // get operator ids
    let operatorIds = await kvReader("operator_ids");
    let operatorId = 0;
    // if is empty return
    if (message.reply_to_message === undefined) {
      if (
        message.text.split(" ")[1] === "" ||
        message.text.split(" ")[1] === undefined
      ) {
        return sendPlainText(chatId, "请输入管理员ID");
      } else {
        operatorId = message.text.split(" ")[1];
      }
    } else {
      operatorId = message.reply_to_message.from.id;
    }
    //handle is num
    if (isNaN(operatorId)) {
      return sendPlainText(chatId, "请输入正确的管理员ID");
    }
    // if exist, return
    if (operatorIds.includes(operatorId)) {
      return sendPlainText(chatId, "管理员已存在");
    }
    operatorIds.push(operatorId);
    kvWriter("operator_ids", operatorIds);
    return sendMarkdownV2Text(
      chatId,
      escapeMarkdown(
        "已添加管理员:" + `[${operatorId}](tg://user?id=${operatorId})\n`,
        "[]()"
      )
    );
  }
  if (command === "/remove_operator") {
    // get operator ids
    let operatorIds = await kvReader("operator_ids");
    let operatorId = 0;
    // if is empty return
    if (message.reply_to_message === undefined) {
      if (
        message.text.split(" ")[1] === "" ||
        message.text.split(" ")[1] === undefined
      ) {
        return sendPlainText(chatId, "请输入管理员ID");
      } else {
        operatorId = message.text.split(" ")[1];
      }
    } else {
      operatorId = message.reply_to_message.from.id;
    }
    //handle is num
    if (isNaN(operatorId)) {
      return sendPlainText(chatId, "请输入正确的管理员ID");
    }
    // if not exist, return
    if (!operatorIds.includes(operatorId)) {
      return sendPlainText(chatId, "管理员不存在");
    }
    const index = operatorIds.indexOf(operatorId);
    if (index > -1) {
      operatorIds.splice(index, 1);
    }
    kvWriter("operator_ids", operatorIds);

    return sendMarkdownV2Text(
      chatId,
      escapeMarkdown(
        "已移除管理员:" + `[${operatorId}](tg://user?id=${operatorId})\n`,
        "[]()"
      )
    );
  }
}

/**
 * If new member first name or last name have block username keywords, kick it
 */
async function newMemberCheck(message) {
  const username = message.new_chat_member.username;
  const firstName = message.new_chat_member.first_name;
  const lastName = message.new_chat_member.last_name;
  // read kv
  const kvBlockUsernameKeywords = await kvReader("block_username_keywords");
  // if kvBlockUsernameKeywords is empty or null or undefined, set it to blockUsernameKeywords
  if (
    kvBlockUsernameKeywords === null ||
    kvBlockUsernameKeywords === undefined ||
    kvBlockUsernameKeywords === ""
  ) {
    kvWriter("block_username_keywords", blockUsernameKeywords);
  } else {
    blockUsernameKeywords = kvBlockUsernameKeywords;
  }

  if (
    blockUsernameKeywords.some((keyword) =>
      new RegExp(keyword, "i").test(username)
    ) ||
    blockUsernameKeywords.some((keyword) =>
      new RegExp(keyword, "i").test(firstName)
    ) ||
    blockUsernameKeywords.some((keyword) =>
      new RegExp(keyword, "i").test(lastName)
    )
  ) {
    return banMember(message.chat.id, message.new_chat_member.id);
  }
  if (firstName.length + lastName.length > 16) {
    return banMember(message.chat.id, message.new_chat_member.id);
  }
}

async function bannedStickerDelete(message) {
  // get sticker name and t.me link
  const stickerName = message.sticker.set_name;
  const stickerLink = `https://t.me/addstickers/${stickerName}`;
  let text =
    "出警! 🚓🚨 发现了一张逆天贴纸 " +
    `: [${stickerName}](${stickerLink}) !` +
    "马上逮捕 " +
    `[${
      message.from.username === undefined
        ? " " + message.from.first_name + message.from.last_name
        : "@" + message.from.username
    }](tg://user?id=${message.from.id})` +
    "!";
  // delete sticker
  await deleteMessage(message.chat.id, message.message_id);
  return sendMarkdownV2Text(message.chat.id, escapeMarkdown(text, "[]()"));
}

/**
 * Delete message
 * https://core.telegram.org/bots/api#deletemessage
 */
async function deleteMessage(chatId, messageId, tips = "") {
  //set tips message
  console.log("Detected sticker from chat:", chatId, "messageId:", messageId);
  if (tips != "") {
    await sendPlainText(chatId, tips);
  }
  console.log("Sending delete request...");
  return (
    await fetch(
      apiUrl("deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      })
    )
  ).json();
}

/**
 * Ban member
 * https://core.telegram.org/bots/api#kickchatmember
 */
async function banMember(chatId, userId, untilData = 0, revokeMessage = true) {
  //set tips message
  await sendMarkdownV2Text(
    chatId,
    escapeMarkdown(
      "出警! 🚓🚨 发现了疑似广告机用户! User ID:" +
        `${userId}[tg://user?id=${userId}]`,
      "[]()"
    )
  );
  console.log("Sending ban request...");
  return (
    await fetch(
      apiUrl("banChatMember", {
        chat_id: chatId,
        user_id: userId,
        until_data: untilData,
        revoke_messages: revokeMessage,
      })
    )
  ).json();
}

function sayHello(chatId) {
  return sendPlainText(chatId, "退钱！");
}
