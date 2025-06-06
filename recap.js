// recap.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');

const CHANNELS = {
  depot: '1375152581307007056',
  prod: '1376982976176324648'
};

function getWeekDateRange(weekCode) {
  const match = weekCode.match(/^S(\d{1,2})$/i);
  if (!match) return null;
  const weekNumber = parseInt(match[1], 10);
  const year = 2025;
  const start = DateTime.fromObject({ weekYear: year, weekNumber, weekday: 1 }).setZone('Europe/Paris').startOf('day');
  const end = start.plus({ days: 6 }).endOf('day');
  return { start, end };
}

async function collectRecap(channel, start, end) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const data = {};

  for (const msg of messages.values()) {
    if (!msg.embeds?.length) continue;
    const embed = msg.embeds[0];
    const fields = embed.fields || [];
    const date = DateTime.fromJSDate(msg.createdAt).setZone('Europe/Paris');
    if (date < start || date > end) continue;

    let nom = null, quantite = null, salaire = null;
    for (const field of fields) {
      if (field.name.toLowerCase().includes('nom')) nom = field.value;
      if (field.name.toLowerCase().includes('quantité')) quantite = parseInt(field.value);
      if (field.name.toLowerCase().includes('salaire')) salaire = parseInt(field.value);
    }

    if (!nom || !quantite || !salaire) continue;
    if (!data[nom]) data[nom] = { quantite: 0, salaire: 0 };
    data[nom].quantite += quantite;
    data[nom].salaire += salaire;
  }

  return data;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recap')
    .setDescription('Affiche un récapitulatif des livraisons ou production pour une semaine.')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Choisissez le type de récapitulatif')
        .setRequired(true)
        .addChoices(
          { name: 'Dépôt', value: 'depot' },
          { name: 'Production', value: 'prod' }
        ))
    .addStringOption(opt =>
      opt.setName('semaine')
        .setDescription('Code semaine (ex: S23)')
        .setRequired(true)),

  async execute(interaction) {
    const semaine = interaction.options.getString('semaine');
    const type = interaction.options.getString('type');
    const dates = getWeekDateRange(semaine);
    if (!dates) return interaction.reply({ content: 'Code semaine invalide.', flags: 64 });

    const channelId = CHANNELS[type];
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel) return interaction.reply({ content: 'Salon introuvable.', flags: 64 });

    const data = await collectRecap(channel, dates.start, dates.end);
    if (Object.keys(data).length === 0) {
      return interaction.reply({ content: `Aucune donnée trouvée pour la semaine ${semaine}.`, flags: 64 });
    }

    const chunk = Object.entries(data);
    const embeds = [];
    for (let i = 0; i < chunk.length; i += 25) {
      const embed = new EmbedBuilder()
        .setTitle(`Récapitulatif ${type === 'depot' ? 'Livraisons' : 'Production'} - Semaine ${semaine}`)
        .setColor(type === 'depot' ? 0x3498db : 0xf39c12)
        .setTimestamp(new Date());

      for (const [nom, { quantite, salaire }] of chunk.slice(i, i + 25)) {
        embed.addFields({
          name: nom,
          value: `Quantité : **${quantite}**\nSalaire : **$${salaire}**`,
          inline: false
        });
      }

      embeds.push(embed);
    }

    await interaction.reply({ embeds });
  }
};
