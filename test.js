import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import { CharacterAI } from 'node_characterai';
import { promises as fs } from 'node:fs';

const discord = new Client();
const characterAI = new CharacterAI();
const rawData = await fs.readFile('./data.json', 'utf8');
const data = JSON.parse(rawData);

let dmSession;
let targetChannel;

async function main() {
  try {
    // Authenticate with Character.AI
    await characterAI.authenticate(process.env.CAI_TOKEN);
    console.log("✅ Logged into Character.AI");

    const character = await characterAI.fetchCharacter(process.env.CAI_URL);
    dmSession = await character.DM();
    console.log("✅ Character DM session initialized");

    // Login to Discord
    discord.login(process.env.DISC_TOKEN);

    discord.once('ready', async () => {
      console.log(`✅ ${discord.user.username} is ready!`);

      try {
        targetChannel = await discord.channels.fetch(process.env.DISC_CHAT_ID);
        console.log("✅ Target channel cached");

        startRandomMessages(450000, 600000); // 7.5 to 10 minutes
      } catch (error) {
        console.error("❌ Error during ready event:", error);
      }
    });

    // Attach message handler
    discord.on('messageCreate', handleMessage);
  } catch (err) {
    console.error("❌ Startup error:", err);
  }
}

async function handleMessage(message) {
  try {
    if (
      message.author.id === discord.user.id ||
      message.channel.id !== process.env.DISC_CHAT_ID ||
      !message.mentions.has(discord.user)
    ) return;

    // Optional: live reload data.json (skip this if you don't need real-time updates)
    // const data = JSON.parse(await fs.readFile('./data.json', 'utf8'));

    const username = message.author.username;
    const displayName = data.users[username] || username;

    const usrmsg = message.content.replace(/<@!?(\d+)>/, '').trim();
    const userMessage = `${usrmsg}\nfrom: ${displayName}`;

    const aiResponse = await getAIResponse(userMessage);

    await message.reply(aiResponse || "I didn't get that.");
    console.log(`📨 Message from ${username} processed as ${displayName}`);

    storeRes(userMessage, aiResponse);
  } catch (error) {
    console.error("❌ Error replying to mention:", error);
  }
}

async function getAIResponse(messageText) {
  try {
    const message = await dmSession.sendMessage(messageText);
    console.log("🤖 AI Response:\n", message.content + "\n\n\n");
    return message.content;
  } catch (err) {
    console.error("❌ AI Error:", err);
    return "Error getting response from AI.";
  }
}

async function storeRes(message, response) {
  const log = `MESSAGE: ${message}\nRESP: ${response}\n\n------------------------------------\n\n`;
  try {
    await fs.appendFile('res.txt', log);
  } catch (err) {
    console.error("❌ File write error:", err);
  }
}

async function randomMessage() {
  try {
    const aiResponse = await getAIResponse('');
    if (aiResponse) {
      await targetChannel.send(aiResponse);
      console.log("📤 Sent random message to channel.");
    }
  } catch (err) {
    console.error("❌ Error sending random message:", err);
  }
}

function startRandomMessages(minDelay, maxDelay) {
  async function loop() {
    await randomMessage();

    const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    setTimeout(loop, nextDelay);
  }

  loop();
}

main();
