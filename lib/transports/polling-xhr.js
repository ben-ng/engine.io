
/**
 * Module dependencies.
 */

var Polling = require('./polling');
var Transport = require('../transport');
var debug = require('debug')('engine:polling-xhr');
var zlib = require('zlib')

/**
 * Module exports.
 */

module.exports = XHR;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHR(req, opts){
  Polling.call(this, req, opts);
}

/**
 * Inherits from Polling.
 */

XHR.prototype.__proto__ = Polling.prototype;

/**
 * Overrides `onRequest` to handle `OPTIONS`..
 *
 * @param {http.ServerRequest}
 * @api private
 */

XHR.prototype.onRequest = function (req) {
  if ('OPTIONS' == req.method) {
    var res = req.res;
    var headers = this.headers(req);
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    res.writeHead(200, headers);
    res.end();
  } else {
    Polling.prototype.onRequest.call(this, req);
  }
};

/**
 * Frames data prior to write.
 *
 * @api private
 */

XHR.prototype.doWrite = function(data){
  // explicit UTF-8 is required for pages not served under utf
  var self = this;
  var isString = typeof data == 'string';
  var gzippable = false;
  var contentType = isString
    ? 'text/plain; charset=UTF-8'
    : 'application/octet-stream';
  var contentLength = '' + (isString ? Buffer.byteLength(data) : data.length);

  var headers = {
    'Content-Type': contentType,
    'Content-Length': contentLength
  };

  // prevent XSS warnings on IE
  // https://github.com/LearnBoost/socket.io/pull/1333
  var ua = this.req.headers['user-agent'];
  if (ua && (~ua.indexOf(';MSIE') || ~ua.indexOf('Trident/'))) {
    headers['X-XSS-Protection'] = '0';
  }

  if (this.gzip && this.req.headers['accept-encoding'] && this.req.headers['accept-encoding'].match(/\bgzip\b/)) {
    headers['Content-Encoding'] = 'gzip';
    gzippable = true;
  }

  // Must do this because when gzipping this.req gets cleaned up after this method exits
  var res = this.res;
  headers = this.headers(this.req, headers);

  if (gzippable) {
    zlib.gzip(data, function (err, gzipped) {
      // If error, fall back to no gzipping
      if(err) {
        delete headers['Content-Encoding'];
        res.writeHead(200, headers);
        res.end(data);
      }
      else {
        headers['Content-Length'] = gzipped.length;
        res.writeHead(200, headers);
        res.end(gzipped);
      }
    })
  }
  else {
    res.writeHead(200, headers);
    res.end(data);
  }
};

/**
 * Returns headers for a response.
 *
 * @param {http.ServerRequest} request
 * @param {Object} extra headers
 * @api private
 */

XHR.prototype.headers = function(req, headers){
  headers = headers || {};

  if (req.headers.origin) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Origin'] = req.headers.origin;
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  this.emit('headers', headers);
  return headers;
};
