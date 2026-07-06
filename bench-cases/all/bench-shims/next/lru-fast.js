export class LRUCache {
  constructor(limit) {
    this.limit = limit;
    this.size = 0;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    const oldValue = this.get(key);
    this.map.set(key, value);
    this.size = this.map.size;
    if (this.size > this.limit) {
      this.shift();
    }
    return oldValue;
  }

  put(key, value) {
    this.set(key, value);
    return undefined;
  }

  remove(key) {
    const value = this.map.get(key);
    this.map.delete(key);
    this.size = this.map.size;
    return value;
  }

  shift() {
    const first = this.map.keys().next();
    if (first.done) {
      return undefined;
    }
    const key = first.value;
    const value = this.map.get(key);
    this.map.delete(key);
    this.size = this.map.size;
    return { key, value };
  }

  removeAll() {
    this.map.clear();
    this.size = 0;
  }

  keys() {
    return [...this.map.keys()];
  }

  forEach(callback, context) {
    for (const [key, value] of this.map) {
      callback.call(context ?? this, key, value, this);
    }
  }

  toJSON() {
    return [...this.map].map(([key, value]) => ({ key, value }));
  }
}

export default LRUCache;
