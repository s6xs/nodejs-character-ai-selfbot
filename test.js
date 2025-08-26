import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import { CharacterAI } from 'node_characterai';
import { promises as fs } from 'node:fs';
import { EventEmitter } from 'events';

// Optional: Increase max listeners if needed
EventEmitter.defaultMaxListeners = 20;

const discord = new Client();
const characterAI = new CharacterAI();

let dmSession; // Reused DM session

async function main() {
  try {
    // Authenticate with Character.AI
    await characterAI.authenticate(process.env.CAI_TOKEN);
    console.log("✅ Logged into Character.AI");

    const character = await characterAI.fetchCharacter(process.env.CAI_URL);
    dmSession = await character.DM();
    console.log("✅ Character DM session initialized");

    // Login to Discord
    await discord.login(process.env.DISC_TOKEN);

    // Set up ready listener once
    discord.once('ready', () => {
      console.log(`✅ ${discord.user.username} is ready!`);
    });

    // Prevent listener stacking
    discord.removeAllListeners('messageCreate');

    // Attach message handler
    discord.on('messageCreate', handleMessage);

  } catch (err) {
    console.error("❌ Startup error:", err);
  }
}

async function handleMessage(message) {
  try {
    if (message.author.id === discord.user.id) return;
    if (message.channel.id !== process.env.DISC_CHAT_ID) return;
    if (!message.mentions.has(discord.user)) return;

    const usrmsg = message.content.replace(/<@!?(\d+)>/, '').trim();
    const discordmention = message.author.username;
    const userMessage = `${usrmsg}\nfrom: ${discordmention}`;

    const aiResponse = await getAIResponse(userMessage);

    await message.reply(aiResponse || "I didn't get that.");
    console.log(`📨 Message from ${discordmention} processed.`);

    await storeRes(userMessage, aiResponse);
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

main();
