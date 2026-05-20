const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
channelAccessToken: "hB8KQSRa8x2r7P+Phj2M5LRJki3LFhBPscglvz8gi/NESEXpsOcLf78ZCVpJhUU7tSqOlgeIfk8e4leSaFHAyI+IgFRaYHf+4w2DtO6SYXSMmMGbwpafBcGsZr2dwzh0lpOfblQqOiqh+fAaQVdTWQdB04t89/1O/w1cDnyilFU=",
  channelSecret: "acaf2a041486118242cab90b367b696d",
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {

    if (event.type !== "message") continue;
    if (event.message.type !== "text") continue;

    const msg = event.message.text;

    if (msg.startsWith("+")) {

      const krw = Number(msg.replace("+", ""));

      // 韓幣換台幣
      const twd = krw / 44;

      let total = 0;
      let feeText = "";

      // 2500 以下 +230
      if (twd <= 2500) {

        total = twd + 230;

        feeText = `${Math.round(twd)} + 230`;

      } else {

        // 2500 以上 +18%
        const fee = twd * 0.18;

        total = twd + fee;

        feeText = `${Math.round(twd)} + ${Math.round(fee)} (18%)`;
      }

      // 稅金
      const tax = Math.round(total * 0.05);

      // 最終價格
      const finalTotal = Math.round(total + tax);

      const replyText =
`1.韓幣：₩${krw.toLocaleString()}

2.換算台幣：NT$${Math.round(twd)}

3.${feeText}

4.總金額：NT$${Math.round(total)}

5.營業稅5%：NT$${tax}

────────

最終價格：NT$${finalTotal}`;

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: replyText,
          },
        ],
      });
    }
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot is running");
});