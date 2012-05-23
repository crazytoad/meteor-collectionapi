Collection API
========

Easily perform [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) operations over HTTP/HTTPS on Meteor Collections from outside of the Meteor client or server environment.


Installation
-------

*coming soon*


Quick Usage
-------

```javascript
Players = new Meteor.Collection("players");

if (Meteor.is_server) {
  Meteor.startup(function () {

    // All values listed below are default
    collectionApi = new CollectionAPI({
      sslEnabled: false,                 // Disable/Enable SSL
      listenPort: 3005,                  // Port to listen to
      listenHost: undefined,             // Host to bind to (undefined binds to all hosts)
      authToken: undefined,              // Require this string to be passed in on each request
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

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" http://localhost:3005/players

Get an individual record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" http://localhost:3005/players/c4acddd1-a504-4212-9534-adca17af4885

Create a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -d '{"name": "John Smith"}' http://localhost:3005/players

Update a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X PUT -d '{"$set":{"gender":"male"}}' http://localhost:3005/players/c4acddd1-a504-4212-9534-adca17af4885

Delete a record:

    $ curl -H "X-Auth-Token: 97f0ad9e24ca5e0408a269748d7fe0a0" -X DELETE http://localhost:3005/players/c4acddd1-a504-4212-9534-adca17af4885
