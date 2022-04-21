"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require("fs");

const { IOPath } = require(path.join(basePath, "/src/config.js"));

// read json data
let rawdata = fs.readFileSync(`${IOPath}/assets/_metadata.json`);
let data = JSON.parse(rawdata);

const getRarity = () => {
  let rarityData = {};
  data.forEach((element) => {
    let attributes = element.attributes;
    attributes.forEach((attribute) => {
      let traitType = attribute.trait_type;
      let value = attribute.value;

      if (traitType in rarityData) {
        if (value in rarityData[traitType]) {
          rarityData[traitType][value] += 1;
        } else {
          rarityData[traitType][value] = 1;
        }
      } else {
        let valueDict = {};
        valueDict[value] = 1;
        rarityData[traitType] = valueDict;
      }
    });
  });

  var logger = fs.createWriteStream(`${IOPath}/assets/rarity.txt`, {});

  for (const [myKey, myValue] of Object.entries(rarityData)) {
    logger.write(
      `\n==================================== ${myKey} ====================================\n\n`
    );
    var items = Object.keys(myValue).map(function (key) {
      return [key, myValue[key]];
    });

    // Sort the array based on the second element
    items.sort(function (first, second) {
      return second[1] - first[1];
    });
    let sum = 0;

    items.forEach((eachEntry) => {
      sum += eachEntry[1];
    });

    logger.write(`Category Sum: ${sum}\n`);

    items.forEach((eachEntry) => {
      logger.write(
        JSON.stringify(
          {
            Trait: eachEntry[0],
            Percentage: `${((eachEntry[1] / sum) * 100).toFixed(0)}%`,
            Occurrence: eachEntry[1],
          },
          undefined,
          2
        )
      );
    });
  }

  logger.end();
};

getRarity();

module.exports = {
  getRarity
};
