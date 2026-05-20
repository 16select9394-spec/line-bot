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

      const twd = krw / 44;

      let total = 0;
      let feeText = "";

      if (twd <= 2500) {
        total = twd + 230;
        feeText = "+230";
      } else {
        total = twd * 1.18;
        feeText = "+18%";
      }

      total = total * 1.05;

      const replyText =
`韓幣：₩${krw.toLocaleString()}

換算台幣：
NT$${Math.round(twd)}

代購費：
${feeText}

最終價格：
NT$${Math.round(total)}`;

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