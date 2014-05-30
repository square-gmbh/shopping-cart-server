var http = require('http');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var format = require('util').format;
var fs = require('fs');
var url = require('url');
var config = require('./config.json');

function connect (db, callback) {
    
    MongoClient.connect('mongodb://127.0.0.1:27017/' + db, function (err, db) {
        
        if (err) throw err;

        callback(db);

    });
}

function find (db, collection_name, query, options, callback) {
    
    var collection = db.collection(collection_name);

    if (options.limit) {
        collection.find(query).skip(options.skip).limit(options.limit).toArray(function (err, docs) {

            if (err) {
                throw err;
            }

            callback(docs);
            db.close();
        });
    } else {
        collection.find(query).toArray(function (err, docs) {

            if (err) {
                throw err;
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
    console.log("~~~ " + skip);
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

        find(db, 'scan_products', query, options, function (docs) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.end(JSON.stringify(docs)); 
        });
    
    });

});

app.post("/getMappings", function (req, res) {

    connect('scanner', function (db) {
        find(db, 'mappings', {}, {}, function (docs) {
        
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
    console.log(">>> " + pathname);
    var img = fs.readFileSync(config.thumbnails[pathname.substring(1)]);
    res.writeHead(200, {'Content-Type': 'image/gif' });
    res.end(img, 'binary');
});

app.listen(7777);
