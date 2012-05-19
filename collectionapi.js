(function () {

  var http = __meteor_bootstrap__.require('http');
  var url = __meteor_bootstrap__.require('url');

  http.createServer(function (req, res) {

    // [1] should be the collection variable name
    // [2] is the _id of that collection (optional)
    var collection_info = url.parse(req.url).pathname.split('/');
    
    // Make sure it looks like a variable name. I know this does not cover
    // ALL allowed variable names... but since I do an eval, I feel like
    // I have to check for at least something so it can be considered safe'ish.
    if (! collection_info[1].match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
      return notFoundResponse('Invalid Collection Name', req, res);
    }

    // eval() is icky, but I don't know how else to accomplish this.
    try {
      collection_info[1] = eval(collection_info[1]);
    } catch (e) {
      collection_info[1] = undefined;
    }

    // Do our best to ensure we have a Meteor.Collection object
    if (collection_info[1] === undefined || typeof(collection_info[1]) !== 'object' || collection_info[1]._collection === undefined) {
      return notFoundResponse('Collection Object Not Found', req, res);
    }

    handleRequest(collection_info, req, res);
        
  }).listen(3005, '127.0.0.1');

  function handleRequest(collection_info, req, res) {

    switch (req.method) {
      case 'GET':
        getRequest(collection_info, req, res);
        break;
      case 'POST':
        postRequest(collection_info, req, res);
        break;
      case 'PUT':
        putRequest(collection_info, req, res);
        break;
      case 'DELETE':
        deleteRequest(collection_info, req, res);
        break;
      default:
        notSupportedResponse(req, res);
    }

  }

  function getRequest(collection_info, req, res) {

    Fiber(function () {

      try {
        // TODO: A better way to do this?
        var collection_result = collection_info[2] !== undefined
            ? collection_info[1].find(collection_info[2])
            : collection_info[1].find();

        var records = [];
        collection_result.forEach(function (record) {
          records.push(record);
        });

        if (records.length === 0) {
          return notFoundResponse('No Record(s) Found', req, res);
        }

        okResponse(JSON.stringify(records), req, res);

      } catch (e) {
        internalServerErrorResponse(e, req, res);
      }

    }).run();

  }

  function putRequest(collection_info, req, res) {

    if (! collection_info[2]) {
      return notFoundResponse('Missing _id', req, res);
    }

    var requestData = '';

    req.on('data', function(chunk) {
      requestData += chunk.toString();
    });

    req.on('end', function() {
      Fiber(function() {
        try {
          collection_info[1].update(collection_info[2], JSON.parse(requestData));
        } catch (e) {
          return internalServerErrorResponse(e, req, res);
        }
        getRequest(collection_info, req, res);
      }).run();
    });

  }

  function deleteRequest(collection_info, req, res) {

    if (! collection_info[2]) {
      return notFoundResponse('Missing _id', req, res);
    }

    Fiber(function() {
      try {
        collection_info[1].remove(collection_info[2]);
      } catch (e) {
        return internalServerErrorResponse(e, req, res);
      }
      okResponse('', req, res);
    }).run();

  }

  function postRequest(collection_info, req, res) {

    var requestData = '';

    req.on('data', function(chunk) {
      requestData += chunk.toString();
    });

    req.on('end', function() {
      Fiber(function() {
        try {
          collection_info[2] = collection_info[1].insert(JSON.parse(requestData));
        } catch (e) {
          return internalServerErrorResponse(e, req, res);
        }
        createdResponse(JSON.stringify({_id: collection_info[2]}), req, res);
      }).run();
    });

  }

  function okResponse(body, req, res) {
    response(200, body, req, res);
  }

  function createdResponse(body, req, res) {
    response(201, body, req, res);
  }

  function notSupportedResponse(req, res) {
    response(501, '', req, res);
  }

  function notFoundResponse(msg, req, res) {
    response(404, JSON.stringify({message: msg.toString()}), req, res);
  }

  function internalServerErrorResponse(err, req, res) {
    response(500, JSON.stringify({error: err.toString()}), req, res);
  }

  function response(statusCode, body, req, res) {
    res.statusCode = statusCode;
    res.setHeader("Content-Length", body.length);
    res.setHeader("Content-Type", "application/json");
    res.write(body);
    res.end();
  }

  console.log('Collection API running at http://127.0.0.1:3005/');

})();