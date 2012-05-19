Package.describe({
  summary: "CRUD operations on Collections via HTTP API"
});

Package.on_use(function (api, where) {
  api.add_files("collectionapi.js", "server");
});