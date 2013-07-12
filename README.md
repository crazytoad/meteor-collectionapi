Collection API
========

Easily perform [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) operations on Meteor Collections over HTTP/HTTPS from outside of the Meteor client or server environment.


Current version: 0.1.14  ***(Requires Meteor v0.6.0+)***


Installation
-------

### With [Metorite](https://github.com/oortcloud/meteorite)

    $ mrt add collection-api

It's that easy! Be sure to check out other cool packages over at [Atmosphere](https://atmosphere.meteor.com/).


Quick Usage
-------

```javascript
Players = new Meteor.Collection("players");

if (Meteor.isServer) {
  Meteor.startup(function () {

    // All values listed below are default
    collectionApi = new CollectionAPI({
      authToken: undefined,              // Require this string to be passed in on each request
      apiPath: 'collectionapi',          // API path prefix
      standAlone: false,                 // Run as a stand-alone HTTP(S) server
      sslEnabled: false,                 // Disable/Enable SSL (stand-alone only)
      listenPort: 3005,                  // Port to listen to (stand-alone only)
      listenHost: undefined,             // Host to bind to (stand-alone only)
      privateKeyFile: 'privatekey.pem',  // SSL private key file (only used if SSL is enabled)
      certificateFile: 'certificate.pem' // SSL certificate key file (only used if SSL is enabled)
    });

    // Add the collection Players to the API "/players" path
    collectionApi.addCollection(Players, 'players', {
      // All values listed below are default
      authToken: undefined,                   // Require this string to be passed in on each request
      methods: ['POST','GET','PUT','DELETE'],  // Allow creating, reading, updating, and deleting
      before: {  // This methods, if defined, will be called before the POST/GET/PUT/DELETE actions are performed on the collection. If the function returns false the action will be canceled, if you return true the action will take place.
        POST: undefined,  // function(obj) {return true/false;},
        GET: undefined,  // function(collectionID, objs) {return true/false;},
        PUT: undefined,  //function(collectionID, obj, newValues) {return true/false;},
        DELETE: undefined,  //function(collectionID, obj) {return true/false;}
      }
    });

    // Starts the API server
    collectionApi.start();
  });
}
```

Using the API
-------

If you specify an `authToken` it must be passed in either the `X-Auth-Token` request header or as an `auth-token` param in the query string.


### API Usage Example

```javascript
Players = new Meteor.Collection("players");

if (Meteor.isServer) {
  Meteor.startup(function () {
    collectionApi = new CollectionAPI({ authToken: '97f0ad9e24ca5e0408a269748d7fe0a0' });
    collectionApi.addCollection(Players, 'players');
    collectionApi.start();
  });
}
```

Get all of the player records:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" http://localhost:3000/collectionapi/players

Get an individual record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" http://localhost:3000/collectionapi/players/c4acddd1-a504-4212-9534-adca17af4885

Create a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -d "{\"name\": \"John Smith\"}" http://localhost:3000/collectionapi/players

Update a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X PUT -d "{\"$set\":{\"gender\":\"male\"}}" http://localhost:3000/collectionapi/players/c4acddd1-a504-4212-9534-adca17af4885

Delete a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X DELETE http://localhost:3000/collectionapi/players/c4acddd1-a504-4212-9534-adca17af4885
