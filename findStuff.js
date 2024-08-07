import fs from "fs";
import csvWriter from "csv-write-stream";

// Read the JSON file
const data = fs.readFileSync("allPosts.json", "utf-8");

// Parse the JSON data
const allPosts = JSON.parse(data);

// Global sets
const decoratorsSet = new Set();
const annotationsSet = new Set();
const stylesSet = new Set();
const listsSet = new Set();

// Function to recursively find all _type fields and collect other details in an object
function findTypes(obj, typeSet) {
  if (Array.isArray(obj)) {
    obj.forEach((item) => findTypes(item, typeSet));
  } else if (obj && typeof obj === "object") {
    if (obj._type) {
      typeSet.add(obj._type);
    }
    if (obj.marks) {
      obj.marks.forEach((mark) => {
        if (mark.length !== 12) {
          // Ignore decorators that are exactly 12 characters long
          decoratorsSet.add(mark);
        }
      });
    }
    if (obj.markDefs) {
      obj.markDefs.forEach((markDef) => annotationsSet.add(markDef._type));
    }
    if (obj.style) {
      stylesSet.add(obj.style);
    }
    if (obj.listItem) {
      listsSet.add(obj.listItem);
    }
    Object.values(obj).forEach((value) => findTypes(value, typeSet));
  }
}

// Function to collect slugs and types into a map
function collectTypesIntoMap(posts) {
  const slugTypeMap = {};

  posts.forEach((post) => {
    const slug = post?.content?.main?.slug?.current;
    if (slug) {
      const typeSet = new Set();
      findTypes(post, typeSet);
      slugTypeMap[slug] = typeSet;
    } else {
      console.log("Slug not found for post:", post);
    }
  });

  console.log(`Total unique slugs found: ${Object.keys(slugTypeMap).length}`);
  console.log(`Total posts: ${posts.length}`);

  if (Object.keys(slugTypeMap).length === posts.length) {
    console.log("All posts have unique slugs.");
  } else {
    console.log("Some posts are missing a slug or have duplicate slugs.");
  }

  return slugTypeMap;
}

// Function to generate a CSV file with slug/type combinations
function generateCsv(slugTypeMap) {
  const writer = csvWriter({ headers: ["slug", "type"] });
  const writeStream = fs.createWriteStream("slug_type_combinations.csv");
  writer.pipe(writeStream);

  Object.entries(slugTypeMap).forEach(([slug, types]) => {
    types.forEach((type) => {
      writer.write({ slug, type });
    });
  });

  writer.end();

  writeStream.on("finish", () => {
    console.log("CSV file has been generated: slug_type_combinations.csv");
  });
}

// Call the function to collect slugs and types into a map
const slugTypeMap = collectTypesIntoMap(allPosts);

// Print the slugTypeMap
console.log(slugTypeMap);

// Optionally, print the types for each slug
Object.entries(slugTypeMap).forEach(([slug, types]) => {
  console.log(`Slug: ${slug}, Types: ${[...types].join(", ")}`);
});

// Print the global sets
console.log("Decorators:", [...decoratorsSet]);
console.log("Annotations:", [...annotationsSet]);
console.log("Styles:", [...stylesSet]);
console.log("Lists:", [...listsSet]);

// Generate the CSV file
generateCsv(slugTypeMap);
