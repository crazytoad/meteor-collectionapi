**WARNING: This is just a proof-of-concept. While it may work, it's probably very dangerous to use.**

The Goal
========

Easily perform CRUD operations over HTTP on Meteor Collections from a separate process while maintaining live page updates.

Example
=======

Say you have a collection named "Players":

    Players = new Meteor.Collection("players");

To fetch all of the player records using the Collection API:

    $ curl http://localhost:3005/Players
    
To fetch an individual record:

    $ curl http://localhost:3005/Players/c4acddd1-a504-4212-9534-adca17af4885

To add a record:

    $ curl -d '{"name": "John Smith"}' http://localhost:3005/Players

To update a record:

    $ curl -X PUT -d '{"$set":{"gender":"male"}}' http://localhost:3005/Players/c4acddd1-a504-4212-9534-adca17af4885

To remove a record:

    $ curl -X DELETE http://localhost:3005/Players/c4acddd1-a504-4212-9534-adca17af4885