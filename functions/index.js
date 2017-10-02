'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const slug = require('slug')
const cors = require('cors')({origin: '*'});
const app = express();
const print = console.log.bind(console, '>> ')
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

//app.use(authenticate);
app.use(cors);

// GET /api/links/{linkId}
app.get('/links/:linkId', (req, res) => {
  const linkId = req.params.linkId;

  admin.database().ref(`/links/${linkId}`).once('value', function(link) {
    const data = link.val();
    let response = '';
    if (data) {
      res.statusCode = 200;
      response = data;
    }
    else {
      res.statusCode = 400;
      response = {
        msg : `Link of ID ${linkId} does not exit`
      }
    }

    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(response));
  });
});

// GET /api/links/
app.get('/links/', (req, res) => {
  admin.database().ref('/links').once('value', function(links) {
    let data = links.val();

    let linksArray = [];
    Object.keys(data).forEach(key => {
      let temp = data[key];
      temp.id = key;

      delete temp.slug;

      linksArray.push(temp);
    });

    // sorting the list
    linksArray.sort(function compare(a,b) {
      if (a.name < b.name)
        return -1;
      if (a.name > b.name)
        return 1;
      return 0;
    });

    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(linksArray));
  });
});

// POST /api/links/
app.post('/links', (req, res) => {
  try {
    let newLink = req.body;
    let slg = slug(newLink.url).toLocaleLowerCase();

    admin.database().ref('/links').orderByChild("slug").equalTo(slg).once('value', function(link) {
      if(link.val()) {
        let msg = {
          message : `A link with URL: \'${newLink.url}\' already exists.`
        }
        res.statusCode = 400;
        res.set('Content-Type', "application/json");
        res.send(JSON.stringify(msg));
      }
      else {
        const time = new Date();
        
        newLink.slug = slg;
        newLink.createdAt = time.toUTCString();
        newLink.status = "pendingApproval";
    
        admin.database().ref(`/links/`).push(newLink);
        
        res.statusCode = 201;
        res.set('Content-Type', "application/json");
        res.send(JSON.stringify(newLink));
      }
    });
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(error));
  }
});

// PUT /api/links/{linkId}
app.put('/links/:linkId', (req, res) => {
  try {
    const linkId = req.params.linkId;
    const time = new Date();

    let updatedLink = req.body;
    // setting the updated time    
    updatedLink.updatedAt = time.toUTCString();
    updatedLink.id = linkId;

    admin.database().ref(`/links/${linkId}`).set(updatedLink);

    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(updatedLink));
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(error));
  }
});

// DELTE /api/links/{linkId}
app.delete('/links/:linkId', (req, res) => {
  try {
    const linkId = req.params.linkId;

    admin.database().ref(`/links/${linkId}`).remove(function() {
      res.statusCode = 200;
      let msg = {
        message: `Link with ID ${linkId} has been deleted.`
      }
      res.set('Content-Type', "application/json");
      res.send(JSON.stringify(msg));
    });
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set('Content-Type', "application/json");
    res.send(JSON.stringify(error));
  }
});


// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.api = functions.https.onRequest(app);


/**
 * name
 * description
 * url
 * imageUrl
 * status
 * timeStamp
 */