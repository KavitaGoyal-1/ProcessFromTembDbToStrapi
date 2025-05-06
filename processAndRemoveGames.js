// const connectDB = require("./db");
// const Game = require("./game");

// /**
//  * Process and remove a game entry from the database
//  * @param {Function} processFn - Function to process the game data
//  * @returns {Promise<void>}
//  */
// const processAndRemoveGame = async (processFn) => {
//   await connectDB();

//   try {
//     // Find one game entry to process
//     const gameEntry = await Game.findOne();
//     console.log(gameEntry, "gameEntry");
//     if (!gameEntry) {
//       console.log("No games found to process");
//       return;
//     }

//     // Process the game entry
//     console.log("Processing game:", gameEntry.name);
//     await processFn(gameEntry);

//     // After processing, remove the entry
//     await Game.findByIdAndDelete(gameEntry._id);
//     console.log("Game removed after processing:", gameEntry.name);
//   } catch (err) {
//     console.error("Error processing game:", err);
//   }
// };

// module.exports = processAndRemoveGame;

//process all the games in the db

const connectDB = require("./db");
const Game = require("./game");

/**
 * Process and remove all game entries from the database
 * @param {Function} processFn - Function to process each game data
 * @returns {Promise<void>}
 */
const processAndRemoveAllGames = async (processFn) => {
  await connectDB();

  try {
    let processedCount = 0;
    let gameEntry;

    // Continue processing while there are still entries
    while ((gameEntry = await Game.findOne()) !== null) {
      // Process the game entry
      console.log("Processing game:", gameEntry.name);
      await processFn(gameEntry);

      // Remove the entry after processing
      await Game.findByIdAndDelete(gameEntry._id);
      console.log("Game removed after processing:", gameEntry.name);

      processedCount++;
    }

    if (processedCount === 0) {
      console.log("No games found to process");
    } else {
      console.log(`Processed and removed ${processedCount} games`);
    }

  } catch (err) {
    console.error("Error processing games:", err);
  }
};

module.exports = processAndRemoveAllGames;
