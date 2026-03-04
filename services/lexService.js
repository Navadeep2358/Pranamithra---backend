require("dotenv").config();
const { LexRuntimeV2Client, RecognizeTextCommand } = require("@aws-sdk/client-lex-runtime-v2");

const client = new LexRuntimeV2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

async function sendMessageToLex(message, sessionId) {
  const command = new RecognizeTextCommand({
    botId: process.env.BOT_ID,
    botAliasId: process.env.BOT_ALIAS_ID,
    localeId: "en_US",
    sessionId: sessionId,
    text: message,
  });

  return await client.send(command);
}

module.exports = { sendMessageToLex };