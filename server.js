var http = require('http');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var format = require('util').format;
var fs = require('fs');
var url = require('url');
var config = require('./config.json');
var ACTIVE_COL;

// log API init
var log = {
    filename: '',
    activeFile: '',
    flag: 'w+',
    file: null,
    mode: 0666,
    encoding: 'utf8',

    write: function (string) {

        // create file if it does not exist
        if (this.file == null || this.activeFile !== this.filename) {
            this.file = fs.openSync('apps/shopping-cart-server/logs/' + this.filename, this.flag, this.mode);
            this.activeFile = this.filename;

            // insert the log in mongo
            var data = {
                filename: this.filename,
                location: 'apps/shopping-cart-server/logs/' + this.filename,
                log: 'server'
            };

            connect('scanner', function (db) {
                var updateObj = {
                    data: {
                       $set: data
                    },
                    query: {
                        filename: this.filename
                    },
                    options: {
                        upsert: true
                    }
                }

                // prevent log duplicates
                update(db, 'logs', updateObj, function (err) {

                    // handle error
                    if (err) {
                        var errObj = {
                            err: err,
                            date: new Date()
                        }      
                        // build the error log
                        buildError(errObj);
                    }
                });
            });
        }

        if (string instanceof String) { string = string.toString(); }
        if (typeof string != "string") { string = JSON.stringify( string ); }
        
        var buffer = new Buffer(string, this.encoding);
        fs.writeSync(this.file, buffer, 0, buffer.length);

        return this;
    },
    close: function () {
        if (this.file) {
            fs.close(this.file);
        }

        return this;
    }
}

function formatDate (date) {

    if (!date) { return; }

    var result = ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear() + '_' + ('0' + (date.getHours())).slice(-2) + ':' + ('0' + (date.getMinutes() + 1)).slice(-2);
    return result;
}


/* function that builds errors and logs them 
*
*   errObj = {
*       err: ...,
*       date: ...
*   }
*/
function buildError (errObj) {

    if (!errObj) { return; }

    var logLine = '| ' + formatDate(errObj.date) + ' |[ERROR] - ';
    logLine += errObj.err + ' |§';

    console.log(logLine);
    log.write(logLine);
}

/* function that builds logs and logs them 
*
*   logObj = {
*       log: ...,
*       date: ...
*   }
*/
function buildLog (logObj) {

    if (!logObj) { return; }

    var logLine = '| ' + formatDate(logObj.date) + ' |[LOG] - ';
    logLine += logObj.log + ' |§';

    console.log(logLine);
    log.write(logLine);
}

function connect (db, callback) {
    
    MongoClient.connect('mongodb://127.0.0.1:27017/' + db, function (err, db) {
        
        if (err) {
            var errObj = {
                err: err,
                date: new Date()
            }
            // build the error log
            buildError(errObj);

            return;
        }

        callback(db);
    });
}

function update (db, collection_name, obj, callback) {

    if (!obj) { callback('no DATA!'); return; }
    if (!db) { callback('no DB'); return; }

    //get the collection
    var collection = db.collection(collection_name);

    //update the data
    collection.update(obj.query, obj.data, obj.options, function (err, docs) {

        if (err) callback(err);

        // update complete
        callback (null);
    });
}

function find (db, collection_name, query, options, callback) {
    
    var collection = db.collection(collection_name);

    if (options.limit) {
        collection.find(query).skip(options.skip).limit(options.limit).toArray(function (err, docs) {

            if (err) {
                var errObj = {
                    err: err,
                    date: new Date()
                }
                // build the error log
                buildError(errObj);

                return;
            }

            callback(docs);
            db.close();
        });
    } else {
        collection.find(query).toArray(function (err, docs) {

            if (err) {
                var errObj = {
                    err: err,
                    date: new Date()
                }
                // build the error log
                buildError(errObj);

                return;
            }

            callback(docs);
            db.close();
        });
    }
}

app.configure(function () {
    app.use(express.bodyParser());
    app.use(express.logger("short"));
});

app.post("/", function (req, res) {
    
    var subclass = req.body.subclass;
    var itemClass = req.body["class"];
    var skip = req.body.skip || 0;

    // limit
    var limit = config.limit;

    var db = 'scanner';
   
    var query = {
        'class_id': itemClass,
        'subclass_id': subclass
    };

    var options = {
        'limit': limit,
        'skip': parseInt(skip)
    };

    connect(db, function (db) {

        find(db, 'scan_products_' + ACTIVE_COL, query, options, function (docs) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.end(JSON.stringify(docs)); 
        });
    
    });

});

app.post("/getMappings", function (req, res) {
    var date = new Date();
    log.filename = 'server_log_' + formatDate(date) + '.txt';
    ACTIVE_COL = ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();

    connect('scanner', function (db) {
        find(db, 'mappings_' + ACTIVE_COL, {}, {}, function (docs) {
        
            for (var i in docs) {
                docs[i].colors = config.backgrounds[docs[i].class_id];
            }

            //console.log(docs);

            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.end(JSON.stringify(docs));
	    });
    });

});

app.get("*", function (req, res) {
    var request = url.parse(req.url, true);
    var pathname = request.pathname.toString();

    var img = fs.readFileSync(config.thumbnails[pathname.substring(1)]);
    res.writeHead(200, {'Content-Type': 'image/gif' });
    res.end(img, 'binary');
});

// init the log file
var date = new Date();
log.filename = 'server_log_' + formatDate(date) + '.txt';
ACTIVE_COL = ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();

app.listen(7777);
