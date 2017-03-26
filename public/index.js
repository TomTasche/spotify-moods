var accessToken
var spotifyQueue = []

function login () {
  var redirectUri = 'http://localhost:8080/'

  var clientId = '7915aa4b66f84032b9c635f604e72a0a'
  var scope = 'user-read-private user-read-email playlist-modify-private user-library-read'

  var url = 'https://accounts.spotify.com/authorize'
  url += '?response_type=token'
  url += '&client_id=' + encodeURIComponent(clientId)
  url += '&scope=' + encodeURIComponent(scope)
  url += '&redirect_uri=' + encodeURIComponent(redirectUri)

  window.location.href = url
}

// taken from: https://github.com/spotify/web-api-auth-examples/blob/master/implicit_grant/public/index.html
function getHashParams () {
  var hashParams = {}
  var e, r = /([^&;=]+)=?([^&;]*)/g,
    q = window.location.hash.substring(1)
  while (e = r.exec(q)) {
    hashParams[e[1]] = decodeURIComponent(e[2])
  }
  return hashParams
}

function fetchTracks (future, tracks, offset) {
  future = future || $.Deferred()
  tracks = tracks || []
  offset = offset || 0

  let limit = 20

  var requestData = {}
  requestData.limit = limit
  requestData.offset = offset

  var requestOptions = {}
  requestOptions.url = 'https://api.spotify.com/v1/me/tracks'
  requestOptions.data = requestData

  authenticateRequest(requestOptions, accessToken)

  var promise = spotifyRequest(requestOptions)
  promise.done(function (response) {
    let newTracks = response.items
    if (newTracks.length) {
      tracks = tracks.concat(newTracks)

      let newOffset = offset + limit
      fetchTracks(future, tracks, newOffset)
    } else {
      future.resolve(tracks)
    }
  }).catch(future.reject)

  return future.promise()
}

function fetchArtists (artistIds, future, artists, offset) {
  future = future || $.Deferred()
  artists = artists || []
  offset = offset || 0

  let newOffset = offset + 20

  var requestData = {}
  requestData.ids = artistIds.slice(offset, newOffset).join(',')

  var requestOptions = {}
  requestOptions.url = 'https://api.spotify.com/v1/artists'
  requestOptions.data = requestData

  authenticateRequest(requestOptions, accessToken)

  var promise = spotifyRequest(requestOptions)
  promise.done(function (response) {
    let newArtists = response.artists
    artists = artists.concat(newArtists)

    if (newOffset < artistIds.length) {
      fetchArtists(artistIds, future, artists, newOffset)
    } else {
      future.resolve(artists)
    }
  }).catch(future.reject)

  return future.promise()
}

function authenticateRequest (requestOptions, accessToken) {
  requestOptions.headers = requestOptions.headers || {}
  requestOptions.headers['Authorization'] = 'Bearer ' + accessToken
}

function spotifyRequest (requestOptions) {
  var future = $.Deferred()

  var entry = {
    options: requestOptions,
    future: future
  }

  spotifyQueue.push(entry)

  if (spotifyQueue.length === 1) {
    inspectQueue()
  }

  return future.promise()
}

function inspectQueue () {
  if (!spotifyQueue.length) {
    return
  }

  var entry = spotifyQueue[0]

  var requestOptions = entry.options
  var future = entry.future

  var promise = $.ajax(requestOptions)
  promise.done(function (response) {
    future.resolve(response)

    spotifyQueue.shift()
    inspectQueue()
  }).catch(function (xhr) {
    var statusCode = xhr.statusCode()
    if (statusCode === 429) {
      var timeout = parseInt(xhr.getResponseHeader('Retry-After'))
      timeout = timeout || 1
      timeout = timeout * 1000

      window.setTimeout(inspectQueue, timeout)

      return
    }

    future.reject(xhr)

    spotifyQueue.shift()
    inspectQueue()
  })
}

var params = getHashParams()
accessToken = params.access_token
if (accessToken) {
  var promise = fetchTracks()
  promise = promise.then(function (tracks) {
    let artistIds = {}

    for (var i = 0; i < tracks.length; i++) {
      let track = tracks[i]
      let artistId = track.track.artists[0].id

      artistIds[artistId] = true
    }

    return Object.keys(artistIds)
  })
  promise = promise.then(fetchArtists)
  promise.then(function (artists) {
    for (var i = 0; i < artists.length; i++) {
      let artist = artists[i]
      console.log('genres for artists ' + artist.name, artist.genres)
    }
  })
} else {
  login()
}
