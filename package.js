Package.describe({
  summary: "CRUD operations on Collections via HTTP/HTTPS API"
});

Package.on_use(function (api, where) {
  api.use('routepolicy', 'server');
  api.use('webapp', 'server');
  api.add_files("collectionapi.js", "server");
  api.export("CollectionAPI", "server");
});