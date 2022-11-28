export const generalConfig: GeneralConfigType = {
  // do not touch that
  __templateVersion: '2.0.0',

  name: 'Daruma-Games', // the name of your bot
  description: 'Algodaruma Server Bot for NFT games!', // the description of your bot
  defaultLocale: 'en', // default language of the bot, must be a valid locale
  simpleCommandsPrefix: '!', // default prefix for simple command messages (old way to do commands on discord)
  ownerId: process.env['BOT_OWNER_ID'] || '',
  timezone: 'America/New_York', // default TimeZone to well format and localize dates (logs, stats, etc)

  // useful links
  links: {
    supportServer: 'https://algodaruma.com/',
  },

  automaticUploadImagesToImgur: true, // enable or not the automatic assets upload

  devs: [], // discord IDs of the devs that are working on the bot (you don't have to put the owner's id here)

  eval: {
    name: 'bot', // name to trigger the eval command
    onlyOwner: true, // restrict the eval command to the owner only (if not, all the devs can trigger it)
  },

  // define the bot activities (phrases under its name). Types can be: PLAYING, LISTENING, WATCHING, STREAMING
  activities: [
    {
      text: 'With my NFTs',
      type: 'CUSTOM',
    },
  ],
}

// global colors
export const colorsConfig = {
  primary: '#2F3136',
}
