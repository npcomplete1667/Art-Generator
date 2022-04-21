"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const { clearEverything } = require(path.join(basePath, "/src/main.js"));

clearEverything();
