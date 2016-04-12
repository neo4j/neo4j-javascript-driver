//
// Externs for Closure Compiler
// https://developers.google.com/closure/compiler/
//
// Usage:
//   java -jar compiler.jar \
//     --jscomp_warning reportUnknownTypes \
//     --warning_level VERBOSE \
//     --summary_detail_level 3 \
//     --externs util/externs.js \
//     lib/encoding.js
//

/**
 * @param {string} name
 * @return {*}
 */
function require(name) {}

/**
 * @type {Object}
 */
var module;

/**
 * @type {Object.<string,*>}
 */
module.exports;
