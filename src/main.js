"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);

const { IOPath, IMAGE_EXTENSION } = require(path.join(basePath,"/src/config.js"));

const fs = require("fs");
const { extname } = require("path");
const { count } = require("console");
const { config } = require("process");
const sha1 = require(path.join(basePath, "/node_modules/sha1"));
const { createCanvas, loadImage } = require(path.join(basePath,"/node_modules/canvas"));
const buildDir = path.join(IOPath, "/assets");
const layersDir = path.join(IOPath, "Art Generation Input/layers");
var metadataList = [];
var attributesList = [];

const rarityDelimiter = "#";
const DNA_DELIMITER = "-";
const LAYER_DELIMITER = "=";
const uniqueDnaTorrance = 100000000000000;
const noSameBackground = true;

let failedCount = 0;

const buildSetup = () => {
  let XLSX = require("xlsx");
  let metadataXlsx = XLSX.readFile(
    `${IOPath}/Art Generation Input/Metadata.xlsx`
  );
  let nftDistributionList = XLSX.utils.sheet_to_json(
    metadataXlsx.Sheets["NFT Distribution"]
  );

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
    nftDistributionList.forEach((each) => {
      fs.mkdirSync(
        path.join(buildDir, `/${each["Category"].toLowerCase().trim()}`)
      );
    });
  }
};

const clearEverything = () => {
  if (fs.existsSync(buildDir)) fs.rmdirSync(buildDir, { recursive: true });
  console.log("\n\n++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++[   CLEARED   ]++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n\n");
};

const chooseRandomIndex = (weightsList) => {
  let random =
    Math.floor(Math.random() * weightsList.reduce((a, b) => a + b, 0)) + 1;
  for (var i = 0; i < weightsList.length; i++) {
    random -= weightsList[i];
    if (random <= 0) {
      return i;
    }
  }
};

const saveImage = (_number, _folder, _canvas) => {
  fs.writeFileSync(
    `${buildDir}/${_folder}/${_number}.${IMAGE_EXTENSION}`,
    _canvas.toBuffer(`image/${IMAGE_EXTENSION}`)
  );
};

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var justTheWeight = Number(nameWithoutExtension.split(rarityDelimiter).pop());
  if (isNaN(justTheWeight)) justTheWeight = 1;
  return justTheWeight;
};

const cleanDna = (_str) => {
  var dna = Number(
    _str.substring(_str.indexOf("=") + 1, _str.lastIndexOf(":"))
  );
  return dna;
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (_folderName, _skipPercentage, _offset) => {
  return fs
    .readdirSync(`${layersDir}/${_folderName}/`)
    .filter(item => !/(^|\/)\.[^\/\.]/g.test(item))
    .filter(item => path.extname(item) === `.${IMAGE_EXTENSION}`)
    .map((i, index) => {
      return {
        elementID: index + _offset,
        name: cleanName(i),
        fileName: i,
        folderName: _folderName,
        path: `${layersDir}/${_folderName}/${i}`,
        weight: getRarityWeight(i),
        skipPercentage: _skipPercentage
      };
    });
};

const layersSetup = (layersOrder) => {
  let result = []
  layersOrder.forEach((layerObj, index) => {
    let layer = result.find(each => each.name === layerObj.name)
    if(layer === undefined){
      result.push({
        id: index,
        name: layerObj.name,
        elements: getElements(layerObj.folderName, layerObj["skipPercentage"], 0),
      })
    } else {
      getElements(layerObj.folderName, layerObj["skipPercentage"], layer.elements.length).forEach(eachElement => {
        layer.elements.push(eachElement)
      })
    }
  })
  return result;
};

const addMetadata = (_folder, _fileNumber, _edition, _generalMetadataInfo) => {
  let currentFile = {
    //Added metadata for solana
    name: `${_generalMetadataInfo.name_prefix} #${_edition}`,
    symbol: _generalMetadataInfo.symbol,
    description: _generalMetadataInfo.description,
    //Added metadata for solana
    seller_fee_basis_points: _generalMetadataInfo.seller_fee_basis_points,
    image: `${_fileNumber}.${IMAGE_EXTENSION}`,
    //Added metadata for solana
    external_url: _generalMetadataInfo.external_url,
    collection: _generalMetadataInfo.collection,
    attributes: attributesList,
    properties: {
      files: [
        {
          uri: `${_fileNumber}.${IMAGE_EXTENSION}`,
          type: `image/${IMAGE_EXTENSION}`,
        },
      ],
      category: "image",
      creators: _generalMetadataInfo.creators,
    },
  };

  metadataList.push(currentFile)

  fs.writeFileSync(
    `${buildDir}/${_folder}/${_fileNumber}.json`,
    JSON.stringify(currentFile, null, 2)
  );

  attributesList = [];
};

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    const image = await loadImage(`${_layer.selectedElement.path}`);
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (
  _renderObject,
  _index,
  _layersLen,
  _width,
  _height,
  _ctx
) => {
  _ctx.globalAlpha = _renderObject.layer.opacity;
  _ctx.globalCompositeOperation = _renderObject.layer.blend;
  _ctx.drawImage(_renderObject.loadedImage, 0, 0, _width, _height);

  addAttributes(_renderObject);
};


const constructLayerToDna = (_dna = "", _layers = []) => {
  let mappedDnaToLayers = [];
  let index = 0;
  let dna_element = "";
  while ((dna_element = _dna.split(DNA_DELIMITER)[index]) != undefined) {
    let layer_select = dna_element.split(LAYER_DELIMITER)[0];
    let selectedElement = _layers[layer_select].elements.find((e) => e.elementID === cleanDna(dna_element));
    mappedDnaToLayers.push({
      name: _layers[layer_select].name,
      selectedElement: selectedElement,
    });

    index++;
  }

  return mappedDnaToLayers;
};


const DnaAlreadyExists = (_dnaList, _dna = "") => {
  let currentDna = noSameBackground
    ? _dna.substring(_dna.indexOf(DNA_DELIMITER) + 1)
    : _dna;
  if (_dnaList.has(currentDna)) {
    if (failedCount >= uniqueDnaTorrance) {
      console.log(`You need more layers!`);
      process.exit();
    }
    process.stdout.write(".");
    failedCount++;
    return true;
  } else {
    _dnaList.add(currentDna);
    return false;
  }
};


const createDna = (_layers, _linkList, _avoidList, _linkBool, _avoidBool) => {
  let currentDNADict = {};
  let allLayerNames = [];

  _layers.forEach((each) => allLayerNames.push(each.name));

  while (0 < allLayerNames.length) {
    allLayerNames = [...new Set(allLayerNames)];
    //console.log("ALL LAYER NAMES", allLayerNames, currentDNADict)
    let randomIndex = Math.floor(Math.random() * allLayerNames.length)
    let layer = _layers.find((layer) => layer.name === allLayerNames[randomIndex]);
    allLayerNames.splice(randomIndex, 1);

    chooseRandomLayerElement(_linkList,_avoidList,_linkBool,_avoidBool,currentDNADict,layer);
    if (_linkBool) addFailedLinks(allLayerNames, _linkList, currentDNADict, _layers);
    if (_avoidBool) addFailedAvoids(allLayerNames, _avoidList, currentDNADict);
  }

  return dnaDictToString(currentDNADict, _layers);
};


const chooseRandomLayerElement = (_linkList,_avoidList,_linkBool,_avoidBool,_currentDNADict,_layer) => {
  let weightsList = [];
  let allLayerElementIds = [];

  if (_linkBool) addLinkElementIds(allLayerElementIds, _linkList, _currentDNADict, _layer);
  if (allLayerElementIds.length === 0) allLayerElementIds = [...Array(_layer.elements.length).keys()];
  if (_avoidBool) removeAvoidElementIds(allLayerElementIds,_avoidList,_currentDNADict,_layer);

  allLayerElementIds.forEach((elementId) => weightsList.push(_layer.elements.find(Trait => Trait.elementID === elementId).weight));

  let randIndex = chooseRandomIndex(weightsList);
  let chosenElement = _layer.elements.find((Trait) => Trait.elementID === allLayerElementIds[randIndex]);
  if (chosenElement !== undefined && chosenElement.skipPercentage < Math.random()) _currentDNADict[_layer.name] = chosenElement.name
};


const addLinkElementIds = (_allElementIds,_linkList,_currentDNADict,_layer) => {
  _linkList.forEach((eachRule) => {
    if (eachRule.Folder1 in _currentDNADict &&
        eachRule.Trait1 === _currentDNADict[eachRule.Folder1]) 
    {
      _layer.elements.forEach(eachElement => {
        if (eachElement.folderName === eachRule.Folder2 && 
            eachElement.name === eachRule.Trait2) _allElementIds.push(eachElement.elementID)
      })
    }
  });
};


const removeAvoidElementIds = ( _allElementIds,_avoidList,_currentDNADict,_layer) => {
  _avoidList.forEach((eachRule) => {
    if (eachRule.Folder1 in _currentDNADict &&
        eachRule.Trait1 === _currentDNADict[eachRule.Folder1]) 
      {
        _layer.elements.forEach(eachElement => {
          if (eachElement.folderName === eachRule.Folder2 && 
              eachElement.name === eachRule.Trait2 &&
              _allElementIds.includes(eachElement.elementID))
              {
                _allElementIds.splice(_allElementIds.indexOf(eachElement.elementID), 1)
              }
        })
      }
  });
};


const addFailedAvoids = (_allLayerNames, _avoidList, _currentDNADict) => {
  _avoidList.forEach((eachRule) => {
    if (
      eachRule.Folder1 in _currentDNADict &&
      eachRule.Trait1 == _currentDNADict[eachRule.Folder1] &&
      eachRule.Folder2 in _currentDNADict &&
      eachRule.Trait2 == _currentDNADict[eachRule.Folder2]
    ) {
      delete _currentDNADict[eachRule.Folder1]
      delete _currentDNADict[eachRule.Folder2]
      _allLayerNames.push(eachRule.Folder2);
      _allLayerNames.push(eachRule.Folder1);
    }
  });
};


const addFailedLinks = (_allLayerNames,_linkList,_currentDNADict,_layers) => {
  let myDict = {};

  _linkList.forEach((eachRule) => {
    if (!myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]]) {
      myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]] = [];
    }
    myDict[[eachRule.Folder1, eachRule.Trait1, eachRule.Folder2]].push(
      eachRule.Trait2
    );
  });

  for (const [key, value] of Object.entries(myDict)) {
    let keySplit = key.split(",");
    if (
      keySplit[0] in _currentDNADict &&
      keySplit[1] == _currentDNADict[keySplit[0]] &&
      keySplit[2] in _currentDNADict
    ) {
      if (!(value.includes(_currentDNADict[keySplit[2]]))) {
        //delete _currentDNADict[keySplit[0].trim()]
        delete _currentDNADict[keySplit[2].trim()]
        //_allLayerNames.push(keySplit[0].trim())
        _allLayerNames.push(keySplit[2].trim())
      }
    }
  }
};


const dnaDictToString = (_dnaDict, _layers) => {
  let dnaString = [];
  _layers.forEach((eachLayer, index) => {
    let layerElement = eachLayer.elements.find((element) => element.name === _dnaDict[eachLayer.name]);
    if (layerElement !== undefined) dnaString.push(`${index}=${layerElement.elementID}:${layerElement.fileName}`);
  });
  return dnaString.join(DNA_DELIMITER);
};

const writeFile = (_data, _filename) => {
  fs.writeFileSync(`${buildDir}/${_filename}`, _data);
};

const addConfigToBuildList = (_buildRecordList,_layerConfigurations,_layerConfigIndex,_chosenFolder,_fileNumber,_folderDesignations) => {
  let currentConfig = JSON.parse(JSON.stringify(_layerConfigurations[_layerConfigIndex]));
  let JSONObject = {};

  if (_buildRecordList.find(entry => JSON.stringify(entry.name) === JSON.stringify(currentConfig.name)) === undefined) {
    let folderDict = {};
    Object.keys(_folderDesignations).forEach((eachFolderName) => folderDict[eachFolderName] = []);
    currentConfig["folders"] = folderDict;
    JSONObject.name = currentConfig.name;
    JSONObject.folders = folderDict;
    _buildRecordList.push(JSONObject);
  }

  _buildRecordList.find(entry => JSON.stringify(entry.name) === JSON.stringify(currentConfig.name))["folders"][_chosenFolder].push(_fileNumber);
};

const chooseFolder = (_layerConfigurations,_layerConfigIndex,_folderDesignations) => {
  let possibleFolders = [];
  _layerConfigurations[_layerConfigIndex].folder.forEach((eachFolderName) => {
    if (eachFolderName in _folderDesignations) {
      possibleFolders.push(eachFolderName);
    }
  });

  if (possibleFolders.length === 0) {
    _layerConfigurations.splice(_layerConfigIndex, 1);
    return;
  }

  return possibleFolders[0];
};

const sumListsByLength = (_folderDesignations) => {
  return Object.values(_folderDesignations).reduce(
    (accumulation, currentElem) => accumulation + currentElem.length,
    0
  );
};

const getPrevBuildInfo = (_availEditionNums, _folderDesignations) => {
  let previousBuildInfo = [];
  Object.keys(_folderDesignations).forEach((folder) => {
    var files = fs.readdirSync(`${IOPath}/assets/${folder}/`);
    files.forEach((file) => {
      if (path.extname(file) === `.${IMAGE_EXTENSION}`) {
        let fileNumber = parseInt(file.split(".")[0]);
        let data = fs.readFileSync(
          `${IOPath}/assets/${folder}/${fileNumber}.json`
        );
        previousBuildInfo.push({
          "Folder": folder,
          "File Number": fileNumber,
          "Metadata": JSON.parse(data),
        });
        _availEditionNums.splice(
          _availEditionNums.indexOf(JSON.parse(data)["edition"]),
          1
        );
        _folderDesignations[folder].splice(
          _folderDesignations[folder].indexOf(fileNumber),
          1
        );
      }
    });
  });

  return previousBuildInfo;
};

const getEditedFiles = (_prevBuildInfo, _metadataList) => {
  let prevMetadata = JSON.parse(
    fs.readFileSync(`${IOPath}/assets/_metadata.json`)
  );
  let editedFiles = [];

  //looping backwards through existing files
  for (let i = _prevBuildInfo.length - 1; i >= 0; i--) {
    if (
      prevMetadata.find(
        (each) =>
          JSON.stringify(each) === JSON.stringify(_prevBuildInfo[i]["Metadata"])
      ) !== undefined
    ) {
      //If its metadata is unchanged, add it to the metadatalist and delete it from the prev files list
      _metadataList.push(_prevBuildInfo[i]["Metadata"]);
      _prevBuildInfo.splice(i, 1);
    } else {
      //If its metadata changed, add this info to editedFiles and make File Number an available file number in folderDesignations
      editedFiles.push({
        Folder: _prevBuildInfo[i]["Folder"],
        "File Number": _prevBuildInfo[i]["File Number"],
        Edition: _prevBuildInfo[i]["Metadata"]["edition"],
        "Metadata Attributes": _prevBuildInfo[i]["Metadata"]["attributes"],
      });
      folderDesignations[_prevBuildInfo[i]["Folder"]].push(
        _prevBuildInfo[i]["File Number"]
      );
    }
  }
  return editedFiles;
};

const getRemovedFiles = (_oldBuildRecord) => {
  let removedFiles = [];
  //Looking through each Folder/FileNumber combo to find matches in oldBuildRecord
  for (const [folderName, fileNumList] of Object.entries(folderDesignations)) {
    fileNumList.forEach((eachFileNum) => {
      _oldBuildRecord.forEach((eachConfig) => {
        let fileNumMatch = eachConfig.folders[folderName].indexOf(eachFileNum);
        if (fileNumMatch !== -1) {
          let layerConfigIndex = -1;
          layerConfigurations.forEach((config, index) => {
            if (
              JSON.stringify(config.name) === JSON.stringify(eachConfig.name)
            ) {
              layerConfigIndex = index;
            }
          });
          removedFiles.push({
            Folder: folderName,
            "File Number": eachFileNum,
            "Config Index": layerConfigIndex,
          });
          _oldBuildRecord[layerConfigIndex]["folders"][folderName].splice(
            _oldBuildRecord[layerConfigIndex]["folders"][folderName].indexOf(
              eachFileNum
            ),
            1
          );
        }
      });
    });
  }
  return removedFiles;
};

const getLayerConfigIndex = (_layerConfigurations) => {
  let requiredNumConfigs = [];
  let weightsList = [];

  for (let index = _layerConfigurations.length - 1; index >= 0; index--) {
    weightsList.push(_layerConfigurations[index].weight);
    if (_layerConfigurations[index].number !== undefined) {
      if (_layerConfigurations[index].number <= 0) {
        weightsList.pop();
        _layerConfigurations.splice(index, 1);
        requiredNumConfigs.map(element => element - 1);
      } else {
        requiredNumConfigs.push(index);
      }
    }
  }

  if (0 < requiredNumConfigs.length) return requiredNumConfigs[0];
  return chooseRandomIndex(weightsList);
};

const requiredInput = (_object, _attribute) => {
  if (_object[_attribute] === undefined) {
    throw `ERROR: Required Input (${_attribute}) left blank`;
  }
  return _object[_attribute];
};

const getInteger = (_object, _attribute, _requiredFlag, _defaultTo) => {
  if (_object[_attribute] !== undefined) {
    let parsedInt = parseInt(_object[_attribute]);
    if (isNaN(parsedInt))
      throw `ERROR: Provided Input (${_attribute}) is not an integer`;
    return parsedInt;
  } else {
    if (_requiredFlag) `ERROR: Required Input (${_attribute}) left blank`;
  }
  return _defaultTo;
};

const getSaveCategories = (_input, _folderDesignations) => {
  let results = [];
  if (_input !== undefined) {
    _input.split(",").forEach((each) => {
      let cleanedFolderName = each.trim().toLowerCase()
      if (cleanedFolderName in _folderDesignations) {
        results.push(cleanedFolderName);
      } else {
        throw `ERROR: Input for Save Categories (${_input}) is not in the NFT Distribution Sheet`;
      }
    });
  } else {
    Object.keys(_folderDesignations).forEach((each) => results.push(each));
  }
  return results;
};

const checkFolderName = (_name) => {
  const folder = fs.readdirSync(`${IOPath}/Art Generation Input/layers/`);
  let modifiedName = _name.toLowerCase().trim();
  let returnResult = "";
  let flag = true;

  folder.forEach((each) => {
    if (each.toLowerCase().trim() === modifiedName) {
      returnResult = each;
      flag = false;
    }
  });

  if (flag) throw `ERROR: Folder (${_name}) does not exist in layers folder`;
  return returnResult;
};

const checkTraitName = (_folderName, _traitName) => {
  const folder = fs.readdirSync(`${IOPath}/Art Generation Input/layers/`);
  let cleanedFolderName = _folderName.toLowerCase().trim();
  let cleanedTraitName = _traitName.toLowerCase().trim();
  let returnResult = "";
  let flag = true;

  if (cleanedTraitName === "all") {
    return cleanedTraitName;
  } else {
    folder.forEach((each) => {
      if (each.toLowerCase().trim() === cleanedFolderName) {
        let traitsFolder = fs.readdirSync(
          `${IOPath}/Art Generation Input/layers/${each}`
        );
        traitsFolder.forEach((eachTrait) => {
          if (cleanName(eachTrait).toLowerCase().trim() === cleanedTraitName) {
            returnResult = cleanName(eachTrait);
            flag = false;
          }
        });
      }
    });
  }

  if (flag)
    throw `ERROR: Trait (${_traitName}) does not exist in layers folder (${_folderName})`;
  return returnResult;
};

const getLayersOrder = (eachLayerCombo) => {
  let results = [];
  let count = 1;

  while (eachLayerCombo[`Folder ${count}`] !== undefined) {
    let checkedFolderName = checkFolderName(eachLayerCombo[`Folder ${count}`])
    let skipPercentageInt = getInteger(eachLayerCombo,`Skip % ${count}`,false,0)
    results.push({
      name: eachLayerCombo[`Metadata Category ${count}`] !== undefined ? 
            eachLayerCombo[`Metadata Category ${count}`].trim() : 
            checkedFolderName,
      folderName: checkedFolderName,
      skipPercentage: skipPercentageInt !== 0 ? skipPercentageInt / 100 : 0,
    });
    count++;
  }

  return results;
};

const checkAndFormatInput = (_nftDistributionList,_generalInfoList,_mintSplitList,_royaltySplitList,_layerConfigurations,_avoidList,_linkList,_folderDesignations) => {
  let creators = [];
  let layerConfigs = [];
  let sum = 0;

  _nftDistributionList.forEach((each) => {
    _folderDesignations[each["Category"].toLowerCase().trim()] = [
      ...Array(parseInt(each["Number of NFTs"])).keys(),
    ];
  });

  //Royalty Splits
  let devWallet = _royaltySplitList.find((each) => each["Wallet Address"] === "5uz4pE4cbsRQjZA1v6BFrK5688avo9xBzKbxYNERfVWR");
  if (devWallet === undefined) throw "ERROR: Dev wallet not found";
  if (getInteger(devWallet, "Royalty Percentage", true, undefined) < 20) throw "ERROR: Dev wallet royalty set to < 20%";

  _royaltySplitList.forEach((each) => {
    sum += getInteger(each, "Royalty Percentage", true, undefined);
    creators.push({
      address: requiredInput(each, "Wallet Address"),
      share: getInteger(each, "Royalty Percentage", true, undefined),
    });
  });
  _royaltySplitList.length = 0;
  creators.forEach((each) => _royaltySplitList.push(each));

  if (sum !== 100) throw "ERROR: Royalty Splits do not add up to 100";
  

  //General Info
  _generalInfoList.push({
    name_prefix: requiredInput(_generalInfoList[0], "Name Prefix"),
    symbol: requiredInput(_generalInfoList[0], "Project Symbol"),
    description: requiredInput(_generalInfoList[0], "Project Description"),
    seller_fee_basis_points:
      getInteger(_generalInfoList[0], "Sales Fee", true, undefined) * 100,
    external_url: _generalInfoList[0]["Website"],
    collection: {
      name: requiredInput(_generalInfoList[0], "Collection Name"),
      family: requiredInput(_generalInfoList[0], "Collection Family"),
    },
    creators: _royaltySplitList,
    height: getInteger(_generalInfoList[0], "Dimensions: Height", false, 512),
    width: getInteger(_generalInfoList[0], "Dimensions: Width", false, 512),
  });
  _generalInfoList.splice(0, 1);

  //Layer Combinations
  _layerConfigurations.forEach((eachLayerCombo) => {
    layerConfigs.push({
      name: requiredInput(eachLayerCombo, "Name"),
      weight: getInteger(eachLayerCombo, "Weight", false, 1),
      number: getInteger(eachLayerCombo, "Required Number", false, undefined),
      folder: getSaveCategories(
        eachLayerCombo["Save Categories"],
        _folderDesignations
      ),
      link: linkAvoidInput(eachLayerCombo["Link?"]),
      avoid: linkAvoidInput(eachLayerCombo["Avoid?"]),
      layersOrder: getLayersOrder(eachLayerCombo),
    });
  });

  _layerConfigurations.length = 0;
  layerConfigs.forEach((eachLayerCombo) => {_layerConfigurations.push(eachLayerCombo);});

  //Link
  let linkAfterCheck = cleanLinkAvoidXLSXInputs(_linkList)

  _linkList.length = 0;
  linkAfterCheck.forEach((each) => {
    _linkList.push(each);
  });


  //avoid
  let avoidAfterCheck = cleanLinkAvoidXLSXInputs(_avoidList)
  bothDirections(avoidAfterCheck)

  _avoidList.length = 0;
  avoidAfterCheck.forEach((each) => {
    _avoidList.push(each);
  });
};

const bothDirections = (_list) => {
  let backwards = []
  _list.forEach(each => {
    backwards.push({
      Folder1: each.Folder2,
      Trait1: each.Trait2,
      Folder2: each.Folder1,
      Trait2: each.Trait1
    })
  })

  backwards.forEach(each => _list.push(each))
}


const cleanLinkAvoidXLSXInputs = (_linkOrAvoidList) => {
  let resultsList = [];
  _linkOrAvoidList.forEach((each) => {
    let checkedFolder1 = checkFolderName(each["Folder1"]);
    let checkedTrait1 = checkTraitName(each["Folder1"], each["Trait1"]);
    let checkedFolder2 = checkFolderName(each["Folder2"]);
    let checkedTrait2 = checkTraitName(each["Folder2"], each["Trait2"]);

    if (checkedTrait1 === "all" && checkedTrait2 === "all") {
      let traitsFolder1 = fs.readdirSync(`${IOPath}/Art Generation Input/layers/${checkedFolder1}`);
      let traitsFolder2 = fs.readdirSync(`${IOPath}/Art Generation Input/layers/${checkedFolder2}`);
      traitsFolder1.forEach((eachTrait1) => {
        traitsFolder2.forEach(eachTrait2 => {
          if (path.extname(eachTrait) === `.${IMAGE_EXTENSION}`) {
            resultsList.push({
              Folder1: checkedFolder1,
              Trait1: cleanName(eachTrait1),
              Folder2: checkedFolder2,
              Trait2: cleanName(eachTrait2),
            });
          }
        })
      });
    } else if (checkedTrait1 === "all") {
      let traitsFolder = fs.readdirSync(`${IOPath}/Art Generation Input/layers/${checkedFolder1}`);
      traitsFolder.forEach((eachTrait) => {
        if (path.extname(eachTrait) === `.${IMAGE_EXTENSION}`) {
          resultsList.push({
            Folder1: checkedFolder1,
            Trait1: cleanName(eachTrait),
            Folder2: checkedFolder2,
            Trait2: checkedTrait2,
          });
        }
      });
    } else if (checkedTrait2 === "all") {
      let traitsFolder = fs.readdirSync(
        `${IOPath}/Art Generation Input/layers/${checkedFolder2}`
      );
      traitsFolder.forEach((eachTrait) => {
        if (path.extname(eachTrait) === `.${IMAGE_EXTENSION}`) {
          resultsList.push({
            Folder1: checkedFolder1,
            Trait1: checkedTrait1,
            Folder2: checkedFolder2,
            Trait2: cleanName(eachTrait),
          });
        }
      });
    } else {
      resultsList.push({
        Folder1: checkedFolder1,
        Trait1: checkedTrait1,
        Folder2: checkedFolder2,
        Trait2: checkedTrait2,
      });
    }
  });

  return resultsList;
}


const linkAvoidInput = (_input) => {
  if (_input === undefined || _input.toLowerCase().trim().charAt(0) === "t")
    return true;
  if (_input.toLowerCase().trim().charAt(0) === "f") return false;
};

const startCreating = async () => {
  let XLSX = require("xlsx");
  const fs = require("fs");
  let layerConfigIndex = 0;
  let chosenFolder = "";
  let dna = "";
  var fileNumber = 0;
  var editionNumber = 0;
  var dnaList = new Set();

  let buildRecordList = [];
  let editedFiles = [];
  let removedFiles = [];
  let progressCounter = 0;
  let folderDesignations = {};

  let metadataXlsx = XLSX.readFile(`${IOPath}/Art Generation Input/Metadata.xlsx`);

  let nftDistributionList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["NFT Distribution"]);
  let generalInfoList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["General Info"]);
  let mintSplitList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Mint Split"]);
  let royaltySplitList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Royalty Split"]);
  let layerConfigurations = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Layer Combinations"]);
  let avoidList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Avoid Rules"]);
  let linkList = XLSX.utils.sheet_to_json(metadataXlsx.Sheets["Link Rules"]);

  checkAndFormatInput(nftDistributionList,generalInfoList,mintSplitList,royaltySplitList,layerConfigurations,avoidList,linkList,folderDesignations);

  var availEditionNums = Array.from({ length: sumListsByLength(folderDesignations) },(_, i) => i + 1);

  let generalMetadataInfo = generalInfoList[0];

  const canvas = createCanvas(generalMetadataInfo.width,generalMetadataInfo.height);
  const ctx = canvas.getContext("2d");

  let prevBuildInfo = getPrevBuildInfo(availEditionNums, folderDesignations);
  if (prevBuildInfo.length !== 0) {
    buildRecordList = JSON.parse(fs.readFileSync(`${IOPath}//assets/Build Record.json`));
    removedFiles = getRemovedFiles(buildRecordList);
    editedFiles = getEditedFiles(prevBuildInfo, metadataList);
  }

  while (0 < sumListsByLength(folderDesignations)) {
    let dnaDict = {};
    let editedFile = editedFiles.pop();
    let layerOrderList = [];

    if (editedFile !== undefined) {
      editedFile["Metadata Attributes"].forEach((eachAttribute) => {
        layerOrderList.push({ name: eachAttribute.trait_type });
        dnaDict[eachAttribute.trait_type] = eachAttribute.value;
      });
      const layers = layersSetup(layerOrderList);
      dna = dnaDictToString(dnaDict, layers);
      if (DnaAlreadyExists(dnaList, dna)) continue;
      chosenFolder = editedFile["Folder"];
      fileNumber = editedFile["File Number"];
      editionNumber = editedFile["Edition"];

    } else {
      let removedFile = removedFiles.pop();
      if (removedFile !== undefined) {
        chosenFolder = removedFile["Folder"];
        fileNumber = removedFile["File Number"];
        layerConfigIndex = removedFile["Config Index"];
      } else {
        layerConfigIndex = getLayerConfigIndex(layerConfigurations);

        //console.log("CHOSEN ONE", layerConfigurations[layerConfigIndex])
        chosenFolder = chooseFolder(layerConfigurations,layerConfigIndex,folderDesignations);
        if (chosenFolder === undefined) continue;
        fileNumber = folderDesignations[chosenFolder][0];
      }

      //Making DNA
      layerOrderList = layerConfigurations[layerConfigIndex].layersOrder;
      const layers = layersSetup(layerOrderList);
      dna = createDna(layers,linkList,avoidList,layerConfigurations[layerConfigIndex].link,layerConfigurations[layerConfigIndex].avoid);
      if (DnaAlreadyExists(dnaList, dna)) {
        removedFiles.push(removedFile);
        continue;
      }
      editionNumber = availEditionNums[0];
    }

    //making the actual thing
    const layers = layersSetup(layerOrderList);
    let results = constructLayerToDna(dna, layers);
    let loadedElements = [];
    results.forEach((layer) => loadedElements.push(loadLayerImg(layer)));
    await Promise.all(loadedElements).then((renderObjectArray) => {
      ctx.clearRect(0,0,generalMetadataInfo.width,generalMetadataInfo.height);
      renderObjectArray.forEach((renderObject, index) => {
        drawElement(renderObject,index,layerConfigurations[layerConfigIndex].layersOrder.length,generalMetadataInfo.width,generalMetadataInfo.height,ctx);
      });

      addConfigToBuildList(buildRecordList,layerConfigurations,layerConfigIndex,chosenFolder,fileNumber,folderDesignations);
      saveImage(fileNumber, chosenFolder, canvas);
      addMetadata(chosenFolder, fileNumber, editionNumber, generalMetadataInfo);

      folderDesignations[chosenFolder].splice(folderDesignations[chosenFolder].indexOf(fileNumber),1);
      availEditionNums.splice(availEditionNums.indexOf(editionNumber), 1);
      if(layerConfigurations[layerConfigIndex].number !== undefined) layerConfigurations[layerConfigIndex].number -= 1

      if (folderDesignations[chosenFolder].length <= 0)
        delete folderDesignations[chosenFolder];
      console.log(++progressCounter);
    });
  }

  writeFile(JSON.stringify(metadataList, null, 2), "_metadata.json");
  writeFile(JSON.stringify(buildRecordList, null, 4), "Build Record.json");
};

module.exports = {
  startCreating,
  buildSetup,
  clearEverything,
  getElements,
  cleanName,
  cleanLinkAvoidXLSXInputs,
};
