// recap.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { DateTime } = require('luxon');

const RECAP_DEPOT_CHANNEL_ID = '1380324663158378627';
const RECAP_PROD_CHANNEL_ID = '1380327229212459028';

function getWeekDateRange(weekCode) {
  const match = weekCode.match(/^S(\d{1,2})$/i);
  if (!match) return null;
  const weekNumber = parseInt(match[1], 10);
  const year = 2025;
  const start = DateTime.fromObject({ weekYear: year, weekNumber, weekday: 1, zone: 'Europe/Paris' }).startOf('day');
  const end = start.plus({ days: 6 }).endOf('day');
  return { start, end };
}

async function collectRecap(channel, start, end) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const data = {};

  for (const msg of messages.values()) {
    if (!msg.embeds || msg.embeds.length === 0) continue;
    const embed = msg.embeds[0];
    if (!embed.fields || embed.fields.length === 0 || !embed.timestamp) continue;

    const msgDate = DateTime.fromISO(embed.timestamp);
    if (msgDate < start || msgDate > end) continue;

    const nameLine = embed.author?.name || embed.title || '';
    const nameMatch = nameLine.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const qtyField = embed.fields.find(f => f.name.toLowerCase().includes('quantit'));
    const salaireField = embed.fields.find(f => f.name.toLowerCase().includes('salaire'));
    const qty = parseInt(qtyField?.value || '0');
    const salaire = parseInt(salaireField?.value || '0');

    if (!data[name]) data[name] = { quantite: 0, salaire: 0 };
    data[name].quantite += qty;
    data[name].salaire += salaire;
  }

  return data;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recap')
    .setDescription('Génère un récapitulatif des dépôts ou production pour une semaine donnée.')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de récapitulatif: depot ou prod')
        .setRequired(true)
        .addChoices(
          { name: 'Depot', value: 'depot' },
          { name: 'Prod', value: 'prod' }
        )
    )
    .addStringOption(option =>
      option.setName('semaine')
        .setDescription('Code semaine (ex: S23)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const semaine = interaction.options.getString('semaine');
    const dates = getWeekDateRange(semaine);
    if (!dates) return interaction.reply({ content: 'Code semaine invalide.', ephemeral: true });

    const channelId = type === 'depot' ? RECAP_DEPOT_CHANNEL_ID : RECAP_PROD_CHANNEL_ID;
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel) return interaction.reply({ content: 'Salon introuvable.', ephemeral: true });

    const recapData = await collectRecap(channel, dates.start, dates.end);

    if (Object.keys(recapData).length === 0) {
      return interaction.reply({ content: `Aucune donnée trouvée pour la semaine ${semaine}.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Récapitulatif ${type === 'depot' ? 'Dépôts' : 'Production'} - ${semaine}`)
      .setColor(type === 'depot' ? 0x2ecc71 : 0x3498db)
      .setTimestamp(new Date());

    for (const [nom, recap] of Object.entries(recapData)) {
      embed.addFields({
        name: nom,
        value: `Quantité totale : **${recap.quantite}**\nSalaire total : **$${recap.salaire}**`,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

