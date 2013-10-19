define([
    'hr/hr',
    'vendors/socket.io',
    'codebox/file',
    'codebox/shell'
], function (hr, io, File, Shell) {
    var logging = hr.Logger.addNamespace("codebox");

    var Codebox = hr.Class.extend({
        defaults: {
            'baseUrl': ""
        },

        /*
         *  Client interface to a codebox
         */
        initialize: function() {
            this.baseUrl = this.options.baseUrl;
            this.state = false;

            // Root file
            this.root = new File({
                'codebox': this
            });
            this.root.getByPath("/");

            // Connect to events
            this.listenEvents();

            return this;
        },

        /*
         *  Subscribe to events from codebox using socket.io
         */
        listenEvents: function() {
            var that = this;

            this.socket("events").done(function(socket) {
                socket.on('event', function(data) {
                    var eventName = "box:"+data.event.replace(/\./g, ":");
                    that.trigger(eventName, data);
                });
                socket.on('connect', function(data) {
                    that.setStatus(true);
                });
                socket.on('connect_failed', function(data) {
                    that.setStatus(false);
                });
                socket.on('reconnect', function(data) {
                    that.setStatus(true);
                });
                socket.on('reconnect_failed', function(data) {
                    that.setStatus(true);
                });
                socket.on('error', function(data) {
                    that.setStatus(false);
                });
                socket.on('disconnect', function(data) {
                    that.setStatus(false);
                });
            });
        },

        /*
         *  Set codebox status (working or not)
         *  
         *  @status : boolean for the status
         */
        setStatus: function(status) {
            this.status = status;
            logging.log("status ", this.status);
            this.trigger("status", status);
        },

        /*
         *  Execute a request
         *
         *  @param mode : mode "get", "post", "getJSON", "put", "delete"
         *  @param method : url for the request
         *  @args : args for the request
         */
        request: function(mode, method, args, options) {
            return hr.Requests[mode](this.baseUrl+method, args, options);
        },

        /*
         *  Execute a rpc request
         *
         *  @param method to call
         *  @args : args for the request
         */
        rpc: function(method, args, options) {
            var d = new hr.Deferred();
            this.request("getJSON", "rpc"+method, args, options).done(function(data) {
                if (!data.ok) { d.reject(data.error); }
                else { d.resolve(data.data); }
            }, function() { d.reject(); });

            return d;
        },

        /*
         *  Socket for the connexion
         *
         *  @namespace : namespace for the socket
         *  @forceCreate : force creation of a new socket
         */
        socket: function(namespace, forceCreate) {
            var d = new hr.Deferred();
            if (this.baseUrl == null) {
                d.reject();
            } else {
                var socket = io.connect([window.location.protocol, '//', window.location.host].join('')+"/"+namespace, {
                    'force new connection': forceCreate
                });

                d.resolve(socket);
            }

            return d;
        },

        /*
         *  Join the box
         */
        join: function(args) {
            var that = this;
            args = args || {};

            if (args.toJSON != null) args = args.toJSON();

            return this.rpc("/auth/join", args);
        },

        /*
         *  Get box status
         */
        status: function() {
            return this.rpc("/box/status");
        },

        /*
         *  Get list of collaborators
         */
        collaborators: function() {
            return this.rpc("/users/list");
        },

        /*
         *  Get git status
         */
        gitStatus: function() {
            return this.rpc("/git/status");
        },

        /*
         *  Get git changes
         */
        changes: function() {
            return this.rpc("/git/diff_working");
        },

        /*
         *  Get commits chages
         */
        commitsPending: function() {
            return this.rpc("/git/commits_pending");
        },

        /*
         *  Search files
         */
        searchFiles: function(q) {
            return this.rpc("/search/files", {
                "query": q
            });
        },

        /*
         *  Commit to the git workspace
         */
        commit: function(args) {
            var that = this;
            args = _.extend(args || {});
            return this.rpc("/git/commit", args);
        },

        /*
         *  Sync (pull & push) the git workspace
         */
        sync: function(args) {
            var that = this;
            args = _.extend(args || {}, {});
            return this.rpc("/git/sync", args);
        },

        /*
         *  Open a shell
         */
        openShell: function(args) {
            args = args || {};
            args.codebox = this;
            return new Shell(args);
        },

        /*
         *  Return an http proxy url
         */
        proxyUrl: function(url) {
            return this.baseUrl+"/proxy/"+encodeURIComponent(url);
        },
    });
    return Codebox;
});