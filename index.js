// index.js (anciennement deploy-command.js fusionné)
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandFiles = fs.readdirSync('./').filter(file => file.endsWith('.js') && file !== 'index.js');
const commands = [];

for (const file of commandFiles) {
  const command = require(`./${file}`);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.warn(`Le fichier ${file} est ignoré car il manque "data" ou "execute".`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN_IPWR);

(async () => {
  try {
    console.log(`✨ Déploiement de ${commands.length} commande(s) en cours...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID_IPWR, process.env.GUILD_ID_IPWR),
      { body: commands }
    );
    console.log('✅ Les commandes ont été déployées avec succès.');
  } catch (error) {
    console.error('Une erreur est survenue lors du déploiement :', error);
  }
})();

client.once('ready', () => {
  console.log(`🤖 Intendant connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN_IPWR);
