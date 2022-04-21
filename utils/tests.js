"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require("fs");
const { IOPath } = require(path.join(basePath, "/src/config.js"));
const { cleanName, cleanLinkAvoidXLSXInputs } = require(path.join(basePath, "/src/main.js"));

// read json data
let XLSX = require("xlsx");
let metadataXlsx = XLSX.readFile(
  `${IOPath}/Art Generation Input/Metadata.xlsx`
);
let nftDistributionList = XLSX.utils.sheet_to_json(
  metadataXlsx.Sheets["NFT Distribution"]
);
let avoidList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Avoid Rules"]);
let linkList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Link Rules"]);
let rawdata = fs.readFileSync(`${IOPath}/assets/_metadata.json`);
let data = JSON.parse(rawdata);

const testMetadataEditionNumbers = () => {
  var sum = 0;

  nftDistributionList.forEach((eachEntry) => {
    sum += parseInt(eachEntry["Number of NFTs"]);
  });

  var allEditionNums = Array.from({ length: sum }, (_, i) => i + 1);
  data.forEach((element) => {
    allEditionNums.splice(allEditionNums.indexOf(element.edition), 1);
  });

  if (allEditionNums.length > 0) {
    console.log(
      "Edition Number Test ++ FAILED ++\nMissing Edition Numbers: ",
      allEditionNums
    );
  } else {
    console.log("Edition Number Test passed");
  }
};

const testAvoids = () => {
  let newAvoidList = cleanLinkAvoidXLSXInputs(avoidList);
  
  data.forEach((eachMetadata) => {
    newAvoidList.forEach((eachRule) => {
      var cat1attribute = eachMetadata.attributes.find(
        (attribute) =>
          attribute.trait_type === eachRule.Folder1 &&
          attribute.value === eachRule.Trait1
      );

      var cat2attribute = eachMetadata.attributes.find(
        (attribute) =>
          attribute.trait_type === eachRule.Folder2 &&
          attribute.value === eachRule.Trait2
      );

      if (cat1attribute != undefined && cat2attribute != undefined) {
        return console.log(
          "Avoid Test ++ FAILED ++\nMetadata: ",
          eachMetadata,
          "\nAvoid Rule: ",
          eachRule
        );
      }
    });
  });

  console.log("Avoid Test passed");
};


const testLinks = () => {
  let newLinkList = cleanLinkAvoidXLSXInputs(linkList);
  data.forEach((eachMetadata) => {
    var currentLayers = {};
    let myDict = {};

    eachMetadata.attributes.forEach((eachAttribute) => {
      currentLayers[eachAttribute.trait_type] = eachAttribute.value;
    });

    newLinkList.forEach((eachRule) => {
      if (!myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]]) {
        myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]] = [];
      }

      myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]].push(eachRule.Trait2);
    });

    for (const [key, value] of Object.entries(myDict)) {
      let keySplit = key.split(",");
      if (
        keySplit[0] in currentLayers &&
        keySplit[1] == currentLayers[keySplit[0]] &&
        keySplit[2] in currentLayers
      ) {
        if (!value.includes(currentLayers[keySplit[2]])) {
          console.log("currentLayers[keySplit[2]]", currentLayers[keySplit[2]]);
          console.log("value", value[0] === currentLayers[keySplit[2]]);
          throw `Link Test ++ FAILED ++\nMetadata: ${JSON.stringify(eachMetadata,null,2)} \nViolated Link Rule: ${key}, ${value}`;
        }
      }
    }
  });

  console.log("Link Test passed");
};

const testMetadata = () => {
  var mySet = new Set();

  data.forEach((element) => {
    mySet.add(JSON.stringify(element.attributes));
  });

  if (mySet.size !== data.length) {
    console.log("Unique DNA Test ++ FAILED ++\n");
  } else {
    console.log("Unique DNA Test passed");
  }
};

testMetadataEditionNumbers();
testMetadata();
testLinks();
testAvoids();

module.exports = {
  testMetadataEditionNumbers,
  testAvoids,
  testLinks,
  testMetadata,
};
