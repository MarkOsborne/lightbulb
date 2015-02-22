var sys = require("sys"),
    http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    util = require("util"),
    querystring = require('querystring'),
    stdio = require("stdio"),
    twilio = require('twilio')('AC7239810de85d39898d6b545a64af1c6d','242c0a1d2148bf8cc640096b05dbfa41');
var sparky = require('./sparkcore.js');
 
var core1 = new sparky({
    deviceId: '54ff6d066672524819170167',
    token: '96af3db06c5d1e8d3575c0156f9ad5bc5c1db969',
//    debug: true
});


var xbeePromise = require('./xbeepromise.js');

//args = getopt.getopt(argv, "x:", ["xbee="]);

var xbee_enabled = false;
var ser_portname = null;

var ops = stdio.getopt({
    'xbee': { key: 'x', args: 1, description: 'xbee connection: none, win, pi or serial port name' },
});


if (ops.xbee) {
    switch (ops.xbee) {
        case "pi":
            xbee_enabled = true;
            ser_portname = "/dev/ttyAMA0";
            break;
        case "win":
            xbee_enabled = true;
            ser_portname = "COM3";
            break;
        case "edison":
           xbee_enabled = true;
           ser_portname = "/dev/ttyMFD1";
           break;
        case "none":
            xbee_enabled = false;
            break;
        default:
            xbee_enabled = true;
            ser_portname = ops.xbee;
    }
};

var xbee;
if (xbee_enabled) {
    xbee = xbeePromise({
        api_mode: 2,
        serialport: ser_portname,  
        serialPortOptions: {
            baudrate: 9600
        },
        module: 'ZigBee',
        debug: true
    });
}


function load_static_file(request, response) {
    var uri = url.parse(request.url).pathname;
    var filename = path.join(process.cwd(), uri);
    fs.exists(filename, function (exists) {
        if (!exists) {
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.write("404 Not Found\n");
            response.end();
            return;
        }
        
        fs.readFile(filename, "binary", function (err, file) {
            if (err) {
                response.writeHead(500, { "Content-Type": "text/plain" });
                response.write(err + "\n");
                response.end();
                return;
            }
            
            response.writeHead(200);
            response.write(file, "binary");
            response.end();
        });
    });
}

http.createServer(function (request, response) {
    var urlParsed = url.parse(request.url);
    var uri = urlParsed.pathname;
    var query = urlParsed.query;
    if (uri == "/lamp") {
        if (query == "on") {
            xbee.localCommand({
                command: "MY"
                //commandParameter: [5]
            }).then(function (response) {
                console.log("good");
            }).catch(function(response) {
                console.log("bad");
            });
            xbee.remoteCommand({
                command: "D1",
                commandParameter: [5],
                destinationId: "Lamp Module"
            }).then(function (xbee_response) {
                response.writeHead(200);
                response.write("ON");
                response.end();
            }).catch(function (xbee_response) {
                response.writeHead(200);
                response.write("failed");
                response.end();
            });
        }
        else if (query == "off") {
            xbee.remoteCommand({
                command: "D1",
                commandParameter: [4],
                destinationId: "Lamp Module"
            }).then(function (xbee_response) {
                response.writeHead(200);
                response.write("OFF");
                response.end();
            }).catch(function (xbee_response) {
                response.writeHead(200);
                response.write("failed");
                response.end();
            });

        }
    } else
    if (uri == "/sms") {
        message = querystring.parse(query).msg;
        twilio.sendMessage({
            to: '+14253012406',
            from: '+17473008679',
            body: message
        }, function (err, responseData) { //this function is executed when a response is received from Twilio
            response.writeHead(200);
            
            if (!err) { // "err" is an error received during the request, if any
                
                // "responseData" is a JavaScript object containing data received from Twilio.
                // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
                // http://www.twilio.com/docs/api/rest/sending-sms#example-1
                
                console.log(responseData.from); // outputs "+14506667788"
                console.log(responseData.body); // outputs "word to your mother."
                response.write(util.inspect(responseData));
            }
            else
                response.write("Failed");
            
            response.end();

        });
    } 
    else
    if (uri == "/sparkcore") {
        led = querystring.parse(query).led;
        console.log("/sparkcore led=",led);
        core1.run('led', led, function (core_response) {
          resp = "/sparkcore led="+led+" : "+core_response;
          console.log(" : " + core_response);
          response.writeHead(200);
          response.write(resp);
          response.end();
        });


    }
    else
        load_static_file(request, response);
}).listen(80);

console.log("Server running at http://localhost:80/");
console.log("Serial Port:"+ser_portname);
