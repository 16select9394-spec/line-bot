const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
require("dotenv").config();

const app = express();

// 讀取設定檔
function getSettings() {
  return JSON.parse(fs.readFileSync("settings.json", "utf8"));
}

// 儲存設定檔
function saveSettings(settings) {
  fs.writeFileSync(
    "settings.json",
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

// LINE 設定
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});
// =========================
// Webhook
// =========================

app.post("/webhook", line.middleware(config), async (req, res) => {

  const events = req.body.events;

  for (const event of events) {

    if (event.type !== "message") continue;
    if (event.message.type !== "text") continue;

    const msg = event.message.text.trim();

    // =====================
    // 查看目前匯率
    // =====================

    if (msg === "/匯率") {

      const settings = getSettings();

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: `目前匯率：${settings.rate}`,
          },
        ],
      });

      continue;
    }

    // =====================
    // 修改匯率
    // =====================

    if (msg.startsWith("/匯率 ")) {

      const rate = Number(
        msg.replace("/匯率", "").trim()
      );

      if (!rate || rate <= 0) {

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "❌ 匯率格式錯誤",
            },
          ],
        });

        continue;
      }

      const settings = getSettings();

      settings.rate = rate;

      saveSettings(settings);

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: `✅ 已更新匯率：${rate}`,
          },
        ],
      });

      continue;
    }
    // =====================
    // 韓幣試算
    // =====================

    if (msg.startsWith("+")) {

      // 支援：
      // +29900
      // +29900+12000
      // +29,900 + 12,000

      const numbers = msg
        .replace(/\s/g, "")
        .substring(1)
        .split("+")
        .map(n => n.replace(/,/g, ""));

      if (numbers.some(n => !/^\d+$/.test(n))) {

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: "text",
            text: "❌ 請輸入正確格式，例如：\n+29900\n+29900+12000"
          }]
        });

        continue;
      }

      const krw = numbers
        .map(Number)
        .reduce((a, b) => a + b, 0);

      const result = calculateKRW(krw);

      const profitText =
`${result.fee}-${result.tax}=${result.profit}`;

      const replyText =
`1.韓幣：₩${formatNumber(krw)}
2.目前匯率：${result.rate}
3.換算台幣：NT$${formatNumber(result.twd)}
4.代購費：${result.feeText}
5.營業稅5%：NT$${formatNumber(result.tax)}

────────

估算盈利
${profitText}

────────

總金額：NT$${formatNumber(result.total)}`;

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "text",
          text: replyText
        }]
      });

      continue;
    }

  }

  res.sendStatus(200);

});
app.listen(process.env.PORT || 3000, () => {
  console.log("Bot is running");
});