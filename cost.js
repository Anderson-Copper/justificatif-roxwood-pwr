// cost.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');

const COST_CHANNEL_ID = '1375152581307007056';

function getWeekDateRange(weekCode) {
  const match = weekCode.match(/^S(\d{1,2})$/i);
  if (!match) return null;
  const weekNumber = parseInt(match[1], 10);
  const year = 2025;
  const start = DateTime.fromObject({ weekYear: year, weekNumber, weekday: 1 }).setZone('Europe/Paris').startOf('day');
  const end = start.plus({ days: 6 }).endOf('day');
  return { start, end };
}

async function collectCosts(channel, start, end) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const data = {};

  for (const msg of messages.values()) {
    const msgDate = DateTime.fromJSDate(msg.createdAt).setZone('Europe/Paris');
    if (msgDate < start || msgDate > end) continue;

    const content = msg.content;
    console.log(`[DEBUG] Contenu message :`, content);

    let nameMatch = content.match(/Nom Prénom *: *(.+)/i);
    const altNameMatch = content.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)+)/);
    if (!nameMatch && altNameMatch) {
      nameMatch = [null, altNameMatch[1]];
    }

    const costMatch = content.match(/Prix final *: *\$?(\d+)/i);
    if (!nameMatch || !costMatch) continue;

    const name = nameMatch[1].trim();
    const cost = parseInt(costMatch[1]);
    if (!data[name]) data[name] = 0;
    data[name] += cost;
  }

  return data;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cost')
    .setDescription('Génère un récapitulatif des frais de véhicules pour une semaine donnée.')
    .addStringOption(option =>
      option.setName('semaine')
        .setDescription('Code semaine (ex: S23)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const semaine = interaction.options.getString('semaine');
    const dates = getWeekDateRange(semaine);
    if (!dates) return interaction.reply({ content: 'Code semaine invalide.', flags: 64 });

    const channel = await interaction.client.channels.fetch(COST_CHANNEL_ID);
    if (!channel) return interaction.reply({ content: 'Salon introuvable.', flags: 64 });

    const costData = await collectCosts(channel, dates.start, dates.end);
    if (Object.keys(costData).length === 0) {
      return interaction.reply({ content: `Aucune donnée trouvée pour la semaine ${semaine}.`, flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Récapitulatif Frais Véhicules - ${semaine}`)
      .setColor(0xe67e22)
      .setTimestamp(new Date());

    for (const [nom, total] of Object.entries(costData)) {
      embed.addFields({
        name: nom,
        value: `Frais totaux : **$${total}**`,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

