export const generalConfig: GeneralConfigType = {
    name: 'Daruma-Games', // the name of your bot
    description: 'Algodaruma Server Bot for NFT games!', // the description of your bot
    ownerId: process.env['BOT_OWNER_ID'] || '',
    timezone: 'America/New_York', // default TimeZone to well format and localize dates (logs, stats, etc)

    // useful links
    links: {
        supportServer: 'https://algodaruma.com/',
    },

    devs: [], // discord IDs of the devs that are working on the bot (you don't have to put the owner's id here)
};
