"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const { startCreating, buildSetup } = require(path.join(
  basePath,
  "/src/main.js"
));

(async () => {
  buildSetup();
  await startCreating();
  const { getRarity } = require(path.join(basePath, "/utils/rarity.js"));
  const {
    testMetadataEditionNumbers,
    testAvoids,
    testLinks,
    testMetadata,
  } = require(path.join(basePath, "/utils/tests.js"));
  getRarity();
  testMetadataEditionNumbers();
  testMetadata();
  testAvoids();
  testLinks();
})();
