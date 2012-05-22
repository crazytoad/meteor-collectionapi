function CollectionAPI(options) {

  var self = this;

  self._url = __meteor_bootstrap__.require('url');
  self._collections = {};
  self.options = {
    sslEnabled: false,
    listenPort: 3005,
    listenHost: undefined,
    privateKeyFile: 'privatekey.pem',
    certificateFile: 'certificate.pem'
  };
  _.extend(self.options, options || {});

  self.addCollection = function() {

  };

  self.start = function() {
    var httpServer, httpOptions;

    if (self.options.sslEnabled === true) {
      httpServer = __meteor_bootstrap__.require('https');
      var fs = __meteor_bootstrap__.require('fs');

      httpOptions = {
        key: fs.readFileSync(self.options.privateKeyFile),
        cert: fs.readFileSync(self.options.certificateFile)
      };
    } else {
      httpServer = __meteor_bootstrap__.require('http');
    }

    self._server = httpServer.createServer(httpOptions);
    self._server.addListener('request', function(request, response) { self._requestListener(request, response) });
    self._server.listen(self.options.listenPort, self.options.listenHost);

    var protocol = self.options.sslEnabled ? 'https://' : 'http://';
    var host = self.options.listenHost || 'localhost';
    console.log('Collection API running on ' +  protocol + host + ':' + self.options.listenPort);
  }

  self._requestListener = function(request, response) {
    self._request = request;
    self._response = response;

    // [1] should be the collection path variable name
    // [2] is the _id of that collection (optional)
    self._requestInfo = self._url.parse(self._request.url).pathname.split('/');
    
    // Make sure it looks like a variable name. I know this does not cover
    // ALL allowed variable names... but since I do an eval, I feel like
    // I have to check for at least something so it can be considered safe'ish.
    if (! self._requestInfo[1].match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
      return self._notFoundResponse('Invalid Collection Name');
    }

    // eval() is icky, but I don't know how else to accomplish this.
    try {
      self._requestCollection = eval(self._requestInfo[1]);
    } catch (e) {
      self._requestCollection = undefined;
    }

    // Do our best to ensure we have a Meteor.Collection object
    if (self._requestCollection === undefined || typeof(self._requestCollection) !== 'object' || self._requestCollection._collection === undefined) {
      return self._notFoundResponse('Collection Object Not Found');
    }

    return self._handleRequest();
  };

  self._handleRequest = function() {

    switch (self._request.method) {
      case 'GET':
        self._getRequest();
        break;
      case 'POST':
        self._postRequest();
        break;
      case 'PUT':
        self._putRequest();
        break;
      case 'DELETE':
        self._deleteRequest();
        break;
      default:
        self._notSupportedResponse();
    }

  }

  self._getRequest = function() {

    Fiber(function () {

      try {
        // TODO: A better way to do this?
        var collection_result = self._requestInfo[2] !== undefined
            ? self._requestCollection.find(self._requestInfo[2])
            : self._requestCollection.find();

        var records = [];
        collection_result.forEach(function (record) {
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

    if (! self._requestInfo[2]) {
      return self._notFoundResponse('Missing _id');
    }

    var requestData = '';

    req.on('data', function(chunk) {
      requestData += chunk.toString();
    });

    req.on('end', function() {
      Fiber(function() {
        try {
          self._requestCollection.update(self._requestInfo[2], JSON.parse(requestData));
        } catch (e) {
          return self._internalServerErrorResponse(e);
        }
        return self._getRequest();
      }).run();
    });

  }

  self._deleteRequest = function() {
    if (! self._requestInfo[2]) {
      return self._notFoundResponse('Missing _id');
    }

    Fiber(function() {
      try {
        self._requestCollection.remove(self._requestInfo[2]);
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
          self._requestInfo[2] = self._requestCollection.insert(JSON.parse(requestData));
        } catch (e) {
          return self._internalServerErrorResponse(e);
        }
        return self._createdResponse(JSON.stringify({_id: self._requestInfo[2]}));
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