// deploy-command.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./').filter(file => file.endsWith('.js') && file !== 'deploy-command.js');

for (const file of commandFiles) {
  const command = require(`./${file}`);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`Le fichier ${file} est ignoré car il manque "data" ou "execute".`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN_IPWR);

(async () => {
  try {
    console.log(`Déploiement de ${commands.length} commande(s) en cours...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID_IPWR, process.env.GUILD_ID_IPWR),
      { body: commands }
    );

    console.log('✅ Les commandes ont été déployées avec succès.');
  } catch (error) {
    console.error('Une erreur est survenue lors du déploiement :', error);
  }
})();
