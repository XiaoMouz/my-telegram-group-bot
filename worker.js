/**
 * https://github.com/cvzi/telegram-bot-cloudflare
 */

// @ts-ignore
const TOKEN = ENV_BOT_TOKEN; // Get it from @BotFather https://core.telegram.org/bots#6-botfather
const WEBHOOK = "/endpoint";
// @ts-ignore
const SECRET = ENV_BOT_SECRET; // A-Z, a-z, 0-9, _ and -

const blockStickers = ["spottedhyenaNL", "FriendlyHyena"];
const blockUsernameKeywords = [
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
  if (message.sticker && blockStickers.includes(message.sticker.set_name)) {
    console.log("Detected sticker from blocked set:", message.sticker.set_name);
    return deleteMessage(
      message.chat.id,
      message.message_id,
      // at username
      "出警! 🚓🚨 发现了一张逆天贴纸! " +
        "马上逮捕 @" +
        message.from.username +
        "!"
    );
  }
  // if message is new member, check it

  // @ts-ignore
  let disable_join_check = await KV_SETTINGS.get("disable_join_check");
  if (message.new_chat_member && disable_join_check === "false") {
    return newMemberCheck(message);
  }
  // if message is from bot owner and someone left the chat, delete it
  if (
    message.from.id === 7127605463 &&
    message.left_chat_participant !== undefined
  ) {
    return deleteMessage(message.chat.id, message.message_id);
  }
  // if message start with '/' and end with "@xmz_gpm_bot" go to on command
  if (message.text.startsWith("/") && message.text.endsWith("@xmz_gpm_bot")) {
    return onCommand(message);
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
}

/**
 * If new member first name or last name have block username keywords, kick it
 */
function newMemberCheck(message) {
  const username = message.new_chat_member.username;
  const firstName = message.new_chat_member.first_name;
  const lastName = message.new_chat_member.last_name;
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
  await sendPlainText(
    chatId,
    "出警! 🚓🚨 发现了疑似广告机用户! User ID:" + userId
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
