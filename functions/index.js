'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const cors = require('cors')({origin: true});
const app = express();

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const authenticate = (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    res.status(403).send('Unauthorized');
    return;
  }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    res.status(403).send('Unauthorized');
  });
};

app.use(authenticate);
app.use(cors);

// GET /api/links/{linkId}
app.get('/links/:linkId', (req, res) => {
  // if there's an ID a specific link is retrieved
  const linkId = req.params.linkId;
  
  res.send("Get");
});

// GET /api/links/
app.get('/links/', (req, res) => {
  // if there's an ID a specific link is retrieved
  
  res.send("Get");
});

app.post('/links', (req, res) => {
  // create a new link
  /**
   * const data = {message: message, sentiment: results, category: category};
   * return admin.database().ref(`/links/${req.user.uid}/messages`).push(data);
   */
  var json = req.body;
  res.send("Post");
});

app.put('/links', (req, res) => {
  // update a link
  var json = req.body;
  res.send("Put");
});
// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.api = functions.https.onRequest(app);