// Required via NODE_OPTIONS=--require before next build on Windows CI.
// NTFS junction points in the user profile (e.g. "Application Data") cannot
// be enumerated and return EPERM. webpack/glob treat that as a fatal build
// error. Patching readdir to return [] on EPERM makes them see an empty
// directory and move on, which is safe — we never need those junctions.
'use strict';
const fs = require('fs');

const _readdir = fs.readdir.bind(fs);
fs.readdir = function (path, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = undefined; }
  function wrap(err, result) {
    if (err && err.code === 'EPERM') return cb(null, []);
    cb(err, result);
  }
  return opts !== undefined ? _readdir(path, opts, wrap) : _readdir(path, wrap);
};

const _readdirSync = fs.readdirSync.bind(fs);
fs.readdirSync = function (path, opts) {
  try { return _readdirSync(path, opts); }
  catch (err) { if (err.code === 'EPERM') return []; throw err; }
};

if (fs.promises && fs.promises.readdir) {
  const _readdirP = fs.promises.readdir.bind(fs.promises);
  fs.promises.readdir = async function (path, opts) {
    try { return await _readdirP(path, opts); }
    catch (err) { if (err.code === 'EPERM') return []; throw err; }
  };
}
