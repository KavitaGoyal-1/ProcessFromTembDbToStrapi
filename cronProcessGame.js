//for process and remove from db
const cron = require("node-cron");
const processAndRemoveGame = require("./processAndRemoveGames");
const startProcess = require("./processGame");

processAndRemoveGame(async (game) => {
  console.log(`Processing game ${game.name} with ID ${game.id}`);
  await startProcess(game);
});

console.log("Game processing cron job scheduled");
