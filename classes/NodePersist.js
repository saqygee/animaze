const path = require('path');
const storage = require('node-persist');

class StorageService {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await storage.init({ dir: this.storageDir });
      this.initialized = true;
    }
  }

  async set(key, value) {
    await this.init();
    return await storage.setItem(key, value);
  }

  async get(key) {
    await this.init();
    return await storage.getItem(key);
  }

  async remove(key) {
    await this.init();
    return await storage.removeItem(key);
  }

  async clear() {
    await this.init();
    return await storage.clear();
  }

  async keys() {
    await this.init();
    return await storage.keys();
  }

  async values() {
    await this.init();
    const keys = await this.keys();
    const result = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result;
  }
}

module.exports = StorageService;
