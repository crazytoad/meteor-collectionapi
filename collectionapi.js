function CollectionAPI(options) {
  var self = this;

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

  self.addCollection = function(collection, path, options) {
    collectionOptions = {}
    collectionOptions[path] = {
      collection: collection,
      options: options || {}
    };
    _.extend(self._collections, collectionOptions);
  };

  self.start = function() {
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

    self._server = httpServer.createServer(httpOptions);
    self._server.addListener('request', function(request, response) { self._requestListener(request, response) });
    self._server.listen(self.options.listenPort, self.options.listenHost);

    console.log('Collection API running on ' +  scheme + (self.options.listenHost || 'localhost') + ':' + self.options.listenPort);
  }

  self._requestListener = function(request, response) {
    self._request = request;
    self._response = response;

    self._requestUrl = self._url.parse(self._request.url);

    // Check for the X-Auth-Token header or auth-token in the query string
    self._requestAuthToken = self._request.headers['x-auth-token'] ? self._request.headers['x-auth-token'] : self._querystring.parse(self._requestUrl.query)['auth-token'];

    // [1] should be the collection path name
    // [2] is the _id of that collection (optional)
    self._requestPath = self._requestUrl.pathname.split('/');
    
    self._requestCollection = self._collections[self._requestPath[1]] ? self._collections[self._requestPath[1]].collection : undefined;

    if (!self._authenticate()) {
      return self._unauthorizedResponse('Invalid/Missing Auth Token');
    }

    if (!self._requestCollection) {
      return self._notFoundResponse('Collection Object Not Found');
    }

    return self._handleRequest();
  };

  self._authenticate = function() {
    var collectionOptions = self._requestCollectionOptions();

    // Check the collection's auth token
    if (collectionOptions && collectionOptions.authToken) {
      return self._requestAuthToken === collectionOptions.authToken;
    }

    // Check the global auth token
    if (self.options.authToken) {
      return self._requestAuthToken === self.options.authToken;
    }

    return true;
  }

  self._handleRequest = function() {

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

  }

  self._requestCollectionOptions = function() {
    return self._collections[self._requestPath[1]] ? self._collections[self._requestPath[1]].options : undefined;
  }

  self._requestMethodAllowed = function (method) {
    var collectionOptions = self._requestCollectionOptions();

    if (collectionOptions && collectionOptions.methods) {
      return _.indexOf(collectionOptions.methods, method) >= 0;
    }

    return true;
  }

  self._getRequest = function() {

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

  }

  self._putRequest = function() {

    if (! self._requestPath[2]) {
      return self._notFoundResponse('Missing _id');
    }

    var requestData = '';

    req.on('data', function(chunk) {
      requestData += chunk.toString();
    });

    req.on('end', function() {
      Fiber(function() {
        try {
          self._requestCollection.update(self._requestPath[2], JSON.parse(requestData));
        } catch (e) {
          return self._internalServerErrorResponse(e);
        }
        return self._getRequest();
      }).run();
    });

  }

  self._deleteRequest = function() {
    if (! self._requestPath[2]) {
      return self._notFoundResponse('Missing _id');
    }

    Fiber(function() {
      try {
        self._requestCollection.remove(self._requestPath[2]);
      } catch (e) {
        return self._internalServerErrorResponse(e);
      }
      okResponse('', req, res);
    }).run();
  }

  self._postRequest = function() {
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
  }

  self._okResponse = function(body) {
    self._sendResponse(200, body);
  }

  self._createdResponse = function(body) {
    self._sendResponse(201, body);
  }

  self._notSupportedResponse = function() {
    self._sendResponse(501, '');
  }

  self._unauthorizedResponse = function(body) {
    self._sendResponse(401, JSON.stringify({message: body.toString()}));
  }

  self._notFoundResponse = function(body) {
    self._sendResponse(404, JSON.stringify({message: body.toString()}));
  }

  self._internalServerErrorResponse = function(body) {
    self._sendResponse(500, JSON.stringify({error: body.toString()}));
  }

  self._sendResponse = function(statusCode, body) {
    self._response.statusCode = statusCode;
    self._response.setHeader('Content-Length', body.length);
    self._response.setHeader('Content-Type', 'application/json');
    self._response.write(body);
    self._response.end();
  }

};