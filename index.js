const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(express.json());

// =========================
// 設定檔
// =========================

function getSettings() {
  return JSON.parse(fs.readFileSync("settings.json", "utf8"));
}

function saveSettings(settings) {
  fs.writeFileSync(
    "settings.json",
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

// =========================
// LINE
// =========================

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// =========================
// 工具
// =========================

function formatNumber(num) {
  return Number(num).toLocaleString("zh-TW");
}

function calculateKRW(krw) {
  const settings = getSettings();

  const rate = settings.rate;

  const twd = Math.round(krw / rate);

  let fee = 0;
  let feeText = "";

  if (twd <= 2500) {
    fee = 240;
    feeText = "NT$240";
  } else {
    fee = Math.round(twd * 0.15);
    feeText = `NT$${formatNumber(fee)}（15%）`;
  }

  const total = twd + fee;

  const tax = Math.round(total * 0.05);

  const profit = fee - tax;

  return {
    rate,
    krw,
    twd,
    fee,
    feeText,
    total,
    tax,
    profit,
  };
}

// =========================
// 健康檢查
// =========================

app.get("/", (req, res) => {
  res.send("LINE BOT OK");
});

// =========================
// Webhook
// =========================

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const msg = event.message.text.trim();

      // =====================
      // 健康測試
      // =====================

      if (msg === "/健康") {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "✅ Bot 正常運作",
            },
          ],
        });

        continue;
      }

      // =====================
      // 查看匯率
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
        const rate = Number(msg.replace("/匯率", "").trim());

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
        const numbers = msg
          .replace(/\s/g, "")
          .substring(1)
          .split("+")
          .map((n) => n.replace(/,/g, ""));

        if (
          numbers.length === 0 ||
          numbers.some((n) => !/^\d+$/.test(n))
        ) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "❌ 請輸入正確格式，例如：\n+29900\n+29900+12000",
              },
            ],
          });

          continue;
        }

        const krw = numbers
          .map(Number)
          .reduce((a, b) => a + b, 0);

        const result = calculateKRW(krw);

        const replyText = `1.韓幣：₩${formatNumber(result.krw)}
2.目前匯率：${result.rate}
3.換算台幣：NT$${formatNumber(result.twd)}
4.代購費：${result.feeText}
5.營業稅5%：NT$${formatNumber(result.tax)}

────────

估算盈利
${formatNumber(result.fee)}-${formatNumber(result.tax)}=${formatNumber(result.profit)}

────────

總金額：NT$${formatNumber(result.total)}`;

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: replyText,
            },
          ],
        });

        continue;
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error(err);

    return res.sendStatus(500);
  }
});

// =========================
// 啟動
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});