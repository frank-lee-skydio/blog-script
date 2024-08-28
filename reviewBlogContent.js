import { createClient } from "@sanity/client";
import fs from "fs";
import { dataset, projectId } from "./hidden_constant.js";

export const client = createClient({
  projectId: projectId,
  dataset: dataset,
  apiVersion: "2024-08-07",
});

export async function fetchAllData() {
  const query = `*[_type == "post"]`; // Adjust the query if necessary
  try {
    const allData = await client.fetch(query);
    console.log(allData);
    return allData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

async function exportDataToJson() {
  try {
    const allData = await fetchAllData();
    // fs.writeFileSync(
    //   "allPosts.json",
    //   JSON.stringify(allData, null, 2),
    //   "utf-8"
    // );
    console.log("Data has been exported to allPosts.json");
  } catch (error) {
    console.error("Error exporting data to JSON:", error);
  }
}

exportDataToJson();
