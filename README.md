Collection API
========

Easily perform [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) operations on Meteor Collections over HTTP/HTTPS from outside of the Meteor client or server environment.


Current version: 0.11


Installation
-------

Since this isn't an official Meteor smart package, you'll need to copy the collectionapi directory into the Meteor packages directory. Here's the easiest way:


Go to the Meteor packages directory (`/usr/lib/meteor/packages/` on Linux)

    $ cd /usr/local/meteor/packages/

Clone this neat repo:

    $ git clone git://github.com/crazytoad/meteor-collectionapi.git collectionapi

Go to your app directory and run:

    $ meteor add collectionapi

That's it!

Quick Usage
-------

```javascript
Players = new Meteor.Collection("players");

if (Meteor.is_server) {
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
      methods: ['POST','GET','PUT','DELETE']  // Allow creating, reading, updating, and deleting
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

if (Meteor.is_server) {
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

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -d '{"name": "John Smith"}' http://localhost:3000/collectionapi/players

Update a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X PUT -d '{"$set":{"gender":"male"}}' http://localhost:3000/collectionapi/players/c4acddd1-a504-4212-9534-adca17af4885

Delete a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X DELETE http://localhost:3000/collectionapi/players/c4acddd1-a504-4212-9534-adca17af4885
