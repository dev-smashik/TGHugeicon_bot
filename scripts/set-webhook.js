const axios = require("axios");
require("dotenv").config();

// This script sends a POST request to Telegram to link your bot to your Vercel URL
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.argv[2];

if (!TOKEN) {
  console.error("❌ Need TELEGRAM_BOT_TOKEN environment variable.");
  console.log("Run this like: set TELEGRAM_BOT_TOKEN=your_token && npm run set-webhook https://your-vercel-domain/api/webhook");
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error("❌ Please provide the webhook URL as an argument.");
  console.error("Usage: npm run set-webhook https://your-vercel-domain.vercel.app/api/webhook");
  process.exit(1);
}

async function setWebhook() {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      url: WEBHOOK_URL,
      drop_pending_updates: true, // Prevents a flood of old messages when it goes live
    });
    console.log("✅ Webhook status:", response.data);
  } catch (err) {
    console.error("❌ Failed to set webhook:", err.response?.data || err.message);
  }
}

setWebhook();
