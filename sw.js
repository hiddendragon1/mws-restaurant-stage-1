var staticCacheName = "mws-project-part1-v2";

/**
 * Install service worker and cache assets
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName)
     .then( cache => {
      return cache.addAll([
      				'/',
      				'css/styles.css',
      				'js/dbhelper.js',
      				'js/main.js',
      				'js/restaurant_info.js',
      				'index.html',
      				'/restaurant.html',
              'http://localhost:8081/restaurant.html?id=1',
      				'img/1.jpg',
      				'img/2.jpg',
      				'img/3.jpg',
      				'img/4.jpg',
      				'img/5.jpg',
      				'img/6.jpg',
      				'img/7.jpg',
      				'img/8.jpg',
      				'img/9.jpg',
      				'img/10.jpg',
      				'images/1-320_small.jpg',
      				'images/1-480_medium.jpg',
      				'images/2-320_small.jpg',
      				'images/2-480_medium.jpg',
      				'images/3-320_small.jpg',
							'images/3-480_medium.jpg',
      				'images/4-320_small.jpg',
      				'images/4-480_medium.jpg',
      				'images/5-320_small.jpg',
      				'images/5-480_medium.jpg',
      				'images/6-320_small.jpg',
      				'images/6-480_medium.jpg',
      				'images/7-320_small.jpg',
      				'images/7-480_medium.jpg',
      				'images/8-320_small.jpg',
      				'images/8-480_medium.jpg',
      				'images/9-320_small.jpg',
      				'images/9-480_medium.jpg',
      				'images/10-320_small.jpg',
      				'images/10-480_medium.jpg',
      				'data/restaurants.json',
    	      ]);
    })
  );
});


/*
 * activate service worker, get latest cache and delete old ones
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then( cacheNames => {
      return Promise.all(
        cacheNames.filter( cacheName => {
          return cacheName.startsWith('mws-project-part1-') &&
                 cacheName !== staticCacheName;
        }).map( cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});


/**
 * Intercept requests and fetch them from cache first with network fallback
 */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
      })
  );
});