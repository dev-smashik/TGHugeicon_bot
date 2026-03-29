const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Initialize bot. If running locally with node api/webhook.js --local, enable polling.
const isLocal = process.argv.includes("--local");
if (isLocal) {
  require("dotenv").config();
}
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: isLocal });

if (isLocal) {
  console.log("🤖 Running in LOCAL POLLING mode. Send a message to your bot!");
}

// HEADERS for scraping
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const WELCOME_MESSAGE = `👋 স্বাগতম\\! Icon Converter Bot\\-এ আপনাকে আমন্ত্রণ।

এই বটটির মাধ্যমে আপনি খুব সহজেই আপনার প্রয়োজনীয় আইকনগুলোর SVG ফরম্যাট দ্রুত সংগ্রহ করতে পারবেন। 

📌 কীভাবে ব্যবহার করবেন:
১\\. আপনার কাঙ্ক্ষিত আইকনের \\(HugeIcons বা FlatIcon\\) লিংকটি কপি করুন।
২\\. লিংকটি এই চ্যাটে পেস্ট করুন।
৩\\. বট থেকে আপনার প্রস্তুতকৃত SVG ফাইলটি সংগ্রহ করুন।

যেকোনো আইকনের লিংক পেস্ট করে এখনই শুরু করুন\\!`;

function detectPlatform(url) {
  if (url.includes("hugeicons.com")) return "hugeicons";
  if (url.includes("flaticon.com")) return "flaticon";
  return null;
}

// Format SVG string properly
function formatSvg(svgStr) {
  let clean = svgStr.replace(/\s+/g, " ");
  clean = clean.replace(/> </g, ">\n  <");
  return clean.trim();
}

// Escape markdown specifically for Telegram MarkdownV2
function escapeMd(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\-])/g, "\\$1");
}

async function fetchHugeIconsSvg(url) {
  const match = url.match(/hugeicons\.com\/icon\/([^?#]+)/);
  if (!match) throw new Error("Invalid HugeIcons URL");

  const iconName = match[1];
  const styleMatch = url.match(/[?&]style=([^&]+)/);
  const style = styleMatch ? styleMatch[1] : "stroke-rounded";

  const cdnUrl = `https://cdn.hugeicons.com/icons/${iconName}-${style}.svg?v=1.0.0`;

  try {
    const res = await axios.get(cdnUrl, {
      headers: { ...HEADERS, "Referer": "https://hugeicons.com/" },
      timeout: 10000,
    });
    if (res.status === 200 && res.data.includes("<svg")) {
      return { svg: res.data.trim(), icon_name: iconName, style, source: "HugeIcons" };
    }
  } catch (err) {
    // CDN fetch failed, fallback to scraping
  }

  // Fallback: scrape the page
  const pageRes = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  const svgMatch = pageRes.data.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    return { svg: svgMatch[0], icon_name: iconName, style, source: "HugeIcons" };
  }

  throw new Error("SVG not found on HugeIcons");
}

async function fetchFlatIconSvg(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });

  const svgMatch = res.data.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    return { svg: svgMatch[0], source: "FlatIcon" };
  }

  const jsonMatch = res.data.match(/"svg"\s*:\s*"([^"]+)"/);
  if (jsonMatch) {
    const svg = jsonMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\//g, "/");
    return { svg, source: "FlatIcon" };
  }

  const cdnMatch = res.data.match(/https:\/\/[^\s"']+\.svg/);
  if (cdnMatch) {
    const svgRes = await axios.get(cdnMatch[0], { headers: HEADERS, timeout: 10000 });
    if (svgRes.data.includes("<svg")) {
      return { svg: svgRes.data.trim(), source: "FlatIcon" };
    }
  }

  throw new Error("SVG not found on FlatIcon");
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text.startsWith("/start") || text.startsWith("/help")) {
    await bot.sendMessage(chatId, WELCOME_MESSAGE, { parse_mode: "MarkdownV2" });
    return;
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    await bot.sendMessage(
      chatId,
      "⚠️ Bhai, give me a valid HugeIcons or FlatIcon link, then I will surprise you\\!\n\nExample:\n`https://hugeicons\\.com/icon/delete\\-01?style=stroke\\-sharp`",
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const url = urlMatch[0];
  const platform = detectPlatform(url);

  if (!platform) {
    await bot.sendMessage(
      chatId,
      "❌ Bhai, I don't support this link\\. Only HugeIcons or FlatIcon link\\.",
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, "⏳ Fetch kortesi, ek second\\.\\.\\.", {
    parse_mode: "MarkdownV2",
  });

  try {
    let result;
    if (platform === "hugeicons") {
      result = await fetchHugeIconsSvg(url);
    } else {
      result = await fetchFlatIconSvg(url);
    }

    const cleanSvg = formatSvg(result.svg);
    const iconName = result.icon_name || "icon";
    const style = result.style || result.source || "icon";
    const fileName = `${iconName}-${style}.svg`;

    // Attempt to delete status message
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    const label = `✅ *${escapeMd(iconName)}* \\(${escapeMd(style)}\\)`;
    await bot.sendMessage(chatId, label, { parse_mode: "MarkdownV2" });

    // Send the code block for easy copy
    await bot.sendMessage(chatId, `\`\`\`xml\n${cleanSvg}\n\`\`\``, {
      parse_mode: "MarkdownV2",
    });

    // Send the .svg file for download
    const fileBuffer = Buffer.from(cleanSvg, "utf-8");
    await bot.sendDocument(
      chatId,
      fileBuffer,
      { caption: `📁 ${fileName} — download kore direct use koro!` },
      { filename: fileName, contentType: "image/svg+xml" }
    );
  } catch (err) {
    console.error(`Error processing ${url}:`, err.message);
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    await bot.sendMessage(
      chatId,
      "❌ Fetch korte parina bhai\\!\n\nPossible reason:\n• Link ta valid na\n• Site block kortese\n• Icon ta exist kore na\n\nArekbar try kor ba অন্য link de\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
}

if (isLocal) {
  bot.on("message", (msg) => {
    // We ignore the initial undefined messages that node-telegram-bot-api might send
    if (msg) handleMessage(msg).catch(console.error);
  });
}

// Vercel serverless function export
module.exports = async (req, res) => {
  try {
    // Check if Telegram sent an update
    if (req.method === "POST" && req.body && req.body.message) {
      await handleMessage(req.body.message);
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
  }
  // Sending 200 OK prevents Telegram from retrying the update
  res.status(200).send("OK");
};
