/**
 * @ngdoc service
 * @name osm.oauth.osmAuthService
 * @description The main idea is use geojson object where it is possible
 * for the rest of the API (changeset, ...) it's XML2JS that is used so always expect objects.
 * @param  {any} $base64
 * @param  {any} $http
 * @param  {any} $q
 * @param  {any} osmSettingsService
 */
function osmAPI($base64, $http, $q, osmSettingsService, osmUtilsService, options) {

    this.url = options.url;
    // ------------------ CREDENTIALS -----------------

    /**
     * @ngdoc method
     * @name validateCredentials
     * @description if you don't use oauth, you can manage
     * credentials here using base64 headers
     * @methodOf osm.api.osmAPI
     * @returns {Promise} true/false
    */
    this.validateCredentials = function () {
        var deferred = $q.defer();
        this.getUserDetails().then(function (data) {
            if (data.osm.user) {
                osmSettingsService.setUserID(data.osm.user._id);
            }
            deferred.resolve(data.osm.user !== undefined);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };
    /**
     * @ngdoc method
     * @name setCredentials
     * @description if you don't use oauth, you can save
     * credentials here using base64 localstorage (completly unsecure)
     * @methodOf osm.api.osmAPI
     * @returns {string} crendentials
    */
    this.setCredentials = function (username, password) {
        osmSettingsService.setUserName(username);
        var credentials = $base64.encode(username + ':' + password);
        osmSettingsService.setCredentials(credentials);
        return credentials;
    };
    /**
     * @ngdoc method
     * @name getCredentials
     * @description if you don't use oauth, you can manage
     * credentials here using base64 headers
     * @methodOf osm.api.osmAPI
     * @returns {string} crendentials from the last set
    */
    this.getCredentials = function () {
        return osmSettingsService.getCredentials();
    };
    /**
     * @ngdoc method
     * @name getAuthorization
     * @description compute authorization header from credentials
     * @methodOf osm.api.osmAPI
     * @returns {string} HTTP Header 'Basic CREDENTIAL AS BASE64'
    */
    this.getAuthorization = function () {
        return 'Basic ' + osmSettingsService.getCredentials();
    };
    /**
     * @ngdoc method
     * @name clearCredentials
     * @description remove credentials from the localstorage
     * @methodOf osm.api.osmAPI
     * @returns {string} HTTP Header 'Basic CREDENTIAL AS BASE64'
    */
    this.clearCredentials = function () {
        osmSettingsService.setCredentials('');
    };

    /**
     * @ngdoc method
     * @name setOauth
     * @description use oauth object to call API
     * @methodOf osm.api.osmAPI
    */
    this.setOauth = function setOauth(oauth) {
        this._oauth = oauth;
    };

    /**
     * @ngdoc method
     * @name setOauth
     * @description use oauth object to call API
     * @methodOf osm.api.osmAPI
     * @return {Object} oauth
    */
    this.getOauth = function getOauth() {
        return this._oauth;
    };


    // ------------------ INTERNAL CALL SERVER (API) -----------------


    /**
     * @ngdoc method
     * @name xhr
     * @description call the API
     * @param {Object} options
     * @comment
     * ```
        var options = {
            method: 'GET' // POST, DELETE, PUT
            path: '/0.6/changesets' //without the /api,
            data: content //if you need a payload
        };
        osmAPI.xhr(options);
        ```
     * @methodOf osm.api.osmAPI
     * @return {Object} oauth
    */
    this.xhr = function (options) {
        let deferred = $q.defer();
        let promise;
        let hasOauth = this._oauth; 
        if (hasOauth) {
            options.path = '/api' + options.path;
            if (options.data) {
                options.body = options.data;
                options.data = undefined;
            }
            promise = this._oauth.xhr(options);
        } else {
            let fct = options.method.toLowerCase();
            if (options.config === undefined) {
                options.config = {};
            }
            options.config.headers = {Authorization: this.getAuthorization()};
            promise = $http[fct](options.path, options.config);
        }
        promise.then(function (data) {
            if (hasOauth) {
                deferred.resolve(osmUtilsService.x2js.dom2js(data));
            } else {
                deferred.resolve(osmUtilsService.xml2js(data.data));
            }
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    /**
     * @ngdoc method
     * @name getAuthenticated
     * @description send a get request to OSM with
     * base64 crendentials in header
     * @methodOf osm.api.osmAPI
     * @returns {Promise} $http response
    */
    this.getAuthenticated = function (method, config) {
        var _config = angular.copy(config);
        if (!_config) {
            _config = {};
        }
        _config.method = 'GET';
        _config.path = method;
        return this.xhr(_config);
    };
    /**
     * @ngdoc method
     * @name get
     * @description send a get request
     * @methodOf osm.api.osmAPI
     * @param {string} method the api method
     * @param {Object} config the $http.get config
     * @returns {Promise} $http response with XML as string
    */
    this.get = function (method, config) {
        var deferred = $q.defer();
        var self = this;
        var url = this.url + method;
        $http.get(url, config).then(function (data) {
            deferred.resolve(osmUtilsService.xml2js(data.data));
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };
    /**
     * @ngdoc method
     * @name put
     * @description send a put request
     * @methodOf osm.api.osmAPI
     * @param {string} method the api method
     * @param {Object} content payload
     * @param {Object} config the $http.put config
     * @returns {Promise} $http response
    */
    this.put = function (method, content, config) {
        var _config = angular.copy(config);
        config.method = 'PUT';
        config.path = method;
        config.data = content;
        return this.xhr(_config);
    };
    /**
     * @ngdoc method
     * @name delete
     * @description send a delete request
     * @methodOf osm.api.osmAPI
     * @param {string} method the api method
     * @param {Object} config the $http.delete config
     * @returns {Promise} $http response
    */
    this.delete = function (method, config) {
        var _config = angular.copy(config);
        config.method = 'DELETE';
        config.path = method;
        return this.xhr(_config);
    };


    // ------------------ CHANGESET -----------------


    /**
     * @ngdoc method
     * @name createChangeset
     * @methodOf osm.api.osmAPI
     * @param {string} comment the comment assiociated to the changeset
     * @returns {Promise} $http response
    */
    this.createChangeset = function (comment) {
        var deferred = $q.defer();
        var changeset = {osm: {
            changeset: {
                tag: [
                    {_k:'created_by', _v: 'Angular-OSM'},
                    {_k:'comment', _v: comment},
                ]
            }
        }};
        this.put('/0.6/changeset/create', changeset).then(function (data) {
            osmSettingsService.setChangeset(data);
            deferred.resolve(data);
        });
        return deferred.promise;
    };
    /**
     * @ngdoc method
     * @name getLastOpenedChangesetId
     * @methodOf osm.api.osmAPI
     * @returns {Promise} $http response with the last changeset id
     * or undefined if no changeset was opened
    */
    this.getLastOpenedChangesetId = function () {
        var deferred = $q.defer();
        var config = {
            params:{user: osmSettingsService.getUserID(), open: true}
        };
        this.get('/0.6/changesets', config).then(function (data) {
            var changesets = data.osm.changeset;
            if (changesets.length > 0) {
                osmSettingsService.setChangeset(changesets[0].id);
                deferred.resolve(changesets[0].id);
            }else{
                osmSettingsService.setChangeset();
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    /**
     * @ngdoc method
     * @name closeChangeset
     * @methodOf osm.api.osmAPI
     * @returns {Promise} $http.put response of
     * /0.6/changeset/CHANGESET_ID/close
    */
    this.closeChangeset = function () {
        var changeset = osmSettingsService.getChangeset();
        return this.put('/0.6/changeset/'+ changeset +'/close')
        .then(function (data) {
            osmSettingsService.setChangeset();
            return data;
        });
    };


    // ------------------ USER API -----------------

    /**
     * @ngdoc method
     * @name getUserById
     * @methodOf osm.api.osmAPI
     * @param {string} id of the user
     * @returns {Promise} $http.get response
     * /0.6/user/#id
    */
    this.getUserById = function (id) {
        return this.getAuthenticated('/0.6/user/' + id);
    };


    /**
     * @ngdoc method
     * @name getUserDetails
     * @methodOf osm.api.osmAPI
     * @returns {Promise} $http.get response
     * /0.6/user/details
    */
    this.getUserDetails = function () {
        return this.getAuthenticated('/0.6/user/details');
    };
    /**
     * @ngdoc method
     * @name getUserPreferences
     * @methodOf osm.api.osmAPI
     * @returns {Promise} $http.get response
     * /0.6/user/preferences
    */
    this.getUserPreferences = function () {
        return this.getAuthenticated('/0.6/user/preferences');
    };

    /**
     * @ngdoc method
     * @name putUserPreferences
     * @methodOf osm.api.osmAPI
     * @param {string} key the preference key
     * @param {string} value the preference value
     * @returns {Promise} $http.get response
     * /0.6/user/preferences
    */
    this.putUserPreferences = function (key, value) {
        return this.put('/0.6/user/preferences/' + key , value);
    };


    //------------------ MAP DATA -------------------------

    /**
     * @ngdoc method
     * @name getMap
     * @methodOf osm.api.osmAPI
     * @param {string} bbox left,bottom,right,top
     * where:
        left is the longitude of the left (westernmost) side of the bounding box.
        bottom is the latitude of the bottom (southernmost) side of the bounding box.
        right is the longitude of the right (easternmost) side of the bounding box.
        top is the latitude of the top (northernmost) side of the bounding box.
     * @returns {Promise} $http.get response
     * /0.6/map?bbox=bbox
    */
    this.getMap = function (bbox) {
        return this.get('/0.6/map?bbox=' + bbox);
    };

    /**
     * @ngdoc method
     * @name getMapGeoJSON
     * @methodOf osm.api.osmAPI
     * @param {string} bbox the bounding box
     * @returns {Promise} $http.get response
    */
    this.getMapGeoJSON = function (bbox) {
        var self = this;
        var deferred = $q.defer();
        self.getMap(bbox).then(function (nodes) {
            var geojsonNodes = osmUtilsService.js2geojson(nodes);
            deferred.resolve(geojsonNodes);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };


    /**
     * @ngdoc method
     * @name getNotes
     * @methodOf osm.api.osmAPI
     * @param {string} bbox left,bottom,right,top
     * where:
        left is the longitude of the left (westernmost) side of the bounding box.
        bottom is the latitude of the bottom (southernmost) side of the bounding box.
        right is the longitude of the right (easternmost) side of the bounding box.
        top is the latitude of the top (northernmost) side of the bounding box.
     * @returns {Promise} $http.get response
    */
    this.getNotes = function (bbox) {
        var url = '/0.6/notes?bbox=' + bbox;
        return this.get(url);
    };



    //------------------ ELEMENTS: Node ----------------

    /**
     * @ngdoc method
     * @name createNode
     * @methodOf osm.api.osmAPI
     * @param {Object/string} node
         var node = {osm: {node: {
            _changeset: '12', _lat: '...', _lon: '...',
            tags: [
                {_k: '...', _v: '...'}
            ]
        }}};
     * @returns {Promise} $http.put response
     * PUT /0.6/node/create
    */
    this.createNode = function (node) {
        return this.put('/0.6/node/create', node);
    };

    /**
     * @ngdoc method
     * @name getNode
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.get response
     * GET /0.6/node/#id
    */
    this.getNode = function (id) {
        return this.get('/0.6/node/' + id);
    };

    /**
     * @ngdoc method
     * @name deleteNode
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.delete response
     * DELETE /0.6/node/#id
    */
    this.deleteNode = function (id) {
        return this.delete('/0.6/node/' + id);
    };



    //------------------ ELEMENTS: WAY ----------------


    /**
     * @ngdoc method
     * @name createWay
     * @methodOf osm.api.osmAPI
     * @param {Object/string} way
        var way = {osm: {way: {
            _changeset: '12', _lat: '...', _lon: '...',
            tags: [
                {_k: '...', _v: '...'}
            ],
            nd: [
                {_ref: '123'},
                {_ref: '456'},
            ]
        }}};
     * @returns {Promise} $http.put response
     * PUT /0.6/way/create
    */
    this.createWay = function (way) {
        return this.put('/0.6/way/create', way);
    };

    /**
     * @ngdoc method
     * @name getWay
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.get response
     * GET /0.6/way/#id
    */
    this.getWay = function (id) {
        return this.get('/0.6/way/' + id);
    };

    /**
     * @ngdoc method
     * @name deleteWay
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.delete response
     * DELETE /0.6/way/#id
    */
    this.deleteWay = function (id) {
        return this.delete('/0.6/way/' + id);
    };

    //------------------ ELEMENTS: RELATION ----------------


    /**
     * @ngdoc method
     * @name createRelation
     * @methodOf osm.api.osmAPI
     * @param {Object/string} relation
        var relation = {osm: {relation: {
            _changeset: '12', _lat: '...', _lon: '...',
            tags: [
                {_k: '...', _v: '...'}
            ],
            member: [
                {_type: 'node', _role: 'stop', 'ref': '123'},
                {_type: 'way', 'ref': '234'}
            ]
        }}};
     * @returns {Promise} $http.put response
     * PUT /0.6/relation/create
    */
    this.createRelation = function (relation) {
        return this.put('/0.6/relation/create', relation);
    };

    /**
     * @ngdoc method
     * @name getRelation
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.get response
     * GET /0.6/relation/#id
    */
    this.getRelation = function (id) {
        return this.get('/0.6/relation/' + id);
    };

    /**
     * @ngdoc method
     * @name deleteRelation
     * @methodOf osm.api.osmAPI
     * @param {string} id
     * @returns {Promise} $http.delete response
     * DELETE /0.6/relation/#id
    */
    this.deleteRelation = function (id) {
        return this.delete('/0.6/relation/' + id);
    };

}

export default osmAPI;