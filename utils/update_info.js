"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const { NETWORK } = require(path.join(basePath, "constants/network.js"));
const fs = require("fs");

console.log(path.join(basePath, "/src/config.js"));
const {
  baseUri,
  description,
  namePrefix,
  network,
  solanaMetadata,
  folderDesignations,
} = require(path.join(basePath, "/src/config.js"));

// read json data

var metadataList = []

var foldersList = Object.keys(folderDesignations);
foldersList.forEach(folder => {
  var files = fs.readdirSync(`${basePath}/assets/${folder}/`);

  files.forEach(file => {
    if (path.extname(file) == ".json"){
      var data = JSON.parse(fs.readFileSync(`${basePath}/assets/${folder}/${file}`));
      data.name = `${namePrefix} #${data.edition}`;
      data.description = description;
      data.properties.creators = solanaMetadata.creators;
      fs.writeFileSync(`${basePath}/assets/${folder}/${file}`, JSON.stringify(data, null, 2));
      metadataList.push(data)
    }
  })
})

metadataList.sort(function(a, b){
  return a.edition - b.edition;
});

fs.writeFileSync(`${basePath}/assets/_metadata.json`, JSON.stringify(metadataList, null, 2));

