var spotifyQueue = []

var accessToken
var userId

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

  authenticateRequest(requestOptions)

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

  authenticateRequest(requestOptions)

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

function fetchAlbums (albumIds, future, albums, offset) {
  future = future || $.Deferred()
  albums = albums || []
  offset = offset || 0

  let newOffset = offset + 20

  var requestData = {}
  requestData.ids = albumIds.slice(offset, newOffset).join(',')

  var requestOptions = {}
  requestOptions.url = 'https://api.spotify.com/v1/albums'
  requestOptions.data = requestData

  authenticateRequest(requestOptions)

  var promise = spotifyRequest(requestOptions)
  promise.done(function (response) {
    let newAlbums = response.albums
    albums = albums.concat(newAlbums)

    if (newOffset < albumIds.length) {
      fetchAlbums(albumIds, future, albums, newOffset)
    } else {
      future.resolve(albums)
    }
  }).catch(future.reject)

  return future.promise()
}

function authenticateRequest (requestOptions) {
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

function fetchUserId () {
  var future = $.Deferred()

  var requestOptions = {}
  requestOptions.url = 'https://api.spotify.com/v1/me'
  authenticateRequest(requestOptions)

  var promise = spotifyRequest(requestOptions)
  promise.done(function (response) {
    let userId = response.id

    future.resolve(userId)
  }).catch(future.reject)

  return future.promise()
}

function createPlaylist (name) {
  var future = $.Deferred()

  var data = {
    public: false,
    name: name
  }

  var requestOptions = {
    method: 'POST',
    url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
    data: JSON.stringify(data)
  }
  authenticateRequest(requestOptions)

  var promise = spotifyRequest(requestOptions)
  promise.done(function (response) {
    var playlistId = response.id

    future.resolve(playlistId)
  }).catch(future.reject)

  return future.promise()
}

function updatePlaylist (playlistId, tracks) {
  function updatePlaylistInternal (url, uris) {
    var future = $.Deferred()

    var data = {
      uris: uris
    }

    var requestOptions = {
      method: 'POST',
      url: url,
      data: JSON.stringify(data)
    }
    authenticateRequest(requestOptions)

    var promise = spotifyRequest(requestOptions)
    promise.done(future.resolve).catch(future.reject)

    return future.promise()
  }

  var future = $.Deferred()

  var uris = []
  for (var i = 0; i < tracks.length; i++) {
    var track = tracks[i]

    uris.push(track.uri)
  }

  var requestUrl = 'https://api.spotify.com/v1/users/' + userId + '/playlists/' + playlistId + '/tracks'

  var count = 0

  function countDown () {
    count--

    if (count === 0) {
      future.resolve()
    }
  }

  while (uris.length) {
    var urisStack = uris.splice(0, 100)

    var promise = updatePlaylistInternal(requestUrl, urisStack)
    promise.done(countDown).catch(countDown)

    count++
  }

  return future.promise()
}

let params = getHashParams()
accessToken = params.access_token
if (accessToken) {
  let genreQuery = null // e.g. 'house'
  let dateQuery = '2010-01-01'

  let tracksForArtist = {}
  let tracksForAlbum = {}
  let matchingTracks = []

  var promise = fetchUserId()
  promise = promise.then(function (userIdParameter) {
    userId = userIdParameter
  })

  promise = promise.then(fetchTracks)
  promise = promise.then(function (tracks) {
    for (var i = 0; i < tracks.length; i++) {
      let track = tracks[i].track

      let artistId = track.artists[0].id
      let artistTracks = tracksForArtist[artistId]
      if (!artistTracks) {
        artistTracks = []
        tracksForArtist[artistId] = artistTracks
      }

      artistTracks.push(track)

      let albumId = track.album.id
      let albumTracks = tracksForAlbum[albumId]
      if (!albumTracks) {
        albumTracks = []
        tracksForAlbum[albumId] = albumTracks
      }

      albumTracks.push(track)
    }
  })

  promise = promise.then(function () {
    let artistIds = Object.keys(tracksForArtist)

    let promise = fetchArtists(artistIds)
    return promise
  })
  promise = promise.then(function (artists) {
    if (!genreQuery) {
      return
    }

    for (let artistIndex = 0; artistIndex < artists.length; artistIndex++) {
      let artist = artists[artistIndex]
      let genres = artist.genres

      for (let genreIndex = 0; genreIndex < genres.length; genreIndex++) {
        let genre = genres[genreIndex]

        if (genre.indexOf(genreQuery) >= 0) {
          let tracks = tracksForArtist[artist.id]
          matchingTracks = matchingTracks.concat(tracks)

          break
        }
      }
    }
  })

  promise = promise.then(function () {
    let albumIds = Object.keys(tracksForAlbum)

    let promise = fetchAlbums(albumIds)
    return promise
  })
  promise = promise.then(function (albums) {
    if (!dateQuery) {
      return
    }

    let yearQuery = parseInt(dateQuery)

    for (let i = 0; i < albums.length; i++) {
      let album = albums[i]

      let releaseDate = album.release_date
      let releaseYear = parseInt(releaseDate.split('-')[0])
      if (releaseYear < yearQuery) {
        let tracks = tracksForAlbum[album.id]
        matchingTracks = matchingTracks.concat(tracks)
      }
    }
  })

  let queryDescription = []
  if (genreQuery) {
    queryDescription.push(genreQuery)
  }
  if (dateQuery) {
    queryDescription.push(dateQuery)
  }

  let playlistName = 'spotify-mood: ' + queryDescription.join(', ')

  promise = promise.then(createPlaylist.bind(this, playlistName))
  promise = promise.then(function (playlistId) {
    let promise = updatePlaylist(playlistId, matchingTracks)
    return promise
  })

  promise.then(console.log.bind(this, 'done'))
} else {
  login()
}
