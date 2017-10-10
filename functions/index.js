'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const slug = require('slug')
const cors = require('cors')({origin: '*'});
const app = express();
const print = console.log.bind(console, '>> ')

const responseHeaders = {
  'Content-Type': 'application/json', 
  'Expires': new Date(Date.now() + 345600000).toUTCString(), 
  'Cache-Control': 'must-revalidate', 
  'Cache-Control': 'no-cache', 
  'Cache-Control': 'public', 
  'Cache-Control': 'proxy-revalidate', 
  'Cache-Control': 'max-age=7200', 
  'Cache-Control': 's-maxage=7200', 
};

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

function buildStructuredData(linkData){
  return {
    "@context": "http://schema.org/",
    "@type": "Website",
    "url": linkData.url,
    "name": linkData.name,
    "image": linkData.imageUrl,
    "description": linkData.description
  };
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
      data['structuredData'] = buildStructuredData(data);
      res.statusCode = 200;
      response = data;
    }
    else {
      res.statusCode = 400;
      response = {
        msg : `Link of ID ${linkId} does not exit`
      }
    }

    res.set(responseHeaders);
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
      temp['id'] = key;
      temp['structuredData'] = buildStructuredData(temp);

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

    res.set(responseHeaders);
    res.send(JSON.stringify(linksArray));
  });
});

// POST /api/links/check/{url}
app.post('/links/check/:url', (req, res) => {
  const url = req.params.url;
  const sluggedUrl = slug(url).toLocaleLowerCase();
  admin.database().ref('/links').once('value', function(links) {
    let data = links.val();
    let response = {
      msg : `Link with url ${url} does not exit, yay, we are about to add a new link`
    };
    Object.keys(data).forEach(key => {
      let temp = data[key];
      if( sluggedUrl == temp.slug ) {
        res.statusCode = 409;
        response = {
          msg : `Link url url ${url} already exits`
        };
      }
    });
    res.set(responseHeaders);
    res.send(JSON.stringify(response));
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
        res.set(responseHeaders);
        res.send(JSON.stringify(msg));
      }
      else {
        const time = new Date();
        
        newLink.slug = slg;
        newLink.createdAt = time.toUTCString();
        newLink.status = "pendingApproval";
    
        admin.database().ref(`/links/`).push(newLink);
        
        res.statusCode = 201;
        res.set(responseHeaders);
        res.send(JSON.stringify(newLink));
      }
    });
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set(responseHeaders);
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

    res.set(responseHeaders);
    res.send(JSON.stringify(updatedLink));
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set(responseHeaders);
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
      res.set(responseHeaders);
      res.send(JSON.stringify(msg));
    });
  }
  catch(error) {
    print(error);
    res.statusCode = 500;
    res.set(responseHeaders);
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