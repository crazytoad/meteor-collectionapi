function CollectionAPI(options) {
  var self = this;

  self.version = '0.10';
  self._url = __meteor_bootstrap__.require('url');
  self._querystring = __meteor_bootstrap__.require('querystring');
  self._collections = {};
  self.options = {
    sslEnabled: false,
    listenPort: 3005,
    listenHost: undefined,
    authToken: undefined,
    privateKeyFile: 'privatekey.pem',
    certificateFile: 'certificate.pem'
  };
  _.extend(self.options, options || {});
};

CollectionAPI.prototype.addCollection = function(collection, path, options) {
  var self = this;

  var collectionOptions = {};
  collectionOptions[path] = {
    collection: collection,
    options: options || {}
  };
  _.extend(self._collections, collectionOptions);
};

CollectionAPI.prototype.start = function() {
  var self = this;
  var httpServer, httpOptions, scheme;

  if (self.options.sslEnabled === true) {
    scheme = 'https://';
    httpServer = __meteor_bootstrap__.require('https');
    var fs = __meteor_bootstrap__.require('fs');

    httpOptions = {
      key: fs.readFileSync(self.options.privateKeyFile),
      cert: fs.readFileSync(self.options.certificateFile)
    };
  } else {
    scheme = 'http://';
    httpServer = __meteor_bootstrap__.require('http');
  }

  self._httpServer = httpServer.createServer(httpOptions);
  self._httpServer.addListener('request', function(request, response) { new CollectionAPI._requestListener(self, request, response); });
  self._httpServer.listen(self.options.listenPort, self.options.listenHost);

  console.log('Collection API v' + self.version + ' running on ' +  scheme + (self.options.listenHost || 'localhost') + ':' + self.options.listenPort);
};

CollectionAPI.prototype._collectionOptions = function(requestPath) {
  var self = this;
  return self._collections[requestPath[1]] ? self._collections[requestPath[1]].options : undefined;
};

CollectionAPI._requestListener = function (server, request, response) {
  var self = this;

  self._server = server;
  self._request = request;
  self._response = response;

  self._requestUrl = self._server._url.parse(self._request.url);

  // Check for the X-Auth-Token header or auth-token in the query string
  self._requestAuthToken = self._request.headers['x-auth-token'] ? self._request.headers['x-auth-token'] : self._server._querystring.parse(self._requestUrl.query)['auth-token'];

  // [1] should be the collection path name
  // [2] is the _id of that collection (optional)
  self._requestPath = self._requestUrl.pathname.split('/');

  self._requestCollection = self._server._collections[self._requestPath[1]] ? self._server._collections[self._requestPath[1]].collection : undefined;

  if (!self._authenticate()) {
    return self._unauthorizedResponse('Invalid/Missing Auth Token');
  }

  if (!self._requestCollection) {
    return self._notFoundResponse('Collection Object Not Found');
  }

  return self._handleRequest();
};

CollectionAPI._requestListener.prototype._authenticate = function() {
  var self = this;
  var collectionOptions = self._server._collectionOptions(self._requestPath);

  // Check the collection's auth token
  if (collectionOptions && collectionOptions.authToken) {
    return self._requestAuthToken === collectionOptions.authToken;
  }

  // Check the global auth token
  if (self._server.options.authToken) {
    return self._requestAuthToken === self._server.options.authToken;
  }

  return true;
};

CollectionAPI._requestListener.prototype._handleRequest = function() {
  var self = this;

  if (!self._requestMethodAllowed(self._request.method)) {
    return self._notSupportedResponse();
  }

  switch (self._request.method) {
    case 'GET':
      return self._getRequest();
    case 'POST':
      return self._postRequest();
    case 'PUT':
      return self._putRequest();
    case 'DELETE':
      return self._deleteRequest();
    default:
      return self._notSupportedResponse();
  }
};

CollectionAPI._requestListener.prototype._requestMethodAllowed = function (method) {
  var self = this;
  var collectionOptions = self._server._collectionOptions(self._requestPath);

  if (collectionOptions && collectionOptions.methods) {
    return _.indexOf(collectionOptions.methods, method) >= 0;
  }

  return true;
};

CollectionAPI._requestListener.prototype._getRequest = function() {
  var self = this;

  Fiber(function() {

    try {
      // TODO: A better way to do this?
      var collection_result = self._requestPath[2] !== undefined
          ? self._requestCollection.find(self._requestPath[2])
          : self._requestCollection.find();

      var records = [];
      collection_result.forEach(function(record) {
        records.push(record);
      });

      if (records.length === 0) {
        return self._notFoundResponse('No Record(s) Found');
      }

      return self._okResponse(JSON.stringify(records));

    } catch (e) {
      return self._internalServerErrorResponse(e);
    }

  }).run();

};

CollectionAPI._requestListener.prototype._putRequest = function() {
  var self = this;

  if (! self._requestPath[2]) {
    return self._notFoundResponse('Missing _id');
  }

  var requestData = '';

  self._request.on('data', function(chunk) {
    requestData += chunk.toString();
  });

  self._request.on('end', function() {
    Fiber(function() {
      try {
        self._requestCollection.update(self._requestPath[2], JSON.parse(requestData));
      } catch (e) {
        return self._internalServerErrorResponse(e);
      }
      return self._getRequest();
    }).run();
  });

};

CollectionAPI._requestListener.prototype._deleteRequest = function() {
  var self = this;

  if (! self._requestPath[2]) {
    return self._notFoundResponse('Missing _id');
  }

  Fiber(function() {
    try {
      self._requestCollection.remove(self._requestPath[2]);
    } catch (e) {
      return self._internalServerErrorResponse(e);
    }
    return self._okResponse('');
  }).run();
}

CollectionAPI._requestListener.prototype._postRequest = function() {
  var self = this;
  var requestData = '';

  self._request.on('data', function(chunk) {
    requestData += chunk.toString();
  });

  self._request.on('end', function() {
    Fiber(function() {
      try {
        self._requestPath[2] = self._requestCollection.insert(JSON.parse(requestData));
      } catch (e) {
        return self._internalServerErrorResponse(e);
      }
      return self._createdResponse(JSON.stringify({_id: self._requestPath[2]}));
    }).run();
  });
};

CollectionAPI._requestListener.prototype._okResponse = function(body) {
  var self = this;
  self._sendResponse(200, body);
};

CollectionAPI._requestListener.prototype._createdResponse = function(body) {
  var self = this;
  self._sendResponse(201, body);
};

CollectionAPI._requestListener.prototype._notSupportedResponse = function() {
  var self = this;
  self._sendResponse(501, '');
};

CollectionAPI._requestListener.prototype._unauthorizedResponse = function(body) {
  var self = this;
  self._sendResponse(401, JSON.stringify({message: body.toString()}));
};

CollectionAPI._requestListener.prototype._notFoundResponse = function(body) {
  var self = this;
  self._sendResponse(404, JSON.stringify({message: body.toString()}));
};

CollectionAPI._requestListener.prototype._internalServerErrorResponse = function(body) {
  var self = this;
  self._sendResponse(500, JSON.stringify({error: body.toString()}));
};

CollectionAPI._requestListener.prototype._sendResponse = function(statusCode, body) {
    var self = this;
    self._response.statusCode = statusCode;
    self._response.setHeader('Content-Length', body.length);
    self._response.setHeader('Content-Type', 'application/json');
    self._response.write(body);
    self._response.end();
  };