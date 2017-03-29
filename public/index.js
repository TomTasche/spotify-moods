import * as mdc from './material-components-web.min.js'

import SpotifyBridge from './spotify-bridge.js'

function generate (genreQuery, dateQuery) {
  let tracksForArtist = {}
  let tracksForAlbum = {}

  var promise = SpotifyBridge.fetchUserId()
  promise = promise.then(SpotifyBridge.fetchTracks.bind(this, null, null, null))
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

  let matchingTracks = []

  promise = promise.then(function () {
    let artistIds = Object.keys(tracksForArtist)

    let promise = SpotifyBridge.fetchArtists(artistIds)
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

    let promise = SpotifyBridge.fetchAlbums(albumIds)
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
  let playlistUrl

  promise = promise.then(SpotifyBridge.createPlaylist.bind(this, playlistName))
  promise = promise.then(function (playlist) {
    playlistUrl = playlist.external_urls.spotify

    let playlistId = playlist.id

    let promise = SpotifyBridge.updatePlaylist(playlistId, matchingTracks)
    return promise
  })

  promise = promise.then(function () {
    return playlistUrl
  })

  return promise
}

mdc.autoInit()

let filters = document.getElementById('filter-fieldset')
let loginButton = document.getElementById('login-button')

if (SpotifyBridge.validateLogin()) {
  let filterForm = document.getElementById('filter-form')
  filterForm.addEventListener('submit', function (event) {
    event.preventDefault()

    let elements = event.target.elements

    let genreQuery = elements['filter-genre-input'].value
    let yearQuery = elements['filter-year-input'].value

    let promise = generate(genreQuery, yearQuery)
    promise.then(function (playlistUrl) {
      elements['mood-result-message'].textContent = 'Go listen to it here: '

      elements['mood-result-link'].href = playlistUrl
      elements['mood-result-link'].textContent = playlistUrl
    })
  })

  loginButton.disabled = true
} else {
  loginButton.addEventListener('click', SpotifyBridge.login)

  filters.disabled = true
}
