/*eslint-env node, express*/

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require("express");
var request = require("request");
var crypto = require("crypto");

var APP_ID = process.env.APP_ID;
var APP_SECRET = process.env.APP_SECRET;
var WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const WWS_URL = "https://api.watsonwork.ibm.com";
const AUTHORIZATION_API = "/oauth/token";
var WEBHOOK_VERIFICATION_TOKEN_HEADER = "X-OUTBOUND-TOKEN".toLowerCase();

// create a new express server
var app = express();

// serve the files out of ./public as our main files
app.use(express.static(__dirname + "/public"));

function rawBody(req, res, next) {
  var buffers = [];
  req.on("data", function(chunk) {
    buffers.push(chunk);
  });
  req.on("end", function() {
    req.rawBody = Buffer.concat(buffers);
    next();
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render("error", {
    error: err
  });
}

app.use(rawBody);
app.use(errorHandler);

app.listen(process.env.PORT || 3000, () => {
  console.log("INFO: app is listening on port: " + (process.env.PORT || 3000));
});

app.post("/webhook_callback", function(req, res) {


  if (!APP_ID || !APP_SECRET || !WEBHOOK_SECRET) {
    console.log("ERROR: Missing variables APP_ID, APP_SECRET or WEBHOOK_SECRET from environment");
    return;
  }

  if (!verifySender(req.headers, req.rawBody)) {
    console.log("ERROR: Cannot verify caller! -------------");
    console.log(req.rawBody.toString());
    res.status(200).end();
    return;
  }

  var body = JSON.parse(req.rawBody.toString());
  var eventType = body.type;
  if (eventType === "verification") {
    handleVerificationRequest(res, body.challenge);
    console.log("INFO: Verification request processed");
    return;
  }

  // Acknowledge we received and processed notification to avoid getting sent the same event again
  res.status(200).end();


  if (eventType !== "message-annotation-added") {
    console.log("INFO: Skipping unwanted eventType: " + eventType);
    return;
  }

  if (body.userId === APP_ID) {
    console.log("INFO: Skipping our own message Body: " + JSON.stringify(body));
    return;
  }


  const spaceId = body.spaceId;

  var msgTitle = "";
  var msgText = "";
  var memberName = "";
  var memberId = "";

  const annotationType = body.annotationType;
  var messageId = body.messageId;
  var annotationPayload = JSON.parse(body.annotationPayload);

  // if (annotationType === "message-nlp-docSentiment") {
  //   var docSentiment = annotationPayload.docSentiment;
  //   msgTitle = "Sentiment Analysis";
  //   if (docSentiment.type === "negative" && docSentiment.score < -0.50) {
  //     msgText = " is being negative (" + docSentiment.score + ")";
  //   } else if (docSentiment.type === "positive" && docSentiment.score > 0.50) {
  //     msgText = " seems very happy ! (" + docSentiment.score + ")";
  //   } else {
  //     // If the person is neither happy nor sad then assume neutral and just return
  //     return;
  //   }
  // } else {
  //     // Skip analysis we are not interested in
  //     return;
  // }

  var jokes = [
    ['What do you call a group of unorganized cats?',
    'A CAT- astrophe!'],
    ["Why don't they play poker in the jungle?",
    'Too many cheetahs!'],
    ['What did the duck say to the bartender?',
    'Put it on my bill!'],
    ['I wonder why the baseball was getting bigger...',
    'then it hit me!'],
    ['I am reading a book about anti-gravity',
    'it is impossible to put down!']
  ];

  if (annotationType === "message-nlp-docSentiment") {
    var watson = require('watson-developer-cloud');

    var tone_analyzer = watson.tone_analyzer({
      username: process.env.TONE_ID,
      password: process.env.TONE_SECRET,
      version: 'v3',
      version_date: '2016-05-19 '
    });

    tone_analyzer.tone({ text: annotationPayload.text },
      function(err, tone) {
        if (err)
          console.log(err);
        else {
          // console.log(JSON.stringify(tone, null, 2));

          // var docSentiment = annotationPayload.docSentiment;
          // msgTitle = "Sentiment Analysis";
          // if (docSentiment.type === 'negative') {
          //   if (docSentiment.score < -0.85)
          //     msgText = 'Want some cheese with your wine?';
          //   else if (docSentiment.score < -0.80)
          //     msgText = 'Sounds like you could use a drink.';
          //   else if (docSentiment.score < -0.50) {
          //     var joke = jokes[Math.floor(Math.random() * jokes.length)];
          //     msgText = joke[0];
          //   } else
          //     return;
          //
          //   // msgText += " (" + docSentiment.score + ")";
          //
          //   if (docSentiment.score < -0.85)
          //     msgText += "\nAre y'all interested in a drink at Max's Wine Dive?";
          //   else if (docSentiment.score < -0.80)
          //     msgText += "\nAre y'all interested in a drink at Buffalo Billiards?";
          // } else if (docSentiment.type === 'positive') {
          //   if (docSentiment.score > 0.80)
          //     msgText = 'Want a cookie?';
          //   else if (docSentiment.score > 0.50)
          //     msgText = " seems very happy !";
          //   else
          //     return;
          //
          //   // msgText += " (" + docSentiment.score + ")";
          //
          //   if (docSentiment.score > 0.80)
          //     msgText += "\nAre y'all interested in eating at Voodoo Doughnut?";
          // } else {
          //   // If the person is neither happy nor sad then assume neutral and just return
          //   return;
          // }

          console.log(Object.keys(tone));

          var disgust = tone.documenttone.tonecategories[0].tones[1];
          var fear = tone.documenttone.tonecategories[0].tones[2];
          var joy = tone.documenttone.tonecategories[0].tones[3];
          var sadness = tone.documenttone.tonecategories[0].tones[4];

          switch (true) {
            case disgust > 0.75:
              msgText = 'Want some cheese with your wine?';
              msgText += "\nAre y'all interested in a drink at Max's Wine Dive?";
              break;
            case fear > 0.75:
              var joke = jokes[Math.floor(Math.random() * jokes.length)];
              msgText = joke[0];
              break;
            case joy > 0.75:
              msgText = 'Want a cookie?';
              msgText += "\nAre y'all interested in eating at Voodoo Doughnut?";
              break;
            case sadness > 0.75:
              msgText = 'Sounds like you could use a drink.';
              msgText += "\nAre y'all interested in a drink at Buffalo Billiards?";
              break;
            default:
              return;
          }


          // Build request options for authentication.
          const authenticationOptions = {
            "method": "POST",
            "url": `${WWS_URL}${AUTHORIZATION_API}`,
            "auth": {
              "user": APP_ID,
              "pass": APP_SECRET
            },
            "form": {
              "grant_type": "client_credentials"
            }
          };

          request(authenticationOptions, function(err, response, authenticationBody) {

            // If successful authentication, a 200 response code is returned
            if (response.statusCode !== 200) {
              // if our app can't authenticate then it must have been disabled.  Just return
              console.log("ERROR: App can't authenticate");
              return;
            }
            const accessToken = JSON.parse(authenticationBody).access_token;

            const GraphQLOptions = {
              "url": `${WWS_URL}/graphql`,
              "headers": {
                "Content-Type": "application/graphql",
                "x-graphql-view": "PUBLIC",
                "jwt": "${jwt}"
              },
              "method": "POST",
              "body": ""
            };

            GraphQLOptions.headers.jwt = accessToken;
            GraphQLOptions.body = "{ message (id: \"" + messageId + "\") {createdBy { displayName id}}}";

            request(GraphQLOptions, function(err, response, graphqlbody) {

              if (!err && response.statusCode === 200) {
                const bodyParsed = JSON.parse(graphqlbody);
                var person = bodyParsed.data.message.createdBy;
                memberId = person.id;
                memberName = person.displayName;
                // if (docSentiment.score > 0.50 && docSentiment.score < 0.80)
                //   msgText = memberName + msgText;

              } else {
                console.log("ERROR: Can't retrieve " + GraphQLOptions.body + " status:" + response.statusCode);
                return;
              }

              // Avoid endless loop of analysis :-)
              if (memberId !== APP_ID) {
                const appMessage = {
                  "type": "appMessage",
                  "version": "1",
                  "annotations": [{
                    "type": "generic",
                    "version": "1",

                    "title": "",
                    "text": "",
                    "color": "#ececec",
                  }]
                };

                const sendMessageOptions = {
                  "url": "https://api.watsonwork.ibm.com/v1/spaces/${space_id}/messages",
                  "headers": {
                    "Content-Type": "application/json",
                    "jwt": ""
                  },
                  "method": "POST",
                  "body": ""
                };

                sendMessageOptions.url = sendMessageOptions.url.replace("${space_id}", spaceId);
                sendMessageOptions.headers.jwt = accessToken;
                // appMessage.annotations[0].title = msgTitle;
                appMessage.annotations[0].text = msgText;
                sendMessageOptions.body = JSON.stringify(appMessage);

                sendMessage(sendMessageOptions);

                if (fear > 0.75) {
                // if (docSentiment.score < -0.50 && docSentiment.score > -0.80) {
                  appMessage.annotations[0].text = joke[1];
                  sendMessageOptions.body = JSON.stringify(appMessage);

                  setTimeout(function() {
                    sendMessage(sendMessageOptions);
                  }, 5000);
                }
              }
              else {
                console.log("INFO: Skipping sending a message of analysis of our own message " + JSON.stringify(body));
              }
            });
          });
        }
    });

  } else {
    // Skip analysis we are not interested in
    return;
  }
});



function sendMessage(messageOptions) {
  request(messageOptions, function(err, response, sendMessageBody) {

    if (err || response.statusCode !== 201) {
      console.log("ERROR: Posting to " + messageOptions.url + "resulted on http status code: " + response.statusCode + " and error " + err);
    }

  });
}

function verifySender(headers, rawbody) {
  var headerToken = headers[WEBHOOK_VERIFICATION_TOKEN_HEADER];
  var endpointSecret = WEBHOOK_SECRET;
  var expectedToken = crypto
    .createHmac("sha256", endpointSecret)
    .update(rawbody)
    .digest("hex");

  if (expectedToken === headerToken) {
    return Boolean(true);
  } else {
    return Boolean(false);
  }
}

function handleVerificationRequest(response, challenge) {
  var responseBodyObject = {
    "response": challenge
  };
  var responseBodyString = JSON.stringify(responseBodyObject);
  var endpointSecret = WEBHOOK_SECRET;

  var responseToken = crypto
    .createHmac("sha256", endpointSecret)
    .update(responseBodyString)
    .digest("hex");

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "X-OUTBOUND-TOKEN": responseToken
  });

  response.end(responseBodyString);
}
