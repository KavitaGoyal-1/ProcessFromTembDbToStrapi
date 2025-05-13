// //process all the games in the db

// const connectDB = require("./db");
// const Game = require("./game");

// /**
//  * Process and remove all game entries from the database
//  * @param {Function} processFn - Function to process each game data
//  * @returns {Promise<void>}
//  */
// const processAndRemoveAllGames = async (processFn) => {
//   await connectDB();

//   try {
//     let processedCount = 0;
//     let gameEntry;

//     while ((gameEntry = await Game.findOne()) !== null) {
//       console.log("Processing game:", gameEntry.name);
//       await processFn(gameEntry);

//       await Game.findByIdAndDelete(gameEntry._id);
//       console.log("Game removed after processing:", gameEntry.name);

//       processedCount++;
//     }

//     if (processedCount === 0) {
//       console.log("No games found to process");
//     } else {
//       console.log(`Processed and removed ${processedCount} games`);
//     }

//   } catch (err) {
//     console.error("Error processing games:", err);
//   }
// };

// module.exports = processAndRemoveAllGames;

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

    while ((gameEntry = await Game.findOne()) !== null) {
      // Store the game ID before processing
      const gameId = gameEntry._id;
      const gameName = gameEntry.name;

      console.log("Processing game:", gameName);

      try {
        // Process the game
        await processFn(gameEntry);

        // Remove the game using the stored ID
        const deletedGame = await Game.findByIdAndDelete(gameId);

        if (deletedGame) {
          console.log("Game removed after processing:", gameName);
          processedCount++;
        } else {
          console.warn(
            `Failed to delete game with ID ${gameId} - game may have been deleted already`
          );
        }
      } catch (processError) {
        console.error(`Error processing game ${gameName}:`, processError);
      }
    }

    if (processedCount === 0) {
      console.log("No games found to process");
    } else {
      console.log(`Processed and removed ${processedCount} games`);
    }
  } catch (err) {
    console.error("Error in processAndRemoveAllGames:", err);
  }
};

module.exports = processAndRemoveAllGames;
