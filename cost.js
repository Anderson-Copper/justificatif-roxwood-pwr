// cost.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');

const COST_CHANNEL_ID = '1379479480208461884';

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
    console.log('[DEBUG] Contenu message :', content);

    const nomMatch = content.match(/Nom Pr\u00e9nom ?: (.+)/i);
    const montantMatch = content.match(/Prix final ?: ?(\d+)/i);

    if (!nomMatch || !montantMatch) continue;

    const nom = nomMatch[1].trim();
    const montant = parseInt(montantMatch[1], 10);

    if (!data[nom]) data[nom] = 0;
    data[nom] += montant;
  }

  return data;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cost')
    .setDescription('Affiche le r\u00e9capitulatif des frais v\u00e9hicules pour une semaine donn\u00e9e.')
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

    const costs = await collectCosts(channel, dates.start, dates.end);

    if (Object.keys(costs).length === 0) {
      return interaction.reply({ content: `Aucune donn\u00e9e trouv\u00e9e pour la semaine ${semaine}.`, flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Frais V\u00e9hicules - Semaine ${semaine}`)
      .setColor(0xe74c3c)
      .setTimestamp(new Date());

    for (const [nom, montant] of Object.entries(costs)) {
      embed.addFields({ name: nom, value: `Total : **$${montant}**`, inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

