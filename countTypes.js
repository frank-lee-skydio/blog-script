import fs from "fs";
import csv from "csv-parser";

const typeCountMap = {};

// Function to process the CSV file
function processCsv() {
  fs.createReadStream("slug_type_combinations.csv")
    .pipe(csv())
    .on("data", (row) => {
      const type = row["type"];
      if (type) {
        if (typeCountMap[type]) {
          typeCountMap[type] += 1;
        } else {
          typeCountMap[type] = 1;
        }
      }
    })
    .on("end", () => {
      console.log("CSV file processed successfully.");

      // Convert the typeCountMap to an array of [type, count] pairs
      const sortedTypes = Object.entries(typeCountMap).sort(
        (a, b) => b[1] - a[1]
      );

      // Print the sorted list
      console.log("Sorted type count map:");
      sortedTypes.forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
      });
    });
}

// Run the function to process the CSV file
processCsv();
