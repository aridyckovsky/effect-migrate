const fs = require("fs");
const path = require("path");

module.exports = {
  readConfig: function() {
    return JSON.parse(fs.readFileSync("config.json"));
  },
};
