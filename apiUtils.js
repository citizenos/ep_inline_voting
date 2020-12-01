'use strict';

const fs = require('fs');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const settings = require('ep_etherpad-lite/node/utils/Settings');

// ensure we have an apiKey
let apiKey = '';
try {
  apiKey = fs.readFileSync('./APIKEY.txt', 'utf8').trim();
} catch (e) {
  console.warn('Could not find APIKEY');
}

// Checks if api key is correct and prepare response if it is not.
// Returns true if valid, false otherwise.
exports.validateApiKey = (fields, res) => {
  let valid = true;

  const apiKeyReceived = fields.apikey || fields.api_key;
  if (apiKeyReceived !== apiKey) {
    res.statusCode = 401;
    res.json({code: 4, message: 'no or wrong API Key', data: null});
    valid = false;
  }

  return valid;
};

const isValid = (originalFields, fieldName) => (typeof originalFields[fieldName] !== 'undefined');

// Checks if required fields are present, and prepare response if any of them
// is not. Returns true if valid, false otherwise.
exports.validateRequiredFields = (originalFields, requiredFields, res) => {
  for (const i of requiredFields) {
    const requiredField = requiredFields[i];
    if (!isValid(originalFields, requiredField)) {
      const errorMessage = `${requiredField} is required`;
      res.json({code: 1, message: errorMessage, data: null});
      return false;
    }
  }
  return true;
};

// Sanitizes pad id and returns it:
exports.sanitizePadId = (req) => {
  let padIdReceived = req.params.pad;
  padManager.sanitizePadId(padIdReceived, (padId) => {
    padIdReceived = padId;
  });

  return padIdReceived;
};

// Builds url for message broadcasting, based on settings.json and on the
// given endPoint:
exports.broadcastUrlFor = (endPoint) => {
  let url = '';
  if (settings.ssl) {
    url += 'https://';
  } else {
    url += 'http://';
  }
  url += `${settings.ip}:${settings.port}${endPoint}`;

  return url;
};
