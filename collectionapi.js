CollectionAPI = function(options) {
  var self = this;

  self.version = '0.1.12';
  self._url = Npm.require('url');
  self._querystring = Npm.require('querystring');
  self._collections = {};
  self.options = {
    apiPath: 'collectionapi',
    standAlone: false,
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

  var startupMessage = 'Collection API v' + self.version;

  if (self.options.standAlone === true) {
    if (self.options.sslEnabled === true) {
      scheme = 'https://';
      httpServer = Npm.require('https');
      var fs = Npm.require('fs');

      httpOptions = {
        key: fs.readFileSync(self.options.privateKeyFile),
        cert: fs.readFileSync(self.options.certificateFile)
      };
    } else {
      scheme = 'http://';
      httpServer = Npm.require('http');
    }

    self._httpServer = httpServer.createServer(httpOptions);
    self._httpServer.addListener('request', function(request, response) { new CollectionAPI._requestListener(self, request, response); });
    self._httpServer.listen(self.options.listenPort, self.options.listenHost);
    console.log(startupMessage + ' running as a stand-alone server on ' +  scheme + (self.options.listenHost || 'localhost') + ':' + self.options.listenPort + '/' + (self.options.apiPath || ''));
  } else {
    var route = "/" + this.options.apiPath;

    // I really wish I could call .use(), but I need this to be at the
    // beginning of the stack so it runs before Meteor's handler
    __meteor_bootstrap__.app.stack.unshift({
      route: route,
      handle: function(request, response) { new CollectionAPI._requestListener(self, request, response); }
    });
    console.log(startupMessage + ' running at ' + route);
  }
};

CollectionAPI.prototype._collectionOptions = function(requestPath) {
  var self = this;
  return self._collections[requestPath.collectionPath] ? self._collections[requestPath.collectionPath].options : undefined;
};

CollectionAPI._requestListener = function (server, request, response) {
  var self = this;

  self._server = server;
  self._request = request;
  self._response = response;

  self._requestUrl = self._server._url.parse(self._request.url);

  // Check for the X-Auth-Token header or auth-token in the query string
  self._requestAuthToken = self._request.headers['x-auth-token'] ? self._request.headers['x-auth-token'] : self._server._querystring.parse(self._requestUrl.query)['auth-token'];

  if (self._server.options.standAlone === true && self._server.options.apiPath) {
    var requestPath = self._requestUrl.pathname.split('/').slice(2,4);
  } else {
    var requestPath = self._requestUrl.pathname.split('/').slice(1,3);
  }

  self._requestPath = {
    collectionPath: requestPath[0],
    collectionId: requestPath[1]
  };

  self._requestCollection = self._server._collections[self._requestPath.collectionPath] ? self._server._collections[self._requestPath.collectionPath].collection : undefined;

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
      var collection_result = self._requestPath.collectionId !== undefined
          ? self._requestCollection.find(self._requestPath.collectionId)
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

  if (! self._requestPath.collectionId) {
    return self._notFoundResponse('Missing _id');
  }

  var requestData = '';

  self._request.on('data', function(chunk) {
    requestData += chunk.toString();
  });

  self._request.on('end', function() {
    Fiber(function() {
      try {
        self._requestCollection.update(self._requestPath.collectionId, JSON.parse(requestData));
      } catch (e) {
        return self._internalServerErrorResponse(e);
      }
      return self._getRequest();
    }).run();
  });

};

CollectionAPI._requestListener.prototype._deleteRequest = function() {
  var self = this;

  if (! self._requestPath.collectionId) {
    return self._notFoundResponse('Missing _id');
  }

  Fiber(function() {
    try {
      self._requestCollection.remove(self._requestPath.collectionId);
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
        self._requestPath.collectionId = self._requestCollection.insert(JSON.parse(requestData));
      } catch (e) {
        return self._internalServerErrorResponse(e);
      }
      return self._createdResponse(JSON.stringify({_id: self._requestPath.collectionId}));
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