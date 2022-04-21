"use strict";

const { DH_NOT_SUITABLE_GENERATOR } = require("constants");
const path = require("path");
const internal = require("stream");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//                                  INSTRUCTIONS:
//configWeight: int.  weight for that config being chosen
//number: int. that config will be used <requiredNum> of times and then be deleted
//folder: [string]  choose what folders a config goes to
//
// options:
//   skipPercentage: double
//   displayName: String

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

const IOPath = basePath
const IMAGE_EXTENSION = "png";

module.exports = {
  IOPath,
  IMAGE_EXTENSION,
};
