const fs = require('fs');

class Storage {
  constructor(filepath) {
    this.filepath = filepath;
    this.data = this._load(); // load synchronously
  }

  _load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const fileContent = fs.readFileSync(this.filepath, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (err) {
      console.error('Error reading JSON file:', err);
    }
    return {};
  }

  _save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing JSON file:', err);
    }
  }

  get(key, defaultValue = null) {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }
}

module.exports = Storage;
