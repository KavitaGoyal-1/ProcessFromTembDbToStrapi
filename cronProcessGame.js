// //for process and remove from db
// const processAndRemoveGame = require("./processAndRemoveGames");
// const startProcess = require("./processGame");

// processAndRemoveGame(async (game) => {
//   console.log(`Processing game ${game.name} with ID ${game.id}`);
//   await startProcess(game);
// });

// console.log("Game processing cron job scheduled");

// for process and remove from db
const processAndRemoveGame = require("./processAndRemoveGames");
const startProcess = require("./processGame");

// 🕐 Cron 1: Process from oldest to newest
processAndRemoveGame(async (game) => {
  console.log(
    `Cron 1 (Oldest→Newest): Processing game ${game.name} (${game.id})`
  );
  await startProcess(game);
}, 1); // <-- Pass 1 to sort by oldest first

// 🕐 Cron 2: Process from newest to oldest
processAndRemoveGame(async (game) => {
  console.log(
    `Cron 2 (Newest→Oldest): Processing game ${game.name} (${game.id})`
  );
  await startProcess(game);
}, -1); // <-- Pass -1 to sort by newest first

console.log("✅ Both game processing cron jobs scheduled");
