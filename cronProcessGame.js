//for process and remove from db
const cron = require("node-cron");
const processAndRemoveGame = require("./processAndRemoveGames");
const startProcess = require("./processGame");

processAndRemoveGame(async (game) => {
  console.log(`Processing game ${game.name} with ID ${game.id}`);
  await startProcess(game);
});

console.log("Game processing cron job scheduled");

// const cron = require("node-cron");
// const processAndRemoveGame = require("./processAndRemoveGames");
// const startProcess = require("./processGame");

// // Schedule the job to run every 5 minutes (adjust as needed)
// cron.schedule("20 11 * * *", () => {
//   console.log("Cron job started");

//   processAndRemoveGame(async (game) => {
//     console.log(`Processing game ${game.name} with ID ${game.id}`);
//     await startProcess(game);
//   });

//   console.log("Cron job finished");
// });

// console.log("Game processing cron job scheduled");
