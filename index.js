const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();


async function getRate() {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rate")
    .single();

  if (error) throw error;

  return Number(data.value);
}

async function setRate(rate) {
  const { error } = await supabase
    .from("settings")
    .update({ value: String(rate) })
    .eq("key", "rate");

  if (error) throw error;
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

async function calculateKRW(krw) {
  const rate = await getRate();

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

      console.log("========== 收到 Event ==========");
      console.log(JSON.stringify(event, null, 2));

      if (event.type !== "message") {
        console.log("不是 message event");
        continue;
      }

      if (event.message.type !== "text") {
        console.log("不是文字訊息");
        continue;
      }

      const msg = event.message.text.trim();

      console.log("收到文字：", msg);

      // =====================
      // 健康測試
      // =====================

      if (msg === "/健康") {

        console.log("進入 /健康");

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "✅ Bot 正常運作",
            },
          ],
        });

        console.log("/健康 已回覆");

        continue;
      }
      // =====================
      // 查看匯率
      // =====================

      if (msg === "/匯率") {
const rate = await getRate();

await client.replyMessage({
  replyToken: event.replyToken,
  messages: [
    {
      type: "text",
      text: `目前匯率：${rate}`,
    },
  ],
});

        continue;
      }

 // =====================
// 修改匯率
// =====================

if (msg.startsWith("/匯率 ")) {

  console.log("====== 修改匯率 ======");
  console.log("原始訊息：", JSON.stringify(msg));

  const text = msg.replace("/匯率", "").trim();

  console.log("解析後：", JSON.stringify(text));

  const rate = Number(text);

  console.log("rate =", rate);

  if (isNaN(rate) || rate <= 0) {
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

await setRate(rate);

console.log("已更新資料庫匯率：", rate);

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `✅ 已更新匯率：${rate}`,
      },
    ],
  });

  console.log("已回覆修改成功");

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

        const result = await calculateKRW(krw);

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