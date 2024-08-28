import { createClient } from "@sanity/client";
import { v2Dataset, v3Dataset, projectId } from "./hidden_constant.js";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";

const sanityToken = process.env.TOKEN;

export const clientV2 = createClient({
  projectId: projectId,
  dataset: v2Dataset,
  apiVersion: "v2022-03-07",
  token: sanityToken,
});

export const clientV3 = createClient({
  projectId: projectId,
  dataset: v3Dataset,
  apiVersion: "2024-08-26",
  token: sanityToken,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, "assets");

// Ensure the directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Function to download a file from a given URL
async function downloadFile(url, filename) {
  const filePath = path.join(assetsDir, filename);

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    response.data.pipe(fs.createWriteStream(filePath));

    return new Promise((resolve, reject) => {
      response.data.on("end", () => {
        console.log(`Downloaded ${filename}`);
        resolve(filePath);
      });

      response.data.on("error", (err) => {
        console.error(`Error downloading ${filename}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Failed to download file from ${url}:`, error);
    throw error;
  }
}

// Function to upload a file to v3
async function uploadFileToSanity(filePath) {
  try {
    const imageAsset = await clientV3.assets.upload(
      "image",
      createReadStream(filePath),
      {
        filename: path.basename(filePath),
      }
    );

    console.log(`Uploaded ${path.basename(filePath)} to Sanity:`, imageAsset);
    return imageAsset._id;
  } catch (error) {
    console.error(
      `Failed to upload file ${path.basename(filePath)} to Sanity:`,
      error
    );
    throw error;
  }
}

export async function migrate() {
  const query = `
  *[_type == "application"]{
    ...,
    content{
      main{
        title,
        slug,
        summaryHeadline,
        summaryText,
        mainImage{
          asset->{
            _id,
            url,
            _ref,
            metadata {
              dimensions,
              lqip,
              palette
            }
          }
        },
        icon{
          asset->{
            _id,
            url,
            _ref,
            metadata {
              dimensions,
              lqip,
              palette
            }
          }
        },
        gallery,
      },
    },
    language,
    orderRank
  }
`;

  // meta{
  //   metaNote,
  //   title,
  //   description,
  //   keywords,
  //   socialImage{
  //     asset->{
  //       _id,
  //       url,
  //       _ref,
  //       metadata {
  //         dimensions,
  //         lqip,
  //         palette
  //       }
  //     }
  //   },
  let docs;
  try {
    docs = await clientV2.fetch(query);
    console.log("Docs fetched:", docs);
  } catch (error) {
    console.error("Error fetching docs:", error);
    throw error;
  }

  for (const doc of docs) {
    let newMainImageId = null;
    let newIconId = null;

    // Handle mainImage
    if (doc.content?.main?.mainImage?.asset?.url) {
      const mainImageUrl = doc.content.main.mainImage.asset.url;
      const mainImageRef = doc.content.main.mainImage.asset._id;
      const mainImageFilename = `${mainImageRef.split("-")[1]}-${
        mainImageRef.split("-")[2]
      }.${mainImageRef.split("-")[3]}`;
      const mainImagePath = await downloadFile(mainImageUrl, mainImageFilename);
      newMainImageId = await uploadFileToSanity(mainImagePath);
      console.log(`New mainImage ID: ${newMainImageId}`);
    }

    // Handle icon
    if (doc.content?.main?.icon?.asset?.url) {
      const iconUrl = doc.content.main.icon.asset.url;
      const iconRef = doc.content.main.icon.asset._id;
      const iconFilename = `${iconRef.split("-")[1]}-${iconRef.split("-")[2]}.${
        iconRef.split("-")[3]
      }`;
      const iconPath = await downloadFile(iconUrl, iconFilename);
      newIconId = await uploadFileToSanity(iconPath);
      console.log(`New icon ID: ${newIconId}`);
    }

    // Flatten the "main" object inside the "content" field to the root level and update asset references
    const flattenedDoc = {
      _id: doc._id,
      _type: doc._type,
      _createdAt: doc._createdAt,
      _updatedAt: doc._updatedAt,
      _rev: doc._rev,
      orderRank: doc.orderRank,
      title: doc.content?.main?.title,
      slug: doc.content?.main?.slug,
      summaryHeadline: doc.content?.main?.summaryHeadline,
      summaryText: doc.content?.main?.summaryText,
      mainImage: newMainImageId
        ? {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: newMainImageId,
            },
          }
        : null,
      icon: newIconId
        ? {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: newIconId,
            },
          }
        : null,
      // linkTo: doc.content?.main?.linkTo,
      meta: doc.content?.meta,
      language: doc.language,
    };

    // Clean up null or undefined fields
    Object.keys(flattenedDoc).forEach((key) => {
      if (flattenedDoc[key] === null || flattenedDoc[key] === undefined) {
        delete flattenedDoc[key];
      }
    });

    // console.log("New document ready for upload:", flattenedDoc);

    // Upload the new document to Sanity v3
    try {
      const response = await clientV3.createIfNotExists(flattenedDoc);
      console.log("New document uploaded to Sanity:", response);
    } catch (error) {
      console.error("Error uploading new document to Sanity:", error);
      throw error;
    }
  }
}

migrate();
