export const constants = {};
export const sep = "/";
export const delimiter = ":";
export const EOL = "\n";

export function arch() {
  return "x64";
}

export function basename(value) {
  return value;
}

export function cpus() {
  return [];
}

export function dirname() {
  return "";
}

export function endianness() {
  return "LE";
}

export function extname() {
  return "";
}

export function format(value) {
  return String(value ?? "");
}

export function freemem() {
  return 0;
}

export function homedir() {
  return "/";
}

export function join(...parts) {
  return parts.filter(Boolean).join("/");
}

export function normalize(value) {
  return value;
}

export function parse() {
  return {};
}

export function platform() {
  return "browser";
}

export function randomBytes(size = 0) {
  return new Uint8Array(size);
}

export function relative(_from, to) {
  return to;
}

export function release() {
  return "";
}

export function resolve(...parts) {
  return join(...parts);
}

export function tmpdir() {
  return "/tmp";
}

export function totalmem() {
  return 0;
}

export function type() {
  return "Browser";
}

export function userInfo() {
  return {
    gid: -1,
    homedir: "/",
    shell: null,
    uid: -1,
    username: "bench"
  };
}

export function createHash() {
  return {
    update() {
      return this;
    },
    digest() {
      return "";
    }
  };
}

export default {
  arch,
  basename,
  constants,
  cpus,
  createHash,
  delimiter,
  dirname,
  endianness,
  EOL,
  extname,
  format,
  freemem,
  homedir,
  join,
  normalize,
  parse,
  platform,
  randomBytes,
  relative,
  release,
  resolve,
  sep,
  tmpdir,
  totalmem,
  type,
  userInfo
};
