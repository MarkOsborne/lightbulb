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
var relayr = require('relayr');

var wunderground = require('wundergroundnode');
var wuKey = 'dd5e9ed71875736c';
var wunder = new wunderground(wuKey);

var relayrKeys = {
    app_id: "c79e3440-c636-4b49-9be4-304c9e9e8abd",
//    dev_id: "00c76356-0d20-419e-a8f9-b530e405e2cc", // temp + humidity
    dev_id: "589b62ef-2e0c-4c01-9ba0-45c7f2c6be2f", // proximity
    token:  "GIWoAT8lJfWq1AC6lu2QYkQkk2_2k8cp"
};

relayr.connect(relayrKeys);

relayr.listen(function(err,data){
    if(err) {
        console.log("Error: ",err);
    } else {
        console.log(data);
    }
});

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
    console.log("URI="+uri);
    var query = urlParsed.query;
    if (uri == "/lamp") {
        if (query == "on") {
            //xbee.localCommand({
            //    command: "MY"
            //    //commandParameter: [5]
            //}).then(function (response) {
            //    console.log("good");
            //}).catch(function(response) {
            //    console.log("bad");
            //});
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
        remote = querystring.parse(query).remote;
        if(remote)
        {
          console.log("/sparkcore remote",remote);
          core1.run('remote', remote, function (core_response) {
            resp = "/sparkcore remote="+remote+" : "+core_response;
            console.log(" : " + core_response);
            response.writeHead(200);
            response.write(resp);
            response.end();
          });

        }
        else
        {
          console.log("/sparkcore led=",led);
          core1.run('led', led, function (core_response) {
            resp = "/sparkcore led="+led+" : "+core_response;
            console.log(" : " + core_response);
            response.writeHead(200);
            response.write(resp);
            response.end();
          });
        }
    }
    else
    if (uri == "/wunderground") {
        zip = querystring.parse(query).zip;
        wunder.conditions().request(zip, function(err,wuresponse) {
          icon_url = wuresponse.current_observation.icon_url;
          temp_f = wuresponse.current_observation.temp_f;
          location = wuresponse.current_observation.display_location.full;
           
          response.writeHead(200);
          response.write(
            "<p>"+location+"</p>"
            +"<img src='"+icon_url+"'/>" 
            +"<h1>"+temp_f+"</h1>"+"<br/>"
            //+JSON.stringify(wuresponse)
          );
          response.end();
        });
    }
    else
    if (uri == "/stream")
    {
        sendSSE(request,response);
    }
    else
        load_static_file(request, response);
}).listen(80);

function sendSSE(request,response)
{
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  var id = (new Date()).toLocaleTimeString();

  setInterval(function() {
    constructSSE(response, id, (new Date()).toLocaleTimeString());
  }, 5000);

  constructSSE(response, id, (new Date()).toLocaleTimeString());
}

function constructSSE(res, id, data) {
  res.write('id: ' + id + '\n');
  res.write("data: " + data + '\n\n');
}


console.log("Server running at http://localhost:80/");
console.log("Serial Port:"+ser_portname);
